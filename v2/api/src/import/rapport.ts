// Rapport d'import : compteurs par table, anomalies, fichiers, montants, statuts.
// Écrit en JSON (complet) et résumé en français pour la console.

import fs from 'node:fs';
import path from 'node:path';

export type Gravite = 'info' | 'attention' | 'erreur';

export interface Anomalie {
  table: string;
  legacy_id: string | null;
  code: string;
  gravite: Gravite;
  message: string;
  details?: unknown;
}

export interface CompteTable {
  lus: number;
  importes: number;
  ignores: number;
}

export interface FichierListe {
  chemin: string;
  taille: number;
  categorie?: string;
}

export interface FichierManquant {
  legacy_id: number | null;
  dossier_legacy_id: number | null;
  dossier_numero: string | null;
  nom: string | null;
  chemins_base: string[];
  taille_declaree: number | null;
  raison: string;
}

export interface RapportJson {
  version: 1;
  outil: string;
  mode: 'reel' | 'simulation';
  statut: 'ok' | 'echec' | 'refuse';
  debut: string;
  fin: string | null;
  duree_ms: number | null;
  erreur: string | null;
  source: {
    base: string;
    fuseau: string;
    racines_uploads: string[];
    tables: Record<string, number>;
    empreinte_avant: Record<string, { lignes: number; md5: string }>;
    empreinte_apres: Record<string, { lignes: number; md5: string }>;
    inchangee: boolean | null;
  };
  cible: {
    base: string;
    stockage: string;
    remplacement: boolean;
    migrations_appliquees: string[];
    lignes_supprimees_avant_import: Record<string, number>;
    lignes_apres_import: Record<string, number>;
    fichiers_v2_mis_de_cote: { nombre: number; octets: number; dossier: string | null };
  };
  tables: Record<string, CompteTable>;
  tables_non_reprises: { table: string; lignes: number; raison: string }[];
  statuts: {
    correspondances: { avant: string; apres: string; nombre: number }[];
    apres: Record<string, number>;
  };
  montants: {
    dossiers: {
      somme_montant_cfa_ancienne_base: number;
      somme_montants_retenus_avant_arrondi: number;
      somme_montants_retenus_arrondis: number;
      somme_v2: number;
      ecart_v2_moins_retenus: number;
      ecart_explique_par_arrondis: number;
      dossiers_avec_montant: number;
      dossiers_sans_montant: number;
      sources: Record<string, number>;
    };
    paiements: {
      somme_ancienne_base: number;
      somme_importee: number;
      somme_ignoree: number;
      par_statut_v2: Record<string, number>;
    };
    factures: { somme_ttc_ancienne_base: number; somme_ttc_importee: number; somme_ttc_ignoree: number };
  };
  fichiers: {
    copies: number;
    octets_copies: number;
    simulation_a_copier: number;
    simulation_octets_a_copier: number;
    par_regle: Record<string, number>;
    manquants: FichierManquant[];
    octets_manquants_declares: number;
    orphelins: FichierListe[];
    octets_orphelins: number;
    espace_libre_cible: number | null;
  };
  clients_fusionnes: { nom_retenu: string; variantes: string[]; dossiers: number }[];
  compteurs: { cle: string; annee: number; valeur: number; prochain: string }[];
  anomalies_par_code: Record<string, number>;
  anomalies: Anomalie[];
}

export class Rapport {
  readonly data: RapportJson;
  private debutMs = Date.now();

