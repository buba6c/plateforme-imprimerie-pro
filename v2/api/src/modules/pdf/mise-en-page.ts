// Mise en page commune des documents PDF (devis, facture, bon de travail) : A4, Helvetica
// intégrée au lecteur PDF (aucun fichier de police à déployer), couleurs de la charte.
//
// Les polices standard de PDF ne connaissent que l'encodage WinAnsi : tout texte passe par
// `t()` qui remplace les caractères hors de cet encodage (espace fine insécable des montants,
// signe moins typographique…) par un équivalent sûr.

import PDFDocument from 'pdfkit';
import type { Entreprise } from '../../lib/params';

export const COULEURS = {
  titre: '#0F4C81',
  texte: '#1B2733',
  discret: '#5F6B7A',
  filet: '#E1E7EE',
  fond: '#F4F7FA',
} as const;

export const POLICE = 'Helvetica';
export const POLICE_GRAS = 'Helvetica-Bold';

const MARGE = 50;
const MARGE_BAS = 60;

// Caractères Unicode au-delà de 255 que WinAnsi sait représenter.
const WIN_ANSI_EXTRA = new Set([
  0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017d, 0x017e, 0x0192, 0x02c6, 0x02dc, 0x2013, 0x2014, 0x2018, 0x2019, 0x201a,
  0x201c, 0x201d, 0x201e, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122,
]);

const REMPLACEMENTS: Record<number, string> = {
  0x202f: ' ', // espace fine insécable (séparateur de milliers)
  0x2009: ' ',
  0x2007: ' ',
  0x200b: '',
  0x2212: '-', // signe moins
  0x2010: '-',
  0x2011: '-',
  0x2192: '->',
  0x2190: '<-',
  0x2264: '<=',
  0x2265: '>=',
  0x2032: "'",
  0x2033: '"',
};

/** Texte sûr pour une police standard PDF. */
export function t(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value).normalize('NFC');
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (code === 0x0a) out += '\n';
    else if (code < 0x20 || (code >= 0x7f && code < 0xa0)) out += ' ';
    else if (code <= 0xff || WIN_ANSI_EXTRA.has(code)) out += ch;
    else if (REMPLACEMENTS[code] !== undefined) out += REMPLACEMENTS[code];
    else out += '?';
  }
  return out;
}

export type Doc = PDFKit.PDFDocument;

export function nouveauDocument(info: { titre: string; sujet?: string; auteur?: string }): Doc {
  return new PDFDocument({
    size: 'A4',
    margins: { top: MARGE, bottom: MARGE_BAS, left: MARGE, right: MARGE },
    bufferPages: true,
    info: { Title: t(info.titre), Subject: t(info.sujet ?? info.titre), Author: t(info.auteur ?? 'Evocom Print'), Creator: 'Evocom Print' },
  });
}

/** Termine le document et renvoie son contenu. */
export function versBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export function largeurUtile(doc: Doc): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

export function basDePage(doc: Doc): number {
  return doc.page.height - doc.page.margins.bottom;
}

export function filet(doc: Doc, y: number, x1 = doc.page.margins.left, x2 = doc.page.width - doc.page.margins.right, couleur: string = COULEURS.filet) {
  doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(0.75).strokeColor(couleur).stroke().restore();
}

/** Ajoute une page si `hauteur` ne tient plus ; renvoie le y où écrire. */
export function place(doc: Doc, y: number, hauteur: number): number {
  if (y + hauteur <= basDePage(doc)) return y;
  doc.addPage();
  return doc.page.margins.top;
}

/** Libellé discret en petites capitales (au-dessus d'un bloc). */
export function etiquette(doc: Doc, texte: string, x: number, y: number, width?: number, align: 'left' | 'right' = 'left') {
  doc.font(POLICE_GRAS).fontSize(7.5).fillColor(COULEURS.discret).text(t(texte.toUpperCase()), x, y, { width, align, characterSpacing: 0.6, lineBreak: false });
}

/**
 * En-tête : coordonnées de l'entreprise à gauche, titre du document et références à droite.
 * Renvoie le y sous l'en-tête.
 */
