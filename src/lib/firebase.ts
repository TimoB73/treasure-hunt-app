import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

/**
 * Öffentliche Web-Konfiguration des Firebase-Projekts. Das ist kein geheimer Schlüssel –
 * er identifiziert nur das Projekt; geschützt wird über Firestore-Regeln und Login.
 * Die API-Schlüssel für Claude und OpenRouteService liegen ausschließlich im Secret Manager.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyBxX2BQv6m1nwt5rqPvkGp9Kh6rUgisEMQ',
  authDomain: 'schatzsuche-d5d97.firebaseapp.com',
  projectId: 'schatzsuche-d5d97',
  storageBucket: 'schatzsuche-d5d97.firebasestorage.app',
  messagingSenderId: '21635380668',
  appId: '1:21635380668:web:0e73db4e08c8699c9f27b9',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// Bestätigungs- und Passwort-E-Mails auf Deutsch
auth.languageCode = 'de'
// Lokaler Cache: Eine einmal geladene Jagd lässt sich auch bei schlechtem Empfang wieder öffnen
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
export const functions = getFunctions(app, 'europe-west3')
