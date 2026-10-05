// Documents de la démonstration : aperçus HTML imprimables (bon de travail, devis, facture)
// à la place des PDF du serveur, et exports CSV calculés à partir des données en mémoire.

import {
  formatDate,
  formatDateHeure,
  formatFCFA,
  formatTaille,
  MACHINE_LABELS,
  MODE_PAIEMENT_LABELS,
  STATUT_LABELS,
  STATUT_PAIEMENT_LABELS,
  type LigneRoland,
  type LigneXerox,
} from '@evocom/shared';
import { E, nomUtilisateur, type UserDemo } from './etat';
import { charger } from './domaine/dossiers';
import { ErreurDemo, forbidden, notFound } from './http';
import { reponseEnregistree } from './enregistrements';
import { dansPeriode, jourDans } from './dates';

const h = (s: unknown) => String(s ?? '').replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

const STYLE = `
  body { font: 13px/1.5 Arial, Helvetica, sans-serif; color: #1c2430; margin: 0; background: #fff; }
  .page { max-width: 760px; margin: 0 auto; padding: 32px 36px; }
  .bandeau { border: 1px dashed #9aa5b1; color: #4a5562; padding: 6px 10px; font-size: 12px; margin-bottom: 20px; }
  header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #0f4c81; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { font-size: 22px; margin: 0 0 4px; color: #0f4c81; }
  h2 { font-size: 14px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .04em; color: #4a5562; }
  .entreprise { text-align: right; font-size: 12px; color: #4a5562; }
  .entreprise strong { font-size: 15px; color: #1c2430; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #dde3ea; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; color: #4a5562; }
  td.n, th.n { text-align: right; white-space: nowrap; }
  .grille { display: grid; grid-template-columns: 160px 1fr; gap: 4px 12px; }
  .grille dt { color: #4a5562; }
  .grille dd { margin: 0; }
  .totaux { margin-left: auto; width: 300px; margin-top: 10px; }
  .totaux td { border: 0; padding: 3px 8px; }
  .totaux tr.total td { font-weight: 700; font-size: 15px; border-top: 2px solid #1c2430; }
  .urgent { display: inline-block; padding: 2px 8px; border: 2px solid #b42318; color: #b42318; font-weight: 700; }
  .note { white-space: pre-wrap; border-left: 3px solid #dde3ea; padding-left: 10px; }
  footer { margin-top: 28px; font-size: 11px; color: #4a5562; border-top: 1px solid #dde3ea; padding-top: 8px; }
  @media print { .bandeau { display: none; } .page { padding: 0; } }
`;

function enteteEntreprise(): string {
  const e = E().parametres.entreprise ?? {};
  return `<div class="entreprise"><strong>${h(e.nom || 'Evocom Print')}</strong><br>${[e.adresse, e.telephone, e.email].filter(Boolean).map(h).join('<br>')}${
    e.ninea || e.rccm ? `<br>${e.ninea ? `NINEA ${h(e.ninea)}` : ''}${e.ninea && e.rccm ? ' · ' : ''}${e.rccm ? `RCCM ${h(e.rccm)}` : ''}` : ''
  }</div>`;
}

