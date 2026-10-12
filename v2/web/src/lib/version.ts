// Mises à jour sans fermer le navigateur : la page connaît sa version (compilée) et relit version.json
// toutes les 3 minutes et au retour sur l'onglet. Si le serveur a une version plus récente, on recharge
// au prochain changement de page (moment sûr : rien n'est en cours de saisie), ou tout de suite si
// l'onglet est en arrière-plan. Les erreurs de chargement d'une ancienne version déclenchent aussi un
// rechargement (une fois).

const ACTUELLE = typeof __EVOCOM_VERSION__ === 'string' ? __EVOCOM_VERSION__ : 'dev';
let nouvelle: string | null = null;
const abonnes = new Set<(v: string) => void>();

async function verifier() {
  if (ACTUELLE === 'dev') return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store', credentials: 'omit' });
    if (!res.ok) return;
    const { version } = (await res.json()) as { version?: string };
    if (version && version !== ACTUELLE && version !== nouvelle) {
      nouvelle = version;
      abonnes.forEach((f) => f(version));
      if (document.visibilityState === 'hidden') recharger('version');
    }
  } catch {
    /* hors ligne : on réessaiera */
  }
}

export function nouvelleVersionDisponible(): boolean {
  return nouvelle !== null;
}

export function surNouvelleVersion(f: (v: string) => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/** Recharge la page en contournant le cache (au plus une fois toutes les 20 s, pour ne jamais boucler). */
export function recharger(motif: string) {
  try {
    const dernier = Number(sessionStorage.getItem('evocom-rechargement') ?? 0);
    if (Date.now() - dernier < 20_000) return false;
    sessionStorage.setItem('evocom-rechargement', String(Date.now()));
    sessionStorage.setItem('evocom-rechargement-motif', motif);
  } catch {
    /* stockage indisponible */
  }
  const url = new URL(window.location.href);
  url.searchParams.set('v', Date.now().toString(36));
  window.location.replace(url.toString());
  return true;
}

/** Erreur typique d'un morceau d'une ancienne version qui n'existe plus sur le serveur. */
export function estErreurDeVersion(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed|Unable to preload CSS|ChunkLoadError/i.test(m);
}

export function demarrerVerificationVersion() {
  // Nettoie le paramètre ?v= laissé par un rechargement forcé.
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('v')) {
      url.searchParams.delete('v');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {
    /* rien */
  }
  void verifier();
  setInterval(() => void verifier(), 3 * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void verifier();
  });
  window.addEventListener('vite:preloadError', (e) => {
    if (recharger('morceau')) e.preventDefault();
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (estErreurDeVersion(e.reason)) recharger('morceau');
  });
}
