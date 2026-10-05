import { useState } from 'react';
import { Card, SelectField, TextareaField, TextField } from '../../../ui';
import { entier, SectionForm, useBrouillon, useSignalerModifie, type SectionProps } from '../form';

const FUSEAUX: { value: string; label: string }[] = [
  { value: 'Africa/Dakar', label: 'Dakar — Sénégal (UTC+0)' },
  { value: 'Africa/Abidjan', label: 'Abidjan — Côte d’Ivoire (UTC+0)' },
  { value: 'Africa/Bamako', label: 'Bamako — Mali (UTC+0)' },
  { value: 'Africa/Conakry', label: 'Conakry — Guinée (UTC+0)' },
  { value: 'Africa/Nouakchott', label: 'Nouakchott — Mauritanie (UTC+0)' },
  { value: 'Africa/Ouagadougou', label: 'Ouagadougou — Burkina Faso (UTC+0)' },
  { value: 'Africa/Lome', label: 'Lomé — Togo (UTC+0)' },
  { value: 'Africa/Casablanca', label: 'Casablanca — Maroc (UTC+1)' },
  { value: 'Africa/Porto-Novo', label: 'Porto-Novo — Bénin (UTC+1)' },
  { value: 'Africa/Niamey', label: 'Niamey — Niger (UTC+1)' },
  { value: 'Africa/Douala', label: 'Douala — Cameroun (UTC+1)' },
  { value: 'Africa/Libreville', label: 'Libreville — Gabon (UTC+1)' },
  { value: 'Africa/Lagos', label: 'Lagos — Nigeria (UTC+1)' },
];

const CHAMPS = ['nom', 'adresse', 'telephone', 'email', 'ninea', 'rccm', 'pied_facture'] as const;

function heureDans(fuseau: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { timeZone: fuseau, hour: '2-digit', minute: '2-digit', weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(),
    );
  } catch {
    return '—';
  }
}

export function SectionEntreprise({ p, onModifie }: SectionProps) {
  const { f, setF, modifie, annuler } = useBrouillon(
    () => ({ ...p.entreprise, fuseau: p.fuseau, livreur_jours_historique: String(p.livreur_jours_historique) }),
    [p.entreprise, p.fuseau, p.livreur_jours_historique],
  );
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  useSignalerModifie(modifie, onModifie);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const fuseaux = FUSEAUX.some((z) => z.value === f.fuseau) ? FUSEAUX : [{ value: f.fuseau, label: f.fuseau }, ...FUSEAUX];

  const verifier = () => {
    const e: Record<string, string> = {};
    if (!f.nom.trim()) e['entreprise.nom'] = "Le nom de l'entreprise ne peut pas être vide.";
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e['entreprise.email'] = 'Adresse e-mail invalide.';
    for (const k of CHAMPS) if (f[k].trim().length > 200) e[`entreprise.${k}`] = '200 caractères au maximum.';
    const jours = entier(f.livreur_jours_historique, 1, 90, 'jours');
    if (typeof jours === 'string') e.livreur_jours_historique = jours;
    if (Object.keys(e).length) return { erreurs: e };
    return {
      body: {
        entreprise: Object.fromEntries(CHAMPS.map((k) => [k, f[k].trim()])) as unknown as typeof p.entreprise,
        fuseau: f.fuseau,
        livreur_jours_historique: jours as number,
      },
    };
  };

  return (
    <SectionForm titre="Entreprise" modifie={modifie} verifier={verifier} annuler={annuler} onErreurs={setErreurs}>
      <Card title="Coordonnées">
        <div className="stack">
          <p className="adm-explain">Ces informations figurent en en-tête et en pied des devis et des factures PDF.</p>
          <div className="ev-form-grid">
            <TextField label="Nom de l’entreprise" required value={f.nom} onChange={(e) => set('nom', e.target.value)} error={erreurs['entreprise.nom']} maxLength={200} />
            <TextField label="Téléphone" type="tel" value={f.telephone} onChange={(e) => set('telephone', e.target.value)} error={erreurs['entreprise.telephone']} maxLength={200} />
            <TextField label="E-mail" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} error={erreurs['entreprise.email']} maxLength={200} />
          </div>
          <TextField label="Adresse" value={f.adresse} onChange={(e) => set('adresse', e.target.value)} error={erreurs['entreprise.adresse']} maxLength={200} />
          <div className="ev-form-grid">
            <TextField
              label="NINEA"
              mono
              value={f.ninea}
              onChange={(e) => set('ninea', e.target.value)}
              error={erreurs['entreprise.ninea']}
              maxLength={200}
              help="Numéro d’identification fiscale."
            />
            <TextField
              label="RCCM"
              mono
              value={f.rccm}
              onChange={(e) => set('rccm', e.target.value)}
              error={erreurs['entreprise.rccm']}
              maxLength={200}
              help="Registre du commerce."
            />
          </div>
          <TextareaField
            label="Pied de page des documents"
            rows={2}
            value={f.pied_facture}
            onChange={(e) => set('pied_facture', e.target.value)}
            error={erreurs['entreprise.pied_facture']}
            maxLength={200}
            help={`Une ligne en bas de chaque page des devis et des factures : coordonnées bancaires, slogan… (${f.pied_facture.length}/200)`}
          />
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Fuseau horaire">
          <SelectField
            label="Fuseau de l’entreprise"
            value={f.fuseau}
            onChange={(e) => set('fuseau', e.target.value)}
            options={fuseaux}
            error={erreurs.fuseau}
            help={`Sert à dater les documents et à découper les journées des statistiques. En ce moment : ${heureDans(f.fuseau)}.`}
          />
        </Card>
        <Card title="Livraison">
          <TextField
            label="Historique visible par le livreur"
            inputMode="numeric"
            mono
            addon="jours"
            value={f.livreur_jours_historique}
            onChange={(e) => set('livreur_jours_historique', e.target.value)}
            error={erreurs.livreur_jours_historique}
            help="Nombre de jours pendant lesquels un dossier livré et payé reste dans la liste du livreur (1 à 90)."
          />
        </Card>
      </div>
    </SectionForm>
  );
}
