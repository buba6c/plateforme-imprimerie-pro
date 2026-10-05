// Données de référence modifiables en mémoire : clients, tarifs, paramètres, utilisateurs,
// apparence et préférences, corbeille, assistant IA (lecture et réglages simples).

import { calculerPrix, CATEGORIES_TARIF, MACHINES, specsSchemaFor, telephoneSchema, UNITES_TARIF, userCreateSchema, userUpdateSchema, type Specs } from '@evocom/shared';
import { z } from 'zod';
import { E, maintenant, prochainId, utilisateur, type ClientDemo, type Preferences, type UserDemo } from '../etat';
import { badRequest, conflict, contient, forbidden, notFound, pagination, pasEnDemo, qStr, type Requete } from '../http';
import { journal } from './notifications';
import { tarifsPrix } from './dossiers';

const bureau = (u: UserDemo) => u.role === 'admin' || u.role === 'preparateur';
const exigerBureau = (u: UserDemo) => {
  if (!bureau(u)) throw forbidden();
};
const exigerAdmin = (u: UserDemo) => {
  if (u.role !== 'admin') throw forbidden();
};

// ---------------------------------------------------------------------------
// Clients (api/src/modules/clients/routes.ts)

function totaux(clientId: number) {
  const dossiers = E().dossiers.filter((d) => d.client_id === clientId && !d.deleted_at);
  let total_commandes = 0;
  let total_paye = 0;
  let reste_du = 0;
  let dernier: string | null = null;
  for (const d of dossiers) {
    const paye = E()
      .paiements.filter((p) => p.dossier_id === d.id && p.statut === 'valide')
      .reduce((s, p) => s + p.montant, 0);
    total_commandes += d.montant ?? 0;
    total_paye += paye;
    reste_du += Math.max(0, (d.montant ?? 0) - paye);
    if (!dernier || d.created_at > dernier) dernier = d.created_at;
  }
  return { nb_dossiers: dossiers.length, total_commandes, total_paye, reste_du, dernier_dossier_at: dernier };
}

const chiffres = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

export function listerClients(user: UserDemo, r: Requete) {
  exigerBureau(user);
  const { page, limit, offset } = pagination(r, 50, 200);
  const q = qStr(r, 'q');
  let l = E().clients.filter((c) => c.fusionne_dans === null);
  if (q) {
    const ch = chiffres(q);
    l = l.filter((c) => contient(c.nom, q) || contient(c.email, q) || (ch.length >= 3 && chiffres(c.telephone).includes(ch)));
  }
  const lignes = l.map((c) => ({ c, t: totaux(c.id) }));
  lignes.sort(
    (a, b) =>
      (b.t.dernier_dossier_at ?? '').localeCompare(a.t.dernier_dossier_at ?? '') ||
      a.c.nom.toLowerCase().localeCompare(b.c.nom.toLowerCase()) ||
      a.c.id - b.c.id,
  );
  return {
    items: lignes.slice(offset, offset + limit).map(({ c, t }) => ({ id: c.id, nom: c.nom, telephone: c.telephone, email: c.email, adresse: c.adresse, ...t })),
    total: lignes.length,
    page,
    limit,
  };
}

export function rechercherClients(user: UserDemo, r: Requete) {
  exigerBureau(user);
  const q = (qStr(r, 'q') ?? '').slice(0, 100);
  if (!q) return [];
  const ql = q.toLowerCase();
  const ch = chiffres(q);
  return E()
    .clients.filter((c) => c.fusionne_dans === null && (contient(c.nom, q) || (ch.length >= 3 && chiffres(c.telephone).includes(ch))))
    .sort((a, b) => Number(b.nom.toLowerCase().startsWith(ql)) - Number(a.nom.toLowerCase().startsWith(ql)) || a.nom.toLowerCase().localeCompare(b.nom.toLowerCase()) || a.id - b.id)
    .slice(0, 10)
    .map((c) => ({ id: c.id, nom: c.nom, telephone: c.telephone, email: c.email }));
}

