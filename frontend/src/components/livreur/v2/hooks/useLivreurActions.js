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
  const programmerLivraison = useCallback(async (dossierOrId, data) => {
    try {
      setProcessing(true);

      // Extraire l'ID si c'est un objet dossier
      const dossierId = typeof dossierOrId === 'object' ? dossierOrId.id : dossierOrId;

      // Validation
      const validation = validateDeliveryData(data);
      if (!validation.isValid) {
        validation.errors.forEach(err => {
          notificationService.error(err);
        });
        return false;
      }

      // Appel API - Utiliser updateDossier pour ne modifier QUE les champs de livraison
      const updateData = {
        date_livraison_prevue: data.date_livraison || data.date_livraison_prevue,
        adresse_livraison: data.adresse_livraison,
        notes_livraison: data.notes
        // PAS de champ 'statut' => le statut reste inchangé
      };

      console.log('🔍 [PROGRAMMER] Données envoyées:', updateData);
      console.log('🔍 [PROGRAMMER] ID dossier:', dossierId);

      const result = await dossiersService.updateDossier(dossierId, updateData);

      console.log('✅ [PROGRAMMER] Résultat retourné:', result);

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

      // Utiliser changeStatus pour changer le statut
      await dossiersService.changeStatus(dossierId, 'livre', data.commentaire);

      // Puis mettre à jour les détails de livraison
      await dossiersService.updateDossier(dossierId, {
        date_livraison_reelle: new Date().toISOString(),
        signature: data.signature
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
      setProcessing(true);

      await dossiersService.updateDossier(dossierId, {
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
