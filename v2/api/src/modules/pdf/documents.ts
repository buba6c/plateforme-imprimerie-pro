// Documents PDF : devis, facture, bon de travail.

import QRCode from 'qrcode';
import {
  formatDecimal,
  formatEntier,
  formatFCFA,
  formatTaille,
  MACHINE_DESCRIPTIONS,
  MACHINE_LABELS,
  STATUT_LABELS,
  type LigneRoland,
  type LigneXerox,
  type Machine,
  type Statut,
  type Tarif,
} from '@evocom/shared';
import type { Parametres } from '../../lib/params';
import { dateHeureFr, jourFr } from '../commun/dates';
import { quantiteFr, type LigneDocument } from './lignes';
import {
  blocInfos,
  COULEURS,
  enTete,
  etiquette,
  filet,
  largeurUtile,
  nouveauDocument,
  paragraphe,
  piedsDePage,
  place,
  POLICE,
  POLICE_GRAS,
  t,
  tableau,
  totaux,
  UNITES_COURTES,
  versBuffer,
  type Colonne,
  type Doc,
  type LigneTotal,
} from './mise-en-page';

const COLONNES_LIGNES: Colonne[] = [
  { titre: 'Désignation', largeur: 0 },
  { titre: 'Quantité', largeur: 60, align: 'right' },
  { titre: 'Unité', largeur: 50 },
  { titre: 'Prix unitaire', largeur: 85, align: 'right' },
  { titre: 'Total', largeur: 90, align: 'right' },
];

function lignesTableau(lignes: LigneDocument[]) {
  return lignes.map((l) => ({
    cellules: [
      l.designation,
      quantiteFr(l.quantite),
      l.unite ? (UNITES_COURTES[l.unite] ?? l.unite) : '',
      l.prix_unitaire === null ? '' : formatFCFA(l.prix_unitaire),
      formatFCFA(l.total),
    ],
    detail: l.detail,
  }));
}

function filigrane(doc: Doc, texte: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.save();
    doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc
      .font(POLICE_GRAS)
      .fontSize(90)
      .fillColor(COULEURS.discret)
      .fillOpacity(0.12)
      .text(t(texte), 0, doc.page.height / 2 - 45, { width: doc.page.width, align: 'center', lineBreak: false });
    doc.restore();
  }
}

// ---------------------------------------------------------------------------
// Devis

export interface DevisPdf {
  numero: string;
  statut: string;
  machine: Machine;
  client_nom: string;
  client_telephone: string | null;
  client_email: string | null;
  description: string | null;
  notes: string | null;
  validite_jours: number;
  created_at: string | Date;
  total_ht: number;
  tva: number;
  total_ttc: number;
  detail_prix: { sous_total?: number; remise?: number; arrondi?: number; tva_taux?: number; tva_applicable?: boolean } | null;
  lignes: LigneDocument[];
  auteur_nom: string | null;
}

