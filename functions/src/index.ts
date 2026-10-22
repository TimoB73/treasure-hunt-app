import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'
import {
  ADMINS,
  ALLOWLIST,
  MAX_HUNTS_PER_MONTH,
  assertAdmin,
  assertCanCreate,
  normalizeEmail,
  type Caller,
} from './access.js'
import { UserFacingError, missingSecret } from './errors.js'
import { distanceMeters } from './geo.js'
import { fetchDistanceMatrix } from './ors.js'
import { buildOverpassQuery, extractPois, fetchOverpass, isNearMajorRoad, thinOut } from './poi.js'
import { assertFeasible, planBudget, searchArea, seededRandom, selectRoute } from './route.js'
import { generateStory, type StationFacts } from './story.js'
import { huntParamsSchema, type HuntDoc, type HuntParams, type Poi } from './types.js'
import { fetchWikipediaExtract } from './wikipedia.js'

initializeApp()
setGlobalOptions({ region: 'europe-west3', maxInstances: 3 })

const anthropicKey = defineSecret('ANTHROPIC_API_KEY')
const orsKey = defineSecret('OPENROUTESERVICE_API_KEY')

/** Sicherheitsnetz gegen Kostenexplosion: so viele Jagden pro Tag insgesamt (Admins ausgenommen) */
const MAX_HUNTS_PER_DAY = 30
/** Höchstens so viele Kandidaten gehen in die Distanzmatrix (OpenRouteService erlaubt 3500 Zellen) */
const MAX_CANDIDATES = 40
const GEOFENCE_RADIUS_M = 30

/** Wandelt UserFacingError in eine HttpsError mit reason/action fürs Frontend um */
function toHttpsError(error: unknown, context: string): HttpsError {
  if (error instanceof HttpsError) return error
  if (error instanceof UserFacingError) {
    console.warn(`${context}: ${error.reason}`, error.message)
    return new HttpsError(error.code, error.message, { reason: error.reason, action: error.action })
  }
  console.error(`${context}: unerwarteter Fehler`, error)
  return new HttpsError('internal', 'Es ist ein unerwarteter Fehler aufgetreten.', {
    reason: 'unknown',
    action: 'Erneut versuchen. Bleibt der Fehler, in den Function-Logs nachsehen (firebase functions:log).',
  })
}

/** Liest Anmeldestatus, Admin-Rolle und Freischaltung der anfragenden Person – ausschließlich serverseitig */
async function getCaller(request: CallableRequest): Promise<Caller> {
  if (!request.auth) {
    throw new UserFacingError('unauthenticated', 'not_signed_in', 'Bitte zuerst anmelden.')
  }
  const { uid, token } = request.auth
  const email = typeof token.email === 'string' ? normalizeEmail(token.email) : null
  const db = getFirestore()
  const [admin, allowed] = await Promise.all([
    db.collection(ADMINS).doc(uid).get(),
    email ? db.collection(ALLOWLIST).doc(email).get() : null,
  ])
  return {
    uid,
    email,
    emailVerified: token.email_verified === true,
    provider: token.firebase?.sign_in_provider ?? 'unknown',
    isAdmin: admin.exists,
    isAllowed: allowed?.exists ?? false,
  }
}

const monthKey = () => new Date().toISOString().slice(0, 7)

async function huntsThisMonth(uid: string): Promise<number> {
  const snap = await getFirestore().doc(`usage/user_${uid}_${monthKey()}`).get()
  return snap.get('count') ?? 0
}

/** Konto-Status für die App: angemeldet, bestätigt, freigeschaltet, Admin, Kontingent */
export const getAccount = onCall(async (request) => {
  try {
    const caller = await getCaller(request)
    return {
      uid: caller.uid,
      email: caller.email,
      emailVerified: caller.emailVerified,
      isAdmin: caller.isAdmin,
      isAllowed: caller.isAllowed || caller.isAdmin,
      huntsThisMonth: await huntsThisMonth(caller.uid),
      monthlyLimit: caller.isAdmin ? null : MAX_HUNTS_PER_MONTH,
    }
  } catch (error) {
    throw toHttpsError(error, 'getAccount')
  }
})

const allowlistRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }),
  z.object({ action: z.literal('add'), email: z.email() }),
  z.object({ action: z.literal('remove'), email: z.string().min(1) }),
])

