// Mise en page des documents commerciaux (devis et facture), sur le modèle des documents de
// l'entreprise : titre et dates à gauche, logo à droite, blocs Vendeur / Acheteur, tableau à bande
// noire (N°, Désignation, Qté, PU, Total HT), TOTAL, montant à payer en chiffres et en lettres,
// zone de signatures, pied de page avec l'adresse, le RC, le NINEA, le téléphone et l'e-mail.
//
// Le bon de travail garde sa mise en page propre (mise-en-page.ts) : il n'est pas commercial.

import { formatDecimal, formatEntier, nombreEnLettres } from '@evocom/shared';
import type { Entreprise } from '../../lib/params';
import { quantiteFr, type LigneDocument } from './lignes';
import { LOGO_EVOCOM_PNG, LOGO_EVOCOM_RATIO } from './logo-evocom';
import { basDePage, largeurUtile, place, POLICE, POLICE_GRAS, t, UNITES_COURTES, type Doc } from './mise-en-page';

const NOIR = '#000000';
const GRIS = '#444444';
const FILET = '#D0D0D0';
const LARGEUR_LOGO = 150;

/** Titre du document (« Devis N° D/0861 ») et ses dates à gauche, logo à droite. Renvoie le y suivant. */
export function enTeteCommercial(doc: Doc, titre: string, infos: [string, string][]): number {
  const x = doc.page.margins.left;
  const largeur = largeurUtile(doc);
  const haut = doc.page.margins.top;
  const hauteurLogo = LARGEUR_LOGO / LOGO_EVOCOM_RATIO;
  doc.image(LOGO_EVOCOM_PNG, x + largeur - LARGEUR_LOGO, haut - 14, { width: LARGEUR_LOGO, height: hauteurLogo });

  doc.font(POLICE_GRAS).fontSize(18).fillColor(NOIR).text(t(titre), x, haut, { width: largeur - LARGEUR_LOGO - 20, lineBreak: false });
  let y = doc.y + 8;
  for (const [label, valeur] of infos) {
    doc.font(POLICE_GRAS).fontSize(8.5).fillColor(NOIR).text(t(`${label}: `), x, y, { continued: true, lineBreak: false });
    doc.font(POLICE).fontSize(8.5).fillColor(NOIR).text(t(valeur), { lineBreak: false });
    y += 12;
  }
  return Math.max(y + 24, haut + hauteurLogo + 18);
}

/** Blocs « Vendeur » et « Acheteur » côte à côte : un nom en premier, puis des précisions. Renvoie le y suivant. */
export function blocsParties(doc: Doc, y: number, vendeur: (string | null | undefined)[], acheteur: (string | null | undefined)[]): number {
  const x = doc.page.margins.left;
  const largeur = largeurUtile(doc);
  const xd = x + largeur * 0.55;
  const colonne = (cx: number, width: number, titre: string, lignes: (string | null | undefined)[]): number => {
    doc.font(POLICE_GRAS).fontSize(10).fillColor(NOIR).text(t(titre), cx, y, { width, lineBreak: false });
    let yy = y + 14;
    const contenu = lignes.filter((l): l is string => !!l && l.trim() !== '');
    if (!contenu.length) contenu.push('-');
    doc.font(POLICE).fontSize(9).fillColor(NOIR);
    for (const l of contenu) {
      doc.text(t(l), cx, yy, { width });
      yy = doc.y + 1;
    }
    return yy;
  };
  const y1 = colonne(x, largeur * 0.5, 'Vendeur', vendeur);
  const y2 = colonne(xd, largeur - (xd - x), 'Acheteur', acheteur);
  return Math.max(y1, y2) + 18;
}

/** Ligne « Objet : … » entre les parties et le tableau. */
export function ligneObjet(doc: Doc, y: number, texte: string): number {
  const x = doc.page.margins.left;
  const largeur = largeurUtile(doc);
  doc.font(POLICE_GRAS).fontSize(9).fillColor(NOIR).text(t('Objet : '), x, y, { continued: true });
  doc.font(POLICE).fontSize(9).fillColor(NOIR).text(t(texte), { width: largeur });
  return doc.y + 10;
}

const COLONNES = [
  { titre: 'N°', largeur: 28, align: 'left' as const },
  { titre: 'Désignation', largeur: 0, align: 'left' as const },
  { titre: 'Qté', largeur: 70, align: 'right' as const },
  { titre: 'PU', largeur: 80, align: 'right' as const },
  { titre: 'Total HT', largeur: 90, align: 'right' as const },
];

