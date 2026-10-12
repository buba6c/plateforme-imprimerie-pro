// Outils libres de traitement des PDF, présents sur le serveur (apt-get install ghostscript qpdf) :
//  - qpdf : répare les tables de références abîmées (« xref », « invalid object »), compacte sans perte
//    (flux d'objets, compression), linéarise ;
//  - Ghostscript (pdfwrite) : réécrit le PDF pour l'impression (polices incorporées, images gardées au
//    moins à 300 ppp, compression efficace). C'est le moteur des « optimiseurs PDF » courants.
// Sans ces outils, le traitement est simplement ignoré (le fichier d'origine est servi).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const exec = promisify(execFile);

let qpdf: boolean | null = null;
let gs: boolean | null = null;

export async function qpdfPresent(): Promise<boolean> {
  if (qpdf === null) qpdf = await exec('qpdf', ['--version'], { timeout: 5000 }).then(() => true, () => false);
  return qpdf;
}

export async function gsPresent(): Promise<boolean> {
  if (gs === null) gs = await exec('gs', ['--version'], { timeout: 5000 }).then(() => true, () => false);
  return gs;
}

/** Pour les tests. */
export function oublierOutils() {
  qpdf = null;
  gs = null;
}
