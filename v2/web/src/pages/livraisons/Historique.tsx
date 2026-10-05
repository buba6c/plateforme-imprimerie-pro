// Historique des livraisons : tout ce que le livreur a livré, au-delà des derniers jours de « Livrées »,
// avec ce qu'il a encaissé et l'état de validation. Ni téléphone, ni prix, ni fichiers.
// L'administrateur voit toutes les livraisons et peut n'afficher qu'un livreur.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { History, RotateCw } from 'lucide-react';
import { formatDateHeure, formatFCFA, MODE_PAIEMENT_LABELS, MODES_PAIEMENT, type ModePaiement } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { useParametres } from '../../features/livraisons/hooks';
import { Resume } from '../../features/livraisons/Resume';
import '../../features/livraisons/livraisons.css';
import { ajouterJours, aujourdhuiDans, estJour, useEcranLarge, useHistorique, useLivreurs } from '../../features/livraisons-planning/hooks';
import type { LivraisonEffectuee } from '../../features/livraisons-planning/types';
import '../../features/livraisons-planning/livraisons-planning.css';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Card, EmptyState, LoadingRows, PageHeader, PaiementStatutBadge, Pagination, Ref, SelectField, TextField } from '../../ui';

const TAILLE = 20;

type Periode = '7j' | '30j' | 'mois' | 'mois_dernier' | 'tout' | 'dates';
const PERIODES: { value: Periode; label: string }[] = [
  { value: '7j', label: '7 derniers jours' },
  { value: '30j', label: '30 derniers jours' },
  { value: 'mois', label: 'Ce mois-ci' },
  { value: 'mois_dernier', label: 'Le mois dernier' },
  { value: 'tout', label: 'Tout l’historique' },
  { value: 'dates', label: 'Dates précises' },
];

function bornes(p: Periode, aujourdhui: string, du?: string, au?: string): { du?: string; au?: string } {
  const debutMois = `${aujourdhui.slice(0, 8)}01`;
  switch (p) {
    case '7j':
      return { du: ajouterJours(aujourdhui, -6), au: aujourdhui };
    case '30j':
      return { du: ajouterJours(aujourdhui, -29), au: aujourdhui };
    case 'mois':
      return { du: debutMois, au: aujourdhui };
    case 'mois_dernier': {
      const fin = ajouterJours(debutMois, -1);
      return { du: `${fin.slice(0, 8)}01`, au: fin };
    }
    case 'tout':
      return {};
    case 'dates':
      return { du, au };
  }
}

function Encaissements({ l }: { l: LivraisonEffectuee }) {
  if (!l.encaissements.length) return <span className="ev-muted">Aucun encaissement</span>;
  return (
    <div className="lp-enc">
      {l.encaissements.map((e) => (
        <div key={e.id} className="lp-enc__item">
          <span className="lp-enc__ligne" data-refuse={e.statut === 'refuse' || undefined}>
            <span className="ev-num">{formatFCFA(e.montant)}</span>
            <span>{MODE_PAIEMENT_LABELS[e.mode]}</span>
            <PaiementStatutBadge statut={e.statut} />
          </span>
          {e.statut === 'refuse' && <p className="lp-enc__motif">Motif du refus : {e.motif_refus || 'non précisé'}</p>}
        </div>
      ))}
    </div>
  );
}

function Dossier({ l }: { l: LivraisonEffectuee }) {
  return l.fiche_accessible ? (
    <Link to={`/dossiers/${l.id}`} className="ev-link">
      <Ref>{l.numero}</Ref>
    </Link>
  ) : (
    <span title="La fiche n’est plus consultable : la livraison est trop ancienne.">
      <Ref>{l.numero}</Ref>
    </span>
  );
}

