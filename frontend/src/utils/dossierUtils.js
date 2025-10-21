// Utilitaire central pour récupérer l'identifiant public d'un dossier
// Priorise folder_id (UUID). Fallback sur id (legacy) avec warning en dev.

export function getDossierId(dossier) {
  if (!dossier) return undefined;
  if (dossier.folder_id) return dossier.folder_id; // chemin correct
  if (dossier.id) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      // Warning unique (limiter le bruit)
      if (!window.__WARNED_NUMERIC_DOSSIER_ID__) {
        // eslint-disable-next-line no-console
        console.warn(
          '[dossierUtils] Utilisation fallback dossier.id numérique. Vérifier migration vers folder_id.'
        );
        window.__WARNED_NUMERIC_DOSSIER_ID__ = true;
      }
    }
    return dossier.id; // fallback pour anciens objets
  }
  return undefined;
}

// Validation rapide d'un pattern UUID (simplifié)
export function isUUID(value) {
  return typeof value === 'string' && /[0-9a-fA-F-]{10,}/.test(value);
}

// Construit une URL API dossier résiliente
export function buildDossierUrl(base, dossier) {
  const id = typeof dossier === 'string' ? dossier : getDossierId(dossier);
  return `${base}/dossiers/${id}`;
}
