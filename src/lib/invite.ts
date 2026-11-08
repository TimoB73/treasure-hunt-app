// Einladungstext für neue App-Nutzer (Spielleiter) – per Mail oder Teilen-Menü.
// Vorbild: Einladung der Hertha-App. Es wird keine Mail vom Server verschickt,
// sondern das eigene Mailprogramm mit fertigem Text geöffnet.

export const INVITE_SUBJECT = 'Einladung zur Schatzsuche-App 🗝️'

export function inviteText(email: string, url: string): string {
  return [
    'Hallo!',
    '',
    'Du bist zur Schatzsuche-App eingeladen 🗝️ – damit erstellst du in wenigen Minuten Schatzsuchen mit echten Orten in deiner Umgebung, einer spannenden Geschichte und Rätseln, z. B. für Kindergeburtstage oder Ausflüge.',
    '',
    '📋 Dein Link zur App (lange drücken → „Kopieren“):',
    '',
    url,
    '',
    `👉 Registrieren mit: ${email}`,
    '(Bitte genau diese Adresse verwenden – sie ist freigeschaltet.)',
    '',
    '📱 iPhone',
    '1. Den Link oben lange drücken und „Kopieren“ wählen.',
    '2. Die Safari-App öffnen, oben in die Adressleiste tippen, „Einsetzen und öffnen“ wählen.',
    '   (Bitte nicht direkt aus WhatsApp oder Instagram öffnen – dort fehlt die Installation.)',
    '3. Unten auf Teilen tippen (Quadrat mit Pfeil nach oben, evtl. hinter ⋯), nach unten wischen, „Zum Home-Bildschirm“ → Hinzufügen.',
    '4. Die App über das neue Symbol öffnen.',
    '',
    '🤖 Android',
    '1. Den Link oben lange drücken und „Link kopieren“ wählen.',
    '2. Chrome öffnen, oben in die Adressleiste tippen, den Link einfügen und öffnen.',
    '3. Oben rechts auf ⋮ tippen → „App installieren“ (oder „Zum Startbildschirm hinzufügen“).',
    '4. Die App über das neue Symbol öffnen.',
    '',
    '🔑 Anmelden',
    `1. In der App oben rechts auf 👤 tippen → „Registrieren“ → ${email} und ein eigenes Passwort (zweimal) eingeben → „Konto anlegen“.`,
    '2. In der Bestätigungs-Mail auf den Link tippen (auch im Spam-Ordner nachsehen).',
    '3. Zurück in der App „Ich habe bestätigt“ tippen – fertig! Auf der Startseite steht jetzt „✨ Jagd erzeugen“.',
    '',
    '🎯 Mitspielen ohne Konto',
    'Wer nur mitspielt, braucht weder App noch Konto: In der fertigen Jagd auf „Link für Mitspieler teilen“ tippen und den Link verschicken.',
    '',
    'Viel Spaß beim Schatzsuchen!',
  ].join('\n')
}

/** mailto-Link: öffnet das eigene Mailprogramm mit fertiger Einladung */
export function inviteMailto(email: string, url: string): string {
  // Zeilenumbrüche als CRLF, damit auch Outlook die Absätze übernimmt
  const body = encodeURIComponent(inviteText(email, url)).replace(/%0A/g, '%0D%0A')
  return `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}?subject=${encodeURIComponent(INVITE_SUBJECT)}&body=${body}`
}
