import { errorHandler } from './errorHandlerService';
import { dossierSync } from './dossierSyncService';
import { DossierIdResolver } from './dossierIdResolver';

/**
 * Frontend workflow service
 * - Normalise les statuts localisés en clés canoniques
 * - Empêche les imprimeurs de marquer 'termine'
 * - Traite 'imprimé' comme 'pret_livraison'
 * - Après 'livre' tente une auto-transition vers 'termine' (fire-and-forget)
 */
class WorkflowService {
  constructor() {
    this.devLog = (level, ...args) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console[level](...args);
      }
    };

    // Codes canoniques + alias rétro-compatibles
    this.statuses = {
      en_cours: { label: 'En cours' },
      pret_impression: { label: 'Prêt impression' },
      en_impression: { label: 'En impression' },
      imprime: { label: 'Imprimé' },
      pret_livraison: { label: 'Prêt livraison' },
      en_livraison: { label: 'En livraison' },
      livre: { label: 'Livré' },
      termine: { label: 'Terminé' },
      a_revoir: { label: 'À revoir' },
      // alias
      en_preparation: { label: 'En cours' },
      a_imprimer: { label: 'Prêt impression' },
      a_livrer: { label: 'Prêt livraison' },
      nouveau: { label: 'En cours' },
      valide: { label: 'Prêt impression' },
    };

    // Transitions canoniques (avec alias mappés sur les mêmes flux)
    this.transitions = {
      en_cours: ['pret_impression'],
      pret_impression: ['en_impression', 'a_revoir'],
      en_impression: ['imprime', 'a_revoir'],
      imprime: ['pret_livraison', 'a_revoir'],
      pret_livraison: ['en_livraison', 'livre', 'a_revoir'],
      en_livraison: ['livre'],
      livre: ['termine'],
      termine: [],
      a_revoir: ['en_cours', 'pret_impression'],
      // alias
      en_preparation: ['pret_impression'],
      a_imprimer: ['en_impression', 'a_revoir'],
      a_livrer: ['en_livraison', 'livre', 'a_revoir'],
      nouveau: ['pret_impression'],
      valide: ['en_impression', 'a_revoir'],
    };

    this.rolePermissions = {
      admin: { can_transition_to: Object.keys(this.statuses), can_force_transition: true },
      preparateur: { can_transition_to: ['en_cours', 'pret_impression'] },
      imprimeur: { can_transition_to: ['en_impression', 'imprime', 'pret_livraison', 'a_revoir'] },
      livreur: { can_transition_to: ['en_livraison', 'livre', 'termine'] }
    };
  }

  // Normalize localized or messy status strings into canonical keys
  normalizeStatusKey(status) {
    if (!status) return status;
    let s = String(status).trim().toLowerCase();
    try {
      s = s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    } catch (e) {
      s = s.replace(/[\u0300-\u036f]/g, '');
    }
    s = s.replace(/[^a-z0-9_ ]/g, '');
    // collapse spaces
    s = s.replace(/\s+/g, ' ');

    const map = {
      'imprime': 'imprime',
      'imprimee': 'imprime',
      'imprim': 'imprime',
      'imprime ': 'imprime',
      'imprimee ': 'imprime',
      'en impression': 'en_impression',
      'pret impression': 'pret_impression',
      'prêt impression': 'pret_impression',
      'pret livraison': 'pret_livraison',
      'prêt livraison': 'pret_livraison',
      'en cours': 'en_cours',
      'nouveau': 'en_cours',
      'valide': 'pret_impression',
      'a imprimer': 'pret_impression',
      'a livrer': 'pret_livraison',
      'a revoir': 'a_revoir',
    };

    return map[s] || s.replace(/ /g, '_');
  }

  isOwner(dossier, user) {
    return !!(dossier && user && (dossier.created_by === user.id || dossier.preparateur_id === user.id));
  }

  getStatusInfo(status) {
    const key = this.normalizeStatusKey(status);
    return this.statuses[key] || { label: status };
  }

  getAvailableTransitions(dossier, userRole, user = null) {
    if (!dossier || !dossier.statut) return [];
    const cur = this.normalizeStatusKey(dossier.statut);
    const possible = this.transitions[cur] || [];
    const roleCfg = this.rolePermissions[userRole] || {};
    if (!roleCfg) return [];

    return possible
      .filter(to => {
        if (roleCfg.can_force_transition) return true;
        const key = this.normalizeStatusKey(to);
        return Array.isArray(roleCfg.can_transition_to) && roleCfg.can_transition_to.includes(key);
      })
      .map(to => ({ key: this.normalizeStatusKey(to), ...this.getStatusInfo(to), canTransition: true }));
  }

  validateTransition(fromStatus, toStatus, userRole, dossier, user = null) {
    const fromKey = this.normalizeStatusKey(fromStatus);
    const toKey = this.normalizeStatusKey(toStatus);

    if (!this.statuses[fromKey]) {
      const e = new Error(`Statut source invalide: ${fromStatus}`);
      e.code = 'INVALID_FROM_STATUS';
      throw e;
    }
    if (!this.statuses[toKey]) {
      const e = new Error(`Statut destination invalide: ${toStatus}`);
      e.code = 'INVALID_TO_STATUS';
      throw e;
    }

    const allowed = this.transitions[fromKey] || [];
    if (!allowed.includes(toKey)) {
      const e = new Error(`Transition non autorisée de "${fromStatus}" vers "${toStatus}"`);
      e.code = 'INVALID_STATUS_TRANSITION';
      throw e;
    }

    const roleCfg = this.rolePermissions[userRole] || {};
    if (roleCfg.can_force_transition) return true;
    if (!Array.isArray(roleCfg.can_transition_to) || !roleCfg.can_transition_to.includes(toKey)) {
      const e = new Error(`Le rôle "${userRole}" ne peut pas changer le statut vers "${toStatus}"`);
      e.code = 'ROLE_CANNOT_TRANSITION';
      throw e;
    }

    return true;
  }

  // dossierLike can be id or object
  async changeStatus(dossierLike, newStatus, reason = '', user = null) {
    try {
      const dossierId = DossierIdResolver.resolve(dossierLike);
      if (!dossierId) {
        const e = new Error('Identifiant de dossier invalide');
        e.code = 'INVALID_DOSSIER_ID';
        throw e;
      }

      const dossier = await dossierSync.getDossier(dossierId);
      if (!dossier) {
        const e = new Error("Ce dossier n'existe pas ou vous n'avez pas l'autorisation pour cette action");
        e.code = 'DOSSIER_NOT_FOUND';
        throw e;
      }

      const currentStatus = dossier.statut;
      const userRole = user?.role || localStorage.getItem('user_role') || 'user';

      this.devLog('log', `Changement de statut: ${currentStatus} → ${newStatus} (${userRole})`);

      // validate using normalized keys
      this.validateTransition(currentStatus, newStatus, userRole, dossier, user);

      const result = await dossierSync.changeStatus(dossier, newStatus, reason);
      this.devLog('log', 'Statut changé avec succès', result && (result.id || dossierId));

      // If livre was just set, try to auto-mark termine (fire-and-forget)
      try {
        const normalizedNew = this.normalizeStatusKey(newStatus);
        if (normalizedNew === 'livre') {
          (async () => {
            try {
              await dossierSync.changeStatus(result.id || dossierId, 'termine', 'Auto: marqué terminé après livraison');
              this.devLog('log', `Auto-transition: ${result.id || dossierId} livre -> termine`);
            } catch (errAuto) {
              this.devLog('warn', 'Auto-transition échouée:', errAuto);
            }
          })();
        }
      } catch (e) {
        this.devLog('warn', 'Erreur auto-transition:', e);
      }

      return result;
    } catch (error) {
      const processed = errorHandler.handleError(error);
      this.devLog('warn', 'Erreur changement statut:', processed);
      throw processed;
    }
  }

  async getStatusHistory(dossierLike) {
    try {
      const dossierId = DossierIdResolver.resolve(dossierLike);
      // Placeholder: actual implementation should call an API
      return [
        { dossier_id: dossierId, from_status: 'nouveau', to_status: 'en_preparation', changed_by: 'Système', changed_at: new Date().toISOString(), reason: 'Exemple' }
      ];
    } catch (err) {
      this.devLog('warn', 'Erreur récupération historique:', err);
      return [];
    }
  }

  // Suggest the next action for UI convenience
  getNextSuggestedAction(dossier, userRole) {
    const avail = this.getAvailableTransitions(dossier, userRole);
    if (!avail || avail.length === 0) return null;

    const priority = {
      nouveau: ['en_preparation'],
      en_preparation: ['valide'],
      valide: ['en_impression'],
      en_impression: ['pret_livraison'],
      pret_livraison: ['livre']
    };

    const suggested = priority[this.normalizeStatusKey(dossier.statut)];
    if (suggested) {
      for (const s of suggested) {
        const t = avail.find(a => a.key === s);
        if (t) return { ...t, suggestion: true };
      }
    }

    return { ...avail[0], suggestion: true };
  }
}

export const workflowService = new WorkflowService();
export default workflowService;