export async function pdfDevis(d: DevisPdf, params: Parametres): Promise<Buffer> {
  const tz = params.fuseau;
  const doc = nouveauDocument({ titre: `Devis ${d.numero}`, auteur: params.entreprise.nom });
  const creation = new Date(d.created_at);
  const fin = new Date(creation.getTime() + d.validite_jours * 86_400_000);
  let y = enTete(doc, params.entreprise, 'DEVIS', [
    ['Numéro', d.numero],
    ['Date', jourFr(creation, tz)],
    ['Valable jusqu’au', jourFr(fin, tz)],
  ]);

  const yClient = blocInfos(doc, y, 'Client', d.client_nom, [d.client_telephone && `Tél. ${d.client_telephone}`, d.client_email], {
    x: doc.page.margins.left + largeurUtile(doc) * 0.5,
    width: largeurUtile(doc) * 0.5,
  });
  etiquette(doc, 'Prestation', doc.page.margins.left, y + 10);
  doc
    .font(POLICE_GRAS)
    .fontSize(10.5)
    .fillColor(COULEURS.texte)
    .text(t(`Impression ${MACHINE_LABELS[d.machine]}`), doc.page.margins.left, y + 22, { width: largeurUtile(doc) * 0.45 });
  doc.font(POLICE).fontSize(9).fillColor(COULEURS.discret).text(t(MACHINE_DESCRIPTIONS[d.machine]), { width: largeurUtile(doc) * 0.45 });
  if (d.auteur_nom) doc.text(t(`Établi par ${d.auteur_nom}`), { width: largeurUtile(doc) * 0.45 });
  y = Math.max(yClient, doc.y) + 16;

  if (d.description) y = paragraphe(doc, y, 'Objet', d.description);

  y = tableau(doc, y, COLONNES_LIGNES, lignesTableau(d.lignes));

  const dp = d.detail_prix ?? {};
  const rows: LigneTotal[] = [];
  const remise = dp.remise ?? 0;
  const arrondi = dp.arrondi ?? 0;
  if (remise > 0 || arrondi !== 0) rows.push({ label: 'Sous-total', valeur: formatFCFA(dp.sous_total ?? d.total_ttc) });
  if (remise > 0) rows.push({ label: 'Remise', valeur: `- ${formatFCFA(remise)}` });
  if (arrondi !== 0) rows.push({ label: 'Arrondi', valeur: `${arrondi > 0 ? '+ ' : '- '}${formatFCFA(Math.abs(arrondi))}` });
  const tvaApplicable = dp.tva_applicable ?? d.tva > 0;
  if (tvaApplicable) {
    const taux = dp.tva_taux ?? params.prix.tva_taux;
    rows.push({ label: 'Total HT', valeur: formatFCFA(d.total_ht) });
    rows.push({ label: `TVA (${formatDecimal(taux)} %)`, valeur: formatFCFA(d.tva) });
    rows.push({ label: 'Total TTC', valeur: formatFCFA(d.total_ttc), fort: true });
  } else {
    rows.push({ label: 'Total', valeur: formatFCFA(d.total_ttc), fort: true });
  }
  y = totaux(doc, y + 6, rows);

  if (d.notes) y = paragraphe(doc, y + 6, 'Remarques', d.notes);
  y = paragraphe(
    doc,
    y + 6,
    'Conditions',
    `Devis valable ${d.validite_jours} jour${d.validite_jours > 1 ? 's' : ''} à compter du ${jourFr(creation, tz)}. Montants en francs CFA (FCFA)${tvaApplicable ? '' : ', TVA non applicable'}. Le travail est lancé après acceptation du devis.`,
  );
  y = place(doc, y + 10, 60);
  etiquette(doc, 'Bon pour accord (date et signature du client)', doc.page.margins.left + largeurUtile(doc) - 240, y);
  doc.save().rect(doc.page.margins.left + largeurUtile(doc) - 240, y + 12, 240, 50).lineWidth(0.75).strokeColor(COULEURS.filet).stroke().restore();

  if (d.statut === 'refuse') filigrane(doc, 'REFUSÉ');
  piedsDePage(doc, params.entreprise.pied_facture, `Devis ${d.numero}`);
  return versBuffer(doc);
}

// ---------------------------------------------------------------------------
// Facture

export interface FacturePdf {
  numero: string;
  machine: Machine | null;
  objet: string | null;
  statut: string;
  date_emission: string;
  dossier_numero: string;
  client_nom: string;
  client_telephone: string | null;
  client_adresse: string | null;
  lignes: LigneDocument[];
  total_ht: number;
  tva_taux: number;
  tva: number;
  total_ttc: number;
  deja_paye: number;
  reste: number;
  annulee_at: string | Date | null;
  motif_annulation: string | null;
}

