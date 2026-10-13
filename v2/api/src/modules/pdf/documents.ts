// Documents PDF : devis, facture, bon de travail.

import QRCode from 'qrcode';
import {
  formatDecimal,
  formatEntier,
  formatTaille,
  MACHINE_DESCRIPTIONS,
  MACHINE_LABELS,
  MODE_PAIEMENT_LABELS,
  STATUT_LABELS,
  type LigneRoland,
  type LigneXerox,
  type Machine,
  type ModePaiement,
  type Statut,
  type Tarif,
  detailsLigne,
  formulairesAnciens,
  sectionAncienneTexte,
} from '@evocom/shared';
import type { Parametres } from '../../lib/params';
import { dateHeureFr, jourFr } from '../commun/dates';
import {
  blocLibre,
  blocsParties,
  enTeteCommercial,
  ligneObjet,
  montantAPayer,
  paragrapheCommercial,
  piedCommercial,
  signatures,
  tableauCommercial,
  totauxCommerciaux,
  type LigneTotalCommercial,
} from './commercial';
import type { LigneDocument } from './lignes';
import {
  COULEURS,
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
  versBuffer,
  type Doc,
} from './mise-en-page';

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
// Devis et facture : modèle des documents de l'entreprise (commercial.ts).

/** Date courte « 11/06/2024 » dans le fuseau de l'entreprise ; une date AAAA-MM-JJ est lue telle quelle. */
function dateCourte(v: string | Date, tz: string): string {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [a, m, j] = v.split('-');
    return `${j}/${m}/${a}`;
  }
  return new Intl.DateTimeFormat('fr-FR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(v));
}

interface TotauxDocument {
  total_ht: number;
  tva: number;
  total_ttc: number;
  detail_prix?: { sous_total?: number; remise?: number; arrondi?: number; tva_taux?: number; tva_applicable?: boolean } | null;
}

function lignesTotaux(d: TotauxDocument, tauxDefaut: number, tvaForcee?: boolean): LigneTotalCommercial[] {
  const dp = d.detail_prix ?? {};
  const rows: LigneTotalCommercial[] = [];
  const remise = dp.remise ?? 0;
  const arrondi = dp.arrondi ?? 0;
  if (remise > 0 || arrondi !== 0) rows.push({ label: 'Sous-total :', valeur: formatEntier(dp.sous_total ?? d.total_ttc) });
  if (remise > 0) rows.push({ label: 'Remise :', valeur: `- ${formatEntier(remise)}` });
  if (arrondi !== 0) rows.push({ label: 'Arrondi :', valeur: `${arrondi > 0 ? '+ ' : '- '}${formatEntier(Math.abs(arrondi))}` });
  const tvaApplicable = tvaForcee ?? dp.tva_applicable ?? d.tva > 0;
  if (tvaApplicable) {
    rows.push({ label: 'Total HT :', valeur: formatEntier(d.total_ht) });
    rows.push({ label: `TVA (${formatDecimal(dp.tva_taux ?? tauxDefaut)} %) :`, valeur: formatEntier(d.tva) });
    rows.push({ label: 'TOTAL TTC :', valeur: formatEntier(d.total_ttc), fort: true });
  } else {
    rows.push({ label: 'TOTAL :', valeur: formatEntier(d.total_ttc), fort: true });
  }
  return rows;
}

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
  /** Imprimés en tête : « Mode de règlement : Chèque », « Date limite de règlement : À la commande ». */
  mode_reglement?: ModePaiement | null;
  echeance_reglement?: string | null;
}

export async function pdfDevis(d: DevisPdf, params: Parametres): Promise<Buffer> {
  const tz = params.fuseau;
  const doc = nouveauDocument({ titre: `Devis ${d.numero}`, auteur: params.entreprise.nom });
  const creation = new Date(d.created_at);
  const fin = new Date(creation.getTime() + d.validite_jours * 86_400_000);
  const infos: [string, string][] = [
    ['Date de création', dateCourte(creation, tz)],
    ['Date limite de validité', dateCourte(fin, tz)],
  ];
  if (d.mode_reglement) infos.push(['Mode de règlement', MODE_PAIEMENT_LABELS[d.mode_reglement]]);
  if (d.echeance_reglement) infos.push(['Date limite de règlement', d.echeance_reglement]);
  let y = enTeteCommercial(doc, `Devis N° ${d.numero}`, infos);
  y = blocsParties(doc, y, [params.entreprise.nom], [d.client_nom, d.client_telephone && `Tél. ${d.client_telephone}`, d.client_email]);
  if (d.description) y = ligneObjet(doc, y, d.description);
  y = tableauCommercial(doc, y, d.lignes);
  y = totauxCommerciaux(doc, y + 4, lignesTotaux(d, params.prix.tva_taux));
  y = montantAPayer(doc, y, d.total_ttc);
  if (d.notes) y = paragrapheCommercial(doc, y, 'Remarques', d.notes);
  if (params.documents.mentions_devis) y = paragrapheCommercial(doc, y, 'Mentions', params.documents.mentions_devis);
  signatures(doc, y + 4, true);

  if (d.statut === 'refuse') filigrane(doc, 'REFUSÉ');
  piedCommercial(doc, params.entreprise);
  return versBuffer(doc);
}

