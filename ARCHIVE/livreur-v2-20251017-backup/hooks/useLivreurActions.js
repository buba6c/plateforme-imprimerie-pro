/**
 * 🎣 Hook useLivreurActions
 * Gestion des actions de livraison : programmer, valider, modifier, annuler
 */

import { useState, useCallback } from 'react';
import { dossiersService } from '../../../services/apiAdapter';
import notificationService from '../../../services/notificationService';
import { 
  validateDeliveryData,
  generateMapsUrl,
  generatePhoneUrl 
} from '../utils/livreurUtils';
import { 
  DELIVERY_STATUS,
  MESSAGES 
} from '../utils/livreurConstants';

const useLivreurActions = () => {
  // États des actions en cours
  const [actionLoading, setActionLoading] = useState({});
  const [lastAction, setLastAction] = useState(null);

  /**
   * 📅 Programmer une livraison
   */
  const programmerLivraison = useCallback(async (dossier, programmationData) => {
    const actionKey = `programmer_${dossier.id}`;
    
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));

      // Validation des données
      const validation = validateDeliveryData('programmer', programmationData);
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        throw new Error(firstError);
      }

      // Appel API pour programmer la livraison
      const updateData = {
        statut: DELIVERY_STATUS.EN_LIVRAISON,
        date_livraison_prevue: programmationData.date_livraison_prevue,
        adresse_livraison: programmationData.adresse_livraison,
        telephone_livraison: programmationData.telephone_livraison || dossier.displayTelephone,
        commentaire_livraison: programmationData.commentaire_livraison || '',
        heure_prevue: programmationData.heure_prevue || '09:00',
        livreur_id: programmationData.livreur_id,
        montant_prevu: programmationData.montant_prevu || dossier.displayMontant
      };

      // Simulation d'appel API (à remplacer par l'appel réel)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Dans un vrai projet, l'appel serait :
      // const result = await dossiersService.updateStatus(dossier.id, updateData);
      
      const result = { success: true, dossier: { ...dossier, ...updateData } };

      if (result.success) {
        // Notification de succès
        notificationService.success(MESSAGES.SUCCESS.PROGRAMMED);
        
        // Émettre l'événement de mise à jour
        notificationService.emit('dossier_updated', result.dossier);
        
        // Enregistrer la dernière action
        setLastAction({
          type: 'programmer',
          dossierId: dossier.id,
          timestamp: new Date(),
          data: programmationData
        });

        return result;
      } else {
        throw new Error(result.error || 'Échec de la programmation');
      }

    } catch (error) {
      console.error('❌ Erreur programmation livraison:', error);
      notificationService.error(`Erreur: ${error.message}`);
      throw error;
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  }, []);

  /**
   * ✅ Valider une livraison
   */
  const validerLivraison = useCallback(async (dossier, validationData) => {
    const actionKey = `valider_${dossier.id}`;
    
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));

      // Validation des données
      const validation = validateDeliveryData('valider', validationData);
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        throw new Error(firstError);
      }

      // Appel API pour valider la livraison
      const updateData = {
        statut: DELIVERY_STATUS.LIVRE,
        date_livraison: new Date().toISOString(),
        montant_encaisse: validationData.montant_encaisse,
        mode_paiement: validationData.mode_paiement,
        commentaire_livraison: validationData.commentaire_livraison || dossier.commentaire_livraison || '',
        signature_client: validationData.signature_client || null,
        photo_livraison: validationData.photo_livraison || null,
        heure_livraison: new Date().toLocaleTimeString('fr-FR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      };

      // Simulation d'appel API
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const result = { success: true, dossier: { ...dossier, ...updateData } };

      if (result.success) {
        // Notification de succès avec détails
        const montantText = new Intl.NumberFormat('fr-FR').format(validationData.montant_encaisse);
        notificationService.success(
          `Livraison validée • ${montantText} CFA • ${validationData.mode_paiement}`
        );
        
        // Émettre l'événement de mise à jour
        notificationService.emit('dossier_updated', result.dossier);
        
        // Enregistrer la dernière action
        setLastAction({
          type: 'valider',
          dossierId: dossier.id,
          timestamp: new Date(),
          data: validationData
        });

        return result;
      } else {
        throw new Error(result.error || 'Échec de la validation');
      }

    } catch (error) {
      console.error('❌ Erreur validation livraison:', error);
      notificationService.error(`Erreur: ${error.message}`);
      throw error;
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  }, []);

  /**
   * 📝 Modifier une livraison programmée
   */
  const modifierLivraison = useCallback(async (dossier, modificationData) => {
    const actionKey = `modifier_${dossier.id}`;
    
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));

      // Validation des nouvelles données
      const validation = validateDeliveryData('programmer', modificationData);
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        throw new Error(firstError);
      }

      // Appel API pour modifier
      const updateData = {
        ...modificationData,
        date_modification: new Date().toISOString()
      };

      // Simulation d'appel API
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const result = { success: true, dossier: { ...dossier, ...updateData } };

      if (result.success) {
        notificationService.success('Livraison modifiée avec succès');
        
        notificationService.emit('dossier_updated', result.dossier);
        
        setLastAction({
          type: 'modifier',
          dossierId: dossier.id,
          timestamp: new Date(),
          data: modificationData
        });

        return result;
      } else {
        throw new Error(result.error || 'Échec de la modification');
      }

    } catch (error) {
      console.error('❌ Erreur modification livraison:', error);
      notificationService.error(`Erreur: ${error.message}`);
      throw error;
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  }, []);

  /**
   * 🚫 Signaler un échec de livraison
   */
  const signalerEchec = useCallback(async (dossier, echecData) => {
    const actionKey = `echec_${dossier.id}`;
    
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));

      if (!echecData.raison_echec) {
        throw new Error('La raison de l\'échec est obligatoire');
      }

      const updateData = {
        statut: DELIVERY_STATUS.ECHEC,
        date_echec: new Date().toISOString(),
        raison_echec: echecData.raison_echec,
        commentaire_echec: echecData.commentaire_echec || '',
        nouvelle_tentative_prevue: echecData.nouvelle_tentative_prevue || null
      };

      // Simulation d'appel API
      await new Promise(resolve => setTimeout(resolve, 700));
      
      const result = { success: true, dossier: { ...dossier, ...updateData } };

      if (result.success) {
        notificationService.warning(`Échec signalé: ${echecData.raison_echec}`);
        
        notificationService.emit('dossier_updated', result.dossier);
        
        setLastAction({
          type: 'echec',
          dossierId: dossier.id,
          timestamp: new Date(),
          data: echecData
        });

        return result;
      } else {
        throw new Error(result.error || 'Échec du signalement');
      }

    } catch (error) {
      console.error('❌ Erreur signalement échec:', error);
      notificationService.error(`Erreur: ${error.message}`);
      throw error;
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  }, []);

  /**
   * ⏰ Reporter une livraison
   */
  const reporterLivraison = useCallback(async (dossier, reportData) => {
    const actionKey = `reporter_${dossier.id}`;
    
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));

      if (!reportData.nouvelle_date) {
        throw new Error('La nouvelle date est obligatoire');
      }

      const updateData = {
        statut: DELIVERY_STATUS.REPORTE,
        date_report: new Date().toISOString(),
        ancienne_date_prevue: dossier.date_livraison_prevue,
        date_livraison_prevue: reportData.nouvelle_date,
        raison_report: reportData.raison_report || '',
        commentaire_report: reportData.commentaire_report || ''
      };

      // Simulation d'appel API
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const result = { success: true, dossier: { ...dossier, ...updateData } };

      if (result.success) {
        const nouvelleDate = new Date(reportData.nouvelle_date).toLocaleDateString('fr-FR');
        notificationService.info(`Livraison reportée au ${nouvelleDate}`);
        
        notificationService.emit('dossier_updated', result.dossier);
        
        setLastAction({
          type: 'reporter',
          dossierId: dossier.id,
          timestamp: new Date(),
          data: reportData
        });

        return result;
      } else {
        throw new Error(result.error || 'Échec du report');
      }

    } catch (error) {
      console.error('❌ Erreur report livraison:', error);
      notificationService.error(`Erreur: ${error.message}`);
      throw error;
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  }, []);

  /**
   * 🗺️ Naviguer vers l'adresse
   */
  const naviguerVersAdresse = useCallback((dossier) => {
    try {
      const mapsUrl = generateMapsUrl(dossier);
      window.open(mapsUrl, '_blank');
      
      notificationService.info(`Navigation vers ${dossier.displayClient}`);
      
      setLastAction({
        type: 'navigation',
        dossierId: dossier.id,
        timestamp: new Date(),
        data: { url: mapsUrl }
      });
      
    } catch (error) {
      console.error('❌ Erreur navigation:', error);
      notificationService.error('Impossible d\'ouvrir la navigation');
    }
  }, []);

  /**
   * 📞 Appeler le client
   */
  const appelerClient = useCallback((dossier) => {
    try {
      const phoneUrl = generatePhoneUrl(dossier.displayTelephone);
      
      if (phoneUrl) {
        window.location.href = phoneUrl;
        
        notificationService.info(`Appel vers ${dossier.displayClient}`);
        
        setLastAction({
          type: 'appel',
          dossierId: dossier.id,
          timestamp: new Date(),
          data: { telephone: dossier.displayTelephone }
        });
      } else {
        notificationService.warning('Numéro de téléphone non disponible');
      }
      
    } catch (error) {
      console.error('❌ Erreur appel:', error);
      notificationService.error('Impossible d\'initier l\'appel');
    }
  }, []);

  /**
   * 🔄 Annuler la dernière action (si possible)
   */
  const annulerDerniereAction = useCallback(async () => {
    if (!lastAction) {
      notificationService.warning('Aucune action récente à annuler');
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, 'annuler': true }));

      // Logique d'annulation selon le type d'action
      switch (lastAction.type) {
        case 'programmer':
          // Remettre en "prêt livraison"
          notificationService.info('Programmation annulée');
          break;
          
        case 'valider':
          // Impossible d'annuler une validation
          throw new Error('Impossible d\'annuler une livraison validée');
          
        case 'reporter':
          // Remettre la date originale
          notificationService.info('Report annulé');
          break;
          
        default:
          throw new Error('Cette action ne peut pas être annulée');
      }

      setLastAction(null);
      
    } catch (error) {
      console.error('❌ Erreur annulation:', error);
      notificationService.error(`Erreur: ${error.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, 'annuler': false }));
    }
  }, [lastAction]);

  /**
   * 📊 Vérifier si une action est en cours
   */
  const isActionLoading = useCallback((type, dossierId = null) => {
    if (dossierId) {
      return actionLoading[`${type}_${dossierId}`] || false;
    }
    
    // Vérifier si une action de ce type est en cours
    return Object.keys(actionLoading).some(key => 
      key.startsWith(`${type}_`) && actionLoading[key]
    );
  }, [actionLoading]);

  /**
   * ✨ Vérifier si des actions sont disponibles pour un dossier
   */
  const getAvailableActions = useCallback((dossier) => {
    const actions = [];
    
    switch (dossier.deliveryStatus) {
      case DELIVERY_STATUS.IMPRIME:
      case DELIVERY_STATUS.PRET_LIVRAISON:
        actions.push('programmer', 'navigation', 'appel');
        break;
        
      case DELIVERY_STATUS.EN_LIVRAISON:
        actions.push('valider', 'modifier', 'echec', 'reporter', 'navigation', 'appel');
        break;
        
      case DELIVERY_STATUS.LIVRE:
        actions.push('navigation', 'appel');
        break;
        
      case DELIVERY_STATUS.ECHEC:
      case DELIVERY_STATUS.REPORTE:
        actions.push('programmer', 'navigation', 'appel');
        break;
    }
    
    return actions;
  }, []);

  // Interface publique du hook
  return {
    // Actions principales
    programmerLivraison,
    validerLivraison,
    modifierLivraison,
    signalerEchec,
    reporterLivraison,
    
    // Actions utilitaires
    naviguerVersAdresse,
    appelerClient,
    annulerDerniereAction,
    
    // États et vérifications
    actionLoading,
    isActionLoading,
    lastAction,
    getAvailableActions,
    
    // Méthodes utilitaires
    clearLastAction: () => setLastAction(null),
    clearAllLoadingStates: () => setActionLoading({})
  };
};

export default useLivreurActions;