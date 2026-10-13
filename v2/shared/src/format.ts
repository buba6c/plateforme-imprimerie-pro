// Formats d'affichage français : montants en FCFA entiers, dates, dimensions.

const NBSP = ' '; // espace fine insécable, séparateur de milliers

/** 45000 -> "45 000" (espace fine insécable). */
export function formatEntier(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString();
  const groups: string[] = [];
  for (let i = s.length; i > 0; i -= 3) groups.unshift(s.slice(Math.max(0, i - 3), i));
  return (neg ? '−' : '') + groups.join(NBSP);
}

/** 45000 -> "45 000 FCFA" ; null -> "—". */
export function formatFCFA(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${formatEntier(n)}${NBSP}FCFA`;
}

/** Décimal français : 1.5 -> "1,5". */
export function formatDecimal(n: number, maxDecimals = 2): string {
  const fixed = Number(n.toFixed(maxDecimals));
  const [ent, dec] = Math.abs(fixed).toString().split('.');
  return (fixed < 0 ? '−' : '') + formatEntier(Number(ent)) + (dec ? `,${dec}` : '');
}

/**
 * Lit un montant saisi par un humain : "45 000", "45.000", "45000 FCFA".
 * Retourne null si la saisie n'est pas un entier positif sans ambiguïté.
 */
export function parseMontant(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isInteger(input) && input >= 0 ? input : null;
  const cleaned = input.replace(/fcfa|f\s*cfa|cfa/gi, '').replace(/[\s  ]/g, '').trim();
  if (cleaned === '') return null;
  // Un point ou une virgule suivis de exactement 3 chiffres = séparateur de milliers.
  if (/^\d{1,3}([.,]\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/[.,]/g, ''));
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  return null;
}

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATETIME_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const TIME_FMT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '—' : DATE_FMT.format(d);
}

export function formatDateHeure(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '—' : DATETIME_FMT.format(d).replace(' ', ' ');
}

export function formatHeure(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? '—' : TIME_FMT.format(d);
}

/** "il y a 5 min", "il y a 2 h", sinon la date. */
export function formatRelatif(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = Math.round((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 7 * 86400) return `il y a ${Math.floor(diff / 86400)} j`;
  return formatDate(d);
}

export function formatTaille(octets: number | null | undefined): string {
  if (octets === null || octets === undefined) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${formatDecimal(octets / 1024, 0)} Ko`;
  if (octets < 1024 * 1024 * 1024) return `${formatDecimal(octets / (1024 * 1024), 1)} Mo`;
  return `${formatDecimal(octets / (1024 * 1024 * 1024), 2)} Go`;
}

/** "300 × 200 cm" */
export function formatDimensions(l: number, h: number, unite: string): string {
  return `${formatDecimal(l)} × ${formatDecimal(h)} ${unite}`;
}

const UNITES_LETTRES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const DIZAINES_LETTRES = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

/** 0 à 999 en lettres, orthographe traditionnelle (trait d'union sous cent, « et un » sans trait). */
function centainesEnLettres(n: number): string {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  const parts: string[] = [];
  if (c > 0) parts.push(c === 1 ? 'cent' : `${UNITES_LETTRES[c]} cent${reste === 0 ? 's' : ''}`);
  if (reste > 0) {
    if (reste < 17) parts.push(UNITES_LETTRES[reste]!);
    else {
      const d = Math.floor(reste / 10);
      const u = reste % 10;
      // 70-79 et 90-99 se lisent soixante-dix… et quatre-vingt-dix… : l'unité vaut 10 + u.
      const unite = d === 7 || d === 9 ? 10 + u : u;
      let mot = DIZAINES_LETTRES[d]!;
      if (unite === 0) mot += d === 8 ? 's' : '';
      else if (unite === 1 && d !== 8 && d !== 9) mot += ' et un';
      else if (unite === 11 && d === 7) mot += ' et onze';
      else mot += `-${UNITES_LETTRES[unite]}`;
      parts.push(mot);
    }
  }
  return parts.join(' ');
}

/**
 * Montant entier en toutes lettres, comme sur les devis : 1105000 -> "un million cent cinq mille".
 * « mille » est invariable ; « million » et « milliard » prennent un s ; « cents » et « vingts »
 * perdent leur s devant mille, million ou milliard.
 */
export function nombreEnLettres(n: number): string {
  const v = Math.abs(Math.round(n));
  if (v === 0) return 'zéro';
  const tranches: [number, string, string][] = [
    [1_000_000_000, 'milliard', 'milliards'],
    [1_000_000, 'million', 'millions'],
    [1_000, 'mille', 'mille'],
  ];
  const parts: string[] = [];
  let reste = v;
  for (const [base, sing, plur] of tranches) {
    const q = Math.floor(reste / base);
    reste %= base;
    if (q === 0) continue;
    const prefixe = centainesEnLettres(q).replace(/(vingt|cent)s$/, '$1');
    if (base === 1_000) parts.push(q === 1 ? 'mille' : `${prefixe} mille`);
    else parts.push(`${prefixe} ${q > 1 ? plur : sing}`);
  }
  if (reste > 0) parts.push(centainesEnLettres(reste));
  return (n < 0 ? 'moins ' : '') + parts.join(' ');
}