function page(titre: string, corps: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${h(titre)}</title><style>${STYLE}</style></head><body><div class="page">
<div class="bandeau">Démonstration : aperçu imprimable généré dans le navigateur, à la place du PDF du serveur.</div>
${corps}
<footer>Document de démonstration Evocom Print · données fictives.</footer></div></body></html>`;
}

export interface DocumentDemo {
  titre: string;
  html: string;
}

// ---------------------------------------------------------------------------

function libelle(machine: string, code: string): string {
  return E().tarifs.find((t) => (t.machine === machine || t.machine === 'global') && t.code === code)?.libelle ?? code;
}

export function bonDeTravail(user: UserDemo, id: number): DocumentDemo {
  if (!['admin', 'preparateur', 'imprimeur_roland', 'imprimeur_xerox'].includes(user.role)) throw forbidden();
  const d = charger(user, id);
  const lignes = (d.specs.lignes ?? []) as (LigneRoland | LigneXerox)[];
  const specs = lignes
    .map((l, i) => {
      const format =
        d.machine === 'roland'
          ? `${(l as LigneRoland).largeur} × ${(l as LigneRoland).hauteur} ${(l as LigneRoland).unite}`
          : `${(l as LigneXerox).pages} p.${(l as LigneXerox).recto_verso ? ' recto-verso' : ''}`;
      const finitions = [...l.finitions.map((f) => `${libelle(d.machine, f.code)}${f.quantite ? ` × ${f.quantite}` : ''}`), ...l.options.map((o) => libelle(d.machine, o))];
      return `<tr><td>${i + 1}</td><td>${h(libelle(d.machine, l.support))}${l.description ? `<br><small>${h(l.description)}</small>` : ''}</td><td>${h(format)}</td><td class="n">${l.quantite}</td><td>${h(finitions.join(', ') || '—')}</td></tr>`;
    })
    .join('');
  const fichiers = d.fichiers
    .filter((f) => !f.deleted_at)
    .map((f) => `<tr><td>${h(f.nom_original)}</td><td class="n">${h(formatTaille(f.taille))}</td><td>${f.a_reimprimer ? '<strong>À réimprimer</strong>' : ''}</td></tr>`)
    .join('');
  const corps = `
<header><div><h1>Bon de travail ${h(d.numero)}</h1><div>${h(MACHINE_LABELS[d.machine])} · ${h(STATUT_LABELS[d.statut])}</div>${d.urgent ? '<p><span class="urgent">URGENT</span></p>' : ''}</div>${enteteEntreprise()}</header>
<dl class="grille">
<dt>Client</dt><dd>${h(d.client_nom)}</dd>
<dt>Créé le</dt><dd>${h(formatDateHeure(d.created_at))}</dd>
<dt>Validé le</dt><dd>${h(formatDateHeure(d.date_validation))}</dd>
<dt>Date promise</dt><dd>${h(formatDate(d.date_promise))}</dd>
<dt>Préparateur</dt><dd>${h(nomUtilisateur(d.preparateur_id, d.noms.preparateur) ?? '—')}</dd>
<dt>Imprimeur</dt><dd>${h(nomUtilisateur(d.imprimeur_id, d.noms.imprimeur) ?? '—')}</dd>
</dl>
${d.description ? `<h2>Description</h2><p class="note">${h(d.description)}</p>` : ''}
${d.consignes ? `<h2>Consignes</h2><p class="note">${h(d.consignes)}</p>` : ''}
${d.commentaire_revision ? `<h2>Révision demandée</h2><p class="note">${h(d.commentaire_revision)}</p>` : ''}
<h2>Travail à réaliser</h2>
${specs ? `<table><thead><tr><th>#</th><th>Support</th><th>Format</th><th class="n">Quantité</th><th>Finitions et options</th></tr></thead><tbody>${specs}</tbody></table>` : '<p>Aucune ligne de spécification.</p>'}
<h2>Fichiers</h2>
${fichiers ? `<table><thead><tr><th>Fichier</th><th class="n">Taille</th><th></th></tr></thead><tbody>${fichiers}</tbody></table>` : '<p>Aucun fichier.</p>'}`;
  return { titre: `Bon de travail ${d.numero}`, html: page(`Bon de travail ${d.numero}`, corps) };
}

function totaux(lignes: [string, number | null | undefined][], total: [string, number]): string {
  return `<table class="totaux"><tbody>${lignes
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `<tr><td>${h(k)}</td><td class="n">${h(formatFCFA(v as number))}</td></tr>`)
    .join('')}<tr class="total"><td>${h(total[0])}</td><td class="n">${h(formatFCFA(total[1]))}</td></tr></tbody></table>`;
}

export function devis(user: UserDemo, id: number): DocumentDemo {
  if (user.role !== 'admin' && user.role !== 'preparateur') throw forbidden();
  const r = reponseEnregistree(user.role, `/devis/${id}`, new URLSearchParams());
  const v = r.corps as any;
  if (!r.trouve || !v) throw notFound("Ce devis n'existe pas dans la démonstration.");
  const p = v.detail_prix?.ok ? v.detail_prix : null;
  const lignes = (p?.lignes ?? [])
    .map((l: any) => `<tr><td>${h(l.libelle)}</td><td class="n">${h(String(l.quantite).replace('.', ','))}</td><td class="n">${h(formatFCFA(l.prix_unitaire))}</td><td class="n">${h(formatFCFA(l.total))}</td></tr>`)
    .join('');
  const mentions = E().parametres.documents?.mentions_devis;
  const corps = `