  constructor(opts: { mode: 'reel' | 'simulation'; sourceBase: string; cibleBase: string; stockage: string; racines: string[]; remplacement: boolean }) {
    this.data = {
      version: 1,
      outil: 'Evocom Print v2 : import de l’ancienne plateforme EvocomPrint',
      mode: opts.mode,
      statut: 'ok',
      debut: new Date().toISOString(),
      fin: null,
      duree_ms: null,
      erreur: null,
      source: {
        base: opts.sourceBase,
        fuseau: 'UTC',
        racines_uploads: opts.racines,
        tables: {},
        empreinte_avant: {},
        empreinte_apres: {},
        inchangee: null,
      },
      cible: {
        base: opts.cibleBase,
        stockage: opts.stockage,
        remplacement: opts.remplacement,
        migrations_appliquees: [],
        lignes_supprimees_avant_import: {},
        lignes_apres_import: {},
        fichiers_v2_mis_de_cote: { nombre: 0, octets: 0, dossier: null },
      },
      tables: {},
      tables_non_reprises: [],
      statuts: { correspondances: [], apres: {} },
      montants: {
        dossiers: {
          somme_montant_cfa_ancienne_base: 0,
          somme_montants_retenus_avant_arrondi: 0,
          somme_montants_retenus_arrondis: 0,
          somme_v2: 0,
          ecart_v2_moins_retenus: 0,
          ecart_explique_par_arrondis: 0,
          dossiers_avec_montant: 0,
          dossiers_sans_montant: 0,
          sources: {},
        },
        paiements: { somme_ancienne_base: 0, somme_importee: 0, somme_ignoree: 0, par_statut_v2: {} },
        factures: { somme_ttc_ancienne_base: 0, somme_ttc_importee: 0, somme_ttc_ignoree: 0 },
      },
      fichiers: {
        copies: 0,
        octets_copies: 0,
        simulation_a_copier: 0,
        simulation_octets_a_copier: 0,
        par_regle: {},
        manquants: [],
        octets_manquants_declares: 0,
        orphelins: [],
        octets_orphelins: 0,
        espace_libre_cible: null,
      },
      clients_fusionnes: [],
      compteurs: [],
      anomalies_par_code: {},
      anomalies: [],
    };
  }

  table(nom: string): CompteTable {
    return (this.data.tables[nom] ??= { lus: 0, importes: 0, ignores: 0 });
  }

  anomalie(table: string, legacyId: unknown, code: string, gravite: Gravite, message: string, details?: unknown) {
    this.data.anomalies.push({
      table,
      legacy_id: legacyId === null || legacyId === undefined ? null : String(legacyId),
      code,
      gravite,
      message,
      ...(details === undefined ? {} : { details }),
    });
    this.data.anomalies_par_code[code] = (this.data.anomalies_par_code[code] ?? 0) + 1;
  }

  statut(avant: string, apres: string) {
    const c = this.data.statuts.correspondances.find((x) => x.avant === avant && x.apres === apres);
    if (c) c.nombre++;
    else this.data.statuts.correspondances.push({ avant, apres, nombre: 1 });
  }

  terminer(statut: RapportJson['statut'], erreur?: unknown) {
    this.data.statut = statut;
    this.data.fin = new Date().toISOString();
    this.data.duree_ms = Date.now() - this.debutMs;
    if (erreur) this.data.erreur = erreur instanceof Error ? erreur.message : String(erreur);
    this.data.statuts.correspondances.sort((a, b) => b.nombre - a.nombre || a.avant.localeCompare(b.avant));
  }

  ecrire(fichier: string) {
    fs.mkdirSync(path.dirname(path.resolve(fichier)), { recursive: true });
    fs.writeFileSync(fichier, JSON.stringify(this.data, null, 2), { mode: 0o600 });
  }
}

// ---------------------------------------------------------------------------
// Résumé lisible

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function nombre(n: number): string {
  return nf.format(n).replace(/ | /g, ' ');
}