export async function pdfFacture(f: FacturePdf, params: Parametres): Promise<Buffer> {
  const tz = params.fuseau;
  const doc = nouveauDocument({ titre: `Facture ${f.numero}`, auteur: params.entreprise.nom });
  let y = enTete(doc, params.entreprise, 'FACTURE', [
    ['Numéro', f.numero],
    ["Date d'émission", jourFr(f.date_emission, tz)],
    ['Dossier', f.dossier_numero],
  ]);
  const yClient = blocInfos(doc, y, 'Facturé à', f.client_nom, [f.client_adresse, f.client_telephone && `Tél. ${f.client_telephone}`], {
    x: doc.page.margins.left + largeurUtile(doc) * 0.5,
    width: largeurUtile(doc) * 0.5,
  });
  const lg = largeurUtile(doc) * 0.45;
  etiquette(doc, 'Prestation', doc.page.margins.left, y + 10);
  doc
    .font(POLICE_GRAS)
    .fontSize(10.5)
    .fillColor(COULEURS.texte)
    .text(t(f.machine ? `Impression ${MACHINE_LABELS[f.machine]}` : "Travaux d'impression"), doc.page.margins.left, y + 22, { width: lg });
  doc.font(POLICE).fontSize(9).fillColor(COULEURS.discret).text(t(`Dossier ${f.dossier_numero}`), { width: lg });
  if (f.objet) doc.text(t(f.objet.length > 160 ? `${f.objet.slice(0, 157)}...` : f.objet), { width: lg });
  y = Math.max(yClient, doc.y) + 16;

  if (f.statut === 'annulee') {
    y = paragraphe(
      doc,
      y,
      'Facture annulée',
      `Annulée le ${jourFr(f.annulee_at, tz)}${f.motif_annulation ? ` : ${f.motif_annulation}` : ''}. Ce document n'est plus valable ; son numéro n'est pas réutilisé.`,
      { encadre: true },
    );
  }

  y = tableau(doc, y, COLONNES_LIGNES, lignesTableau(f.lignes));
  const rows: LigneTotal[] = [];
  if (f.tva_taux > 0) {
    rows.push({ label: 'Total HT', valeur: formatFCFA(f.total_ht) });
    rows.push({ label: `TVA (${formatDecimal(f.tva_taux)} %)`, valeur: formatFCFA(f.tva) });
    rows.push({ label: 'Total TTC', valeur: formatFCFA(f.total_ttc), fort: true });
  } else {
    rows.push({ label: 'Total', valeur: formatFCFA(f.total_ttc), fort: true });
  }
  y = totaux(doc, y + 6, rows);
  if (f.statut !== 'annulee') {
    y = totaux(doc, y + 2, [
      { label: 'Déjà réglé', valeur: formatFCFA(f.deja_paye) },
      { label: 'Reste à payer', valeur: formatFCFA(f.reste) },
    ]);
  }
  paragraphe(
    doc,
    y + 8,
    'Mentions',
    `Montants en francs CFA (FCFA)${f.tva_taux > 0 ? '' : ', TVA non applicable'}. Facture établie pour le dossier ${f.dossier_numero}.`,
  );

  if (f.statut === 'annulee') filigrane(doc, 'ANNULÉE');
  piedsDePage(doc, params.entreprise.pied_facture, `Facture ${f.numero}`);
  return versBuffer(doc);
}

// ---------------------------------------------------------------------------
// Bon de travail (atelier) : aucun montant, aucun téléphone.

export interface BonDeTravailPdf {
  id: number;
  numero: string;
  machine: Machine;
  statut: Statut;
  urgent: boolean;
  client_nom: string;
  description: string | null;
  consignes: string | null;
  commentaire_revision: string | null;
  specs: { lignes?: unknown[]; forfaits?: { code: string; quantite?: number }[] } | null;
  date_promise: string | null;
  created_at: string | Date;
  date_validation: string | Date | null;
  preparateur_nom: string | null;
  imprimeur_nom: string | null;
  fichiers: { nom_original: string; taille: number; a_reimprimer: boolean; created_at: string | Date }[];
}

function libelleTarif(tarifs: Tarif[], machine: Machine, code: string): string {
  const tarif = tarifs.find((x) => x.code === code && x.machine === machine) ?? tarifs.find((x) => x.code === code && x.machine === 'global');
  return tarif?.libelle ?? code;
}

function choixTexte(tarifs: Tarif[], machine: Machine, choix: { code: string; quantite?: number }[] | undefined, options: string[] | undefined): string {
  const parts = [
    ...(choix ?? []).map((c) => `${libelleTarif(tarifs, machine, c.code)}${c.quantite ? ` (x${formatEntier(c.quantite)})` : ''}`),
    ...(options ?? []).map((o) => libelleTarif(tarifs, machine, o)),
  ];
  return parts.length ? parts.join(', ') : '-';
}

