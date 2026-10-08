// Assistant « Réimprimer / nouvelle commande » : pose les bonnes questions (pourquoi, prix, modifications,
// fichiers) avant de créer la copie liée au dossier d'origine.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Printer } from 'lucide-react';
import { formatFCFA, MACHINE_LABELS, parseMontant } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import type { DossierDetail } from '../../lib/types';
import { Alert, Button, Checkbox, Dialog, Segmented, TextareaField, TextField, useToast } from '../../ui';

type Type = 'reimpression' | 'nouvelle_commande';
type Prix = 'meme' | 'grille' | 'gratuit' | 'manuel';

export function ReimpressionDialog({ d, admin, onClose }: { d: DossierDetail; admin: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [type, setType] = useState<Type>(admin ? 'reimpression' : 'nouvelle_commande');
  const [prix, setPrix] = useState<Prix>(admin ? 'gratuit' : 'grille');
  const [montant, setMontant] = useState('');
  const [modifs, setModifs] = useState<'non' | 'oui'>('non');
  const [fichiers, setFichiers] = useState(d.fichiers.length > 0);
  const [motif, setMotif] = useState('');
  const [urgent, setUrgent] = useState(type === 'reimpression');

  const direct = modifs === 'non' && fichiers && d.fichiers.length > 0;
  const m = useMutation({
    mutationFn: () =>
      api.post<{ id: number; numero: string; statut: string }>(`/dossiers/${d.id}/dupliquer`, {
        type,
        prix,
        montant: prix === 'manuel' ? parseMontant(montant) : null,
        modifications: modifs === 'oui',
        reprendre_fichiers: fichiers,
        motif: motif.trim() || null,
        urgent,
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['dossiers'] });
      void qc.invalidateQueries({ queryKey: ['dossier', d.id] });
      toast.success(
        r.statut === 'pret_impression' ? `${r.numero} envoyé à l’imprimeur ${MACHINE_LABELS[d.machine]}` : `${r.numero} créé : à préparer`,
        type === 'reimpression' ? `Réimpression de ${d.numero}` : `Nouvelle commande à partir de ${d.numero}`,
      );
      onClose();
      navigate(modifs === 'oui' ? `/dossiers/${r.id}/modifier` : `/dossiers/${r.id}`);
    },
  });

  const montantValide = prix !== 'manuel' || parseMontant(montant) !== null;
  const motifValide = type !== 'reimpression' || motif.trim().length >= 3;

  return (
    <Dialog
      open
      onClose={onClose}
      title={type === 'reimpression' ? `Réimprimer ${d.numero}` : `Nouvelle commande à partir de ${d.numero}`}
      description="Une nouvelle commande est créée et reliée à celle-ci : chacune garde son historique et son paiement."
      width={620}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" icon={direct ? <Printer /> : <Copy />} busy={m.isPending} disabled={!montantValide || !motifValide} onClick={() => m.mutate()}>
            {direct ? `Envoyer à l’imprimeur ${MACHINE_LABELS[d.machine]}` : 'Créer et préparer'}
          </Button>
        </>
      }
    >
      <div className="reimp">
        {admin && (
          <section className="reimp__q">
            <h3>1. Pourquoi ?</h3>
            <Segmented<Type>
              name="reimp-type"
              label="Pourquoi"
              value={type}
              onChange={(v) => {
                setType(v);
                setPrix(v === 'reimpression' ? 'gratuit' : 'grille');
                setUrgent(v === 'reimpression');
              }}
              options={[
                { value: 'reimpression', label: 'Refaire le travail', help: 'défaut, erreur, quantité manquante' },
                { value: 'nouvelle_commande', label: 'Le client recommande', help: 'même travail, nouvelle vente' },
              ]}
            />
            {type === 'reimpression' && (
              <TextareaField label="Ce qui ne va pas" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. couleurs trop sombres, 20 cartes abîmées…" required />
            )}
          </section>
        )}

        <section className="reimp__q">
          <h3>{admin ? '2' : '1'}. Le prix a-t-il changé ?</h3>
          <Segmented<Prix>
            name="reimp-prix"
            label="Prix"
            value={prix}
            onChange={setPrix}
            options={[
              ...(type === 'reimpression' ? [{ value: 'gratuit' as const, label: 'Gratuit', help: 'à nos frais' }] : []),
              { value: 'meme', label: 'Même prix', help: d.montant === null || d.montant === undefined ? 'non renseigné' : formatFCFA(d.montant) },
              { value: 'grille', label: 'Tarifs du jour', help: 'recalculé' },
              { value: 'manuel', label: 'Autre montant' },
            ]}
          />
          {prix === 'manuel' && <TextField label="Nouveau montant (FCFA)" inputMode="numeric" mono value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="Ex. 25 000" />}
        </section>

        <section className="reimp__q">
          <h3>{admin ? '3' : '2'}. Faut-il modifier quelque chose avant d’imprimer ?</h3>
          <Segmented<'non' | 'oui'>
            name="reimp-modifs"
            label="Modifications"
            value={modifs}
            onChange={setModifs}
            options={[
              { value: 'non', label: 'Non, identique', help: 'part directement à l’impression' },
              { value: 'oui', label: 'Oui', help: 'quantité, papier, texte…' },
            ]}
          />
        </section>

        <section className="reimp__q">
          <h3>{admin ? '4' : '3'}. Les fichiers</h3>
          <Checkbox
            label={d.fichiers.length ? `Reprendre les ${d.fichiers.length} fichier${d.fichiers.length > 1 ? 's' : ''} de ${d.numero}` : 'Aucun fichier à reprendre'}
            checked={fichiers}
            disabled={!d.fichiers.length}
            onChange={(v) => setFichiers(v)}
          />
          <Checkbox label="Marquer urgent (en tête de la file d’impression)" checked={urgent} onChange={(v) => setUrgent(v)} />
        </section>

        <Alert tone={direct ? 'success' : 'info'}>
          {direct
            ? `La nouvelle commande arrivera tout de suite dans la file de l’imprimeur ${MACHINE_LABELS[d.machine]}, qui sera prévenu.`
            : modifs === 'oui'
              ? 'La nouvelle commande s’ouvrira en modification ; validez-la ensuite pour l’envoyer à l’impression.'
              : 'La nouvelle commande sera « à préparer » : ajoutez les fichiers puis validez-la.'}
        </Alert>
        {m.isError && <Alert tone="error">{messageErreur(m.error)}</Alert>}
      </div>
    </Dialog>
  );
}
