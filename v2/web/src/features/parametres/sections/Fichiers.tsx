import { useState } from 'react';
import { formatEntier } from '@evocom/shared';
import { Card, TextField } from '../../../ui';
import { useRegles } from '../api';
import { entier, SectionForm, useBrouillon, useSignalerModifie, type SectionProps } from '../form';

/** « pdf, .AI ; tiff » -> ['ai', 'pdf', 'tiff'] (mêmes règles que le serveur). */
function lireExtensions(v: string): { liste: string[]; invalides: string[] } {
  const brutes = v
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase().replace(/^\.+/, ''))
    .filter(Boolean);
  const invalides = brutes.filter((x) => !/^[a-z0-9]{1,10}$/.test(x));
  return { liste: [...new Set(brutes)].sort(), invalides };
}

export function SectionFichiers({ p, onModifie }: SectionProps) {
  const regles = useRegles();
  const plafond = regles.data?.fichiers.plafond_serveur_mo;
  const { f, setF, modifie, annuler } = useBrouillon(
    () => ({ taille_max_mo: String(p.fichiers.taille_max_mo), extensions: p.fichiers.extensions.join(', ') }),
    [p.fichiers],
  );
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  useSignalerModifie(modifie, onModifie);
  const ext = lireExtensions(f.extensions);

  const verifier = () => {
    const e: Record<string, string> = {};
    const taille = entier(f.taille_max_mo, 1, plafond ?? Number.MAX_SAFE_INTEGER, 'Mo');
    if (typeof taille === 'string') e['fichiers.taille_max_mo'] = taille;
    if (ext.invalides.length) e['fichiers.extensions'] = `Extension invalide : ${ext.invalides.join(', ')}. Lettres et chiffres uniquement, 10 au plus.`;
    else if (ext.liste.length > 60) e['fichiers.extensions'] = '60 extensions au maximum.';
    if (Object.keys(e).length) return { erreurs: e };
    return { body: { fichiers: { taille_max_mo: taille as number, extensions: ext.liste } } };
  };

  const erreurExtensions = erreurs['fichiers.extensions'] ?? Object.entries(erreurs).find(([k]) => k.startsWith('fichiers.extensions.'))?.[1];

  return (
    <SectionForm titre="Fichiers" modifie={modifie} verifier={verifier} annuler={annuler} onErreurs={setErreurs}>
      <Card title="Envoi des fichiers d’impression">
        <div className="stack">
          <p className="adm-explain">Ces limites sont vérifiées par le serveur au début de chaque envoi ; un fichier refusé n’est pas transféré.</p>
          <div className="ev-form-grid">
            <TextField
              label="Taille maximale par fichier"
              inputMode="numeric"
              mono
              addon="Mo"
              value={f.taille_max_mo}
              onChange={(e) => setF({ ...f, taille_max_mo: e.target.value })}
              error={erreurs['fichiers.taille_max_mo']}
              help={
                plafond
                  ? `Le serveur accepte au plus ${formatEntier(plafond)} Mo par fichier (variable MAX_UPLOAD_MB). 1 Go = 1 024 Mo.`
                  : '1 Go = 1 024 Mo.'
              }
            />
            <TextField
              label="Extensions acceptées"
              mono
              placeholder="Toutes"
              value={f.extensions}
              onChange={(e) => setF({ ...f, extensions: e.target.value })}
              error={erreurExtensions}
              help="Séparées par des virgules, par exemple : pdf, ai, eps, tiff, jpg. Laissez vide pour accepter tous les types."
            />
          </div>
          <div className="adm-example" aria-live="polite">
            <strong>Règle appliquée</strong>
            <br />
            {ext.liste.length ? `Seuls les fichiers ${ext.liste.map((x) => `.${x}`).join(', ')} sont acceptés` : 'Tous les types de fichiers sont acceptés'}
            {nombreOuRien(f.taille_max_mo) ? `, jusqu’à ${formatEntier(nombreOuRien(f.taille_max_mo)!)} Mo chacun.` : '.'}
          </div>
        </div>
      </Card>
    </SectionForm>
  );
}

function nombreOuRien(v: string): number | null {
  const n = Number(v.replace(/\s/g, ''));
  return Number.isInteger(n) && n > 0 ? n : null;
}
