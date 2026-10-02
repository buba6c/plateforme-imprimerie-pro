// Mapping des statuts visibles par rôle (à adapter selon votre workflow)

/* eslint-disable prettier/prettier */
// Centralized dossier normalization logic
// Ensures consistent shape consumed by React components
import { normalizeStatusLabel } from '../workflow-adapter/workflowConfig';

export function normalizeStatus(raw) {
  // Utilise la normalisation centrale du workflow métier
  // Import dynamique pour éviter les cycles
  return normalizeStatusLabel(raw);
}
export function normalizeType(type, machine) {
  const v = (type || machine || '').toString().toLowerCase();
  if (v.includes('roland')) return 'roland';
  if (v.includes('xerox')) return 'xerox';
  return v || '';
}

export function extractId(d) {
  return d.id || d.dossier_id || d._id || null;
}

export function normalizeDossier(d) {
  if (!d || typeof d !== 'object') return null;
  
  // Parser data_json si c'est une string
  let dataFormulaire = d.data_formulaire || d.dataFormulaire || {};
  
  if (d.data_json) {
    try {
      const parsed = typeof d.data_json === 'string' 
        ? JSON.parse(d.data_json) 
        : d.data_json;
      // Fusionner data_json dans data_formulaire (data_json a la priorité)
      dataFormulaire = { ...dataFormulaire, ...parsed };
    } catch (e) {
      console.warn('⚠️ Impossible de parser data_json:', e);
    }
  }

  // 🔥 FIX CRITIQUE: Préserver explicitement nombre_exemplaires
  // Vérifier les différentes sources possibles pour la quantité
  const nombreExemplaires = 
    dataFormulaire.nombre_exemplaires || 
    d.nombre_exemplaires || 
    d.quantite || 
    dataFormulaire.quantite;

  // Normaliser les données du formulaire avec gestion explicite de la quantité
  const normalizedDataFormulaire = {
    ...dataFormulaire,
    nombre_exemplaires: nombreExemplaires ? String(nombreExemplaires) : '0'
  };

  // 🔥 FIX CRITIQUE: Préserver le montant avec plusieurs sources possibles
  const amount = d.amount || d.montant_cfa || d.montant || d.prix;

  console.log('🔍 [normalizeDossier] Normalisation:', {
    id: extractId(d),
    quantite_input: nombreExemplaires,
    quantite_output: normalizedDataFormulaire.nombre_exemplaires,
    amount_input: amount,
    hasDataFormulaire: !!d.data_formulaire
  });
  
  return {
    ...d,
    id: extractId(d),
    status: normalizeStatus(d.statut || d.status),
    type: normalizeType(d.type_formulaire || d.type, d.machine),
    numero_commande: d.numero_commande || d.numero || d.numeroCommande || d.numero_cmd || '',
    created_by: d.created_by || d.createdById || d.preparateur_id || d.created_by_id || d.createdBy || null,
    data_formulaire: normalizedDataFormulaire, // ✅ Utiliser les données normalisées
    urgent: d.urgent || false, // ✅ Préserver le champ urgent
    amount: amount, // ✅ Préserver le montant
    montant_cfa: amount, // ✅ Alias pour compatibilité
  };
}

export function normalizeDossierList(list = []) {
  return list.map(normalizeDossier).filter(Boolean);
}
