/**
 * Service pour gérer l'historique des modifications des dossiers
 * Enregistre automatiquement les changements dans l'historique
 */

import { dossiersService } from './apiAdapter';
import notificationService from './notificationService';

class DossierHistoryService {
  /**
   * Compare deux objets et retourne les différences
   * @param {Object} oldData - Anciennes données
   * @param {Object} newData - Nouvelles données
   * @param {Object} fieldLabels - Labels des champs pour affichage
   * @returns {Array} Liste des modifications
   */
  compareObjects(oldData, newData, fieldLabels = {}) {
    const changes = [];
    
    // Champs à surveiller
    const fieldsToWatch = {
      // Informations client
      client: 'Nom du client',
      nom_client: 'Nom du client',
      telephone_client: 'Téléphone',
      description: 'Description',
      description_travail: 'Description du travail',
      urgent: 'Urgence',
      urgence: 'Urgence',
      amount: 'Montant',
      montant_cfa: 'Montant',
      
      // Données formulaire - Xerox
      type_document: 'Type de document',
      format: 'Format',
      mode_impression: 'Mode d\'impression',
      nombre_exemplaires: 'Quantité',
      couleur_impression: 'Couleur',
      grammage: 'Grammage',
      
      // Données formulaire - Roland
      type_support: 'Type de support',
      largeur: 'Largeur',
      hauteur: 'Hauteur',
      finition_oeillets: 'Finition œillets',
      finition_position: 'Position finition',
    };

    // Fusionner avec les labels personnalisés
    const labels = { ...fieldsToWatch, ...fieldLabels };

    // Comparer les champs de premier niveau
    Object.keys(labels).forEach(key => {
      const oldValue = oldData?.[key];
      const newValue = newData?.[key];

      if (oldValue !== newValue && (oldValue || newValue)) {
        changes.push({
          field: key,
          label: labels[key],
          oldValue: this.formatValue(oldValue),
          newValue: this.formatValue(newValue),
        });
      }
    });

    // Comparer les données du formulaire (form_data / data_formulaire)
    const oldFormData = oldData?.form_data || oldData?.data_formulaire || {};
    const newFormData = newData?.data_formulaire || newData?.form_data || {};

    Object.keys(labels).forEach(key => {
      const oldValue = oldFormData?.[key];
      const newValue = newFormData?.[key];

      if (oldValue !== newValue && (oldValue || newValue)) {
        // Éviter les doublons
        if (!changes.find(c => c.field === key)) {
          changes.push({
            field: key,
            label: labels[key],
            oldValue: this.formatValue(oldValue),
            newValue: this.formatValue(newValue),
          });
        }
      }
    });

    return changes;
  }

  /**
   * Formate une valeur pour affichage
   * @param {*} value - Valeur à formater
   * @returns {string} Valeur formatée
   */
  formatValue(value) {
    if (value === null || value === undefined || value === '') {
      return '(vide)';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Oui' : 'Non';
    }
    
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : '(vide)';
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  }

  /**
   * Génère un message de commentaire pour l'historique
   * @param {Array} changes - Liste des modifications
   * @param {Object} user - Utilisateur qui a effectué la modification
   * @returns {string} Message formaté
   */
  generateChangeComment(changes, user = null) {
    if (changes.length === 0) {
      return 'Aucune modification détectée';
    }

    const userName = user?.prenom && user?.nom 
      ? `${user.prenom} ${user.nom}` 
      : user?.role === 'admin' ? 'Administrateur' : 'Utilisateur';

    let comment = `✏️ Modifications effectuées par ${userName}:\n\n`;

    changes.forEach(change => {
      comment += `• ${change.label}: ${change.oldValue} → ${change.newValue}\n`;
    });

    return comment;
  }

  /**
   * Enregistre les modifications dans l'historique du dossier
   * @param {number} dossierId - ID du dossier
   * @param {Object} oldData - Anciennes données
   * @param {Object} newData - Nouvelles données
   * @param {Object} user - Utilisateur qui a effectué la modification
   * @returns {Promise<boolean>} Succès de l'enregistrement
   */
  async recordChanges(dossierId, oldData, newData, user = null) {
    try {
      console.log('📝 Enregistrement des modifications pour le dossier:', dossierId);
      console.log('👤 Utilisateur:', user);

      // Comparer les données
      const changes = this.compareObjects(oldData, newData);

      if (changes.length === 0) {
        console.log('ℹ️ Aucune modification à enregistrer');
        return true;
      }

      console.log('✅ Modifications détectées:', changes);

      // Générer le commentaire pour affichage dans la notification
      const comment = this.generateChangeComment(changes, user);

      // ℹ️ Note: L'enregistrement dans dossier_activity_log est géré automatiquement
      // par le backend lors de la mise à jour du dossier (PUT /api/dossiers/:id)
      // Le backend détecte les changements et appelle logDossierActivity()
      
      console.log('✅ Modifications enregistrées dans l\'historique (via backend automatique)');
      notificationService.success('Modifications enregistrées');

      return true;
    } catch (error) {
      console.error('❌ Erreur lors de l\'enregistrement de l\'historique:', error);
      // Ne pas bloquer l'enregistrement du dossier si l'historique échoue
      return false;
    }
  }

  /**
   * Récupère l'historique des modifications d'un dossier
   * @param {number} dossierId - ID du dossier
   * @returns {Promise<Array>} Liste des modifications
   */
  async getChangeHistory(dossierId) {
    try {
      // L'historique est récupéré avec les détails du dossier
      // Cette fonction peut être étendue si besoin
      const response = await dossiersService.getHistory(dossierId);
      return response?.history || [];
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      return [];
    }
  }
}

// Exporter une instance unique (singleton)
const dossierHistoryService = new DossierHistoryService();
export default dossierHistoryService;
