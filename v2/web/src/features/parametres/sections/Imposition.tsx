import { useState } from 'react';
import { Card, Checkbox, TextField } from '../../../ui';
import { nombre, SectionForm, useBrouillon, useSignalerModifie, type SectionProps } from '../form';

/** Nombre décimal entre min et max (virgule acceptée), ou message d'erreur. */
function decimal(v: string, min: number, max: number): number | string {
  const n = nombre(v);
  if (n === null || n < min || n > max) return `Nombre entre ${min} et ${max} (virgule acceptée).`;
  return Math.round(n * 10) / 10;
}

export function SectionImposition({ p, onModifie }: SectionProps) {
  const { f, setF, modifie, annuler } = useBrouillon(
    () => ({ marge_technique_mm: String(p.imposition.marge_technique_mm).replace('.', ','), fonds_perdus_min_mm: String(p.imposition.fonds_perdus_min_mm).replace('.', ','), reperes_obligatoires: p.imposition.reperes_obligatoires !== false }),
    [p.imposition],
  );
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  useSignalerModifie(modifie, onModifie);

  const verifier = () => {
    const e: Record<string, string> = {};
    const marge = decimal(f.marge_technique_mm, 0, 20);
    const fonds = decimal(f.fonds_perdus_min_mm, 0.5, 5);
    if (typeof marge === 'string') e['imposition.marge_technique_mm'] = marge;
    if (typeof fonds === 'string') e['imposition.fonds_perdus_min_mm'] = fonds;
    if (Object.keys(e).length) return { erreurs: e };
    return { body: { imposition: { marge_technique_mm: marge as number, fonds_perdus_min_mm: fonds as number, reperes_obligatoires: f.reperes_obligatoires } } };
  };

  return (
    <SectionForm titre="Imposition" modifie={modifie} verifier={verifier} annuler={annuler} onErreurs={setErreurs}>
      <Card title="Machine et calepinage">
        <div className="stack">
          <p className="adm-explain">
            Ces valeurs guident le calepinage automatique de l’imposition : il place le plus de poses possible sur la feuille sans rien mettre dans le bord
            que la machine n’imprime pas, et ne descend jamais les fonds perdus sous le plancher choisi.
          </p>
          <div className="ev-form-grid">
            <TextField
              label="Bord non imprimable de la machine"
              inputMode="decimal"
              mono
              addon="mm"
              value={f.marge_technique_mm}
              onChange={(e) => setF({ ...f, marge_technique_mm: e.target.value })}
              error={erreurs['imposition.marge_technique_mm']}
              help="Xerox SRA3 : 4 à 5 mm en général. Aucune pose ni repère de coupe n’y est placé ; une marge de feuille plus petite est relevée à cette valeur."
            />
            <TextField
              label="Fonds perdus minimaux en automatique"
              inputMode="decimal"
              mono
              addon="mm"
              value={f.fonds_perdus_min_mm}
              onChange={(e) => setF({ ...f, fonds_perdus_min_mm: e.target.value })}
              error={erreurs['imposition.fonds_perdus_min_mm']}
              help="Pour loger une colonne ou un rang de plus, le calepinage automatique peut réduire les fonds perdus demandés, jamais en dessous de cette valeur. 1,5 mm est sûr au massicot."
            />
          </div>
          <Checkbox
            label="Garder des repères de coupe lisibles plutôt que gagner des poses"
            checked={f.reperes_obligatoires}
            onChange={(reperes_obligatoires) => setF({ ...f, reperes_obligatoires })}
          />
          <p className="adm-explain">
            Coché, le calepinage automatique ne retient jamais une grille dont les traits de coupe tomberaient dans le bord non imprimable (par exemple 25 cartes
            sans repères plutôt que 21 avec) ; l’alternative reste proposée dans le rapport. Décoché, le plus de poses l’emporte et la coupe se fait aux cotes.
          </p>
        </div>
      </Card>
    </SectionForm>
  );
}