export function enTete(doc: Doc, entreprise: Entreprise, titre: string, references: [string, string][]): number {
  const x = doc.page.margins.left;
  const largeur = largeurUtile(doc);
  const colGauche = largeur * 0.55;
  let y = doc.page.margins.top;

  doc.font(POLICE_GRAS).fontSize(15).fillColor(COULEURS.titre).text(t(entreprise.nom || 'Evocom Print'), x, y, { width: colGauche });
  let yg = doc.y + 3;
  doc.font(POLICE).fontSize(8.5).fillColor(COULEURS.discret);
  const coordonnees = [
    entreprise.adresse,
    [entreprise.telephone && `Tél. ${entreprise.telephone}`, entreprise.email].filter(Boolean).join('  ·  '),
    [entreprise.ninea && `NINEA ${entreprise.ninea}`, entreprise.rccm && `RCCM ${entreprise.rccm}`].filter(Boolean).join('  ·  '),
  ].filter((l) => l && l.trim());
  for (const l of coordonnees) {
    doc.text(t(l), x, yg, { width: colGauche });
    yg = doc.y + 1;
  }

  const xd = x + colGauche;
  const ld = largeur - colGauche;
  doc.font(POLICE_GRAS).fontSize(20).fillColor(COULEURS.titre).text(t(titre), xd, y - 2, { width: ld, align: 'right', characterSpacing: 1 });
  let yd = doc.y + 4;
  for (const [label, valeur] of references) {
    doc.font(POLICE).fontSize(8.5).fillColor(COULEURS.discret).text(t(label), xd, yd, { width: ld - 110, align: 'right', lineBreak: false });
    doc.font(POLICE_GRAS).fontSize(9).fillColor(COULEURS.texte).text(t(valeur), xd + ld - 105, yd - 0.5, { width: 105, align: 'right', lineBreak: false });
    yd += 13;
  }

  y = Math.max(yg, yd) + 10;
  filet(doc, y);
  return y + 14;
}

/** Bloc encadré (client, destinataire…). Renvoie le y sous le bloc. */
export function blocInfos(doc: Doc, y: number, titre: string, nom: string, lignes: (string | null | undefined)[], opts: { x?: number; width?: number } = {}): number {
  const x = opts.x ?? doc.page.margins.left;
  const width = opts.width ?? largeurUtile(doc) * 0.5;
  const pad = 10;
  const contenu = lignes.filter((l): l is string => !!l && l.trim() !== '');
  doc.font(POLICE_GRAS).fontSize(11);
  let h = pad + 11 + doc.heightOfString(t(nom), { width: width - 2 * pad }) + 2;
  doc.font(POLICE).fontSize(9);
  for (const l of contenu) h += doc.heightOfString(t(l), { width: width - 2 * pad }) + 1;
  h += pad;
  doc.save().roundedRect(x, y, width, h, 4).fillColor(COULEURS.fond).fill().restore();
  etiquette(doc, titre, x + pad, y + pad);
  doc.font(POLICE_GRAS).fontSize(11).fillColor(COULEURS.texte).text(t(nom), x + pad, y + pad + 11, { width: width - 2 * pad });
  let yy = doc.y + 2;
  doc.font(POLICE).fontSize(9).fillColor(COULEURS.texte);
  for (const l of contenu) {
    doc.text(t(l), x + pad, yy, { width: width - 2 * pad });
    yy = doc.y + 1;
  }
  return y + h;
}

export interface Colonne {
  titre: string;
  largeur: number; // 0 = largeur restante
  align?: 'left' | 'right' | 'center';
}

export interface LigneTableau {
  cellules: string[];
  /** Texte secondaire, en discret sous la première cellule. */
  detail?: string | null;
  gras?: boolean;
}

/** Tableau à filets fins, en-tête répété à chaque page. Renvoie le y sous le tableau. */
export function tableau(doc: Doc, yDepart: number, colonnes: Colonne[], lignes: LigneTableau[]): number {
  const x0 = doc.page.margins.left;
  const total = largeurUtile(doc);
  const fixe = colonnes.reduce((s, c) => s + c.largeur, 0);
  const largeurs = colonnes.map((c) => (c.largeur === 0 ? total - fixe : c.largeur));
  const xs: number[] = [];
  largeurs.reduce((acc, w) => {
    xs.push(acc);
    return acc + w;
  }, x0);
  const pad = 5;

  const entete = (y: number): number => {
    colonnes.forEach((c, i) => {
      doc.font(POLICE_GRAS).fontSize(7.5).fillColor(COULEURS.discret).text(t(c.titre.toUpperCase()), xs[i]! + pad, y, {
        width: largeurs[i]! - 2 * pad,
        align: c.align ?? 'left',
        characterSpacing: 0.5,
        lineBreak: false,
      });
    });
    const yb = y + 13;
    filet(doc, yb, x0, x0 + total, COULEURS.discret);
    return yb + 6;
  };

  let y = entete(place(doc, yDepart, 40));
  for (const ligne of lignes) {
    doc.font(ligne.gras ? POLICE_GRAS : POLICE).fontSize(9);
    let h = 0;
    ligne.cellules.forEach((cell, i) => {
      h = Math.max(h, doc.heightOfString(t(cell), { width: largeurs[i]! - 2 * pad }));
    });
    let hDetail = 0;
    if (ligne.detail) {
      doc.font(POLICE).fontSize(8);
      hDetail = doc.heightOfString(t(ligne.detail), { width: largeurs[0]! - 2 * pad }) + 2;
    }
    const hLigne = Math.max(h, 11) + hDetail + 8;
    if (y + hLigne > basDePage(doc)) {
      doc.addPage();
      y = entete(doc.page.margins.top);
    }
    ligne.cellules.forEach((cell, i) => {
      doc.font(ligne.gras ? POLICE_GRAS : POLICE).fontSize(9).fillColor(COULEURS.texte).text(t(cell), xs[i]! + pad, y, {
        width: largeurs[i]! - 2 * pad,
        align: colonnes[i]!.align ?? 'left',
      });
    });
    if (ligne.detail) {
      doc.font(POLICE).fontSize(8).fillColor(COULEURS.discret).text(t(ligne.detail), xs[0]! + pad, y + h + 2, { width: largeurs[0]! - 2 * pad });
    }
    y += hLigne;
    filet(doc, y - 4, x0, x0 + total);
  }
  return y + 4;
}