export default function Historique() {
  const user = useUser();
  const admin = user.role === 'admin';
  const large = useEcranLarge(760);
  const parametres = useParametres();
  const aujourdhui = aujourdhuiDans(parametres.data?.fuseau);
  const [params, setParams] = useSearchParams();

  const periodeParam = params.get('periode') as Periode | null;
  const periode: Periode = PERIODES.some((p) => p.value === periodeParam) ? periodeParam! : '30j';
  const duParam = params.get('du');
  const auParam = params.get('au');
  const modeParam = params.get('mode');
  const mode = (MODES_PAIEMENT as readonly string[]).includes(modeParam ?? '') ? (modeParam as ModePaiement) : undefined;
  const livreurParam = Number(params.get('livreur'));
  const livreurId = admin && Number.isInteger(livreurParam) && livreurParam > 0 ? livreurParam : undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = params.get('q') ?? '';

  // Mise à jour à partir de l'adresse courante : deux changements rapprochés ne s'écrasent pas.
  const modifier = useCallback(
    (changements: Record<string, string | null>, garderPage = false) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changements)) {
            if (v) p.set(k, v);
            else p.delete(k);
          }
          if (!garderPage) p.delete('page');
          return p;
        },
        { replace: true },
      ),
    [setParams],
  );

  // La recherche part après une courte pause de saisie.
  const [saisie, setSaisie] = useState(q);
  useEffect(() => setSaisie(q), [q]);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (saisie.trim() !== q) modifier({ q: saisie.trim() || null });
    }, 350);
    return () => window.clearTimeout(t);
  }, [saisie, q, modifier]);

  const datesInvalides = periode === 'dates' && estJour(duParam) && estJour(auParam) && duParam > auParam;
  const b = useMemo(
    () => bornes(periode, aujourdhui, estJour(duParam) ? duParam : undefined, estJour(auParam) ? auParam : undefined),
    [periode, aujourdhui, duParam, auParam],
  );
  const filtres = { page, taille: TAILLE, du: b.du, au: datesInvalides ? undefined : b.au, q: q || undefined, mode_paiement: mode, livreur_id: livreurId };
  const h = useHistorique(filtres);
  const livreurs = useLivreurs(admin);
  const t = h.data?.totaux;
  const filtre = !!(q || mode || periode !== 'tout');

  return (
    <>
      <PageHeader
        title="Historique des livraisons"
        subtitle={
          admin
            ? 'Toutes les livraisons effectuées, avec ce que chaque livreur a encaissé.'
            : 'Toutes vos livraisons, même anciennes, avec ce que vous avez encaissé et sa validation.'
        }
      />

      <Card>
        <div className="lp-filtres" role="search" aria-label="Filtrer l’historique">
          <SelectField
            label="Période"
            value={periode}
            onChange={(e) => {
              const v = e.target.value as Periode;
              modifier(v === 'dates' ? { periode: v, du: b.du ?? ajouterJours(aujourdhui, -29), au: b.au ?? aujourdhui } : { periode: v, du: null, au: null });
            }}
            options={PERIODES}
          />
          {periode === 'dates' && (
            <>
              <TextField label="Du" type="date" value={duParam ?? ''} max={auParam ?? undefined} onChange={(e) => modifier({ du: e.target.value || null })} />
              <TextField
                label="Au"
                type="date"
                value={auParam ?? ''}
                min={duParam ?? undefined}
                onChange={(e) => modifier({ au: e.target.value || null })}
                error={datesInvalides ? 'La date de fin précède la date de début.' : null}
              />
            </>
          )}
          <TextField
            className="lp-filtres__recherche"
            label="Rechercher"
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Client, numéro ou lieu"
          />
          <SelectField
            label="Mode de paiement"
            value={mode ?? ''}
            onChange={(e) => modifier({ mode: e.target.value || null })}
            options={[{ value: '', label: 'Tous les modes' }, ...MODES_PAIEMENT.map((m) => ({ value: m, label: MODE_PAIEMENT_LABELS[m] }))]}
          />
          {admin && (
            <SelectField
              label="Livreur"
              value={livreurId ? String(livreurId) : ''}
              onChange={(e) => modifier({ livreur: e.target.value || null })}
              options={[{ value: '', label: 'Tous les livreurs' }, ...(livreurs.data ?? []).map((l) => ({ value: String(l.id), label: l.nom }))]}
            />
          )}
        </div>
      </Card>

      {h.isError && !h.data ? (
        <Alert tone="error">
          <div className="stack-sm">
            <span>L’historique n’a pas pu être chargé : {messageErreur(h.error)}</span>
            <div>
              <Button size="sm" icon={<RotateCw />} onClick={() => void h.refetch()} busy={h.isFetching}>
                Réessayer
              </Button>
            </div>
          </div>
        </Alert>
      ) : !h.data || !t ? (
        <LoadingRows rows={5} />
      ) : (
        <>
          <Resume
            label="Totaux de la période"
            items={[
              { label: 'Livraisons', value: t.nb_livraisons, meta: PERIODES.find((p) => p.value === periode)?.label.toLowerCase() },
              { label: 'Encaissé', montant: t.encaisse, meta: t.valide ? `dont ${formatFCFA(t.valide)} validés` : 'refus exclus' },
              {
                label: 'En attente de validation',
                montant: t.en_attente_validation,
                meta: t.refuse ? `${formatFCFA(t.refuse)} refusés, non comptés` : 'par l’administrateur',
                tone: t.refuse || t.en_attente_validation ? 'alert' : undefined,
                large: true,
              },
            ]}
          />
          {t.par_mode.length > 0 && (
            <Card title="Encaissé par mode de paiement" flush>
              <dl className="lp-modes">
                {t.par_mode.map((m) => (
                  <div key={m.mode}>
                    <dt>{m.libelle}</dt>
                    <dd className="ev-num">
                      {formatFCFA(m.montant)}
                      <small>
                        {m.nb} encaissement{m.nb > 1 ? 's' : ''}
                        {m.en_attente_validation ? `, ${formatFCFA(m.en_attente_validation)} à valider` : ''}
                      </small>
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {h.isError && <Alert tone="warning">Actualisation impossible ({messageErreur(h.error)}). La liste affichée peut ne pas être à jour.</Alert>}

          {h.data.items.length === 0 ? (
            <Card>
              <EmptyState title={filtre ? 'Aucune livraison ne correspond' : 'Aucune livraison pour l’instant'} icon={<History aria-hidden="true" />}>
                {filtre
                  ? 'Élargissez la période ou retirez la recherche et le mode de paiement.'
                  : 'Chaque livraison confirmée apparaît ici, avec les encaissements notés et leur validation.'}
              </EmptyState>
            </Card>
          ) : large ? (
            <div className="ev-table-wrap" aria-busy={h.isFetching || undefined}>
              <table className="ev-table">
                <thead>
                  <tr>
                    <th>Livrée le</th>
                    <th>Dossier</th>
                    <th>Lieu</th>
                    {admin && <th>Livreur</th>}
                    <th className="text-right">Encaissé par le livreur</th>
                  </tr>
                </thead>
                <tbody>
                  {h.data.items.map((l) => (
                    <tr key={l.id}>
                      <td className="nowrap">
                        <span className="ev-ref">{formatDateHeure(l.livre_at)}</span>
                      </td>
                      <td>
                        <span className="ev-cell-main">{l.client_nom}</span>
                        <span className="ev-cell-sub">
                          <Dossier l={l} />
                        </span>
                      </td>
                      <td>{l.adresse_livraison || <span className="ev-muted">—</span>}</td>
                      {admin && <td>{l.livreur_nom ?? <span className="ev-muted">Sans livreur</span>}</td>}
                      <td>
                        <Encaissements l={l} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} total={h.data.total} limit={TAILLE} onPage={(p) => modifier({ page: String(p) }, true)} />
            </div>
          ) : (
            <Card flush>
              <ul className="lv-liste" aria-busy={h.isFetching || undefined}>
                {h.data.items.map((l) => (
                  <li key={l.id} className="lv-ligne">
                    <div className="lv-ligne__lien">
                      <span className="lv-ligne__haut">
                        <span className="lv-ligne__titre">{l.client_nom}</span>
                        <Dossier l={l} />
                      </span>
                      <span className="lv-ligne__sous">
                        Livrée le {formatDateHeure(l.livre_at)}
                        {l.adresse_livraison ? ` · ${l.adresse_livraison}` : ''}
                        {admin && l.livreur_nom ? ` · ${l.livreur_nom}` : ''}
                      </span>
                    </div>
                    <div className="lp-pleine">
                      <Encaissements l={l} />
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={page} total={h.data.total} limit={TAILLE} onPage={(p) => modifier({ page: String(p) }, true)} />
            </Card>
          )}
        </>
      )}
    </>
  );
}