export async function pdfBonDeTravail(d: BonDeTravailPdf, params: Parametres, tarifs: Tarif[], lien: { url: string; absolu: boolean }): Promise<Buffer> {
  const tz = params.fuseau;
  const doc = nouveauDocument({ titre: `Bon de travail ${d.numero}`, auteur: params.entreprise.nom });
  const x = doc.page.margins.left;
  const largeur = largeurUtile(doc);
  const tailleQr = 92;
  let y = doc.page.margins.top;

  // Bandeau : numéro très lisible à gauche, QR code vers la fiche à droite.
  doc.font(POLICE).fontSize(8.5).fillColor(COULEURS.discret).text(t(params.entreprise.nom || 'Evocom Print'), x, y, { width: largeur - tailleQr - 20 });
  etiquette(doc, 'Bon de travail', x, y + 14);
  doc.font(POLICE_GRAS).fontSize(30).fillColor(COULEURS.titre).text(t(d.numero), x, y + 26, { width: largeur - tailleQr - 20, lineBreak: false });
  doc
    .font(POLICE_GRAS)
    .fontSize(13)
    .fillColor(COULEURS.texte)
    .text(t(`${MACHINE_LABELS[d.machine]}  ·  ${MACHINE_DESCRIPTIONS[d.machine]}`), x, y + 64, { width: largeur - tailleQr - 20 });
  doc.font(POLICE).fontSize(9).fillColor(COULEURS.discret).text(t(`Statut : ${STATUT_LABELS[d.statut]}`), x, doc.y + 2, { width: largeur - tailleQr - 20 });

  const qr = await QRCode.toBuffer(lien.url, { errorCorrectionLevel: 'M', margin: 1, width: 300, color: { dark: '#1B2733', light: '#FFFFFF' } });
  const xQr = x + largeur - tailleQr;
  doc.image(qr, xQr, y, { width: tailleQr, height: tailleQr });
  doc
    .font(POLICE)
    .fontSize(6.5)
    .fillColor(COULEURS.discret)
    .text(t(lien.absolu ? 'Scanner pour ouvrir la fiche' : `Fiche : ${lien.url}`), xQr - 20, y + tailleQr + 3, { width: tailleQr + 20, align: 'right' });

  y = Math.max(doc.y, y + tailleQr + 14) + 8;

  if (d.urgent) {
    doc.save().rect(x, y, largeur, 26).fillColor(COULEURS.texte).fill().restore();
    doc
      .font(POLICE_GRAS)
      .fontSize(13)
      .fillColor('#FFFFFF')
      .text(t(`URGENT${d.date_promise ? `  ·  à livrer le ${jourFr(d.date_promise, tz)}` : ''}`), x + 10, y + 7, {
        width: largeur - 20,
        characterSpacing: 1,
        lineBreak: false,
      });
    y += 36;
  }

  // Informations principales sur deux colonnes.
  filet(doc, y);
  y += 10;
  const infos: [string, string][] = [
    ['Client', d.client_nom],
    ['À livrer le', d.date_promise ? jourFr(d.date_promise, tz) : 'Non précisé'],
    ['Préparateur', d.preparateur_nom ?? '-'],
    ['Créé le', dateHeureFr(d.created_at, tz)],
    ['Imprimeur', d.imprimeur_nom ?? 'Non attribué'],
    ['Validé le', d.date_validation ? dateHeureFr(d.date_validation, tz) : 'Pas encore validé'],
  ];
  const colW = largeur / 2;
  for (let i = 0; i < infos.length; i += 2) {
    let h = 0;
    for (let j = 0; j < 2; j++) {
      const info = infos[i + j];
      if (!info) continue;
      const cx = x + j * colW;
      etiquette(doc, info[0], cx, y);
      doc.font(POLICE_GRAS).fontSize(11).fillColor(COULEURS.texte).text(t(info[1]), cx, y + 11, { width: colW - 12 });
      h = Math.max(h, doc.y - y);
    }
    y += h + 8;
  }
  filet(doc, y);
  y += 14;

  if (d.description) y = paragraphe(doc, y, 'Description', d.description);

  // Travaux à réaliser.
  const lignes = (d.specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  doc.font(POLICE_GRAS).fontSize(12).fillColor(COULEURS.titre).text(t('Travaux à réaliser'), x, place(doc, y, 60));
  y = doc.y + 6;
  if (!lignes.length) {
    doc
      .font(POLICE)
      .fontSize(9.5)
      .fillColor(COULEURS.discret)
      .text(t('Aucune ligne de spécification : suivez la description et les consignes.'), x, y, { width: largeur });
    y = doc.y + 12;
  } else if (d.machine === 'roland') {
    const diviseur = { mm: 1e6, cm: 1e4, m: 1 } as const;
    const rows = (lignes as LigneRoland[]).map((l, i) => ({
      cellules: [
        String(i + 1),
        libelleTarif(tarifs, 'roland', l.support),
        `${formatDecimal(l.largeur)} x ${formatDecimal(l.hauteur)} ${l.unite}`,
        `${formatEntier(l.quantite)} ex.`,
        `${formatDecimal(((l.largeur * l.hauteur) / diviseur[l.unite]) * l.quantite, 2)} m²`,
        choixTexte(tarifs, 'roland', l.finitions, l.options),
      ],
      detail: l.description ?? null,
    }));
    y = tableau(doc, y, [
      { titre: 'N°', largeur: 24 },
      { titre: 'Support', largeur: 0 },
      { titre: 'Dimensions', largeur: 95 },
      { titre: 'Quantité', largeur: 55, align: 'right' },
      { titre: 'Surface', largeur: 55, align: 'right' },
      { titre: 'Finitions et options', largeur: 130 },
    ], rows, { detailColonne: 1, detailEtendu: true });
  } else {
    const rows = (lignes as LigneXerox[]).map((l, i) => ({
      cellules: [
        String(i + 1),
        libelleTarif(tarifs, 'xerox', l.support),
        `${formatEntier(l.pages)} p. ${l.recto_verso ? 'recto-verso' : 'recto seul'}`,
        `${formatEntier(l.quantite)} ex.`,
        `${formatEntier(Math.ceil(l.pages / (l.recto_verso ? 2 : 1)) * l.quantite)}`,
        choixTexte(tarifs, 'xerox', l.finitions, l.options),
      ],
      detail: l.description ?? null,
    }));
    y = tableau(doc, y, [
      { titre: 'N°', largeur: 24 },
      { titre: 'Format', largeur: 0 },
      { titre: 'Pages', largeur: 90 },
      { titre: 'Exemplaires', largeur: 74, align: 'right' },
      { titre: 'Feuilles', largeur: 60, align: 'right' },
      { titre: 'Finitions et options', largeur: 125 },
    ], rows, { detailColonne: 1, detailEtendu: true });
  }
  const forfaits = d.specs?.forfaits ?? [];
  if (forfaits.length) y = paragraphe(doc, y + 2, 'Services associés', choixTexte(tarifs, d.machine, forfaits, []));

  if (d.consignes) y = paragraphe(doc, y + 4, 'Consignes', d.consignes, { encadre: true });
  if (d.commentaire_revision) y = paragraphe(doc, y + 4, 'Dernière demande de révision', d.commentaire_revision);

  // Fichiers.
  doc.font(POLICE_GRAS).fontSize(12).fillColor(COULEURS.titre).text(t(`Fichiers (${d.fichiers.length})`), x, place(doc, y + 4, 50));
  y = doc.y + 6;
  if (!d.fichiers.length) {
    doc.font(POLICE).fontSize(9.5).fillColor(COULEURS.discret).text(t('Aucun fichier joint.'), x, y, { width: largeur });
    y = doc.y + 12;
  } else {
    y = tableau(
      doc,
      y,
      [
        { titre: 'Nom du fichier', largeur: 0 },
        { titre: 'Taille', largeur: 70, align: 'right' },
        { titre: 'Ajouté le', largeur: 95 },
        { titre: 'Remarque', largeur: 90 },
      ],
      d.fichiers.map((f) => ({
        cellules: [f.nom_original, formatTaille(f.taille), dateHeureFr(f.created_at, tz), f.a_reimprimer ? 'À RÉIMPRIMER' : ''],
        gras: f.a_reimprimer,
      })),
    );
  }

  // Suivi atelier : cases à remplir à la main.
  y = place(doc, y + 10, 80);
  doc.font(POLICE_GRAS).fontSize(12).fillColor(COULEURS.titre).text(t('Suivi atelier'), x, y);
  y = doc.y + 6;
  const cases = ['Impression (nom, date)', 'Finitions (nom, date)', 'Contrôle qualité (nom, date)'];
  const w = (largeur - 2 * 10) / 3;
  cases.forEach((c, i) => {
    const cx = x + i * (w + 10);
    doc.save().roundedRect(cx, y, w, 50, 3).lineWidth(0.75).strokeColor(COULEURS.discret).stroke().restore();
    etiquette(doc, c, cx + 6, y + 6, w - 12);
  });

  piedsDePage(doc, `Document interne à l'atelier, sans valeur commerciale. Imprimé le ${dateHeureFr(new Date(), tz)}.`, `Bon de travail ${d.numero}`);
  return versBuffer(doc);
}
