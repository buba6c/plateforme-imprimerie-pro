/**
 * 🎣 Hook useLivreurActions
 * Gestion des actions de livraison
 */

import { useState, useCallback } from 'react';
import { dossiersService } from '../../../../services/apiAdapter';
import notificationService from '../../../../services/notificationService';
import { validateDeliveryData } from '../utils/livreurUtils';
import { MESSAGES } from '../utils/livreurConstants';

const useLivreurActions = (onSuccess) => {
  const [processing, setProcessing] = useState(false);

  // Programmer une livraison
  const programmerLivraison = useCallback(async (dossierId, data) => {
    try {
      setProcessing(true);

      // Validation
      const validation = validateDeliveryData(data);
      if (!validation.isValid) {
        validation.errors.forEach(err => {
          notificationService.error(err);
        });
        return false;
      }

      // Appel API
      await dossiersService.updateStatut(dossierId, {
        statut: 'en_livraison',
        date_livraison: data.date_livraison,
        adresse_livraison: data.adresse_livraison,
        notes_livraison: data.notes
      });

      notificationService.success(MESSAGES.SUCCESS.PROGRAMMED);
      
      if (onSuccess) await onSuccess();
      return true;
    } catch (error) {
      console.error('Erreur programmation:', error);
      notificationService.error(MESSAGES.ERROR.SAVE_FAILED);
      return false;
    } finally {
      setProcessing(false);
    }
  }, [onSuccess]);

  // Valider une livraison
  const validerLivraison = useCallback(async (dossierId, data = {}) => {
    try {
      setProcessing(true);

      await dossiersService.updateStatut(dossierId, {
        statut: 'livre',
        date_livraison_effective: new Date().toISOString(),
        signature: data.signature,
        commentaire_livreur: data.commentaire
      });

      notificationService.success(MESSAGES.SUCCESS.DELIVERED);
      
      if (onSuccess) await onSuccess();
      return true;
    } catch (error) {
      console.error('Erreur validation:', error);
      notificationService.error(MESSAGES.ERROR.SAVE_FAILED);
      return false;
    } finally {
      setProcessing(false);
    }
  }, [onSuccess]);

  // Déclarer un échec
  const declarerEchec = useCallback(async (dossierId, motif) => {
    try {
      setProcessing(false);

      await dossiersService.updateStatut(dossierId, {
        statut: 'echec_livraison',
        motif_echec: motif,
        date_echec: new Date().toISOString()
      });

      notificationService.warning('Échec de livraison déclaré');
      
      if (onSuccess) await onSuccess();
      return true;
    } catch (error) {
      console.error('Erreur déclaration échec:', error);
      notificationService.error(MESSAGES.ERROR.SAVE_FAILED);
      return false;
    } finally {
      setProcessing(false);
    }
  }, [onSuccess]);

  return {
    processing,
    programmerLivraison,
    validerLivraison,
    declarerEchec
  };
};

export default useLivreurActions;