export function detailClient(user: UserDemo, id: number) {
  exigerBureau(user);
  const c = E().clients.find((x) => x.id === id);
  if (!c) throw notFound("Ce client n'existe pas.");
  const t = totaux(id);
  const dossiers = E()
    .dossiers.filter((d) => d.client_id === id && !d.deleted_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
    .slice(0, 20)
    .map((d) => ({
      id: d.id,
      numero: d.numero,
      machine: d.machine,
      statut: d.statut,
      client_nom: d.client_nom,
      description: d.description,
      montant: d.montant,
      urgent: d.urgent,
      date_promise: d.date_promise,
      created_at: d.created_at,
      livre_at: d.livre_at,
      deja_paye: E()
        .paiements.filter((p) => p.dossier_id === d.id && p.statut === 'valide')
        .reduce((s, p) => s + p.montant, 0),
    }));
  return {
    ...c,
    fusionne_dans_nom: c.fusionne_dans ? (E().clients.find((x) => x.id === c.fusionne_dans)?.nom ?? null) : null,
    dossiers,
    totaux: { nb_dossiers: t.nb_dossiers, total_commandes: t.total_commandes, total_paye: t.total_paye, reste_du: t.reste_du },
  };
}

const texteOpt = (max: number, libelle: string) =>
  z
    .string({ invalid_type_error: `${libelle} : texte attendu` })
    .trim()
    .max(max, `${libelle} : ${max} caractères au maximum`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const clientSchema = z.object({
  nom: z.string({ required_error: 'Indiquez le nom du client' }).trim().min(1, 'Indiquez le nom du client').max(200, 'Nom : 200 caractères au maximum'),
  telephone: telephoneSchema,
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Adresse e-mail invalide')
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional(),
  adresse: texteOpt(500, 'Adresse'),
  notes: texteOpt(2000, 'Notes'),
});

function verifierDoublon(nom: string, telephone: string | null, saufId?: number) {
  const d = E().clients.find(
    (c) => c.fusionne_dans === null && c.nom.trim().toLowerCase() === nom.trim().toLowerCase() && (c.telephone ?? null) === telephone && c.id !== saufId,
  );
  if (d) {
    throw conflict(
      `Un client « ${nom} »${telephone ? ` avec le numéro ${telephone}` : ' sans téléphone'} existe déjà (fiche n° ${d.id}). Choisissez-le dans la liste ou précisez le nom.`,
      { client_id: d.id },
    );
  }
}

export function creerClient(user: UserDemo, body: unknown) {
  exigerBureau(user);
  const input = clientSchema.parse(body ?? {});
  verifierDoublon(input.nom, input.telephone ?? null);
  const c: ClientDemo = {
    id: prochainId('client'),
    nom: input.nom,
    telephone: input.telephone ?? null,
    email: input.email ?? null,
    adresse: input.adresse ?? null,
    notes: input.notes ?? null,
    fusionne_dans: null,
    created_at: maintenant(),
    updated_at: maintenant(),
  };
  E().clients.push(c);
  return detailClient(user, c.id);
}

export function modifierClient(user: UserDemo, id: number, body: unknown) {
  exigerBureau(user);
  const input = clientSchema.partial().parse(body ?? {});
  const c = E().clients.find((x) => x.id === id);
  if (!c) throw notFound("Ce client n'existe pas.");
  if (c.fusionne_dans) throw conflict(`Ce client a été fusionné dans la fiche n° ${c.fusionne_dans} : modifiez plutôt cette fiche.`, { fusionne_dans: c.fusionne_dans });
  const changements: Record<string, { avant: unknown; apres: unknown }> = {};
  for (const k of ['nom', 'telephone', 'email', 'adresse', 'notes'] as const) {
    if (input[k] === undefined) continue;
    const v = input[k] ?? null;
    if (v !== c[k]) changements[k] = { avant: c[k], apres: v };
  }
  if (changements.nom || changements.telephone) {
    verifierDoublon(input.nom ?? c.nom, input.telephone !== undefined ? (input.telephone ?? null) : c.telephone, id);
  }
  for (const [k, v] of Object.entries(changements)) (c as any)[k] = v.apres;
  if (Object.keys(changements).length) {
    c.updated_at = maintenant();
    journal(user, 'client_modifie', 'client', id, changements);
  }
  return detailClient(user, id);
}

export function fusionnerClients(user: UserDemo, id: number, body: any) {
  exigerAdmin(user);
  const dansId = Number(body?.dans_id);
  if (!Number.isInteger(dansId) || dansId <= 0) throw badRequest('Certains champs sont invalides.', { champs: { dans_id: 'Fiche de destination invalide' } });
  if (dansId === id) throw badRequest('Choisissez une autre fiche : un client ne peut pas être fusionné avec lui-même.');
  const e = E();
  const source = e.clients.find((c) => c.id === id);
  const cible = e.clients.find((c) => c.id === dansId);
  if (!source) throw notFound("Le client à fusionner n'existe pas.");
  if (!cible) throw notFound("La fiche de destination n'existe pas.");
  if (source.fusionne_dans) throw conflict(`Ce client a déjà été fusionné dans la fiche n° ${source.fusionne_dans}.`);
  if (cible.fusionne_dans) throw conflict(`La fiche de destination a elle-même été fusionnée dans la fiche n° ${cible.fusionne_dans} : choisissez celle-ci.`);
  let dossiers = 0;
  for (const d of e.dossiers) {
    if (d.client_id === id) {
      d.client_id = dansId;
      dossiers += 1;
    }
  }
  for (const c of e.clients) if (c.fusionne_dans === id) c.fusionne_dans = dansId;
  cible.telephone = cible.telephone ?? source.telephone;
  cible.email = cible.email ?? source.email;
  cible.adresse = cible.adresse ?? source.adresse;
  if (source.notes) cible.notes = cible.notes ? `${cible.notes}\n${source.notes}` : source.notes;
  source.fusionne_dans = dansId;
  const fusion = { source: { id, nom: source.nom }, destination: { id: dansId, nom: cible.nom }, dossiers, devis: 0, factures: 0 };
  journal(user, 'client_fusionne', 'client', id, fusion);
  return { ...detailClient(user, dansId), fusion };
}

// ---------------------------------------------------------------------------
// Tarifs

const ordreTarifs = (a: any, b: any) =>
  a.machine.localeCompare(b.machine) || a.categorie.localeCompare(b.categorie) || a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, 'fr');

export function listerTarifs(user: UserDemo) {
  exigerBureau(user);
  return [...E().tarifs].sort(ordreTarifs);
}

export function libellesTarifs() {
  return [...E().tarifs].sort(ordreTarifs).map((t) => ({ machine: t.machine, categorie: t.categorie, code: t.code, libelle: t.libelle, unite: t.unite }));
}

const tarifSchema = z.object({
  machine: z.enum(['roland', 'xerox', 'global']),
  categorie: z.enum(CATEGORIES_TARIF),
  code: z.string().trim().regex(/^[a-z0-9_]{2,64}$/, 'Code : lettres minuscules, chiffres et _ uniquement'),
  libelle: z.string().trim().min(2).max(120),
  unite: z.enum(UNITES_TARIF),
  prix: z.number().int().nonnegative().max(100_000_000).nullable(),
  actif: z.boolean().default(true),
  ordre: z.number().int().default(0),
  description: z.string().max(500).nullable().optional(),
});

export function creerTarif(user: UserDemo, body: unknown) {
  exigerAdmin(user);
  const t = tarifSchema.parse(body);
  if (E().tarifs.some((x) => x.machine === t.machine && x.code === t.code)) throw conflict('Ce code existe déjà pour cette machine.');
  const now = maintenant();
  const ligne = { id: prochainId('tarif'), ...t, description: t.description ?? null, updated_by: user.id, created_at: now, updated_at: now };
  E().tarifs.push(ligne);
  journal(user, 'tarif_cree', 'tarif', ligne.id, t);
  return ligne;
}

export function modifierTarif(user: UserDemo, id: number, body: unknown) {
  exigerAdmin(user);
  const t = tarifSchema.partial().omit({ code: true, machine: true }).parse(body);
  const avant = E().tarifs.find((x) => x.id === id);
  if (!avant) throw notFound('Tarif introuvable.');
  const ancien = { prix: avant.prix, actif: avant.actif };
  for (const [k, v] of Object.entries(t)) if (v !== undefined) (avant as any)[k] = v;
  avant.updated_by = user.id;
  avant.updated_at = maintenant();
  journal(user, 'tarif_modifie', 'tarif', id, { avant: ancien, apres: t });
  return avant;
}

export function estimer(user: UserDemo, body: any) {
  exigerBureau(user);
  const b = z.object({ machine: z.enum(MACHINES), specs: z.unknown() }).parse(body);
  const specs = specsSchemaFor(b.machine).parse(b.specs) as Specs;
  return calculerPrix(b.machine, specs, tarifsPrix(), E().parametres.prix);
}

// ---------------------------------------------------------------------------
// Paramètres

const SECTIONS_PUBLIQUES = ['entreprise', 'prix', 'livreur_jours_historique', 'fuseau'];

export function lireParametres(user: UserDemo) {
  const p = E().parametres;
  if (user.role === 'admin') return p;
  return Object.fromEntries(SECTIONS_PUBLIQUES.map((k) => [k, p[k]]));
}

export function regles() {
  const p = E().parametres;
  const r = E().regles ?? {};
  return {
    fichiers: { ...(p.fichiers ?? {}), plafond_serveur_mo: r.fichiers?.plafond_serveur_mo ?? p.fichiers?.taille_max_mo ?? 4096 },
    securite: { mdp_longueur_min: p.securite?.mdp_longueur_min ?? 8 },
    documents: { devis_validite_jours: p.documents?.devis_validite_jours ?? 15 },
  };
}

export function ecrireParametres(user: UserDemo, body: any) {
  exigerAdmin(user);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Corps de requête JSON invalide.');
  const p = E().parametres;
  const changements: Record<string, { avant: unknown; apres: unknown }> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!(k in p) || v === undefined) continue;
    const avant = p[k];
    const apres = v && typeof v === 'object' && !Array.isArray(v) && avant && typeof avant === 'object' ? { ...avant, ...v } : v;
    if (JSON.stringify(avant) !== JSON.stringify(apres)) {
      changements[k] = { avant, apres };
      p[k] = apres;
    }
  }
  if (Object.keys(changements).length) journal(user, 'parametres_modifies', 'parametres', null, changements);
  return p;
}

