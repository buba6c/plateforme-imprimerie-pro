// Normalisation des numéros de téléphone pour WhatsApp.
// Sénégal en priorité (+221, mobiles 7X XXX XX XX), sinon international au format +CCC…
// Aucune dépendance : utilisable par les tests et par l'interface si besoin.

export interface TelephoneNormalise {
  /** Format international sans espace : +221771234567 */
  e164: string;
  /** Identifiant WhatsApp : 221771234567@s.whatsapp.net */
  jid: string;
  /** Lisible : +221 77 123 45 67 */
  affichage: string;
}

const SENEGAL = '221';

/** Numéro normalisé, ou null si le numéro n'est pas exploitable (vide, trop court, lettres…). */
export function normaliserTelephone(brut: string | null | undefined): TelephoneNormalise | null {
  if (typeof brut !== 'string') return null;
  let s = brut.trim();
  if (!s) return null;
  // Plusieurs numéros séparés par « / » ou « , » : on garde le premier.
  s = s.split(/[\/,;]/)[0]!.trim();
  s = s.replace(/[\s.\-()]/g, '');
  if (!/^\+?\d+$/.test(s)) return null;
  if (s.startsWith('00')) s = `+${s.slice(2)}`;

  let chiffres = s.startsWith('+') ? s.slice(1) : s;

  // Sénégal : +221 7X XXX XX XX, 221 7X…, ou 7X XXX XX XX sans indicatif.
  if (chiffres.length === 9 && chiffres.startsWith('7')) chiffres = SENEGAL + chiffres;
  if (chiffres.startsWith(SENEGAL)) {
    const national = chiffres.slice(SENEGAL.length);
    if (!/^7\d{8}$/.test(national)) return null;
    return {
      e164: `+${chiffres}`,
      jid: `${chiffres}@s.whatsapp.net`,
      affichage: `+${SENEGAL} ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7, 9)}`,
    };
  }

  // International : un « + » (ou 00) est obligatoire, 8 à 15 chiffres, pas de zéro initial.
  if (!s.startsWith('+')) return null;
  if (chiffres.length < 8 || chiffres.length > 15 || chiffres.startsWith('0')) return null;
  return { e164: `+${chiffres}`, jid: `${chiffres}@s.whatsapp.net`, affichage: `+${chiffres}` };
}

/** Numéro lisible à partir d'un identifiant WhatsApp (221771234567@s.whatsapp.net → +221771234567). */
export function telephoneDepuisJid(jid: string): string | null {
  const m = /^(\d{8,15})(?::\d+)?@s\.whatsapp\.net$/.exec(jid);
  return m ? `+${m[1]}` : null;
}

/** « STOP », « ARRET », « Arrêt svp »… : le client ne veut plus de messages. */
export function estDemandeStop(texte: string): boolean {
  const t = texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
  return /^(stop|arret|arreter|arretez)\b/.test(t);
}
