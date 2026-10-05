// API simulée : même contrat que le serveur (API.md). Le circuit des dossiers, les paiements,
// les notifications et les statistiques sont calculés en mémoire ; les autres écrans de
// consultation rejouent les réponses enregistrées. Aucune requête ne sort du navigateur.
// Les chemins GET calculés ici ne sont pas enregistrés : liste DOMAINE de outils/enregistrer.mjs.

import type { Role } from '@evocom/shared';
import { connecte, E, maintenant, sauvegarder, type UserDemo } from './etat';
import { MESSAGE_DEMO, badRequest, forbidden, idDe, notFound, pasEnDemo, qBool, qInt, qList, qStr, reponseErreur, unauthorized, type Reponse, type Requete } from './http';
import * as dossiers from './domaine/dossiers';
import * as paiements from './domaine/paiements';
import * as notifications from './domaine/notifications';
import * as stats from './domaine/stats';
import * as livraisons from './domaine/livraisons';
import * as ref from './domaine/referentiels';
import { suggestion } from './domaine/ia';
import * as fichiers from './fichiers';
import { reponseEnregistree } from './enregistrements';

export const MOT_DE_PASSE_DEMO = 'Evocom2026!';

type Gestionnaire = (r: Requete, p: string[], u: UserDemo) => unknown;
interface Route {
  methode: string;
  motif: RegExp;
  roles?: Role[];
  f: Gestionnaire;
  /** Code de réponse en cas de succès (201 pour une création, 204 sans corps). */
  code?: number;
}

const ADMIN: Role[] = ['admin'];
const BUREAU: Role[] = ['admin', 'preparateur'];
const ENCAISSEURS: Role[] = ['admin', 'preparateur', 'livreur'];
const ID = '(\\d+)';
const routes: Route[] = [];
const route = (methode: string, chemin: string, f: Gestionnaire, opts: { roles?: Role[]; code?: number } = {}) =>
  routes.push({ methode, motif: new RegExp(`^${chemin}$`), f, ...opts });

function moiPublic(u: UserDemo) {
  return { id: u.id, nom: u.nom, email: u.email, role: u.role, telephone: u.telephone, doit_changer_mdp: false };
}

/** Réponse enregistrée, sinon 404 explicite. */
function enregistree(r: Requete, u: UserDemo): unknown {
  const e = reponseEnregistree(u.role, r.chemin, r.query);
  if (!e.trouve) throw notFound('Démonstration : ces données ne sont pas disponibles hors connexion.');
  return e.corps;
}

// ---------------------------------------------------------------------------
// Dossiers et circuit

