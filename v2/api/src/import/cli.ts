// Ligne de commande : npm -w api run import-legacy -- [options]
//
// Codes de sortie : 0 succès, 1 erreur, 2 base v2 non vide sans --remplacer.

import path from 'node:path';
import { runImport } from './importer';

const AIDE = `Import des données de l'ancienne plateforme EvocomPrint dans Evocom Print v2.

Usage : npm -w api run import-legacy -- [options]

Options :
  --dry-run              Simulation : tout est exécuté puis annulé, aucun fichier copié ; le rapport est écrit.
  --legacy-url URL       Ancienne base PostgreSQL (lecture seule). Défaut : LEGACY_DATABASE_URL.
  --uploads DIR [DIR…]   Dossiers d'uploads de l'ancienne plateforme (option répétable).
                         Défaut : LEGACY_UPLOADS_DIRS (séparés par des virgules).
  --rapport FICHIER      Rapport JSON. Défaut : ./import-report-<date>.json
  --remplacer            Efface les données métier déjà présentes dans la base v2 avant l'import.
  --fuseau ZONE          Fuseau des dates de l'ancienne base (défaut : celui de son serveur).
  --copies N             Copies de fichiers simultanées (défaut 4).
  --liens                Liens durs vers les fichiers d'origine au lieu de copies (même disque :
                         aucune place en plus ; les originaux ne sont ni déplacés ni modifiés).
  --aide                 Affiche cette aide.

Variables d'environnement : DATABASE_URL (base v2), STORAGE_DIR (stockage v2),
LEGACY_DATABASE_URL, LEGACY_UPLOADS_DIRS.
`;

interface Args {
  dryRun: boolean;
  remplacer: boolean;
  legacyUrl?: string;
  uploads: string[];
  rapport?: string;
  fuseau?: string;
  copies?: number;
  liens: boolean;
  aide: boolean;
}

function lireArgs(argv: string[]): Args {
  const a: Args = { dryRun: false, remplacer: false, uploads: [], liens: false, aide: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const [nom, valeurInline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const valeur = (): string => {
      if (valeurInline !== undefined) return valeurInline;
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`L'option ${nom} attend une valeur.`);
      return v;
    };
    switch (nom) {
      case '--dry-run':
      case '--simulation':
        a.dryRun = true;
        break;
      case '--remplacer':
        a.remplacer = true;
        break;
      case '--legacy-url':
        a.legacyUrl = valeur();
        break;
      case '--uploads':
        a.uploads.push(...valeur().split(',').map((s) => s.trim()).filter(Boolean));
        // Valeurs supplémentaires sans répéter l'option : --uploads A B
        while (valeurInline === undefined && argv[i + 1] !== undefined && !argv[i + 1]!.startsWith('--')) a.uploads.push(argv[++i]!);
        break;
      case '--rapport':
        a.rapport = valeur();
        break;
      case '--fuseau':
        a.fuseau = valeur();
        break;
      case '--copies':
        a.copies = Number(valeur());
        if (!Number.isInteger(a.copies) || a.copies < 1 || a.copies > 32) throw new Error('--copies attend un entier entre 1 et 32.');
        break;
      case '--liens':
        a.liens = true;
        break;
      case '--aide':
      case '--help':
      case '-h':
        a.aide = true;
        break;
      default:
        throw new Error(`Option inconnue : ${arg} (voir --aide).`);
    }
  }
  return a;
}

async function main(): Promise<number> {
  let args: Args;
  try {
    args = lireArgs(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }
  if (args.aide) {
    console.log(AIDE);
    return 0;
  }
  const uploads = args.uploads.length
    ? args.uploads
    : (process.env.LEGACY_UPLOADS_DIRS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const storageDir = path.resolve(process.env.STORAGE_DIR || path.resolve(process.cwd(), 'storage'));
  const r = await runImport({
    legacyUrl: args.legacyUrl ?? process.env.LEGACY_DATABASE_URL ?? '',
    targetUrl: process.env.DATABASE_URL ?? '',
    uploadsDirs: uploads,
    storageDir,
    dryRun: args.dryRun,
    remplacer: args.remplacer,
    rapport: args.rapport,
    fuseau: args.fuseau ?? null,
    copiesSimultanees: args.copies,
    liens: args.liens,
  });
  if (r.code === 0) console.log(r.message);
  else console.error(r.message);
  return r.code;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    console.error(`Erreur inattendue : ${(e as Error).message}`);
    process.exitCode = 1;
  });
