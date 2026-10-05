// Dates de la démonstration : jours civils dans le fuseau de l'entreprise, et recalage des données
// enregistrées sur la date du jour (un dossier créé « il y a 2 jours » le reste quand on ouvre la démo).

const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const RE_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

export const JOUR_MS = 86_400_000;

/** Date du jour (AAAA-MM-JJ) dans un fuseau IANA. */
export function jourDans(fuseau: string, d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Heure HH:MM dans un fuseau IANA. */
export function heureDans(fuseau: string, d: Date): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

export function ajouterJours(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function ecartJours(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / JOUR_MS);
}

/** Décalage de fuseau (ms) à un instant donné : heure locale du fuseau − UTC. */
function decalageFuseau(fuseau: string, instant: number): number {
  try {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone: fuseau,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(instant));
    const v = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
    return Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second')) - Math.floor(instant / 1000) * 1000;
  } catch {
    return 0;
  }
}

/** Début (inclus) du jour civil `jour` dans le fuseau, en millisecondes. */
export function debutJour(jour: string, fuseau: string): number {
  const utc = Date.parse(`${jour}T00:00:00Z`);
  return utc - decalageFuseau(fuseau, utc);
}

/** Vrai si l'instant tombe dans les jours [du, au] (au inclus) du fuseau ; bornes facultatives. */
export function dansPeriode(instant: string | null | undefined, fuseau: string, du?: string | null, au?: string | null): boolean {
  if (!instant) return false;
  const t = Date.parse(instant);
  if (du && t < debutJour(du, fuseau)) return false;
  if (au && t >= debutJour(ajouterJours(au, 1), fuseau)) return false;
  return true;
}

export function estJourValide(v: string): boolean {
  if (!RE_JOUR.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export interface Decalage {
  /** Décalage des instants (horodatages), en millisecondes. */
  ms: number;
  /** Décalage des jours civils (dates sans heure). */
  jours: number;
}

/** Recale toutes les dates d'une donnée JSON (chaînes AAAA-MM-JJ et horodatages ISO). */
export function recaler<T>(v: T, d: Decalage): T {
  if (!d.ms && !d.jours) return v;
  const rec = (x: unknown): unknown => {
    if (typeof x === 'string') {
      if (x.length === 10 && RE_JOUR.test(x)) return d.jours ? ajouterJours(x, d.jours) : x;
      if (x.length >= 16 && RE_INSTANT.test(x)) {
        const t = Date.parse(x);
        return Number.isNaN(t) ? x : new Date(t + d.ms).toISOString();
      }
      return x;
    }
    if (Array.isArray(x)) return x.map(rec);
    if (x && typeof x === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(x)) out[k] = rec(val);
      return out;
    }
    return x;
  };
  return rec(v) as T;
}