// ---------------------------------------------------------------------------
// Utilisateurs

function vueUser(u: UserDemo) {
  return {
    id: u.id,
    nom: u.nom,
    email: u.email,
    telephone: u.telephone,
    role: u.role,
    is_active: u.is_active,
    doit_changer_mdp: u.doit_changer_mdp,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
  };
}

export function annuaire(user: UserDemo) {
  exigerBureau(user);
  return E()
    .users.filter((u) => u.is_active)
    .sort((a, b) => a.role.localeCompare(b.role) || a.nom.localeCompare(b.nom))
    .map((u) => ({ id: u.id, nom: u.nom, role: u.role }));
}

export function listerUsers(user: UserDemo) {
  exigerAdmin(user);
  return [...E().users]
    .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.role.localeCompare(b.role) || a.nom.localeCompare(b.nom))
    .map((u) => ({ ...vueUser(u), nb_dossiers: E().dossiers.filter((d) => d.preparateur_id === u.id && !d.deleted_at).length }));
}

export function creerUser(user: UserDemo, body: unknown) {
  exigerAdmin(user);
  const input = userCreateSchema.parse(body);
  const min = E().parametres.securite?.mdp_longueur_min ?? 8;
  if (input.password.length < min) throw badRequest(`Le mot de passe doit contenir au moins ${min} caractères.`, { champs: { password: `Au moins ${min} caractères` } });
  if (E().users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw conflict('Un compte existe déjà avec cette adresse e-mail.');
  const u: UserDemo = {
    id: prochainId('user'),
    nom: input.nom,
    email: input.email,
    telephone: input.telephone ?? null,
    role: input.role,
    is_active: true,
    doit_changer_mdp: true,
    last_login_at: null,
    created_at: maintenant(),
  };
  E().users.push(u);
  journal(user, 'utilisateur_cree', 'user', u.id, { email: u.email, role: u.role });
  return vueUser(u);
}

export function modifierUser(user: UserDemo, id: number, body: unknown) {
  exigerAdmin(user);
  const input = userUpdateSchema.parse(body);
  if (id === user.id && (input.is_active === false || (input.role && input.role !== 'admin'))) {
    throw badRequest('Vous ne pouvez pas désactiver votre propre compte ni retirer votre rôle administrateur.');
  }
  const u = utilisateur(id);
  if (!u) throw notFound('Utilisateur introuvable.');
  if (!Object.values(input).some((v) => v !== undefined)) throw badRequest('Aucune modification.');
  if (input.email && E().users.some((x) => x.id !== id && x.email.toLowerCase() === input.email!.toLowerCase())) {
    throw conflict('Un compte existe déjà avec cette adresse e-mail.');
  }
  for (const [k, v] of Object.entries(input)) if (v !== undefined) (u as any)[k] = v;
  journal(user, 'utilisateur_modifie', 'user', id, input);
  return vueUser(u);
}

// ---------------------------------------------------------------------------
// Apparence et préférences

const PALETTES = ['evocom', 'sobre', 'perso'];
const hex = /^#[0-9a-fA-F]{6}$/;

export function ecrireApparence(user: UserDemo, body: any) {
  exigerAdmin(user);
  const palette = body?.palette_defaut;
  const perso = body?.couleurs_perso ?? null;
  if (!PALETTES.includes(palette)) throw badRequest('Certains champs sont invalides.', { champs: { palette_defaut: 'Palette inconnue' } });
  if (perso !== null && !(hex.test(perso?.debut ?? '') && hex.test(perso?.fin ?? ''))) {
    throw badRequest('Certains champs sont invalides.', { champs: { couleurs_perso: 'Couleur attendue au format #RRVVBB' } });
  }
  if (palette === 'perso' && !perso) throw badRequest('Certains champs sont invalides.', { champs: { couleurs_perso: 'Choisissez les deux couleurs de la palette personnalisée' } });
  const a = { palette_defaut: palette, couleurs_perso: perso ? { debut: perso.debut.toLowerCase(), fin: perso.fin.toLowerCase() } : null };
  journal(user, 'apparence_modifiee', 'parametres', 'apparence', { avant: E().apparence, apres: a });
  E().apparence = a;
  return a;
}

const PREFS_DEFAUT: Preferences = { theme: 'system', palette: null, contraste: 'normal' };

export function lirePreferences(user: UserDemo): Preferences {
  return E().preferences[user.id] ?? PREFS_DEFAUT;
}

export function ecrirePreferences(user: UserDemo, body: any) {
  const p = { ...lirePreferences(user) };
  if (body?.theme !== undefined) {
    if (!['system', 'light', 'dark'].includes(body.theme)) throw badRequest('Certains champs sont invalides.', { champs: { theme: 'Mode inconnu' } });
    p.theme = body.theme;
  }
  if ('palette' in (body ?? {})) {
    if (body.palette !== null && !PALETTES.includes(body.palette)) throw badRequest('Certains champs sont invalides.', { champs: { palette: 'Palette inconnue' } });
    p.palette = body.palette;
  }
  if (body?.contraste !== undefined) {
    if (!['normal', 'eleve'].includes(body.contraste)) throw badRequest('Certains champs sont invalides.', { champs: { contraste: 'Contraste inconnu' } });
    p.contraste = body.contraste;
  }
  E().preferences[user.id] = p;
  return p;
}

// ---------------------------------------------------------------------------
// Corbeille (dossiers supprimés)

export function corbeille(user: UserDemo) {
  exigerAdmin(user);
  const e = E();
  const supprimes = e.dossiers
    .filter((d) => d.deleted_at)
    .map((d) => ({
      id: d.id,
      numero: d.numero,
      machine: d.machine,
      client_nom: d.client_nom,
      statut: d.statut,
      montant: d.montant,
      deleted_at: d.deleted_at!,
      deleted_by: d.deleted_by,
      deleted_by_nom: utilisateur(d.deleted_by)?.nom ?? null,
      motif: [...d.evenements].reverse().find((x) => x.type === 'suppression')?.commentaire ?? null,
      nb_paiements: e.paiements.filter((p) => p.dossier_id === d.id && p.statut !== 'refuse').length,
    }));
  return [...supprimes, ...e.corbeille].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at) || b.id - a.id);
}

