// Cartes-résumé en haut de l'écran et « Caisse du jour » par encaisseur (GET /caisse).
import { Ban, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { formatEntier, formatFCFA, ROLE_LABELS, type ModePaiement } from '@evocom/shared';
import { Alert, Card, LoadingRows, Skeleton } from '../../ui';
import { ModePastille } from './ModePastille';
import type { Bloc, CaisseJour } from './types';
import './paiements.css';

function pluriel(n: number, mot: string) {
  return `${formatEntier(n)} ${mot}${n > 1 ? 's' : ''}`;
}

export function ResumePaiements({
  caisse,
  chargement,
  onglet,
  mode,
  onAVerifier,
  onMode,
}: {
  caisse: CaisseJour | undefined;
  chargement: boolean;
  onglet: string;
  mode: ModePaiement | '';
  onAVerifier: () => void;
  onMode: (m: ModePaiement) => void;
}) {
  if (chargement || !caisse) {
    return (
      <div className="pay-resume" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="pay-kpi">
            <Skeleton h={16} w="50%" />
            <Skeleton h={32} w="70%" />
          </div>
        ))}
      </div>
    );
  }
  const t = caisse.totaux;
  const refuse: Bloc = t.refuse_aujourdhui ?? { n: 0, somme: 0 };
  const modes = caisse.par_mode.filter((m) => m.a_valider.n > 0).sort((a, b) => b.a_valider.somme - a.a_valider.somme);
  return (
    <div className="pay-resume">
      <button type="button" className="pay-kpi" data-ton="attente" aria-pressed={onglet === 'a_valider' && !mode} onClick={onAVerifier}>
        <span className="pay-kpi__libelle">
          <Clock aria-hidden="true" />À vérifier
        </span>
        <span className="pay-kpi__valeur">
          {formatEntier(t.a_valider.somme)}
          <small>FCFA</small>
        </span>
        <span className="pay-kpi__meta">{t.a_valider.n ? `${pluriel(t.a_valider.n, 'paiement')} à contrôler` : 'Rien à contrôler'}</span>
      </button>
      <div className="pay-kpi" data-ton="valide">
        <span className="pay-kpi__libelle">
          <CheckCircle2 aria-hidden="true" />
          Validé aujourd’hui
        </span>
        <span className="pay-kpi__valeur">
          {formatEntier(t.valide_aujourdhui.somme)}
          <small>FCFA</small>
        </span>
        <span className="pay-kpi__meta">{pluriel(t.valide_aujourdhui.n, 'paiement')}</span>
      </div>
      <div className="pay-kpi" data-ton="refuse">
        <span className="pay-kpi__libelle">
          <Ban aria-hidden="true" />
          Refusé aujourd’hui
        </span>
        <span className="pay-kpi__valeur">
          {formatEntier(refuse.n)}
          <small>{refuse.n > 1 ? 'paiements' : 'paiement'}</small>
        </span>
        <span className="pay-kpi__meta">{refuse.n ? formatFCFA(refuse.somme) : 'Aucun refus'}</span>
      </div>
      <div className="pay-kpi">
        <span className="pay-kpi__libelle">
          <Wallet aria-hidden="true" />À vérifier par mode
        </span>
        {modes.length === 0 ? (
          <span className="pay-kpi__meta">Aucun paiement en attente.</span>
        ) : (
          <div className="pay-kpi-modes">
            {modes.map((m) => (
              <button
                key={m.mode}
                type="button"
                className="pay-kpi-mode"
                aria-pressed={mode === m.mode}
                onClick={() => onMode(m.mode)}
                title={`Afficher les paiements ${m.libelle} à vérifier`}
              >
                <ModePastille mode={m.mode} taille="sm" />
                <span className="ev-num">
                  {formatFCFA(m.a_valider.somme)} <span className="ev-muted">({m.a_valider.n})</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CaisseDuJour({
  caisse,
  erreur,
  chargement,
  actif,
  onChoisir,
}: {
  caisse: CaisseJour | undefined;
  erreur: string | null;
  chargement: boolean;
  actif: number | null;
  onChoisir: (id: number | null) => void;
}) {
  return (
    <Card title="Caisse du jour" flush className="pay-caisse">
      {erreur ? (
        <div style={{ padding: 'var(--space-4)' }}>
          <Alert tone="error">La caisse n’a pas pu être chargée : {erreur}</Alert>
        </div>
      ) : chargement || !caisse ? (
        <div style={{ padding: 'var(--space-4)' }}>
          <LoadingRows rows={3} />
        </div>
      ) : caisse.par_encaisseur.length === 0 ? (
        <p className="pay-caisse__aide" style={{ borderTop: 0 }}>
          Personne ne détient d’argent à vérifier et rien n’a été validé aujourd’hui.
        </p>
      ) : (
        <>
          <div className="pay-caisse__liste">
            {caisse.par_encaisseur.map((e) => (
              <button
                key={e.user_id ?? 'inconnu'}
                type="button"
                className="pay-caisse__ligne"
                aria-pressed={actif !== null && actif === e.user_id}
                disabled={e.user_id === null}
                onClick={() => e.user_id !== null && onChoisir(actif === e.user_id ? null : e.user_id)}
                title={e.user_id === null ? undefined : actif === e.user_id ? 'Retirer le filtre' : `Afficher uniquement les paiements de ${e.nom}`}
              >
                <span className="pay-caisse__haut">
                  <span className="pay-caisse__nom">{e.nom}</span>
                  <span className="pay-caisse__du" data-attente={e.a_valider.somme > 0 || undefined}>
                    {formatFCFA(e.a_valider.somme)}
                  </span>
                </span>
                <span className="pay-caisse__details">
                  <span>{e.role ? ROLE_LABELS[e.role] : 'Données importées'}</span>
                  <span>{pluriel(e.a_valider.n, 'paiement')} à vérifier</span>
                  {e.valide_aujourdhui.n > 0 && <span>Validé auj. {formatFCFA(e.valide_aujourdhui.somme)}</span>}
                  {(e.refuse_aujourdhui?.n ?? 0) > 0 && <span>Refusé auj. {pluriel(e.refuse_aujourdhui!.n, 'paiement')}</span>}
                </span>
              </button>
            ))}
          </div>
          <p className="pay-caisse__aide">
            Avant de valider, comptez l’argent remis par chaque encaisseur : les espèces doivent correspondre au montant à vérifier, les paiements Wave et Orange
            Money à leur référence. Cliquez sur une personne pour n’afficher que ses paiements.
          </p>
        </>
      )}
    </Card>
  );
}
