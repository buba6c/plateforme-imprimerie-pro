import { useState } from 'react';
import { Card, TextareaField, TextField } from '../../../ui';
import { entier, SectionForm, useBrouillon, useSignalerModifie, type SectionProps } from '../form';

const MAX = 1000;

export function SectionDocuments({ p, onModifie }: SectionProps) {
  const { f, setF, modifie, annuler } = useBrouillon(
    () => ({ ...p.documents, devis_validite_jours: String(p.documents.devis_validite_jours) }),
    [p.documents],
  );
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  useSignalerModifie(modifie, onModifie);

  const verifier = () => {
    const e: Record<string, string> = {};
    const jours = entier(f.devis_validite_jours, 1, 365, 'jours');
    if (typeof jours === 'string') e['documents.devis_validite_jours'] = jours;
    if (f.mentions_devis.trim().length > MAX) e['documents.mentions_devis'] = `${MAX} caractères au maximum.`;
    if (f.conditions_paiement.trim().length > MAX) e['documents.conditions_paiement'] = `${MAX} caractères au maximum.`;
    if (Object.keys(e).length) return { erreurs: e };
    return {
      body: { documents: { devis_validite_jours: jours as number, mentions_devis: f.mentions_devis.trim(), conditions_paiement: f.conditions_paiement.trim() } },
    };
  };

  return (
    <SectionForm titre="Documents" modifie={modifie} verifier={verifier} annuler={annuler} onErreurs={setErreurs}>
      <Card title="Devis">
        <div className="stack">
          <TextField
            label="Durée de validité d’un nouveau devis"
            inputMode="numeric"
            mono
            addon="jours"
            value={f.devis_validite_jours}
            onChange={(e) => setF({ ...f, devis_validite_jours: e.target.value })}
            error={erreurs['documents.devis_validite_jours']}
            help="Proposée quand la personne qui crée le devis ne la précise pas (1 à 365). Les devis existants gardent leur date de validité."
          />
          <TextareaField
            label="Mentions en bas des devis"
            rows={3}
            value={f.mentions_devis}
            onChange={(e) => setF({ ...f, mentions_devis: e.target.value })}
            error={erreurs['documents.mentions_devis']}
            maxLength={MAX}
            placeholder="Exemple : acompte de 50 % à la commande, délai de fabrication de 3 jours ouvrés."
            help={`Imprimées sous les conditions de chaque devis PDF, y compris les devis déjà créés. Vide = aucune mention. (${f.mentions_devis.length}/${MAX})`}
          />
        </div>
      </Card>
      <Card title="Factures">
        <TextareaField
          label="Conditions de paiement"
          rows={3}
          value={f.conditions_paiement}
          onChange={(e) => setF({ ...f, conditions_paiement: e.target.value })}
          error={erreurs['documents.conditions_paiement']}
          maxLength={MAX}
          placeholder="Exemple : paiement à réception par Wave, Orange Money ou virement ; pénalités de retard…"
          help={`Imprimées en bas de chaque facture PDF, y compris les factures déjà émises. Vide = aucune condition. (${f.conditions_paiement.length}/${MAX})`}
        />
      </Card>
    </SectionForm>
  );
}
