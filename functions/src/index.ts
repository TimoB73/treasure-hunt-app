import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { setGlobalOptions } from 'firebase-functions/v2'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { UserFacingError, missingSecret } from './errors.js'
import { fetchDistanceMatrix } from './ors.js'
import { buildOverpassQuery, extractPois, fetchOverpass, thinOut } from './poi.js'
import { planBudget, seededRandom, selectRoute } from './route.js'
import { generateStory, type StationFacts } from './story.js'
import { huntParamsSchema, type HuntDoc, type HuntParams, type Poi } from './types.js'
import { fetchWikipediaExtract } from './wikipedia.js'

initializeApp()
setGlobalOptions({ region: 'europe-west3', maxInstances: 3 })

const anthropicKey = defineSecret('ANTHROPIC_API_KEY')
const orsKey = defineSecret('OPENROUTESERVICE_API_KEY')

/** Vorläufiger Kostenschutz bis Phase 5 (Einladungscodes, App Check) */
const MAX_HUNTS_PER_USER_AND_MONTH = 3
const MAX_HUNTS_PER_DAY = 20
/** Höchstens so viele Kandidaten gehen in die Distanzmatrix (OpenRouteService erlaubt 3500 Zellen) */
const MAX_CANDIDATES = 40
const GEOFENCE_RADIUS_M = 30

export const generateHunt = onCall(
  { secrets: [anthropicKey, orsKey], timeoutSeconds: 540, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Bitte zuerst anmelden.')
    const parsed = huntParamsSchema.safeParse(request.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Die Eckdaten sind unvollständig oder ungültig.', {
        reason: 'invalid_params',
        action: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      })
    }
    let reserved = false
    try {
      const keys = { anthropic: anthropicKey.value().trim(), ors: orsKey.value().trim() }
      if (!keys.anthropic) throw missingSecret('ANTHROPIC_API_KEY')
      if (!keys.ors) throw missingSecret('OPENROUTESERVICE_API_KEY')

      await reserveQuota(request.auth.uid, 1)
      reserved = true
      const hunt = await buildHunt(parsed.data, request.auth.uid, keys)
      await getFirestore().collection('hunts').doc(hunt.id).set(hunt)
      return { huntId: hunt.id }
    } catch (error) {
      // Fehlgeschlagene Versuche zählen nicht gegen das Kontingent
      if (reserved) await reserveQuota(request.auth.uid, -1).catch(() => undefined)
      if (error instanceof UserFacingError) {
        console.warn(`generateHunt: ${error.reason}`, error.message)
        throw new HttpsError(error.code, error.message, { reason: error.reason, action: error.action })
      }
      console.error('generateHunt: unerwarteter Fehler', error)
      throw new HttpsError('internal', 'Beim Erzeugen der Jagd ist ein unerwarteter Fehler aufgetreten.', {
        reason: 'unknown',
        action: 'Erneut versuchen. Bleibt der Fehler, in den Function-Logs nachsehen (firebase functions:log).',
      })
    }
  },
)

/** Zählt eine Erzeugung gegen Monats- und Tageslimit (delta -1 gibt sie zurück); wirft, wenn ein Limit erreicht ist */
async function reserveQuota(uid: string, delta: 1 | -1): Promise<void> {
  const db = getFirestore()
  const today = new Date().toISOString().slice(0, 10)
  const userRef = db.doc(`usage/user_${uid}_${today.slice(0, 7)}`)
  const dayRef = db.doc(`usage/day_${today}`)
  await db.runTransaction(async (tx) => {
    const [user, day] = await Promise.all([tx.get(userRef), tx.get(dayRef)])
    if (delta > 0 && (user.get('count') ?? 0) >= MAX_HUNTS_PER_USER_AND_MONTH) {
      throw new UserFacingError(
        'resource-exhausted',
        'quota_user',
        `Du hast diesen Monat schon ${MAX_HUNTS_PER_USER_AND_MONTH} Jagden erzeugt.`,
        'Im nächsten Monat geht es weiter. Bereits erzeugte Jagden kannst du beliebig oft spielen.',
      )
    }
    if (delta > 0 && (day.get('count') ?? 0) >= MAX_HUNTS_PER_DAY) {
      throw new UserFacingError(
        'resource-exhausted',
        'quota_day',
        'Für heute wurden schon genug Jagden erzeugt.',
        'Morgen erneut versuchen.',
      )
    }
    tx.set(userRef, { count: FieldValue.increment(delta) }, { merge: true })
    tx.set(dayRef, { count: FieldValue.increment(delta) }, { merge: true })
  })
}

async function findPois(params: HuntParams, searchRadius: number): Promise<Poi[]> {
  const result = await fetchOverpass(buildOverpassQuery(params.start, searchRadius))
  return extractPois(result, params)
}

async function buildHunt(params: HuntParams, uid: string, keys: { anthropic: string; ors: string }): Promise<HuntDoc> {
  const budget = planBudget(params)

  // 1. Orte suchen; bei zu wenigen Treffern den Suchradius einmal vergrößern
  let pois = await findPois(params, budget.searchRadius)
  if (pois.length < params.stationCount * 2) pois = await findPois(params, budget.searchRadius * 1.6)
  const candidates = thinOut(pois, 40, MAX_CANDIDATES)

  // 2. Echte Weglängen und Routenauswahl
  const matrix = await fetchDistanceMatrix([params.start, ...candidates.map((c) => c.position)], params.mode, keys.ors)
  const id = getFirestore().collection('hunts').doc().id
  const seed = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const plan = selectRoute(params.start, candidates, matrix, params, budget, seededRandom(seed))
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
