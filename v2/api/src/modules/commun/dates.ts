// Dates affichées dans le fuseau de l'entreprise (PDF, CSV), indépendamment du fuseau du serveur.

const JOUR_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parties(d: Date, fuseau: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: fuseau,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
}

function enDate(v: string | Date): Date | null {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** jj/mm/aaaa ; une date seule (AAAA-MM-JJ) est reprise telle quelle, sans décalage. */
export function jourFr(v: string | Date | null | undefined, fuseau: string): string {
  if (!v) return '';
  if (typeof v === 'string') {
    const m = JOUR_RE.exec(v);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = enDate(v);
  if (!d) return '';
  const p = parties(d, fuseau);
  return `${p.day}/${p.month}/${p.year}`;
}

/** jj/mm/aaaa hh:mm */
export function dateHeureFr(v: string | Date | null | undefined, fuseau: string): string {
  if (!v) return '';
  if (typeof v === 'string' && JOUR_RE.test(v)) return jourFr(v, fuseau);
  const d = enDate(v);
  if (!d) return '';
  const p = parties(d, fuseau);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