/** Gästeliste verwalten – nur für Admins */
export const manageAllowlist = onCall(async (request) => {
  try {
    const caller = await getCaller(request)
    assertAdmin(caller)
    const parsed = allowlistRequest.safeParse(request.data)
    if (!parsed.success) {
      throw new UserFacingError('invalid-argument', 'invalid_email', 'Das ist keine gültige E-Mail-Adresse.')
    }
    const col = getFirestore().collection(ALLOWLIST)
    const req = parsed.data
    if (req.action === 'add') {
      await col.doc(normalizeEmail(req.email)).set({ addedAt: Date.now(), addedBy: caller.uid })
    } else if (req.action === 'remove') {
      await col.doc(normalizeEmail(req.email)).delete()
    }
    const snap = await col.get()
    return {
      emails: snap.docs
        .map((d) => ({ email: d.id, addedAt: (d.get('addedAt') as number | undefined) ?? null }))
        .sort((a, b) => a.email.localeCompare(b.email)),
    }
  } catch (error) {
    throw toHttpsError(error, 'manageAllowlist')
  }
})

/**
 * Übernimmt Jagden aus einer früheren anonymen Sitzung ins neue Konto und löscht das anonyme Konto.
 * Der Besitz wird über das (von Firebase signierte) ID-Token der anonymen Sitzung nachgewiesen.
 */
export const claimAnonymousHunts = onCall(async (request) => {
  try {
    const caller = await getCaller(request)
    if (caller.provider === 'anonymous') {
      throw new UserFacingError('failed-precondition', 'still_anonymous', 'Bitte zuerst richtig anmelden.')
    }
    const token = z.object({ anonIdToken: z.string().min(20) }).safeParse(request.data)
    if (!token.success) throw new UserFacingError('invalid-argument', 'invalid_token', 'Ungültige Anfrage.')
    let anonUid: string
    try {
      const decoded = await getAuth().verifyIdToken(token.data.anonIdToken)
      if (decoded.firebase?.sign_in_provider !== 'anonymous') throw new Error('kein anonymes Konto')
      anonUid = decoded.uid
    } catch {
      // Abgelaufen oder ungültig – dann gibt es nichts zu übernehmen
      return { moved: 0 }
    }
    if (anonUid === caller.uid) return { moved: 0 }

    const db = getFirestore()
    const hunts = await db.collection('hunts').where('ownerUid', '==', anonUid).get()
    const batch = db.batch()
    hunts.docs.forEach((d) => batch.update(d.ref, { ownerUid: caller.uid }))
    await batch.commit()
    await getAuth()
      .deleteUser(anonUid)
      .catch((e) => console.warn('claimAnonymousHunts: anonymes Konto nicht gelöscht', e))
    return { moved: hunts.size }
  } catch (error) {
    throw toHttpsError(error, 'claimAnonymousHunts')
  }
})

export const generateHunt = onCall(
  { secrets: [anthropicKey, orsKey], timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    let reserved: Caller | null = null
    try {
      const caller = await getCaller(request)
      assertCanCreate(caller)
      const parsed = huntParamsSchema.safeParse(request.data)
      if (!parsed.success) {
        throw new UserFacingError(
          'invalid-argument',
          'invalid_params',
          'Die Eckdaten sind unvollständig oder ungültig.',
          parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        )
      }
      const keys = { anthropic: anthropicKey.value().trim(), ors: orsKey.value().trim() }
      if (!keys.anthropic) throw missingSecret('ANTHROPIC_API_KEY')
      if (!keys.ors) throw missingSecret('OPENROUTESERVICE_API_KEY')

      await reserveQuota(caller, 1)
      reserved = caller
      const hunt = await buildHunt(parsed.data, caller.uid, keys)
      await getFirestore().collection('hunts').doc(hunt.id).set(hunt)
      return { huntId: hunt.id }
    } catch (error) {
      // Fehlgeschlagene Versuche zählen nicht gegen das Kontingent
      if (reserved) await reserveQuota(reserved, -1).catch(() => undefined)
      throw toHttpsError(error, 'generateHunt')
    }
  },
)

/** Zählt eine Erzeugung gegen Monats- und Tageslimit (delta -1 gibt sie zurück); Admins haben kein Limit */
async function reserveQuota(caller: Caller, delta: 1 | -1): Promise<void> {
  const db = getFirestore()
  const today = new Date().toISOString().slice(0, 10)
  const userRef = db.doc(`usage/user_${caller.uid}_${monthKey()}`)
  const dayRef = db.doc(`usage/day_${today}`)
  await db.runTransaction(async (tx) => {
    const [user, day] = await Promise.all([tx.get(userRef), tx.get(dayRef)])
    if (delta > 0 && !caller.isAdmin && (user.get('count') ?? 0) >= MAX_HUNTS_PER_MONTH) {
      throw new UserFacingError(
        'resource-exhausted',
        'quota_user',
        `Du hast diesen Monat schon ${MAX_HUNTS_PER_MONTH} Jagden erzeugt.`,
        'Im nächsten Monat geht es weiter. Bereits erzeugte Jagden kannst du beliebig oft spielen.',
      )
    }
    if (delta > 0 && !caller.isAdmin && (day.get('count') ?? 0) >= MAX_HUNTS_PER_DAY) {
      throw new UserFacingError(
        'resource-exhausted',
        'quota_day',
        'Für heute wurden schon sehr viele Jagden erzeugt.',
        'Morgen erneut versuchen.',
      )
    }
    tx.set(userRef, { count: FieldValue.increment(delta) }, { merge: true })
    tx.set(dayRef, { count: FieldValue.increment(delta) }, { merge: true })
  })
}

