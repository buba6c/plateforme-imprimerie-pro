// Utilitaire partagé pour la normalisation des statuts
export function normalizeStatusLabel(label) {
  return String(label)
    .toLowerCase()
    .replace(/\s/g, '_')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