export function octets(n: number): string {
  if (n < 1024) return `${n} o`;
  const u = ['Ko', 'Mo', 'Go', 'To'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${nombre(Math.round(v * 10) / 10)} ${u[i]}`;
}

function duree(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 120) return `${nombre(Math.round(s * 10) / 10)} s`;
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
}

const LIBELLES_TABLES: Record<string, string> = {
  users: 'Utilisateurs',
  clients: 'Clients (déduits)',
  dossiers: 'Dossiers',
  historique_statuts: 'Historique (historique_statuts)',
  dossier_status_history: 'Historique (dossier_status_history)',
  dossier_activity_log: "Journal d'activité",
  dossier_formulaires: 'Formulaires de dossier',
  fichiers: 'Fichiers',
  devis: 'Devis',
  devis_historique: 'Historique des devis',
  factures: 'Factures',
  paiements: 'Paiements',
  tarifs_config: 'Tarifs',
};

const GRAVITE_LIBELLE: Record<Gravite, string> = { erreur: 'ERREUR', attention: 'À VÉRIFIER', info: 'info' };

export function resumeTexte(r: RapportJson, fichierRapport: string | null, maxParCode = 8): string {
  const out: string[] = [];
  const ligne = (s = '') => out.push(s);
  ligne('══════════════════════════════════════════════════════════════════════');
  ligne(' Import de l’ancienne plateforme EvocomPrint vers Evocom Print v2');
  ligne('══════════════════════════════════════════════════════════════════════');
  ligne(
    `Mode      : ${r.mode === 'simulation' ? 'SIMULATION (--dry-run) : tout a été annulé, rien n’est écrit ni copié' : 'IMPORT RÉEL'}`,
  );
  ligne(`Résultat  : ${r.statut === 'ok' ? (r.mode === 'simulation' ? 'simulation réussie' : 'import validé (COMMIT)') : `ÉCHEC — ${r.erreur ?? ''}`}`);
  ligne(`Source    : ${r.source.base} (lecture seule, fuseau ${r.source.fuseau})${r.source.inchangee === true ? ' — inchangée, vérifié' : ''}`);
  ligne(`Uploads   : ${r.source.racines_uploads.join(', ') || '(aucun)'}`);
  ligne(`Cible     : ${r.cible.base} — stockage ${r.cible.stockage}${r.cible.remplacement ? ' (remplacement des données existantes)' : ''}`);
  if (r.duree_ms !== null) ligne(`Durée     : ${duree(r.duree_ms)}`);
  ligne();

  ligne('Tables                                        lus   importés   ignorés');
  for (const [t, c] of Object.entries(r.tables)) {
    const nom = (LIBELLES_TABLES[t] ?? t).padEnd(40).slice(0, 40);
    ligne(`  ${nom} ${String(c.lus).padStart(7)} ${String(c.importes).padStart(10)} ${String(c.ignores).padStart(9)}`);
  }
  if (r.tables_non_reprises.length) {
    ligne('  Tables non reprises :');
    for (const t of r.tables_non_reprises) ligne(`    - ${t.table} (${t.lignes} ligne(s)) : ${t.raison}`);
  }
  ligne();

  ligne('Statuts des dossiers (ancienne valeur → statut v2)');
  for (const c of r.statuts.correspondances) ligne(`  ${`« ${c.avant} »`.padEnd(24)} → ${c.apres.padEnd(16)} ${c.nombre}`);
  ligne(`  Après import : ${Object.entries(r.statuts.apres).map(([s, n]) => `${s} ${n}`).join(', ') || '—'}`);
  ligne();

  const m = r.montants.dossiers;
  ligne('Montants des dossiers (FCFA)');
  ligne(`  Σ montant_cfa (ancienne base)              : ${nombre(m.somme_montant_cfa_ancienne_base)}`);
  ligne(`  Σ montants retenus (toutes sources)        : ${nombre(m.somme_montants_retenus_avant_arrondi)}`);
  ligne(`  Σ montants v2                              : ${nombre(m.somme_v2)}`);
  ligne(
    `  Écart v2 − retenus : ${nombre(m.ecart_v2_moins_retenus)} (dont arrondis signalés : ${nombre(m.ecart_explique_par_arrondis)})` +
      (Math.abs(m.ecart_v2_moins_retenus - m.ecart_explique_par_arrondis) < 0.005 ? ' — cohérent' : ' — INCOHÉRENT, voir le rapport'),
  );
  ligne(
    `  ${m.dossiers_avec_montant} dossier(s) avec montant, ${m.dossiers_sans_montant} sans montant. Sources : ${
      Object.entries(m.sources).map(([s, n]) => `${s} ${n}`).join(', ') || '—'
    }`,
  );
  const p = r.montants.paiements;
  ligne(
    `  Paiements : ${nombre(p.somme_ancienne_base)} lus, ${nombre(p.somme_importee)} importés, ${nombre(p.somme_ignoree)} ignorés` +
      ` (${Object.entries(p.par_statut_v2).map(([s, n]) => `${s} ${nombre(n)}`).join(', ') || '—'})`,
  );
  const f = r.montants.factures;
  ligne(`  Factures (TTC) : ${nombre(f.somme_ttc_ancienne_base)} lus, ${nombre(f.somme_ttc_importee)} importés, ${nombre(f.somme_ttc_ignoree)} ignorés`);
  ligne();

  const fi = r.fichiers;
  ligne('Fichiers');
  if (r.mode === 'simulation') ligne(`  À copier          : ${fi.simulation_a_copier} (${octets(fi.simulation_octets_a_copier)})`);
  else ligne(`  Copiés            : ${fi.copies} (${octets(fi.octets_copies)}), empreinte SHA-256 calculée`);
  if (fi.espace_libre_cible !== null) ligne(`  Espace libre cible: ${octets(fi.espace_libre_cible)}`);
  ligne(`  Trouvés par règle : ${Object.entries(fi.par_regle).map(([k, n]) => `${k} ${n}`).join(', ') || '—'}`);
  ligne(`  Manquants         : ${fi.manquants.length} (${octets(fi.octets_manquants_declares)} déclarés) — lignes non créées, métadonnées gardées dans l’historique du dossier`);
  for (const x of fi.manquants.slice(0, 20)) {
    ligne(`    - fichier #${x.legacy_id} « ${x.nom ?? '?'} » (dossier ${x.dossier_numero ?? x.dossier_legacy_id ?? '?'}) : ${x.raison}`);
  }
  if (fi.manquants.length > 20) ligne(`    … ${fi.manquants.length - 20} autre(s) dans le rapport JSON`);
  ligne(`  Orphelins (sur disque, sans ligne en base, non importés) : ${fi.orphelins.length} (${octets(fi.octets_orphelins)})`);
  for (const x of fi.orphelins.slice(0, 20)) ligne(`    - ${x.chemin} (${octets(x.taille)}${x.categorie ? `, ${x.categorie}` : ''})`);
  if (fi.orphelins.length > 20) ligne(`    … ${fi.orphelins.length - 20} autre(s) dans le rapport JSON`);
  if (r.cible.fichiers_v2_mis_de_cote.nombre) {
    ligne(
      `  Anciens fichiers v2 non référencés mis de côté : ${r.cible.fichiers_v2_mis_de_cote.nombre} (${octets(r.cible.fichiers_v2_mis_de_cote.octets)}) dans ${r.cible.fichiers_v2_mis_de_cote.dossier}`,
    );
  }
  ligne();

  if (r.clients_fusionnes.length) {
    ligne(`Clients regroupés (variantes d’écriture) : ${r.clients_fusionnes.length}`);
    for (const c of r.clients_fusionnes.slice(0, 15)) ligne(`  « ${c.nom_retenu} » ← ${c.variantes.map((v) => `« ${v} »`).join(', ')}`);
    ligne();
  }

  if (r.compteurs.length) {
    ligne('Numérotation (compteurs v2)');
    for (const c of r.compteurs) ligne(`  ${c.cle} ${c.annee} : dernier ${c.valeur}, prochain ${c.prochain}`);
    ligne();
  }

  const parGravite = { erreur: 0, attention: 0, info: 0 } as Record<Gravite, number>;
  for (const a of r.anomalies) parGravite[a.gravite]++;
  ligne(`Anomalies : ${r.anomalies.length} (${parGravite.erreur} erreur(s), ${parGravite.attention} à vérifier, ${parGravite.info} info)`);
  const codes = Object.keys(r.anomalies_par_code).sort((a, b) => {
    const g = (c: string) => {
      const x = r.anomalies.find((y) => y.code === c)?.gravite;
      return x === 'erreur' ? 0 : x === 'attention' ? 1 : 2;
    };
    return g(a) - g(b) || a.localeCompare(b);
  });
  for (const code of codes) {
    const liste = r.anomalies.filter((a) => a.code === code);
    ligne(`  [${GRAVITE_LIBELLE[liste[0]!.gravite]}] ${code} (${liste.length})`);
    for (const a of liste.slice(0, maxParCode)) ligne(`     - ${a.table}${a.legacy_id ? ` #${a.legacy_id}` : ''} : ${a.message}`);
    if (liste.length > maxParCode) ligne(`     … ${liste.length - maxParCode} autre(s) dans le rapport JSON`);
  }
  ligne();
  if (fichierRapport) ligne(`Rapport complet (JSON) : ${fichierRapport}`);
  return out.join('\n');
}
