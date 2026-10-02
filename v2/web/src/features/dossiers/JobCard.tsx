import { useNavigate } from 'react-router-dom';
import { formatDate, formatDateHeure, formatFCFA, resumeLigne, type LigneRoland, type LigneXerox } from '@evocom/shared';
import type { DossierResume } from '../../lib/types';
import { MachineChip, Ref, StatusBadge, UrgentTag } from '../../ui';
import { DossierActions } from './DossierActions';

export function specResume(d: Pick<DossierResume, 'machine' | 'specs' | 'description' | 'resume_specs'>): string {
  if (d.resume_specs) return d.resume_specs;
  const lignes = (d.specs?.lignes ?? []) as (LigneRoland | LigneXerox)[];
  if (!lignes.length) return d.description ?? 'Spécifications à voir dans la fiche';
  const first = resumeLigne(d.machine, lignes[0]!);
  return lignes.length > 1 ? `${first} · +${lignes.length - 1} ligne${lignes.length > 2 ? 's' : ''}` : first;
}

/** Carte de dossier pour les files de travail (imprimeurs, livreur, téléphone). */
export function JobCard({ d, montrerStatut, contexte }: { d: DossierResume; montrerStatut?: boolean; contexte: 'atelier' | 'livraison' | 'liste' }) {
  const navigate = useNavigate();
  const echeance =
    contexte === 'livraison' && d.livraison_prevue_at
      ? `Prévue ${formatDateHeure(d.livraison_prevue_at)}`
      : d.date_promise
        ? `Pour le ${formatDate(d.date_promise)}`
        : `Reçu ${formatDate(d.date_validation ?? d.created_at)}`;
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
        {montrerStatut && <StatusBadge statut={d.statut} />}
      </div>
      <div>
        <p className="ev-job__client">{d.client_nom}</p>
        <p className="ev-job__spec">{specResume(d)}</p>
        {contexte === 'livraison' && (
          <p className="ev-job__spec" style={{ marginTop: 4 }}>
            {d.adresse_livraison || 'Adresse à confirmer avec le client'}
            {d.client_telephone ? ` · ${d.client_telephone}` : ''}
          </p>
        )}
      </div>
      <div className="ev-job__foot">
        <span className="ev-muted ev-ref">
          {echeance}
          {contexte === 'livraison' && d.solde ? ` · reste ${formatFCFA(d.solde)}` : ''}
        </span>
        <DossierActions dossier={d} size="sm" principaleSeulement />
      </div>
    </article>
  );
}