route('GET', '/dossiers', (r, _p, u) =>
  dossiers.lister(u, {
    statut: qList(r, 'statut'),
    machine: qStr(r, 'machine'),
    q: qStr(r, 'q'),
    urgent: qBool(r, 'urgent'),
    mine: qBool(r, 'mine'),
    file: qStr(r, 'file'),
    client_id: qInt(r, 'client_id'),
    page: qInt(r, 'page'),
    limit: qInt(r, 'limit'),
    tri: qStr(r, 'tri'),
  }),
);
route('POST', '/dossiers', (r, _p, u) => dossiers.detail(u, dossiers.creer(u, r.body).id), { roles: BUREAU, code: 201 });
route('GET', `/dossiers/${ID}`, (_r, p, u) => dossiers.detail(u, idDe(p[0])));
route('PATCH', `/dossiers/${ID}`, (r, p, u) => (dossiers.modifier(u, idDe(p[0]), r.body), dossiers.detail(u, idDe(p[0]))), { roles: BUREAU });
route('DELETE', `/dossiers/${ID}`, (r, p, u) => dossiers.supprimer(u, idDe(p[0]), r.body), { roles: BUREAU, code: 204 });
route('POST', `/dossiers/${ID}/restaurer`, (_r, p, u) => (dossiers.restaurer(u, idDe(p[0])), dossiers.detail(u, idDe(p[0]))), { roles: ADMIN });
route('POST', `/dossiers/${ID}/actions/([a-z_]+)`, (r, p, u) => (dossiers.executerAction(u, idDe(p[0]), p[1]!, r.body), dossiers.detail(u, idDe(p[0]))));
route('POST', `/dossiers/${ID}/forcer-statut`, (r, p, u) => (dossiers.forcerStatut(u, idDe(p[0]), r.body), dossiers.detail(u, idDe(p[0]))), { roles: ADMIN });
route('POST', `/dossiers/${ID}/reporter`, (r, p, u) => (dossiers.reporterLivraison(u, idDe(p[0]), r.body), dossiers.detail(u, idDe(p[0]))), { roles: ['admin', 'livreur'] });
route('POST', `/dossiers/${ID}/urgence`, (r, p, u) => (dossiers.definirUrgence(u, idDe(p[0]), r.body), dossiers.detail(u, idDe(p[0]))), { roles: BUREAU });
route('POST', `/dossiers/${ID}/affecter`, (r, p, u) => (dossiers.affecter(u, idDe(p[0]), r.body), dossiers.detail(u, idDe(p[0]))), { roles: ADMIN });
route('POST', `/dossiers/${ID}/commentaires`, (r, p, u) => (dossiers.commenter(u, idDe(p[0]), r.body), dossiers.detail(u, idDe(p[0]))), { code: 201 });
route('POST', `/dossiers/${ID}/paiements`, (r, p, u) => paiements.encaisser(u, idDe(p[0]), r.body), { roles: ENCAISSEURS, code: 201 });
route('POST', `/dossiers/${ID}/facture`, () => {
  throw pasEnDemo('Démonstration : l’émission d’une facture n’est pas enregistrée. Les factures existantes restent consultables dans Factures.');
});
route(
  'GET',
  `/dossiers/${ID}/bon-de-travail\\.pdf`,
  (_r, p, u) => {
    dossiers.charger(u, idDe(p[0]));
    return { document: 'bon-de-travail' };
  },
  { roles: ['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox'] },
);

// ---------------------------------------------------------------------------
// Fichiers

route('PATCH', `/fichiers/${ID}`, (r, p, u) => fichiers.marquer(u, idDe(p[0]), r.body), { code: 204 });
route('DELETE', `/fichiers/${ID}`, (_r, p, u) => fichiers.supprimer(u, idDe(p[0])), { code: 204 });

// ---------------------------------------------------------------------------
// Paiements, caisse, notifications

route('GET', '/paiements', (r, _p, u) => paiements.lister(u, r), { roles: ENCAISSEURS });
route('POST', `/paiements/${ID}/valider`, (_r, p, u) => paiements.valider(u, idDe(p[0])), { roles: ADMIN });
route('POST', `/paiements/${ID}/refuser`, (r, p, u) => paiements.refuser(u, idDe(p[0]), r.body), { roles: ADMIN });
route('GET', '/caisse', () => paiements.caisse(), { roles: ADMIN });
route('GET', '/notifications', (r, _p, u) => notifications.lister(u, qBool(r, 'non_lues') === true));
route(
  'POST',
  '/notifications/lues',
  (r, _p, u) => {
    const ids = r.body?.ids;
    if (ids !== undefined && (!Array.isArray(ids) || ids.some((x: unknown) => !Number.isInteger(x)))) {
      throw badRequest('Certains champs sont invalides.', { champs: { ids: 'La liste « ids » doit être un tableau de numéros de notification' } });
    }
    notifications.marquerLues(u, ids);
  },
  { code: 204 },
);

// ---------------------------------------------------------------------------
// Statistiques et livraisons