export interface FacturePdf {
  numero: string;
  machine: Machine | null;
  objet: string | null;
  statut: string;
  date_emission: string;
  /** AAAA-MM-JJ ; absente pour une facture sans échéance précisée. */
  date_echeance?: string | null;
  /** Null pour une facture directe (sans dossier). */
  dossier_numero: string | null;
  client_nom: string;
  client_telephone: string | null;
  client_email?: string | null;
  client_adresse: string | null;
  lignes: LigneDocument[];
  total_ht: number;
  tva_taux: number;
  tva: number;
  total_ttc: number;
  /** Null quand aucun paiement n'est suivi (facture directe) : le bloc « Déjà réglé » n'est pas imprimé. */
  deja_paye: number | null;
  reste: number | null;
  /** Remarques propres à la facture (facture directe). */
  notes?: string | null;
  /** Conditions de paiement propres à la facture ; sinon celles de Paramètres > Documents. */
  conditions_paiement?: string | null;
  /** Mode de règlement prévu sur le dossier. */
  mode_reglement?: ModePaiement | null;
  annulee_at: string | Date | null;
  motif_annulation: string | null;
}

export async function pdfFacture(f: FacturePdf, params: Parametres): Promise<Buffer> {
  const tz = params.fuseau;
  const doc = nouveauDocument({ titre: `Facture ${f.numero}`, auteur: params.entreprise.nom });
  const infos: [string, string][] = [['Date de création', dateCourte(f.date_emission, tz)]];
  if (f.date_echeance) infos.push(['Date limite de règlement', dateCourte(f.date_echeance, tz)]);
  if (f.mode_reglement) infos.push(['Mode de règlement', MODE_PAIEMENT_LABELS[f.mode_reglement]]);
  if (f.dossier_numero) infos.push(['Dossier', f.dossier_numero]);
  let y = enTeteCommercial(doc, `Facture N° ${f.numero}`, infos);
  y = blocsParties(doc, y, [params.entreprise.nom], [f.client_nom, f.client_adresse, f.client_telephone && `Tél. ${f.client_telephone}`, f.client_email ?? null]);
  if (f.statut === 'annulee') {
    y = paragrapheCommercial(
      doc,
      y,
      'Facture annulée',
      `Annulée le ${dateCourte(f.annulee_at ?? new Date(), tz)}${f.motif_annulation ? ` : ${f.motif_annulation}` : ''}. Ce document n'est plus valable ; son numéro n'est pas réutilisé.`,
    );
  }
  if (f.objet) y = ligneObjet(doc, y, f.objet.length > 200 ? `${f.objet.slice(0, 197)}...` : f.objet);
  y = tableauCommercial(doc, y, f.lignes);
  y = totauxCommerciaux(doc, y + 4, lignesTotaux({ total_ht: f.total_ht, tva: f.tva, total_ttc: f.total_ttc, detail_prix: { tva_taux: f.tva_taux } }, f.tva_taux, f.tva_taux > 0));
  y = montantAPayer(doc, y, f.total_ttc);
  if (f.statut !== 'annulee' && f.deja_paye !== null && f.reste !== null && f.deja_paye > 0) {
    y = totauxCommerciaux(doc, y, [
      { label: 'Déjà réglé :', valeur: formatEntier(f.deja_paye) },
      { label: 'Reste à payer :', valeur: formatEntier(f.reste), fort: true },
    ]);
  }
  if (f.notes) y = paragrapheCommercial(doc, y, 'Remarques', f.notes);
  const conditions = f.conditions_paiement || params.documents.conditions_paiement;
  if (conditions) y = paragrapheCommercial(doc, y, 'Conditions de paiement', conditions);
  y = signatures(doc, y + 4, false);
  if (params.entreprise.coordonnees_bancaires) blocLibre(doc, y, params.entreprise.coordonnees_bancaires);

  if (f.statut === 'annulee') filigrane(doc, 'ANNULÉE');
  piedCommercial(doc, params.entreprise);
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
  specs: { lignes?: unknown[]; forfaits?: { code: string; quantite?: number }[]; legacy?: unknown } | null;
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
  const anciens = lignes.length ? [] : formulairesAnciens(d.machine, d.specs?.legacy);
  if (anciens.length) {
    // Dossier repris de l'ancienne plateforme : le formulaire d'origine, section par section.
    const f = anciens[0]!;
    doc.font(POLICE).fontSize(9).fillColor(COULEURS.discret).text(t(`Formulaire de l'ancienne plateforme${f.date_saisie ? ` (saisi le ${jourFr(f.date_saisie, tz)})` : ''}`), x, y, { width: largeur });
    y = doc.y + 6;
    y = tableau(
      doc,
      y,
      [
        { titre: 'Sujet', largeur: 130 },
        { titre: 'À faire', largeur: 0 },
      ],
      f.sections.map((s) => ({ cellules: [s.titre, sectionAncienneTexte(s)], detail: null })),
      {},
    );
  } else if (!lignes.length) {
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
      detail: [...detailsLigne('roland', l), l.description].filter(Boolean).join(' · ') || null,
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
      detail: [...detailsLigne('xerox', l), l.description].filter(Boolean).join(' · ') || null,
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