function quantiteTexte(l: LigneDocument): string {
  if (l.quantite === null || l.quantite === undefined) return '';
  const unite = l.unite && l.unite !== 'forfait' ? ` ${UNITES_COURTES[l.unite] ?? l.unite}` : '';
  return `${quantiteFr(l.quantite)}${unite}`;
}

function montantTexte(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return Number.isInteger(v) ? formatEntier(v) : formatDecimal(v, 2);
}

/**
 * Tableau des lignes : bande noire d'en-tête (répétée à chaque page), désignation en gras, précisions
 * en dessous ligne par ligne, filets fins entre les lignes. Renvoie le y sous le tableau.
 */
export function tableauCommercial(doc: Doc, yDepart: number, lignes: LigneDocument[]): number {
  const x0 = doc.page.margins.left;
  const total = largeurUtile(doc);
  const fixe = COLONNES.reduce((s, c) => s + c.largeur, 0);
  const largeurs = COLONNES.map((c) => (c.largeur === 0 ? total - fixe : c.largeur));
  const xs: number[] = [];
  largeurs.reduce((acc, w) => {
    xs.push(acc);
    return acc + w;
  }, x0);
  const pad = 4;

  const entete = (y: number): number => {
    doc.save().rect(x0, y, total, 16).fillColor(NOIR).fill().restore();
    COLONNES.forEach((c, i) => {
      doc.font(POLICE_GRAS).fontSize(8.5).fillColor('#FFFFFF').text(t(c.titre), xs[i]! + pad, y + 4, { width: largeurs[i]! - 2 * pad, align: c.align, lineBreak: false });
    });
    return y + 22;
  };

  let y = entete(place(doc, yDepart, 60));
  lignes.forEach((l, n) => {
    const cellules = [String(n + 1), l.designation, quantiteTexte(l), montantTexte(l.prix_unitaire), montantTexte(l.total)];
    const details = (l.detail ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
    doc.font(POLICE_GRAS).fontSize(9);
    let h = Math.max(11, doc.heightOfString(t(l.designation), { width: largeurs[1]! - 2 * pad }));
    doc.font(POLICE).fontSize(8);
    const hDetails = details.reduce((s, d) => s + doc.heightOfString(t(d), { width: largeurs[1]! - 2 * pad }), 0);
    const hLigne = h + hDetails + 10;
    if (y + hLigne > basDePage(doc)) {
      doc.addPage();
      y = entete(doc.page.margins.top);
    }
    cellules.forEach((cell, i) => {
      doc
        .font(i === 1 ? POLICE_GRAS : POLICE)
        .fontSize(9)
        .fillColor(NOIR)
        .text(t(cell), xs[i]! + pad, y, { width: largeurs[i]! - 2 * pad, align: COLONNES[i]!.align, lineBreak: i === 1 });
    });
    let yd = y + h;
    for (const d of details) {
      doc.font(POLICE).fontSize(8).fillColor(GRIS).text(t(d), xs[1]! + pad, yd, { width: largeurs[1]! - 2 * pad });
      yd = doc.y;
    }
    y += hLigne;
    doc.save().moveTo(x0, y - 4).lineTo(x0 + total, y - 4).lineWidth(0.5).strokeColor(FILET).stroke().restore();
  });
  return y + 2;
}

export interface LigneTotalCommercial {
  label: string;
  valeur: string;
  fort?: boolean;
}

/** Totaux alignés sur les colonnes PU / Total HT (« TOTAL : » en gras). Renvoie le y suivant. */
export function totauxCommerciaux(doc: Doc, yDepart: number, lignes: LigneTotalCommercial[]): number {
  const x = doc.page.margins.left;
  const largeur = largeurUtile(doc);
  const xLabel = x + largeur - 90 - 80 - 60;
  let y = place(doc, yDepart, lignes.length * 15 + 8);
  for (const l of lignes) {
    doc.font(l.fort ? POLICE_GRAS : POLICE).fontSize(9).fillColor(NOIR).text(t(l.label), xLabel, y, { width: 140, align: 'right', lineBreak: false });
    doc.font(l.fort ? POLICE_GRAS : POLICE).fontSize(9).fillColor(NOIR).text(t(l.valeur), x + largeur - 90, y, { width: 90 - 4, align: 'right', lineBreak: false });
    y += 15;
  }
  return y + 2;
}

/** « À payer: 1 105 000 Franc CFA » et « En lettres: un million cent cinq mille Franc CFA ». */
export function montantAPayer(doc: Doc, y: number, montant: number, libelle = 'À payer'): number {
  const x = doc.page.margins.left;
  const largeur = largeurUtile(doc);
  y = place(doc, y, 40);
  doc.font(POLICE_GRAS).fontSize(9).fillColor(NOIR).text(t(`${libelle}: `), x, y, { continued: true });
  doc.font(POLICE).fontSize(9).fillColor(NOIR).text(t(`${formatEntier(montant)} Franc CFA`), { width: largeur });
  y = doc.y + 6;
  doc.font(POLICE_GRAS).fontSize(9).fillColor(NOIR).text(t('En lettres: '), x, y, { continued: true });
  doc.font(POLICE).fontSize(9).fillColor(NOIR).text(t(`${nombreEnLettres(montant)} Franc CFA`), { width: largeur });
  return doc.y + 14;
}

/** Zone de signatures : « Nom du vendeur » à gauche ; à droite, la mention « Bon pour accord » (devis). */
export function signatures(doc: Doc, y: number, bonPourAccord: boolean): number {
  const x = doc.page.margins.left;
  const largeur = largeurUtile(doc);
  y = place(doc, y, 70);
  const wg = largeur * 0.4;
  doc.font(POLICE_GRAS).fontSize(9).fillColor(NOIR).text(t('Nom du vendeur'), x + 40, y, { width: wg, align: 'center', lineBreak: false });
  if (bonPourAccord) {
    const xd = x + largeur * 0.5;
    doc.font(POLICE_GRAS).fontSize(9).fillColor(NOIR).text(t('Date et signature du client précédée de la mention'), xd, y, { width: largeur - (xd - x), align: 'center', lineBreak: false });
    doc.font(POLICE_GRAS).fontSize(9).fillColor(NOIR).text(t('‘Bon pour accord’'), xd, y + 14, { width: largeur - (xd - x), align: 'center', lineBreak: false });
  }
  return y + 70;
}

/** Bloc libre en grands caractères (coordonnées bancaires sur la facture). */
export function blocLibre(doc: Doc, y: number, texte: string): number {
  const x = doc.page.margins.left;
  const largeur = largeurUtile(doc);
  doc.font(POLICE).fontSize(11);
  const h = doc.heightOfString(t(texte), { width: largeur - 20, lineGap: 6 });
  y = place(doc, y, h + 10);
  doc.fillColor(NOIR).text(t(texte), x + 10, y, { width: largeur - 20, lineGap: 6 });
  return doc.y + 16;
}

/** Paragraphe simple (titre en gras, texte en dessous). */
export function paragrapheCommercial(doc: Doc, y: number, titre: string, texte: string): number {
  const x = doc.page.margins.left;
  const largeur = largeurUtile(doc);
  doc.font(POLICE).fontSize(8.5);
  const h = doc.heightOfString(t(texte), { width: largeur }) + 14;
  y = place(doc, y, Math.min(h, 200));
  doc.font(POLICE_GRAS).fontSize(8.5).fillColor(NOIR).text(t(titre), x, y, { width: largeur });
  doc.font(POLICE).fontSize(8.5).fillColor(NOIR).text(t(texte), x, doc.y + 1, { width: largeur });
  return doc.y + 10;
}

/**
 * Pied de page de chaque page : « Page i / n » à gauche, coordonnées de l'entreprise au centre
 * (adresse ; RC et NINEA ; téléphone et e-mail), texte libre à droite. À appeler avant versBuffer.
 */
export function piedCommercial(doc: Doc, entreprise: Entreprise) {
  const range = doc.bufferedPageRange();
  const centre = [
    entreprise.adresse,
    [entreprise.rccm && `R.C. ${entreprise.rccm}`, entreprise.ninea && `NINEA ${entreprise.ninea}`].filter(Boolean).join(' '),
    [entreprise.telephone && `Tél : ${entreprise.telephone}`, entreprise.email && `email : ${entreprise.email}`].filter(Boolean).join(' - '),
  ].filter((l) => l && l.trim());
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bas = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // écrire dans la marge sans déclencher de saut de page
    const x = doc.page.margins.left;
    const width = largeurUtile(doc);
    const y = doc.page.height - 44;
    doc.font(POLICE).fontSize(7).fillColor(NOIR).text(t(`Page ${i - range.start + 1} / ${range.count}`), x, y, { width: 100, lineBreak: false });
    let yc = y;
    for (const l of centre) {
      doc.font(POLICE).fontSize(7).fillColor(NOIR).text(t(l), x + 100, yc, { width: width - 240, align: 'center', lineBreak: false });
      yc += 9;
    }
    if (entreprise.pied_facture) {
      doc.font(POLICE).fontSize(7).fillColor(NOIR).text(t(entreprise.pied_facture), x + width - 140, y, { width: 140, align: 'right', height: 27, ellipsis: true });
    }
    doc.page.margins.bottom = bas;
  }
}
