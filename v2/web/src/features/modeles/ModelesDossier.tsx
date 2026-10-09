// Modèles de dossier : la bande « Partir d'un modèle » en tête du formulaire, et la fenêtre
// « Enregistrer comme modèle » qui garde la configuration en cours (machine, lignes, forfaits,
// description, consignes, mode de remise) pour soi ou pour toute l'équipe.
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, Search, Trash2, Users, UserRound } from 'lucide-react';
import { MACHINE_LABELS, resumeLigne, type LigneRoland, type LigneXerox, type Machine, type Specs } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Checkbox, ConfirmDialog, Dialog, MachineIcone, Skeleton, TextField, useToast } from '../../ui';
import { useLibelles, useTarifs } from '../specs/useTarifs';
import './modeles.css';

export interface Modele {
  id: number;
  nom: string;
  machine: Machine;
  specs: Specs;
  description: string | null;
  consignes: string | null;
  mode_remise: 'livraison' | 'retrait' | null;
  partage: boolean;
  cree_par_nom: string;
  mien: boolean;
  usages: number;
}

export interface ContenuModele {
  machine: Machine;
  specs: Specs | null;
  description: string;
  consignes: string;
  mode_remise: 'livraison' | 'retrait' | '';
}

export function useModeles() {
  return useQuery({ queryKey: ['modeles'], queryFn: () => api.get<Modele[]>('/modeles'), staleTime: 60_000 });
}

function resume(m: Modele, libelle: (machine: Machine, code: string) => string): string {
  const lignes = (m.specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  if (!lignes.length) return m.description ?? 'Forfaits seulement';
  const l0 = lignes[0]!;
  const first = resumeLigne(m.machine, l0, libelle(m.machine, l0.support));
  return lignes.length > 1 ? `${first} · +${lignes.length - 1} ligne${lignes.length > 2 ? 's' : ''}` : first;
}

/** Bande des modèles disponibles, à appliquer d'un clic. */
export function ModelesDossier({ machineImposee, onAppliquer }: { machineImposee?: Machine; onAppliquer: (m: Modele) => void }) {
  const q = useModeles();
  const qc = useQueryClient();
  const toast = useToast();
  const tarifs = useTarifs(true);
  const libelle = useLibelles(tarifs.data);
  const [recherche, setRecherche] = useState('');
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

  const liste = useMemo(() => {
    const r = recherche.trim().toLowerCase();
    return (q.data ?? []).filter((m) => (!machineImposee || m.machine === machineImposee) && (!r || m.nom.toLowerCase().includes(r) || (m.description ?? '').toLowerCase().includes(r)));
  }, [q.data, machineImposee, recherche]);

  if (q.isLoading) return <Skeleton h={72} />;
  if (q.isError) return <Alert tone="warning">Les modèles n’ont pas pu être chargés : {messageErreur(q.error)}</Alert>;
  if (!q.data?.length) {
    return (
      <p className="modeles__vide">
        Aucun modèle pour l’instant. Remplissez un dossier que vous refaites souvent (en-têtes, cartes de visite…), puis cliquez sur « Enregistrer comme modèle » en bas de page.
      </p>
    );
  }
  return (
    <div className="modeles">
      {q.data.length > 6 && (
        <div className="ev-search modeles__recherche">
          <Search aria-hidden="true" />
          <input className="ev-input" type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Chercher un modèle" aria-label="Chercher un modèle" />
        </div>
      )}
      {liste.length === 0 ? (
        <p className="modeles__vide">Aucun modèle {machineImposee ? `pour la ${MACHINE_LABELS[machineImposee]}` : 'ne correspond'}.</p>
      ) : (
        <ul className="modeles__liste">
          {liste.map((m) => (
            <li key={m.id} className="modele" data-machine={m.machine}>
              <button
                type="button"
                className="modele__corps"
                onClick={() => {
                  onAppliquer(m);
                  void api.post(`/modeles/${m.id}/utiliser`, {}).catch(() => {});
                  toast.success(`Modèle « ${m.nom} » appliqué`, 'Vérifiez les quantités et le client, puis créez le dossier.');
                }}
              >
                <span className="modele__machine">
                  <MachineIcone machine={m.machine} taille={14} />
                  {MACHINE_LABELS[m.machine]}
                </span>
                <span className="modele__nom">{m.nom}</span>
                <span className="modele__resume">{resume(m, libelle)}</span>
                <span className="modele__meta">
                  {m.partage ? <Users aria-hidden="true" /> : <UserRound aria-hidden="true" />}
                  {m.partage ? (m.mien ? 'Partagé par vous' : `Partagé par ${m.cree_par_nom}`) : 'Rien que pour vous'}
                  {m.usages > 0 && ` · utilisé ${m.usages} fois`}
                </span>
              </button>
              {m.mien && (
                <button type="button" className="ev-icon-btn ev-icon-btn--sm modele__supprimer" aria-label={`Supprimer le modèle ${m.nom}`} onClick={() => setASupprimer(m)}>
                  <Trash2 />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
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
    </div>
  );
}

/** Bouton + fenêtre « Enregistrer comme modèle » pour la configuration en cours. */
export function EnregistrerModele({ contenu, disabled }: { contenu: () => ContenuModele; disabled?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState('');
  const [partage, setPartage] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: () => {
      const c = contenu();
      if (!c.specs) throw new Error('Complétez d’abord les spécifications (support, dimensions ou pages, quantité).');
      return api.post<Modele>('/modeles', { nom: nom.trim(), machine: c.machine, specs: c.specs, description: c.description || null, consignes: c.consignes || null, mode_remise: c.mode_remise || null, partage });
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['modeles'] });
      toast.success(`Modèle « ${r.nom} » enregistré`, partage ? 'Toute l’équipe le verra dans « Partir d’un modèle ».' : 'Vous seul le verrez.');
      setOuvert(false);
      setNom('');
      setErreur(null);
    },
    onError: (e) => setErreur(messageErreur(e)),
  });

  return (
    <>
      <Button icon={<BookmarkPlus />} disabled={disabled} onClick={() => setOuvert(true)} title="Garder cette configuration pour la réutiliser">
        Enregistrer comme modèle
      </Button>
      {ouvert && (
        <Dialog
          open
          onClose={() => setOuvert(false)}
          title="Enregistrer comme modèle"
          description="La machine, les lignes, les forfaits, la description, les consignes et le mode de remise sont gardés. Le client, les fichiers et le prix ne le sont pas."
          width={520}
          footer={
            <>
              <Button onClick={() => setOuvert(false)}>Annuler</Button>
              <Button variant="primary" busy={m.isPending} disabled={!nom.trim()} onClick={() => m.mutate()}>
                Enregistrer
              </Button>
            </>
          }
        >
          <div className="stack">
            <TextField label="Nom du modèle" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. En-têtes A4 250 g recto" maxLength={80} autoFocus />
            <Checkbox label="Partager avec toute l’équipe" checked={partage} onChange={(v) => setPartage(v)} />
            {erreur && <Alert tone="error">{erreur}</Alert>}
          </div>
        </Dialog>
      )}
    </>
  );
}
