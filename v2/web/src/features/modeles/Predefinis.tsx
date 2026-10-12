// Prédéfinis : les configurations qui reviennent le plus souvent dans les dossiers déjà créés
// (GET /dossiers/predefinis), à faire défiler et à appliquer d'un clic. Rien à enregistrer :
// plus un type de travail est fréquent, plus il remonte.
import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { formatDate, MACHINE_LABELS, type Machine, type Specs } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, IconButton, MachineIcone, Skeleton } from '../../ui';
import './modeles.css';

export interface Predefini {
  cle: string;
  machine: Machine;
  specs: Specs;
  resume: string;
  description: string | null;
  nb: number;
  dernier_at: string;
}

export function usePredefinis(machine?: Machine) {
  return useQuery({
    queryKey: ['dossiers', 'predefinis', machine ?? 'toutes'],
    queryFn: () => api.get<{ items: Predefini[] }>('/dossiers/predefinis', machine ? { machine } : {}),
    staleTime: 5 * 60_000,
  });
}

export function Predefinis({ machineImposee, onAppliquer }: { machineImposee?: Machine; onAppliquer: (p: Predefini) => void }) {
  const q = usePredefinis(machineImposee);
  const piste = useRef<HTMLDivElement>(null);
  const defiler = (sens: -1 | 1) => piste.current?.scrollBy({ left: sens * Math.max(240, piste.current.clientWidth * 0.8), behavior: 'smooth' });

  if (q.isLoading) return <Skeleton h={96} />;
  if (q.isError) return <Alert tone="warning">Les prédéfinis n’ont pas pu être chargés : {messageErreur(q.error)}</Alert>;
  const items = q.data?.items ?? [];
  if (!items.length) {
    return <p className="modeles__vide">Les prédéfinis apparaissent dès que plusieurs dossiers partagent la même configuration (support, format, papier, finitions…).</p>;
  }
  return (
    <div className="predef">
      <div className="predef__tete">
        <span className="predef__titre">
          <History aria-hidden="true" /> Prédéfinis d’après vos dossiers
        </span>
        <span className="predef__nav">
          <IconButton label="Prédéfinis précédents" onClick={() => defiler(-1)}>
            <ChevronLeft />
          </IconButton>
          <IconButton label="Prédéfinis suivants" onClick={() => defiler(1)}>
            <ChevronRight />
          </IconButton>
        </span>
      </div>
      <div className="predef__piste" ref={piste} role="list" aria-label="Prédéfinis">
        {items.map((p) => (
          <button key={p.cle} type="button" role="listitem" className="predef__carte" data-machine={p.machine} onClick={() => onAppliquer(p)} title="Appliquer cette configuration au formulaire">
            <span className="modele__machine">
              <MachineIcone machine={p.machine} taille={14} />
              {MACHINE_LABELS[p.machine]}
            </span>
            <span className="predef__resume">{p.resume}</span>
            {p.description && <span className="predef__desc">{p.description}</span>}
            <span className="predef__nb">
              <strong>{p.nb}</strong> dossier{p.nb > 1 ? 's' : ''} · dernier le {formatDate(p.dernier_at)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
