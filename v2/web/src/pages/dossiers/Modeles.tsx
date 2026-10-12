// Page « Modèles » : les configurations enregistrées (les miennes et celles partagées), à utiliser,
// renommer, partager, décrire ou supprimer. Les lignes d'un modèle se modifient en partant de lui
// dans « Nouveau dossier », puis « Enregistrer comme modèle » > « Remplacer ».
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookmarkCheck, Pencil, Plus, Trash2, Users, UserRound } from 'lucide-react';
import { MACHINE_LABELS, resumeLigne, type LigneRoland, type LigneXerox } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Checkbox, ConfirmDialog, Dialog, EmptyState, LoadingRows, MachineIcone, PageHeader, Segmented, TextareaField, TextField, useToast } from '../../ui';
import { useLibelles, useTarifs } from '../../features/specs/useTarifs';
import { useModeles, type Modele } from '../../features/modeles/ModelesDossier';
import '../../features/modeles/modeles.css';

export default function Modeles() {
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useModeles();
  const tarifs = useTarifs(true);
  const libelle = useLibelles(tarifs.data);
  const [edition, setEdition] = useState<Modele | null>(null);
  const [aSupprimer, setASupprimer] = useState<Modele | null>(null);

  const suppression = useMutation({
    mutationFn: (id: number) => api.del(`/modeles/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['modeles'] });
      toast.success('Modèle supprimé');
      setASupprimer(null);
    },
    onError: (e) => toast.error('Suppression impossible', messageErreur(e)),
  });

  const resume = (m: Modele) => {
    const lignes = (m.specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
    if (!lignes.length) return 'Forfaits seulement';
    const l0 = lignes[0]!;
    const first = resumeLigne(m.machine, l0, libelle(m.machine, l0.support));
    return lignes.length > 1 ? `${first} · +${lignes.length - 1} ligne${lignes.length > 2 ? 's' : ''}` : first;
  };

  return (
    <>
      <PageHeader
        title="Modèles"
        subtitle="Vos configurations habituelles : un clic pour démarrer un dossier déjà rempli. Pour changer les lignes d’un modèle, partez de lui dans « Nouveau dossier », puis « Enregistrer comme modèle » > « Remplacer »."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => navigate('/dossiers/nouveau')}>
            Nouveau dossier
          </Button>
        }
      />
      {q.isLoading ? (
        <LoadingRows rows={4} />
      ) : q.isError ? (
        <Alert tone="error">Les modèles n’ont pas pu être chargés : {messageErreur(q.error)}</Alert>
      ) : !q.data?.length ? (
        <EmptyState title="Aucun modèle pour l’instant" icon={<BookmarkCheck aria-hidden="true" />} action={<Button variant="primary" onClick={() => navigate('/dossiers/nouveau')}>Créer un dossier</Button>}>
          Remplissez un dossier que vous refaites souvent (en-têtes, cartes de visite, bâches…), puis cliquez sur « Enregistrer comme modèle » en bas de la page. Il apparaîtra ici et dans « Partir d’un modèle ».
        </EmptyState>
      ) : (
        <ul className="modeles__liste">
          {q.data.map((m) => (
            <li key={m.id} className="modele" data-machine={m.machine}>
              <div className="modele__corps" style={{ cursor: 'default' }}>
                <span className="modele__machine">
                  <MachineIcone machine={m.machine} taille={14} />
                  {MACHINE_LABELS[m.machine]}
                </span>
                <span className="modele__nom">{m.nom}</span>
                <span className="modele__resume">{resume(m)}</span>
                {m.description && <span className="modele__resume">{m.description}</span>}
                <span className="modele__meta">
                  {m.partage ? <Users aria-hidden="true" /> : <UserRound aria-hidden="true" />}
                  {m.partage ? (m.mien ? 'Partagé par vous' : `Partagé par ${m.cree_par_nom}`) : 'Rien que pour vous'}
                  {m.usages > 0 && ` · utilisé ${m.usages} fois`}
                  {m.mode_remise && ` · ${m.mode_remise === 'retrait' ? 'à retirer sur place' : 'à livrer'}`}
                </span>
                <div className="row" style={{ marginTop: 8, gap: 6 }}>
                  <Button size="sm" variant="primary" onClick={() => navigate(`/dossiers/nouveau?modele=${m.id}`)}>
                    Créer un dossier
                  </Button>
                  {(m.mien || user.role === 'admin') && (
                    <>
                      <Button size="sm" icon={<Pencil />} onClick={() => setEdition(m)}>
                        Modifier
                      </Button>
                      <Button size="sm" icon={<Trash2 />} onClick={() => setASupprimer(m)}>
                        Supprimer
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {edition && <ModifierModeleDialog modele={edition} onClose={() => setEdition(null)} />}
      <ConfirmDialog
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={() => aSupprimer && suppression.mutate(aSupprimer.id)}
        title="Supprimer ce modèle"
        description={aSupprimer ? `« ${aSupprimer.nom} » ne sera plus proposé. Les dossiers déjà créés ne changent pas.` : undefined}
        confirmLabel="Supprimer le modèle"
        danger
        busy={suppression.isPending}
      />
    </>
  );
}

function ModifierModeleDialog({ modele, onClose }: { modele: Modele; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [nom, setNom] = useState(modele.nom);
  const [partage, setPartage] = useState(modele.partage);
  const [description, setDescription] = useState(modele.description ?? '');
  const [consignes, setConsignes] = useState(modele.consignes ?? '');
  const [remise, setRemise] = useState<'' | 'livraison' | 'retrait'>(modele.mode_remise ?? '');
  const [erreur, setErreur] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => api.patch<Modele>(`/modeles/${modele.id}`, { nom: nom.trim(), partage, description: description || null, consignes: consignes || null, mode_remise: remise || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['modeles'] });
      toast.success('Modèle mis à jour');
      onClose();
    },
    onError: (e) => setErreur(messageErreur(e)),
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Modifier « ${modele.nom} »`}
      description="Les lignes et forfaits se changent depuis « Nouveau dossier » (partir de ce modèle, puis « Enregistrer comme modèle » > « Remplacer »)."
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" busy={m.isPending} disabled={!nom.trim()} onClick={() => m.mutate()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="stack">
        <TextField label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} autoFocus />
        <TextField label="Description du travail" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        <TextareaField label="Consignes pour l’atelier" value={consignes} onChange={(e) => setConsignes(e.target.value)} maxLength={2000} />
        <Segmented<'' | 'livraison' | 'retrait'>
          name="modele-remise"
          label="Mode de remise"
          value={remise}
          onChange={setRemise}
          options={[
            { value: '', label: 'Non précisé' },
            { value: 'livraison', label: 'À livrer' },
            { value: 'retrait', label: 'À retirer sur place' },
          ]}
        />
        <Checkbox label="Partager avec toute l’équipe" checked={partage} onChange={(v) => setPartage(v)} />
        {erreur && <Alert tone="error">{erreur}</Alert>}
      </div>
    </Dialog>
  );
}
