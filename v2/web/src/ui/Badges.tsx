import {
  MACHINE_LABELS,
  SITUATION_PAIEMENT_LABELS,
  STATUT_LABELS,
  STATUT_PAIEMENT_LABELS,
  type Machine,
  type SituationPaiement,
  type Statut,
  type StatutPaiement,
} from '@evocom/shared';

export function StatusBadge({ statut }: { statut: Statut }) {
  return (
    // La clé change avec le statut : le badge est recréé et rejoue son petit rebond.
    <span key={statut} className="ev-badge ev-status" data-statut={statut}>
      {STATUT_LABELS[statut]}
    </span>
  );
}

export function MachineChip({ machine }: { machine: Machine }) {
  return (
    <span className="ev-machine" data-machine={machine}>
      {MACHINE_LABELS[machine]}
    </span>
  );
}

export function UrgentTag() {
  return <span className="ev-urgent">Urgent</span>;
}

const PAY_KEY: Record<SituationPaiement, string> = { sans_montant: 'non_paye', offert: 'offert', non_paye: 'non_paye', partiel: 'partiel', paye: 'paye' };

export function PaymentBadge({ situation, enAttente }: { situation: SituationPaiement; enAttente?: number }) {
  if (enAttente && enAttente > 0 && situation !== 'paye') {
    return (
      <span className="ev-badge ev-pay" data-pay="a_valider">
        À valider
      </span>
    );
  }
  return (
    <span className="ev-badge ev-pay" data-pay={PAY_KEY[situation]}>
      {SITUATION_PAIEMENT_LABELS[situation]}
    </span>
  );
}

const PAIEMENT_KEY: Record<StatutPaiement, string> = { a_valider: 'a_valider', valide: 'paye', refuse: 'refuse' };

export function PaiementStatutBadge({ statut }: { statut: StatutPaiement }) {
  return (
    <span className="ev-badge ev-pay" data-pay={PAIEMENT_KEY[statut]}>
      {STATUT_PAIEMENT_LABELS[statut]}
    </span>
  );
}

export function Count({ n }: { n: number | undefined }) {
  return <span className="ev-count">{n ?? 0}</span>;
}

export function Ref({ children }: { children: React.ReactNode }) {
  return <span className="ev-ref ev-numero">{children}</span>;
}
