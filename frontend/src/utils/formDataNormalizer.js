/**
 * Normalise les données du formulaire pour assurer la cohérence d'affichage
 */

export function normalizeFormData(data) {
  if (!data) return {};

  return {
    ...data,
    nombre_exemplaires: data.nombre_exemplaires?.toString(),
    amount: parseFloat(data.amount || 0).toFixed(2),
    montant_cfa: parseFloat(data.montant_cfa || 0).toFixed(2)
  };
}

export function stringifyFormData(data) {
  if (!data) return {};

  const normalizedData = normalizeFormData(data);
  
  // Log pour debug
  console.log('📝 [formDataNormalizer] Données normalisées:', {
    avant: data.nombre_exemplaires,
    après: normalizedData.nombre_exemplaires
  });

  return normalizedData;
}