<header><div><h1>Devis ${h(v.numero)}</h1><div>Établi le ${h(formatDate(v.created_at))} · valable jusqu’au ${h(formatDate(v.date_validite))}</div></div>${enteteEntreprise()}</header>
<dl class="grille"><dt>Client</dt><dd>${h(v.client_nom)}${v.client_telephone ? `<br>${h(v.client_telephone)}` : ''}</dd>
<dt>Machine</dt><dd>${h(MACHINE_LABELS[v.machine as 'roland' | 'xerox'] ?? v.machine)}</dd></dl>
${v.description ? `<h2>Objet</h2><p class="note">${h(v.description)}</p>` : ''}
<h2>Détail</h2>
${lignes ? `<table><thead><tr><th>Désignation</th><th class="n">Quantité</th><th class="n">Prix unitaire</th><th class="n">Total</th></tr></thead><tbody>${lignes}</tbody></table>` : '<p>Montant forfaitaire.</p>'}
${totaux([['Sous-total', p?.sous_total], ['Remise', p?.remise ? -p.remise : null], ['TVA', v.tva || null]], ['Total TTC', v.total_ttc ?? 0])}
${v.notes ? `<h2>Notes</h2><p class="note">${h(v.notes)}</p>` : ''}
${mentions ? `<p class="note">${h(mentions)}</p>` : ''}`;
  return { titre: `Devis ${v.numero}`, html: page(`Devis ${v.numero}`, corps) };
}

export function facture(user: UserDemo, id: number): DocumentDemo {
  if (user.role !== 'admin' && user.role !== 'preparateur') throw forbidden();
  const r = reponseEnregistree(user.role, `/factures/${id}`, new URLSearchParams());
  const f = r.corps as any;
  if (!r.trouve || !f) throw notFound("Cette facture n'existe pas dans la démonstration.");
  const lignes = (f.lignes ?? [])
    .map(
      (l: any) =>
        `<tr><td>${h(l.designation)}${l.detail ? `<br><small>${h(l.detail)}</small>` : ''}</td><td class="n">${h(String(l.quantite).replace('.', ','))}</td><td class="n">${h(formatFCFA(l.prix_unitaire))}</td><td class="n">${h(formatFCFA(l.total))}</td></tr>`,
    )
    .join('');
  const conditions = E().parametres.documents?.conditions_paiement;
  const pied = E().parametres.entreprise?.pied_facture;
  const corps = `
<header><div><h1>Facture ${h(f.numero)}</h1><div>Émise le ${h(formatDate(f.date_emission))}${f.dossier_numero ? ` · dossier ${h(f.dossier_numero)}` : ''}</div>${
    f.statut === 'annulee' ? `<p><span class="urgent">ANNULÉE</span> ${h(f.motif_annulation ?? '')}</p>` : ''
  }</div>${enteteEntreprise()}</header>
