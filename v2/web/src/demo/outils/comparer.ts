// Compare l'API simulée à l'API réelle, rôle par rôle, juste après un enregistrement (mêmes données) :
//   API=http://127.0.0.1:4000 npx tsx src/demo/outils/comparer.ts
// Chaque réponse GET calculée en mémoire doit être identique à celle du serveur (ordre des clés ignoré).

import { E, initialiser } from '../etat';
import { traiter } from '../serveur';

const API = (process.env.API ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const MOT_DE_PASSE = process.env.MOT_DE_PASSE ?? 'Evocom2026!';

const COMMUNS = [
  '/dossiers',
  '/dossiers?tri=recent&limit=10',
  '/dossiers?tri=ancien&page=2&limit=5',
  '/dossiers?statut=pret_impression,en_impression',
  '/dossiers?q=boulangerie',
  '/dossiers?urgent=1',
  '/dossiers?machine=roland',
  '/dossiers?file=travail',
  '/notifications',
  '/notifications?non_lues=1',
  '/parametres',
  '/parametres/regles',
  '/preferences',
  '/apparence',
  '/tarifs/libelles',
];
const PAR_ROLE: Record<string, string[]> = {
  admin: [
    '/paiements',
    '/paiements?statut=a_valider',
    '/paiements?mode=wave&limit=3',
    '/caisse',
    '/stats/apercu',
    '/stats/apercu?periode=jour',
    '/stats/apercu?periode=semaine',
    '/stats/apercu?periode=annee',
    '/stats/evolution',
    '/stats/evolution?pas=semaine',
    '/stats/evolution?pas=mois',
    '/stats/production',
    '/stats/top-clients',
    '/clients',
    '/clients?q=77',
    '/clients/recherche?q=bou',
    '/clients/11',
    '/tarifs',
    '/users',
    '/users/annuaire',
    '/corbeille',
    '/livraisons/planning?debut=2026-09-28&fin=2026-10-11',
    '/livraisons/historique',
    '/ia/statut',
  ],
  preparateur: ['/paiements', '/clients', '/tarifs', '/users/annuaire', '/ia/statut', '/stats/apercu', '/livraisons/historique'],
  imprimeur_roland: ['/paiements', '/tarifs'],
  imprimeur_xerox: [],
  livreur: ['/paiements', '/livraisons/planning?debut=2026-09-28&fin=2026-10-11', '/livraisons/historique'],
};
const COMPTES: Record<string, string> = {
  admin: 'admin@evocom.test',
  preparateur: 'prep@evocom.test',
  imprimeur_roland: 'roland@evocom.test',
  imprimeur_xerox: 'xerox@evocom.test',
  livreur: 'livreur@evocom.test',
};

function normaliser(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normaliser);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, normaliser((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/** Écarts voulus : la démonstration active l'assistant IA ; les connexions de l'enregistrement changent last_login_at. */
const IGNORES = new Set(['last_login_at']);
const VOULUS = new Set(['/ia/statut']);
const RE_INSTANT = /^\d{4}-\d{2}-\d{2}T/;

/** Premières différences entre deux valeurs (chemins JSON). */
function differences(a: unknown, b: unknown, chemin = '', out: string[] = []): string[] {
  if (out.length > 8) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (IGNORES.has(chemin.split('.').pop()!)) return out;
  // Même instant, écrit différemment (json_build_object garde les microsecondes).
  if (typeof a === 'string' && typeof b === 'string' && RE_INSTANT.test(a) && RE_INSTANT.test(b) && Math.abs(Date.parse(a) - Date.parse(b)) < 1) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) out.push(`${chemin} : ${a.length} éléments (serveur) ≠ ${b.length} (démo)`);
    const cles = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of cles) differences((a as any)[k], (b as any)[k], `${chemin}.${k}`, out);
    return out;
  }
  out.push(`${chemin} : ${JSON.stringify(a)?.slice(0, 120)} (serveur) ≠ ${JSON.stringify(b)?.slice(0, 120)} (démo)`);
  return out;
}

async function main() {
  initialiser({ persistance: false, decalage: { ms: 0, jours: 0 } });
  let ecarts = 0;
  let total = 0;
  for (const [role, email] of Object.entries(COMPTES)) {
    const login = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: MOT_DE_PASSE }) });
    if (!login.ok) throw new Error(`Connexion ${email} : ${login.status}`);
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!;
    E().userId = E().users.find((u) => u.email === email)!.id;
    for (const url of [...COMMUNS, ...(PAR_ROLE[role] ?? [])].filter((x) => !VOULUS.has(x))) {
      total += 1;
      const r = await fetch(`${API}/api${url}`, { headers: { cookie } });
      const serveur = r.status === 200 ? await r.json() : { status: r.status };
      const u = new URL(url, 'http://demo');
      const d = traiter({ methode: 'GET', chemin: u.pathname, query: u.searchParams, body: undefined });
      const demo = d.status === 200 ? d.body : { status: d.status };
      const diff = differences(normaliser(serveur), normaliser(demo));
      if (diff.length) {
        ecarts += 1;
        console.log(`✗ ${role} GET ${url}\n    ${diff.join('\n    ')}`);
      }
    }
  }
  console.log(`${total - ecarts}/${total} réponses identiques.`);
  process.exitCode = ecarts ? 1 : 0;
}

void main();