export interface LigneTotal {
  label: string;
  valeur: string;
  fort?: boolean;
}

/** Bloc de totaux aligné à droite. Renvoie le y sous le bloc. */
export function totaux(doc: Doc, yDepart: number, lignes: LigneTotal[]): number {
  const largeur = 240;
  const x = doc.page.width - doc.page.margins.right - largeur;
  let y = place(doc, yDepart, lignes.length * 18 + 10);
  for (const l of lignes) {
    if (l.fort) {
      doc.save().rect(x, y - 4, largeur, 22).fillColor(COULEURS.fond).fill().restore();
      doc.font(POLICE_GRAS).fontSize(10.5).fillColor(COULEURS.titre).text(t(l.label), x + 8, y + 1.5, { width: 110, lineBreak: false });
      doc.font(POLICE_GRAS).fontSize(10.5).fillColor(COULEURS.titre).text(t(l.valeur), x + 110, y + 1.5, { width: largeur - 118, align: 'right', lineBreak: false });
      y += 24;
    } else {
      doc.font(POLICE).fontSize(9).fillColor(COULEURS.discret).text(t(l.label), x + 8, y, { width: 130, lineBreak: false });
      doc.font(POLICE).fontSize(9).fillColor(COULEURS.texte).text(t(l.valeur), x + 110, y, { width: largeur - 118, align: 'right', lineBreak: false });
      y += 16;
    }
  }
  return y + 4;
}

/** Paragraphe titré (notes, conditions, consignes). Renvoie le y suivant. */
export function paragraphe(doc: Doc, y: number, titre: string, texte: string, opts: { encadre?: boolean } = {}): number {
  const x = doc.page.margins.left;
  const width = largeurUtile(doc);
  doc.font(POLICE).fontSize(9.5);
  const pad = opts.encadre ? 10 : 0;
  const h = doc.heightOfString(t(texte), { width: width - 2 * pad }) + 14 + 2 * pad;
  y = place(doc, y, Math.min(h, 200));
  if (opts.encadre) {
    doc.save().roundedRect(x, y, width, h, 4).lineWidth(1).strokeColor(COULEURS.titre).stroke().restore();
  }
  etiquette(doc, titre, x + pad, y + pad);
  doc.font(POLICE).fontSize(9.5).fillColor(COULEURS.texte).text(t(texte), x + pad, y + pad + 12, { width: width - 2 * pad });
  return Math.max(doc.y, y + h) + 10;
}

/** Pied de page sur chaque page : texte de l'entreprise et pagination. À appeler juste avant versBuffer. */
export function piedsDePage(doc: Doc, texte: string, reference: string) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bas = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // écrire dans la marge sans déclencher de saut de page
    const x = doc.page.margins.left;
    const width = largeurUtile(doc);
    const y = doc.page.height - 42;
    filet(doc, y - 6, x, x + width);
    if (texte) {
      doc.font(POLICE).fontSize(7.5).fillColor(COULEURS.discret).text(t(texte), x, y, { width: width - 90, height: 22, ellipsis: true });
    }
    doc
      .font(POLICE)
      .fontSize(7.5)
      .fillColor(COULEURS.discret)
      .text(t(`${reference}  ·  Page ${i - range.start + 1} / ${range.count}`), x + width - 160, y, { width: 160, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bas;
  }
}

/** Unités courtes pour la colonne « Unité ». */
export const UNITES_COURTES: Record<string, string> = {
  m2: 'm²',
  ml: 'ml',
  page: 'face',
  feuille: 'feuille',
  exemplaire: 'ex.',
  unite: 'unité',
  forfait: 'forfait',
  pourcent: '%',
};