route('GET', '/stats/apercu', (r) => stats.apercu(r), { roles: ADMIN });
route('GET', '/stats/evolution', (r) => stats.evolution(r), { roles: ADMIN });
route('GET', '/stats/production', (r) => stats.production(r), { roles: ADMIN });
route('GET', '/stats/top-clients', (r) => stats.topClients(r), { roles: ADMIN });
route('GET', '/livraisons/planning', (r, _p, u) => livraisons.planning(u, r), { roles: ['admin', 'livreur'] });
route('GET', '/livraisons/historique', (r, _p, u) => livraisons.historique(u, r), { roles: ['admin', 'livreur'] });

// ---------------------------------------------------------------------------
// Clients, tarifs, paramètres, utilisateurs, apparence

route('GET', '/clients', (r, _p, u) => ref.listerClients(u, r), { roles: BUREAU });
route('GET', '/clients/recherche', (r, _p, u) => ref.rechercherClients(u, r), { roles: BUREAU });
route('GET', `/clients/${ID}`, (_r, p, u) => ref.detailClient(u, idDe(p[0])), { roles: BUREAU });
route('POST', '/clients', (r, _p, u) => ref.creerClient(u, r.body), { roles: BUREAU, code: 201 });
route('PATCH', `/clients/${ID}`, (r, p, u) => ref.modifierClient(u, idDe(p[0]), r.body), { roles: BUREAU });
route('POST', `/clients/${ID}/fusionner`, (r, p, u) => ref.fusionnerClients(u, idDe(p[0]), r.body), { roles: ADMIN });

route('GET', '/tarifs', (_r, _p, u) => ref.listerTarifs(u), { roles: BUREAU });
route('GET', '/tarifs/libelles', () => ref.libellesTarifs());
route('POST', '/tarifs', (r, _p, u) => ref.creerTarif(u, r.body), { roles: ADMIN, code: 201 });
route('PATCH', `/tarifs/${ID}`, (r, p, u) => ref.modifierTarif(u, idDe(p[0]), r.body), { roles: ADMIN });
route('POST', '/tarifs/estimer', (r, _p, u) => ref.estimer(u, r.body), { roles: BUREAU });

route('GET', '/parametres', (_r, _p, u) => ref.lireParametres(u));
route('GET', '/parametres/regles', () => ref.regles());
route('PUT', '/parametres', (r, _p, u) => ref.ecrireParametres(u, r.body), { roles: ADMIN });

route('GET', '/users/annuaire', (_r, _p, u) => ref.annuaire(u), { roles: BUREAU });
route('GET', '/users', (_r, _p, u) => ref.listerUsers(u), { roles: ADMIN });
route('POST', '/users', (r, _p, u) => ref.creerUser(u, r.body), { roles: ADMIN, code: 201 });
route('PATCH', `/users/${ID}`, (r, p, u) => ref.modifierUser(u, idDe(p[0]), r.body), { roles: ADMIN });
route('POST', `/users/${ID}/reinitialiser-mot-de-passe`, () => {
  throw pasEnDemo('Démonstration : les mots de passe ne changent pas. Tous les comptes de démonstration utilisent Evocom2026!.');
});

route('PUT', '/apparence', (r, _p, u) => ref.ecrireApparence(u, r.body), { roles: ADMIN });
route('GET', '/preferences', (_r, _p, u) => ref.lirePreferences(u));
route('PUT', '/preferences', (r, _p, u) => ref.ecrirePreferences(u, r.body));
route('GET', '/corbeille', (_r, _p, u) => ref.corbeille(u), { roles: ADMIN });

// Journal : les actions de la démonstration devant le journal enregistré.
route(
  'GET',
  '/journal',
  (r, _p, u) => {
    const base = (reponseEnregistree(u.role, '/journal', r.query).corps as any) ?? { items: [], total: 0, page: 1, limit: 50 };
    const filtre = qStr(r, 'action') || qStr(r, 'user_id') || qStr(r, 'from') || qStr(r, 'to') || qStr(r, 'cible');
    if (filtre || (qInt(r, 'page') ?? 1) > 1) return base;
    const ajouts = E().journal.map((j) => ({ ...j, user_nom: E().users.find((x) => x.id === j.user_id)?.nom ?? null }));
    return { ...base, items: [...ajouts, ...(base.items ?? [])], total: (base.total ?? 0) + ajouts.length };
  },
  { roles: ADMIN },
);