async function buildHunt(params: HuntParams, uid: string, keys: { anthropic: string; ors: string }): Promise<HuntDoc> {
  const budget = planBudget(params)

  // 0. Bei vorgegebenem Ziel zuerst prüfen, ob die Strecke in der Dauer überhaupt schaffbar ist
  if (params.goal) {
    const direct = await fetchDistanceMatrix([params.start, params.goal], params.mode, keys.ors)
    const meters = direct[0][1]
    if (!Number.isFinite(meters)) {
      throw new UserFacingError(
        'failed-precondition',
        'goal_unreachable',
        `Zwischen Start und Ziel gibt es ${params.mode === 'bike' ? 'für Fahrräder' : 'zu Fuß'} keinen Weg.`,
        'Start und Ziel auf Wege oder Plätze setzen, die miteinander verbunden sind.',
      )
    }
    assertFeasible(meters, params, budget, 'direct')
  }

  // 1. Orte suchen; bei zu wenigen Treffern den Suchradius einmal vergrößern
  const area = searchArea(params, budget)
  let result = await fetchOverpass(buildOverpassQuery(area.center, area.radius))
  let pois = extractPois(result, params)
  if (pois.length < params.stationCount * 2) {
    result = await fetchOverpass(buildOverpassQuery(area.center, area.radius * 1.6))
    pois = extractPois(result, params)
  }
  if (params.goal && isNearMajorRoad(result, params.goal, params)) {
    throw new UserFacingError(
      'failed-precondition',
      'goal_at_road',
      'Der Zielpunkt liegt direkt an einer Hauptverkehrsstraße.',
      'Das Ziel ein Stück weiter weg setzen, z. B. in einen Park oder auf einen Platz.',
    )
  }

  let candidates = thinOut(pois, 40, MAX_CANDIDATES - (params.goal ? 1 : 0))
  let fixedGoal: number | undefined
  if (params.goal) {
    const goal = params.goal
    // Orte direkt am gewählten Ziel wären doppelt – das Ziel selbst ist die letzte Station
    candidates = candidates.filter((c) => distanceMeters(c.position, goal) > 40)
    const goalPoi: Poi = {
      osmId: 'custom/goal',
      position: goal,
      kind: 'goal',
      kindLabel: 'Treffpunkt',
      name: null,
      tags: {},
      score: 0,
    }
    fixedGoal = candidates.length
    candidates = [...candidates, goalPoi]
  }

  // 2. Echte Weglängen und Routenauswahl
  const matrix = await fetchDistanceMatrix([params.start, ...candidates.map((c) => c.position)], params.mode, keys.ors)
  const id = getFirestore().collection('hunts').doc().id
  const seed = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const plan = selectRoute(params.start, candidates, matrix, params, budget, seededRandom(seed), fixedGoal)
  // Die längste Gruppenroute muss in die Dauer passen (10 % Spielraum, die Dauer ist eine Schätzung)
  assertFeasible(Math.max(...plan.groupMeters), params, budget, 'planned', 1.1)
  const chosen = [...plan.loop, plan.goal].map((i) => candidates[i])

  // 3. Belegte Fakten sammeln
  const wikipedia = await Promise.all(chosen.map((p) => fetchWikipediaExtract(p.tags.wikipedia)))
  const facts: StationFacts[] = chosen.map((p, i) => ({
    stationNumber: i + 1,
    isGoal: i === chosen.length - 1,
    kind: p.kindLabel,
    name: p.name,
    osm: p.tags,
    wikipedia: wikipedia[i],
  }))

  // 4. Story und Rätsel (einmal pro Jagd)
  const story = await generateStory(params, facts, keys.anthropic)

  const routeMeters = Math.round(plan.groupMeters.reduce((a, b) => a + b, 0) / plan.groupMeters.length)
  return {
    id,
    title: story.title,
    intro: story.intro,
    outro: story.outro,
    radius: GEOFENCE_RADIUS_M,
    stations: chosen.map((p, i) => ({
      id: `s${i + 1}`,
      name: p.name ?? p.kindLabel,
      position: p.position,
      kindLabel: p.kindLabel,
      osmId: p.osmId,
      chapter: story.stations[i].chapter,
      riddle: story.stations[i].riddle,
      transition: story.stations[i].transition,
    })),
    ownerUid: uid,
    createdAt: Date.now(),
    params,
    stats: {
      routeMeters,
      estimatedMinutes: Math.round(routeMeters / budget.metersPerMinute + params.stationCount * budget.stationMinutes),
    },
  }
}
