// Fichiers d'impression de la démonstration : métadonnées en mémoire, contenus générés
// (image de remplacement, petit PDF valide, note texte). Aucun fichier client réel n'est inclus ;
// un fichier ajouté pendant la démonstration reste lisible tant que la page est ouverte.

import { formatTaille, type LigneRoland } from '@evocom/shared';
import { E, maintenant, prochainId, type DossierDemo, type UserDemo } from './etat';
import { charger, evenement, peutModifier, peutVoirFichiers } from './domaine/dossiers';
import { ErreurDemo, forbidden, notFound } from './http';
import { toutesLesReponses } from './enregistrements';
import { signalDossier } from './temps-reel';

export interface MetaFichier {
  id: number;
  nom: string;
  mime: string | null;
  taille: number;
  dossier: DossierDemo | null;
}

/** Fichier connu du domaine, ou d'une réponse enregistrée (gestion des fichiers). */
export function metaFichier(id: number): MetaFichier | null {
  for (const d of E().dossiers) {
    const f = d.fichiers.find((x) => x.id === id);
    if (f) return { id, nom: f.nom_original, mime: f.mime, taille: f.taille, dossier: d };
  }
  for (const corps of toutesLesReponses('/gestion-fichiers')) {
    const f = ((corps as any)?.items ?? []).find((x: any) => x?.id === id && x?.nom_original);
    if (f) return { id, nom: f.nom_original, mime: f.mime ?? null, taille: f.taille ?? 0, dossier: E().dossiers.find((d) => d.id === f.dossier_id) ?? null };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Contenus générés

const echapperXml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

function proportions(m: MetaFichier): { l: number; h: number; legende: string } {
  const ligne = m.dossier?.machine === 'roland' ? (m.dossier.specs.lignes?.[0] as LigneRoland | undefined) : undefined;
  if (ligne?.largeur && ligne.hauteur) {
    const r = ligne.largeur / ligne.hauteur;
    const l = r >= 1 ? 1200 : Math.round(1200 * r);
    const h = r >= 1 ? Math.round(1200 / r) : 1200;
    return { l: Math.max(l, 300), h: Math.max(h, 300), legende: `${ligne.largeur} × ${ligne.hauteur} ${ligne.unite}` };
  }
  return { l: 1200, h: 850, legende: 'Format d’origine' };
}

function imageSvg(m: MetaFichier): string {
  const { l, h, legende } = proportions(m);
  const t = Math.round(Math.min(l, h) / 14);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${l}" height="${h}" viewBox="0 0 ${l} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#007bff"/><stop offset="1" stop-color="#00c6ff"/></linearGradient>
<pattern id="p" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 40L40 0" stroke="#ffffff" stroke-opacity=".12" stroke-width="2"/></pattern></defs>
<rect width="${l}" height="${h}" fill="url(#g)"/><rect width="${l}" height="${h}" fill="url(#p)"/>
<rect x="${t}" y="${t}" width="${l - 2 * t}" height="${h - 2 * t}" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="3" stroke-dasharray="14 10"/>
<g fill="#ffffff" font-family="Geist, Arial, sans-serif" text-anchor="middle">
<text x="${l / 2}" y="${h / 2 - t * 0.9}" font-size="${t * 0.8}" font-weight="700">Aperçu de démonstration</text>
<text x="${l / 2}" y="${h / 2 + t * 0.3}" font-size="${t * 0.55}">${echapperXml(m.nom)}</text>
<text x="${l / 2}" y="${h / 2 + t * 1.2}" font-size="${t * 0.45}" fill-opacity=".85">${echapperXml(legende)} · le fichier réel n’est pas inclus</text>
</g></svg>`;
}

/** Caractères typographiques de WinAnsiEncoding hors Latin-1 (apostrophe, tirets, Œ…). */
const WIN_ANSI: Record<string, number> = { '€': 0x80, '…': 0x85, 'Œ': 0x8c, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, 'œ': 0x9c };

/** Texte PDF : caractères WinAnsi (Latin-1 et typographie courante), parenthèses et barres obliques échappées. */
function textePdf(s: string): string {
  return [...s]
    .map((c) => (WIN_ANSI[c] ? String.fromCharCode(WIN_ANSI[c]) : c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0xff ? c : '?'))
    .join('')
    .replace(/[\\()]/g, (c) => `\\${c}`);
}

/** Petit PDF valide d'une page, écrit à la main (aucune bibliothèque). */
export function pdfSimple(titre: string, lignes: string[]): Blob {
  const contenu = [
    'q 0.94 0.96 0.99 rg 40 40 515 762 re f Q',
    'q 0 0.48 1 RG 2 w 40 40 515 762 re S Q',
    'BT /F2 22 Tf 0.06 0.30 0.51 rg 70 740 Td',
    `(${textePdf(titre)}) Tj ET`,
    ...lignes.map((l, i) => `BT /F1 12 Tf 0.15 0.17 0.2 rg 70 ${700 - i * 22} Td (${textePdf(l)}) Tj ET`),
  ].join('\n');
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const positions: number[] = [];
  objets.forEach((o, i) => {
    positions.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const octets = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) octets[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([octets], { type: 'application/pdf' });
}

function contenuGenere(m: MetaFichier): Blob {
  const mime = m.mime ?? '';
  if (mime.startsWith('image/')) return new Blob([imageSvg(m)], { type: 'image/svg+xml' });
  const lignes = [
    `Fichier : ${m.nom}`,
    `Taille d'origine : ${formatTaille(m.taille)}`,
    m.dossier ? `Dossier : ${m.dossier.numero} - ${m.dossier.client_nom}` : '',
    '',
    'Ceci est un aperçu généré pour la démonstration d’Evocom Print.',
    'Les fichiers réels des clients ne sont pas inclus dans la démonstration.',
  ].filter((l, i) => l !== '' || i === 3);
  if (mime === 'application/pdf') return pdfSimple('Aperçu de démonstration', lignes);
  return new Blob([`${lignes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
}

// ---------------------------------------------------------------------------
// Adresses blob: (aperçu et téléchargement)

const reels = new Map<number, Blob>();
const adresses = new Map<number, string>();
/** Contenus servis par l'interception de fetch (le navigateur peut refuser fetch(blob:) selon la politique de sécurité). */
export const contenusBlob = new Map<string, { blob: Blob; nom: string }>();

export function enregistrerContenu(id: number, blob: Blob) {
  reels.set(id, blob);
  const ancienne = adresses.get(id);
  if (ancienne) {
    contenusBlob.delete(ancienne);
    URL.revokeObjectURL(ancienne);
    adresses.delete(id);
  }
}

/** Après une réinitialisation : les identifiants de fichiers peuvent désigner d'autres fichiers. */
export function oublierContenus() {
  for (const url of adresses.values()) {
    contenusBlob.delete(url);
    URL.revokeObjectURL(url);
  }
  adresses.clear();
  reels.clear();
}

export function adresseBlob(blob: Blob, nom: string): string {
  const url = URL.createObjectURL(blob);
  contenusBlob.set(url, { blob, nom });
  return url;
}

export function fichierUrl(id: number): string {
  const deja = adresses.get(id);
  if (deja) return deja;
  const m = metaFichier(id);
  const blob = reels.get(id) ?? (m ? contenuGenere(m) : pdfSimple('Fichier introuvable', ['Ce fichier n’existe pas dans la démonstration.']));
  const url = adresseBlob(blob, m?.nom ?? `fichier-${id}`);
  adresses.set(id, url);
  return url;
}

// ---------------------------------------------------------------------------
// Écritures (envoi, marquage, suppression)

/** Fin d'un envoi tus simulé : mêmes contrôles que le serveur (onUploadCreate / onUploadFinish). */
export function ajouterFichier(user: UserDemo, meta: { dossierId: number; filename: string; filetype: string; taille: number }) {
  const p = E().parametres.fichiers ?? {};
  const nom = (meta.filename || 'fichier').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180);
  const ext = nom.includes('.') ? nom.split('.').pop()!.toLowerCase() : '';
  const extensions: string[] = p.extensions ?? [];
  if (extensions.length && !extensions.includes(ext)) {
    throw new ErreurDemo(415, `Type de fichier refusé${ext ? ` (.${ext})` : ''}. Extensions acceptées : ${extensions.map((e) => `.${e}`).join(', ')}.`);
  }
  if (p.taille_max_mo && meta.taille > p.taille_max_mo * 1024 * 1024) {
    throw new ErreurDemo(413, `Fichier trop volumineux : ${p.taille_max_mo} Mo au maximum par fichier.`);
  }
  let d: DossierDemo;
  try {
    d = charger(user, meta.dossierId);
  } catch {
    throw new ErreurDemo(404, 'Dossier introuvable.');
  }
  if (!peutModifier(user, d)) throw new ErreurDemo(403, 'Le dossier est validé : les fichiers ne peuvent plus être modifiés.');
  const id = prochainId('fichier');
  d.fichiers.push({
    id,
    nom_original: nom,
    mime: meta.filetype || 'application/octet-stream',
    taille: meta.taille,
    a_reimprimer: false,
    created_at: maintenant(),
    uploaded_by: user.id,
    uploaded_by_nom: user.nom,
    deleted_at: null,
  });
  evenement(d, user, { type: 'fichier', action: 'ajout', data: { fichier_id: id, nom, taille: meta.taille } });
  d.updated_at = maintenant();
  signalDossier(d, d.statut);
  return id;
}

function fichierAccessible(user: UserDemo, id: number) {
  if (!peutVoirFichiers(user)) throw forbidden("Votre rôle n'a pas accès aux fichiers d'impression.");
  const d = E().dossiers.find((x) => x.fichiers.some((f) => f.id === id && !f.deleted_at));
  if (!d) throw notFound('Fichier introuvable.');
  charger(user, d.id);
  return { d, f: d.fichiers.find((f) => f.id === id)! };
}

export function marquer(user: UserDemo, id: number, body: any) {
  if (typeof body?.a_reimprimer !== 'boolean') throw new ErreurDemo(400, 'Certains champs sont invalides.', { champs: { a_reimprimer: 'Oui ou non' } }, 'requete_invalide');
  const { d, f } = fichierAccessible(user, id);
  const imprimeurOk = user.role === `imprimeur_${d.machine}`;
  if (user.role !== 'admin' && !imprimeurOk && !(user.role === 'preparateur' && d.preparateur_id === user.id)) throw forbidden();
  f.a_reimprimer = body.a_reimprimer;
  evenement(d, user, { type: 'fichier', action: body.a_reimprimer ? 'a_reimprimer' : 'reimpression_annulee', data: { fichier_id: f.id, nom: f.nom_original } });
  signalDossier(d, d.statut);
}

export function supprimer(user: UserDemo, id: number) {
  const { d, f } = fichierAccessible(user, id);
  if (!peutModifier(user, d)) throw forbidden('Le dossier est validé : ses fichiers ne peuvent plus être supprimés.');
  f.deleted_at = maintenant();
  evenement(d, user, { type: 'fichier', action: 'suppression', data: { fichier_id: f.id, nom: f.nom_original } });
  signalDossier(d, d.statut);
}

/** Contenu d'un fichier pour GET /fichiers/:id/contenu (droits vérifiés). */
export function contenu(user: UserDemo, id: number): Blob {
  fichierAccessible(user, id);
  const m = metaFichier(id)!;
  return reels.get(id) ?? contenuGenere(m);
}
