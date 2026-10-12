// Fichiers choisis dans le formulaire de création, avant que le dossier existe : ils sont gardés ici
// le temps de la création, puis envoyés par la fiche du dossier (composant Televersement) avec la
// reprise, la progression et les règles habituelles. Mémoire vive seulement : un rechargement de la
// page les oublie, la personne les redépose.

const attente = new Map<number, File[]>();

export function deposerEnAttente(dossierId: number, fichiers: File[]) {
  if (fichiers.length) attente.set(dossierId, fichiers);
}

/** Rend les fichiers en attente d'un dossier et les retire de la file. */
export function prendreEnAttente(dossierId: number): File[] {
  const f = attente.get(dossierId) ?? [];
  attente.delete(dossierId);
  return f;
}