<dl class="grille"><dt>Client</dt><dd>${h(f.client_nom)}${f.client_adresse ? `<br>${h(f.client_adresse)}` : ''}${f.client_telephone ? `<br>${h(f.client_telephone)}` : ''}</dd></dl>
<h2>Détail</h2>
<table><thead><tr><th>Désignation</th><th class="n">Quantité</th><th class="n">Prix unitaire</th><th class="n">Total</th></tr></thead><tbody>${lignes}</tbody></table>
${totaux([['Total HT', f.total_ht], [`TVA ${f.tva_taux ?? 0} %`, f.tva || null]], ['Total TTC', f.total_ttc ?? 0])}
${totaux([['Déjà payé', f.deja_paye]], ['Reste à payer', f.reste ?? 0])}
${conditions ? `<p class="note">${h(conditions)}</p>` : ''}
${pied ? `<p class="note">${h(pied)}</p>` : ''}`;
  return { titre: `Facture ${f.numero}`, html: page(`Facture ${f.numero}`, corps) };
}

// ---------------------------------------------------------------------------
// Exports CSV (mêmes colonnes que api/src/modules/admin/routes.ts)

const TELEPHONE_RE = /^[+-][0-9 ().-]*$/;

function cellule(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  let s = String(v);
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !TELEPHONE_RE.test(s))) s = `'${s}`;
  if (/[;"\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csv(entetes: string[], lignes: unknown[][]): string {
  return `\ufeff${[entetes.map(cellule).join(';'), ...lignes.map((l) => l.map(cellule).join(';'))].join('\r\n')}\r\n`;
}

const dh = (v: string | null) => (v ? formatDateHeure(v).replace(/\u202f|\u00a0/g, ' ') : null);

export function exportCsv(user: UserDemo, nom: string, query: URLSearchParams): { nom: string; contenu: string } {
  if (user.role !== 'admin') throw forbidden();
  const e = E();
  const tz = e.parametres.fuseau;
  const from = query.get('from') || null;
  const to = query.get('to') || null;
  const suffixe = `${from ?? 'debut'}_${to ?? jourDans(tz)}`;
  const paye = (id: number) => e.paiements.filter((p) => p.dossier_id === id && p.statut === 'valide').reduce((s, p) => s + p.montant, 0);
  if (nom === 'dossiers.csv') {
    const l = e.dossiers.filter((d) => !d.deleted_at && (!from && !to ? true : dansPeriode(d.created_at, tz, from, to))).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
    return {
      nom: `dossiers_${suffixe}.csv`,
      contenu: csv(
        ['Numéro', 'Créé le', 'Client', 'Téléphone', 'Machine', 'Statut', 'Préparateur', 'Description', 'Montant (FCFA)', 'Payé (FCFA)', 'Reste à payer (FCFA)', 'Urgent', 'Date promise', 'Livré le', 'Facture'],
        l.map((d) => [
          d.numero,
          dh(d.created_at),
          d.client_nom,
          d.client_telephone,
          MACHINE_LABELS[d.machine],
          STATUT_LABELS[d.statut],
          nomUtilisateur(d.preparateur_id, d.noms.preparateur),
          d.description,
          d.montant,
          paye(d.id),
          d.montant === null ? null : Math.max(0, d.montant - paye(d.id)),
          d.urgent,
          d.date_promise ? formatDate(d.date_promise) : null,
          dh(d.livre_at),
          d.facture?.numero ?? null,
        ]),
      ),
    };
  }
  if (nom === 'paiements.csv') {
    const l = e.paiements.filter((p) => (!from && !to ? true : dansPeriode(p.encaisse_at, tz, from, to))).sort((a, b) => a.encaisse_at.localeCompare(b.encaisse_at) || a.id - b.id);
    return {
      nom: `paiements_${suffixe}.csv`,
      contenu: csv(
        ['Encaissé le', 'Dossier', 'Client', 'Montant (FCFA)', 'Mode', 'Référence', 'Statut', 'Encaissé par', 'Validé ou refusé par', 'Validé ou refusé le', 'Motif du refus', 'Notes', 'Dossier supprimé'],
        l.map((p) => {
          const d = e.dossiers.find((x) => x.id === p.dossier_id);
          const c = e.corbeille.find((x) => x.id === p.dossier_id);
          return [
            dh(p.encaisse_at),
            d?.numero ?? c?.numero,
            d?.client_nom ?? c?.client_nom,
            p.montant,
            MODE_PAIEMENT_LABELS[p.mode],
            p.reference,
            STATUT_PAIEMENT_LABELS[p.statut],
            nomUtilisateur(p.encaisse_par, p.encaisse_par_nom),
            nomUtilisateur(p.valide_par, p.valide_par_nom),
            dh(p.valide_at),
            p.motif_refus,
            p.notes,
            !d || !!d.deleted_at,
          ];
        }),
      ),
    };
  }
  if (nom === 'factures.csv') {
    const r = reponseEnregistree(user.role, '/factures', new URLSearchParams({ limit: '200', page: '1' }));
    const l = ((r.corps as any)?.items ?? []).filter((f: any) => (!from || f.date_emission >= from) && (!to || f.date_emission <= to));
    return {
      nom: `factures_${suffixe}.csv`,
      contenu: csv(
        ['Numéro', 'Émise le', 'Dossier', 'Client', 'Total HT (FCFA)', 'Taux de TVA (%)', 'TVA (FCFA)', 'Total TTC (FCFA)', 'Statut', 'Annulée le', "Motif d'annulation"],
        l.map((f: any) => [
          f.numero,
          formatDate(f.date_emission),
          f.dossier_numero,
          f.client_nom,
          f.total_ht,
          f.tva_taux,
          f.tva,
          f.total_ttc,
          f.statut === 'annulee' ? 'Annulée' : 'Émise',
          dh(f.annulee_at ?? null),
          f.motif_annulation ?? null,
        ]),
      ),
    };
  }
  throw new ErreurDemo(404, 'Export inconnu.');
}