// ---------------------------------------------------------------------------
// Assistant IA : actif dans la démonstration, sans clé réelle

const MODELES = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'];

export function configIA(enregistree: any) {
  const ia = E().ia;
  return {
    actif: ia.actif,
    modele: ia.modele ?? enregistree?.modele ?? MODELES[0],
    modeles: enregistree?.modeles ?? MODELES,
    cle_configuree: true,
    cle_fin: 'demo',
    cle_lisible: true,
    updated_at: enregistree?.updated_at ?? null,
    updated_by_nom: enregistree?.updated_by_nom ?? null,
  };
}

export function ecrireConfigIA(user: UserDemo, body: any, enregistree: any) {
  exigerAdmin(user);
  if (body?.cle !== undefined) throw pasEnDemo('Démonstration : aucune clé OpenAI n’est enregistrée ; l’assistant répond avec des propositions d’exemple.');
  if (body?.actif !== undefined) {
    if (typeof body.actif !== 'boolean') throw badRequest('Certains champs sont invalides.', { champs: { actif: 'Activation : oui ou non' } });
    E().ia.actif = body.actif;
  }
  if (body?.modele !== undefined) {
    const modeles = enregistree?.modeles ?? MODELES;
    if (!modeles.includes(body.modele)) throw badRequest('Certains champs sont invalides.', { champs: { modele: `Modèle inconnu : choisissez ${modeles.join(', ')}` } });
    E().ia.modele = body.modele;
  }
  return configIA(enregistree);
}

export function usagesIA(enregistree: any) {
  return enregistree ?? { items: [], totaux_30_jours: { suggestions: 0, erreurs: 0, jetons_entree: 0, jetons_sortie: 0 } };
}