// ---------------------------------------------------------------------------
// Assistant IA

route('GET', '/ia/statut', () => ({ actif: E().ia.actif }), { roles: BUREAU });
route('GET', '/ia/config', (r, _p, u) => ref.configIA(reponseEnregistree(u.role, r.chemin, r.query).corps), { roles: ADMIN });
route('PUT', '/ia/config', (r, _p, u) => ref.ecrireConfigIA(u, r.body, reponseEnregistree(u.role, '/ia/config', new URLSearchParams()).corps), { roles: ADMIN });
route('GET', '/ia/usages', (r, _p, u) => ref.usagesIA(reponseEnregistree(u.role, r.chemin, r.query).corps), { roles: ADMIN });
route('POST', '/ia/suggestion', (r, _p, u) => suggestion(u, r.body), { roles: BUREAU });
route('POST', '/ia/test', () => {
  throw pasEnDemo('Démonstration : aucune connexion à OpenAI. L’assistant répond avec des propositions d’exemple.');
});

// ---------------------------------------------------------------------------
// Système : rien n'est réinitialisé ni importé dans la démonstration

route('POST', '/systeme/reinitialiser', () => {
  throw pasEnDemo('Démonstration : la réinitialisation des données est désactivée. Utilisez « Réinitialiser la démo » dans le bandeau pour repartir des données de départ.');
});

// ---------------------------------------------------------------------------

function traiterAuth(r: Requete): Reponse | null {
  if (r.chemin === '/auth/login' && r.methode === 'POST') {
    const email = String(r.body?.email ?? '').trim().toLowerCase();
    const u = E().users.find((x) => x.email.toLowerCase() === email);
    if (!u || r.body?.password !== MOT_DE_PASSE_DEMO || !u.is_active) {
      return reponseErreur(unauthorized(u && r.body?.password === MOT_DE_PASSE_DEMO ? 'Ce compte est désactivé.' : 'E-mail ou mot de passe incorrect. Démonstration : mot de passe Evocom2026!'));
    }
    E().userId = u.id;
    u.last_login_at = maintenant();
    return { status: 200, body: { user: moiPublic(u) } };
  }
  if (r.chemin === '/auth/logout' && r.methode === 'POST') {
    E().userId = null;
    return { status: 204 };
  }
  if (r.chemin === '/auth/me' && r.methode === 'GET') {
    const u = connecte();
    return u ? { status: 200, body: { user: moiPublic(u) } } : reponseErreur(unauthorized());
  }
  if (r.chemin === '/apparence' && r.methode === 'GET') return { status: 200, body: E().apparence };
  return null;
}

/** Traite une requête /api/… et renvoie la réponse (jamais d'exception). */
export function traiter(r: Requete): Reponse {
  try {
    const auth = traiterAuth(r);
    if (auth) {
      if (r.methode !== 'GET') sauvegarder();
      return auth;
    }
    const u = connecte();
    if (!u) throw unauthorized();
    const methode = r.methode === 'HEAD' ? 'GET' : r.methode;
    for (const rt of routes) {
      if (rt.methode !== methode) continue;
      const m = rt.motif.exec(r.chemin);
      if (!m) continue;
      if (rt.roles && !rt.roles.includes(u.role)) throw forbidden();
      const corps = rt.f(r, m.slice(1), u);
      if (methode !== 'GET') sauvegarder();
      const code = rt.code ?? 200;
      return code === 204 ? { status: 204 } : { status: code, body: corps };
    }
    if (methode === 'GET') return { status: 200, body: enregistree(r, u) };
    throw pasEnDemo(MESSAGE_DEMO);
  } catch (e) {
    return reponseErreur(e);
  }
}
