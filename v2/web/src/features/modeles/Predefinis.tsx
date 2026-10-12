// Prédéfinis : les configurations qui reviennent le plus souvent dans les dossiers déjà créés
// (GET /dossiers/predefinis), à faire défiler et à appliquer d'un clic. Rien à enregistrer :
// plus un type de travail est fréquent, plus il remonte.
import { useEffect, useRef, useState } from 'react';
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
  // Deux onglets bien séparés : les prédéfinis Roland et les prédéfinis Xerox.
  const [onglet, setOnglet] = useState<Machine>(machineImposee ?? 'xerox');
  useEffect(() => {
    if (machineImposee) setOnglet(machineImposee);
  }, [machineImposee]);
  // Une requête par machine : chaque onglet a ses propres prédéfinis (12 au plus chacun).
  const qRoland = usePredefinis('roland');
  const qXerox = usePredefinis('xerox');
  const q = onglet === 'roland' ? qRoland : qXerox;
  const piste = useRef<HTMLDivElement>(null);
  const defiler = (sens: -1 | 1) => piste.current?.scrollBy({ left: sens * Math.max(200, piste.current.clientWidth * 0.8), behavior: 'smooth' });

  if (q.isLoading) return <Skeleton h={80} />;
  if (q.isError) return <Alert tone="warning">Les prédéfinis n’ont pas pu être chargés : {messageErreur(q.error)}</Alert>;
  const compte = (m: Machine) => ((m === 'roland' ? qRoland : qXerox).data?.items ?? []).length;
  const items = q.data?.items ?? [];
  return (
    <div className="predef">
      <div className="predef__tete">
        <span className="predef__titre">
          <History aria-hidden="true" /> Prédéfinis d’après vos dossiers
        </span>
        <div className="predef__onglets" role="tablist" aria-label="Machine">
          {(['roland', 'xerox'] as Machine[])
            .filter((m) => !machineImposee || m === machineImposee)
            .map((m) => (
              <button key={m} type="button" role="tab" aria-selected={onglet === m} data-machine={m} className="predef__onglet" onClick={() => setOnglet(m)}>
                <MachineIcone machine={m} taille={13} />
                {MACHINE_LABELS[m]}
                <span className="predef__compte">{compte(m)}</span>
              </button>
            ))}
        </div>
        {items.length > 2 && (
          <span className="predef__nav">
            <IconButton label="Prédéfinis précédents" onClick={() => defiler(-1)}>
              <ChevronLeft />
            </IconButton>
            <IconButton label="Prédéfinis suivants" onClick={() => defiler(1)}>
              <ChevronRight />
            </IconButton>
          </span>
        )}
      </div>
      {!items.length ? (
        <p className="modeles__vide">Aucun prédéfini {MACHINE_LABELS[onglet]} pour l’instant : ils apparaissent dès que plusieurs dossiers {MACHINE_LABELS[onglet]} partagent la même configuration.</p>
      ) : (
        <div className="predef__piste" ref={piste} role="list" aria-label={`Prédéfinis ${MACHINE_LABELS[onglet]}`}>
          {items.map((p) => (
            <button key={p.cle} type="button" role="listitem" className="predef__carte" data-machine={p.machine} onClick={() => onAppliquer(p)} title={`${p.resume}${p.description ? ` · ${p.description}` : ''}`}>
              <span className="predef__resume">{p.resume}</span>
              {p.description && <span className="predef__desc">{p.description}</span>}
              <span className="predef__nb">
                <strong>{p.nb}</strong> dossier{p.nb > 1 ? 's' : ''} · {formatDate(p.dernier_at)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
