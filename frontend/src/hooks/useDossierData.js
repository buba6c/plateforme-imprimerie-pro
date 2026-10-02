import { useCallback } from 'react';

export function useDossierData() {
  const updateFormData = useCallback((raw) => {
    if (!raw?.data_formulaire) return raw;

    // Force la mise à jour des champs spécifiques
    const updatedFormData = {
      ...raw.data_formulaire,
      nombre_exemplaires: raw.data_formulaire.nombre_exemplaires?.toString()
    };

    console.log('🔄 [useDossierData] Mise à jour formulaire:', {
      avant: raw.data_formulaire.nombre_exemplaires,
      après: updatedFormData.nombre_exemplaires
    });

    return {
      ...raw,
      data_formulaire: updatedFormData
    };
  }, []);

  return { updateFormData };
}