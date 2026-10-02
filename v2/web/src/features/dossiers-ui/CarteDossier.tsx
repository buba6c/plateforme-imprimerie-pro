// Carte de dossier pour la liste sur téléphone, et utilitaires de résumé.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatFCFA, resumeLigne, type LigneRoland, type LigneXerox, type Machine } from '@evocom/shared';
import type { DossierResume } from '../../lib/types';
import { MachineChip, PaymentBadge, Ref, StatusBadge, UrgentTag } from '../../ui';
import { DossierActions } from '../dossiers/DossierActions';
import './dossiers-ui.css';

type Libelle = (machine: Machine, code: string) => string;

/** « Bâche standard · 300 × 200 cm · 1 ex. · +1 ligne », avec les libellés de la grille. */
export function resumeSpecs(d: Pick<DossierResume, 'machine' | 'specs' | 'description'>, libelle: Libelle): string {
  const lignes = (d.specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  if (!lignes.length) return d.description ?? 'Spécifications à voir dans la fiche';
  const l0 = lignes[0]!;
  const first = resumeLigne(d.machine, l0, libelle(d.machine, l0.support));
  return lignes.length > 1 ? `${first} · +${lignes.length - 1} ligne${lignes.length > 2 ? 's' : ''}` : first;
}

const STATUTS_FINIS = ['livre', 'termine'];

/** Date promise dépassée pour un dossier pas encore livré. */
export function enRetard(d: Pick<DossierResume, 'date_promise' | 'statut'>): boolean {
  if (!d.date_promise || STATUTS_FINIS.includes(d.statut)) return false;
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return d.date_promise.slice(0, 10) < iso;
}

export function useMediaQuery(query: string): boolean {
  const [ok, setOk] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const f = () => setOk(m.matches);
    f();
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [query]);
  return ok;
}

export function CarteDossier({ d, libelle, montrerMontant }: { d: DossierResume; libelle: Libelle; montrerMontant: boolean }) {
  const navigate = useNavigate();
  const retard = enRetard(d);
  return (
    <article
      className="ev-job ev-card--interactive"
      data-urgent={d.urgent}
      tabIndex={0}
      role="link"
      aria-label={`Dossier ${d.numero}, ${d.client_nom}`}
      onClick={() => navigate(`/dossiers/${d.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') navigate(`/dossiers/${d.id}`);
      }}
    >
      <div className="ev-job__top">
        <Ref>{d.numero}</Ref>
        {d.urgent && <UrgentTag />}
        <MachineChip machine={d.machine} />
        <StatusBadge statut={d.statut} />
      </div>
      <div>
        <p className="ev-job__client">{d.client_nom}</p>
        <p className="ev-job__spec">{resumeSpecs(d, libelle)}</p>
      </div>
      <div className="ev-job__foot">
        <span className="ev-muted ev-ref dl-date" data-retard={retard}>
          {d.date_promise ? `${retard ? 'En retard · ' : ''}Pour le ${formatDate(d.date_promise)}` : `Créé le ${formatDate(d.created_at)}`}
        </span>
        {montrerMontant && d.montant !== undefined ? (
          <span className="dl-carte-montant">
            <span className="ev-num">{formatFCFA(d.montant)}</span>
            {d.situation_paiement && <PaymentBadge situation={d.situation_paiement} enAttente={d.en_attente_validation} />}
          </span>
        ) : (
          <DossierActions dossier={d} size="sm" principaleSeulement />
        )}
      </div>
    </article>
  );
}
