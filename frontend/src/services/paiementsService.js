/**
 * 💰 Service de gestion des paiements livreur
 * Gère les encaissements à la livraison et l'historique
 */

import httpClient from '../httpClient';
import notificationService from './notificationService';

class PaiementsService {
  /**
   * Encaisser un paiement à la livraison
   * @param {number} dossierId - ID du dossier
   * @param {Object} data - Données de paiement
   * @param {number} data.montant - Montant encaissé
   * @param {string} data.mode_paiement_final - Mode de paiement (especes, cb, wave, orange_money)
   * @param {string} [data.reference_transaction] - Référence transaction (pour CB/Wave/Orange)
   * @param {string} [data.commentaire] - Commentaire additionnel
   * @returns {Promise<Object>} Résultat de l'encaissement
   */
  async encaisserLivraison(dossierId, data) {
    try {
      console.log('[PaiementsService] Encaissement livraison:', { dossierId, data });

      const response = await httpClient.post('/paiements/encaisser-livraison', {
        dossier_id: dossierId,
        ...data
      });

      if (response.data) {
        notificationService.success(
          response.data.message || 'Encaissement enregistré avec succès',
          {
            title: '💰 Paiement encaissé',
            duration: 5000
          }
        );
        return response.data;
      }

      throw new Error('Réponse invalide du serveur');
    } catch (error) {
      console.error('[PaiementsService] Erreur encaissement:', error);
      
      const errorMsg = error.response?.data?.error || 
                      error.response?.data?.message || 
                      'Erreur lors de l\'encaissement';
      
      notificationService.error(errorMsg, {
        title: '❌ Erreur d\'encaissement',
        duration: 8000
      });

      throw error;
    }
  }

  /**
   * Récupérer l'historique des encaissements du livreur connecté
   * @param {Object} filters - Filtres optionnels
   * @param {string} [filters.date_debut] - Date de début (YYYY-MM-DD)
   * @param {string} [filters.date_fin] - Date de fin (YYYY-MM-DD)
   * @param {string} [filters.statut] - Statut (encaisse_livreur, approuve, refuse)
   * @param {string} [filters.mode_paiement] - Mode de paiement
   * @param {number} [filters.limit=50] - Nombre de résultats
   * @param {number} [filters.offset=0] - Offset pour pagination
   * @returns {Promise<Object>} Historique et statistiques
   */
  async getMesEncaissements(filters = {}) {
    try {
      console.log('[PaiementsService] Récupération encaissements:', filters);

      const params = new URLSearchParams();
      
      if (filters.date_debut) params.append('date_debut', filters.date_debut);
      if (filters.date_fin) params.append('date_fin', filters.date_fin);
      if (filters.statut) params.append('statut', filters.statut);
      if (filters.mode_paiement) params.append('mode_paiement', filters.mode_paiement);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);

      const response = await httpClient.get(`/paiements/mes-encaissements?${params.toString()}`);

      if (response.data) {
        return response.data;
      }

      throw new Error('Réponse invalide du serveur');
    } catch (error) {
      console.error('[PaiementsService] Erreur récupération encaissements:', error);
      
      notificationService.error(
        'Erreur lors du chargement de l\'historique',
        {
          title: '❌ Erreur',
          duration: 5000
        }
      );

      throw error;
    }
  }

  /**
   * Récupérer la liste des dossiers à encaisser
   * @returns {Promise<Object>} Liste des dossiers avec statistiques
   */
  async getDossiersAEncaisser() {
    try {
      console.log('[PaiementsService] Récupération dossiers à encaisser');

      const response = await httpClient.get('/paiements/a-encaisser');

      if (response.data) {
        return response.data;
      }

      throw new Error('Réponse invalide du serveur');
    } catch (error) {
      console.error('[PaiementsService] Erreur récupération dossiers à encaisser:', error);
      
      notificationService.error(
        'Erreur lors du chargement des dossiers à encaisser',
        {
          title: '❌ Erreur',
          duration: 5000
        }
      );

      throw error;
    }
  }

  /**
   * Formater un montant en FCFA
   * @param {number} montant - Montant à formater
   * @returns {string} Montant formaté
   */
  formatMontant(montant) {
    if (!montant || isNaN(montant)) return '0 FCFA';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(montant).replace('XOF', 'FCFA');
  }

  /**
   * Obtenir le libellé du mode de paiement
   * @param {string} mode - Code du mode de paiement
   * @returns {string} Libellé
   */
  getModeLabel(mode) {
    const modes = {
      'especes': '💵 Espèces',
      'cb': '💳 Carte Bancaire',
      'wave': '📱 Wave',
      'orange_money': '🟠 Orange Money',
      'cheque': '📝 Chèque',
      'virement': '🏦 Virement'
    };
    return modes[mode] || mode;
  }

  /**
   * Obtenir le libellé du statut de paiement
   * @param {string} statut - Code du statut
   * @returns {Object} Libellé et couleur
   */
  getStatutLabel(statut) {
    const statuts = {
      'encaisse_livreur': {
        label: 'En attente validation',
        color: 'orange',
        icon: '⏳'
      },
      'approuve': {
        label: 'Approuvé',
        color: 'green',
        icon: '✅'
      },
      'refuse': {
        label: 'Refusé',
        color: 'red',
        icon: '❌'
      },
      'en_attente': {
        label: 'En attente',
        color: 'yellow',
        icon: '⏱️'
      }
    };
    return statuts[statut] || { label: statut, color: 'gray', icon: '❓' };
  }

  /**
   * Valider les données d'encaissement
   * @param {Object} data - Données à valider
   * @returns {Object} Résultat de validation
   */
  validateEncaissement(data) {
    const errors = [];

    if (!data.montant || data.montant <= 0) {
      errors.push('Le montant doit être supérieur à 0');
    }

    if (!data.mode_paiement_final) {
      errors.push('Le mode de paiement est obligatoire');
    }

    // Si paiement électronique, référence obligatoire
    if (['cb', 'wave', 'orange_money', 'virement'].includes(data.mode_paiement_final)) {
      if (!data.reference_transaction || data.reference_transaction.trim() === '') {
        errors.push('La référence de transaction est obligatoire pour ce mode de paiement');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Instance unique (singleton)
const paiementsService = new PaiementsService();

export default paiementsService;
