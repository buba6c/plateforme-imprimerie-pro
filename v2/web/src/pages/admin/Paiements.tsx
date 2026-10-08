// Paiements (administration) : vérifier les encaissements des livreurs et des préparateurs.
// En haut, l'essentiel en chiffres ; au centre, les paiements en cartes lisibles avec Valider /
// Refuser ; à droite, la caisse du jour par encaisseur. Cliquer sur un paiement ou un numéro de
// dossier ouvre l'aperçu du dossier par-dessus la page.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, History, Search, Wallet, X } from 'lucide-react';
import { formatEntier, formatFCFA, MODE_PAIEMENT_LABELS, MODES_PAIEMENT, type ModePaiement, type Role, type StatutPaiement } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, ConfirmDialog, EmptyState, LoadingRows, PageHeader, Pagination, Ref, SelectField, Tabs, TextField, useToast } from '../../ui';
import { DossierApercu } from '../../features/dossiers-ui/DossierApercu';
import { CaisseDuJour, ResumePaiements } from '../../features/paiements/Caisse';
import { CartePaiement, type Sortie } from '../../features/paiements/CartePaiement';
import { HistoriqueDialog, RefusDialog, ResultatGroupeDialog } from '../../features/paiements/Dialogues';
import type { CaisseJour, ListePaiementsAdmin, MembreAnnuaire, PaiementAdmin, ResultatGroupe } from '../../features/paiements/types';
import '../../features/paiements/paiements.css';

const LIMITE = 50;
const DUREE_COULEUR = 650;
const DUREE_REPLI = 320;

type Onglet = StatutPaiement | 'tous';
type Periode = 'tout' | 'jour' | '7j' | '30j' | 'mois' | 'perso';

const ONGLETS: { value: Onglet; label: string }[] = [
  { value: 'a_valider', label: 'À vérifier' },
  { value: 'valide', label: 'Validés' },
  { value: 'refuse', label: 'Refusés' },
  { value: 'tous', label: 'Tous' },
];

const PERIODES: { value: Periode; label: string }[] = [
  { value: 'tout', label: 'Toutes les dates' },
  { value: 'jour', label: 'Aujourd’hui' },
  { value: '7j', label: '7 derniers jours' },
  { value: '30j', label: '30 derniers jours' },
  { value: 'mois', label: 'Ce mois-ci' },
  { value: 'perso', label: 'Choisir les dates…' },
];

const VIDES: Record<Onglet, { titre: string; texte: string }> = {
  a_valider: {
    titre: 'Tout est vérifié',
    texte: 'Les encaissements saisis par les livreurs et les préparateurs apparaîtront ici jusqu’à ce que vous les validiez.',
  },
  valide: { titre: 'Aucun paiement validé', texte: 'Les paiements que vous validez, ou que vous saisissez vous-même, apparaîtront ici.' },
  refuse: { titre: 'Aucun paiement refusé', texte: 'Les paiements refusés apparaîtront ici avec le motif transmis à l’encaisseur.' },
  tous: { titre: 'Aucun paiement', texte: 'Les encaissements apparaîtront ici dès qu’un dossier sera payé.' },
};

function jourIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function bornes(p: Periode, du: string, au: string): { from?: string; to?: string } {
  const auj = new Date();
  const decale = (n: number) => {
    const d = new Date(auj);
    d.setDate(d.getDate() - n);
    return jourIso(d);
  };
  switch (p) {
    case 'jour':
      return { from: jourIso(auj), to: jourIso(auj) };
    case '7j':
      return { from: decale(6), to: jourIso(auj) };
    case '30j':
      return { from: decale(29), to: jourIso(auj) };
    case 'mois':
      return { from: jourIso(new Date(auj.getFullYear(), auj.getMonth(), 1)), to: jourIso(auj) };
    case 'perso':
      return { from: du || undefined, to: au || undefined };
    default:
      return {};
  }
}

function useReduitMouvement(): boolean {
  const [reduit, setReduit] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const f = () => setReduit(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return reduit;
}

export default function Paiements() {
  const qc = useQueryClient();
  const toast = useToast();
  const reduit = useReduitMouvement();

  const [onglet, setOnglet] = useState<Onglet>('a_valider');
  const [page, setPage] = useState(1);
  const [recherche, setRecherche] = useState('');
  const [q, setQ] = useState('');
  const [encaisseur, setEncaisseur] = useState<number | null>(null);
  const [mode, setMode] = useState<ModePaiement | ''>('');
  const [periode, setPeriode] = useState<Periode>('tout');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');

  const [selection, setSelection] = useState<Map<number, PaiementAdmin>>(new Map());
  const [sorties, setSorties] = useState<Map<number, Sortie>>(new Map());
  const [replies, setReplies] = useState<Set<number>>(new Set());
  const [partis, setPartis] = useState<Set<number>>(new Set());
  const [enCours, setEnCours] = useState<Set<number>>(new Set());

  const [apercu, setApercu] = useState<{ dossierId: number; paiementId: number | null } | null>(null);
  const [refus, setRefus] = useState<PaiementAdmin | null>(null);
  const [confirmGroupe, setConfirmGroupe] = useState(false);
  const [resultat, setResultat] = useState<ResultatGroupe | null>(null);
  const [historique, setHistorique] = useState(false);
  const minuteurs = useRef<number[]>([]);

  useEffect(() => () => minuteurs.current.forEach((t) => window.clearTimeout(t)), []);

  // Recherche appliquée après une courte pause de frappe.
  useEffect(() => {
    const t = window.setTimeout(() => setQ(recherche.trim()), 300);
    return () => window.clearTimeout(t);
  }, [recherche]);

  const { from, to } = bornes(periode, du, au);
  const datesInversees = periode === 'perso' && !!du && !!au && du > au;
  const filtres = useMemo(
    () => ({ q: q || undefined, livreur_id: encaisseur ?? undefined, mode: mode || undefined, from: datesInversees ? undefined : from, to: datesInversees ? undefined : to }),
    [q, encaisseur, mode, from, to, datesInversees],
  );

  useEffect(() => {
    setPage(1);
  }, [onglet, filtres]);

  const liste = useQuery({
    queryKey: ['paiements', 'admin', onglet, filtres, page],
    queryFn: () =>
      api.get<ListePaiementsAdmin>('/paiements', { ...filtres, statut: onglet === 'tous' ? undefined : onglet, page, limit: LIMITE }),
    placeholderData: (prev) => prev,
    refetchInterval: 60_000,
  });

  const compteurs = useQuery({
    queryKey: ['paiements', 'admin', 'compteurs', filtres],
    queryFn: async () => {
      const statuts: StatutPaiement[] = ['a_valider', 'valide', 'refuse'];
      const r = await Promise.all(statuts.map((s) => api.get<ListePaiementsAdmin>('/paiements', { ...filtres, statut: s, limit: 1 })));
      const c = Object.fromEntries(statuts.map((s, i) => [s, r[i]!.total])) as Record<StatutPaiement, number>;
      return { ...c, tous: c.a_valider + c.valide + c.refuse } as Record<Onglet, number>;
    },
    placeholderData: (prev) => prev,
  });

  const caisse = useQuery({ queryKey: ['caisse'], queryFn: () => api.get<CaisseJour>('/caisse'), refetchInterval: 60_000 });
  const importes = useQuery({
    queryKey: ['paiements', 'importes'],
    queryFn: () => api.get<ListePaiementsAdmin>('/paiements', { statut: 'a_valider', importe: '1', limit: 1 }),
  });
  const annuaire = useQuery({ queryKey: ['users', 'annuaire'], queryFn: () => api.get<MembreAnnuaire[]>('/users/annuaire'), staleTime: 5 * 60_000 });

  const roles = useMemo(() => new Map<number, Role>((annuaire.data ?? []).map((u) => [u.id, u.role])), [annuaire.data]);
  const encaisseurs = useMemo(() => {
    const m = new Map<number, string>();
    for (const u of annuaire.data ?? []) if (u.role === 'admin' || u.role === 'preparateur' || u.role === 'livreur') m.set(u.id, u.nom);
    for (const e of caisse.data?.par_encaisseur ?? []) if (e.user_id !== null && !m.has(e.user_id)) m.set(e.user_id, e.nom);
    return [...m].map(([id, nom]) => ({ value: String(id), label: nom })).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [annuaire.data, caisse.data]);

  const items = liste.data?.items ?? [];
  // Dans « À vérifier », un paiement traité quitte la liste après son animation.
  const visibles = onglet === 'a_valider' ? items.filter((p) => !partis.has(p.id)) : items;
  const selectionnables = visibles.filter((p) => p.statut === 'a_valider' && !sorties.has(p.id));
  const selectionnes = [...selection.values()];
  const sommeSelection = selectionnes.reduce((s, p) => s + p.montant, 0);
  const toutCoche = selectionnables.length > 0 && selectionnables.every((p) => selection.has(p.id));

  const rafraichir = useCallback(
    (dossiers: number[]) => {
      for (const k of [['paiements'], ['caisse'], ['stats'], ['dossiers']]) qc.invalidateQueries({ queryKey: k });
      for (const id of new Set(dossiers)) qc.invalidateQueries({ queryKey: ['dossier', id] });
    },
    [qc],
  );

  /** La carte se colore, puis se replie et quitte la liste ; les données sont rechargées ensuite. */
  const animerSortie = useCallback(
    (ps: PaiementAdmin[], etat: Sortie) => {
      if (!ps.length) return;
      const ids = ps.map((p) => p.id);
      setSorties((m) => {
        const n = new Map(m);
        ids.forEach((id) => n.set(id, etat));
        return n;
      });
      setSelection((s) => {
        const n = new Map(s);
        ids.forEach((id) => n.delete(id));
        return n;
      });
      const couleur = reduit ? 450 : DUREE_COULEUR;
      const repli = reduit ? 0 : DUREE_REPLI;
      minuteurs.current.push(
        window.setTimeout(() => setReplies((s) => new Set([...s, ...ids])), couleur),
        window.setTimeout(() => {
          setPartis((s) => new Set([...s, ...ids]));
          rafraichir(ps.map((p) => p.dossier_id));
        }, couleur + repli),
      );
    },
    [reduit, rafraichir],
  );

  const valider = useMutation({
    mutationFn: (p: PaiementAdmin) => api.post<PaiementAdmin>(`/paiements/${p.id}/valider`),
    onMutate: (p) => setEnCours((s) => new Set(s).add(p.id)),
    onSettled: (_r, _e, p) =>
      setEnCours((s) => {
        const n = new Set(s);
        n.delete(p.id);
        return n;
      }),
    onSuccess: (_r, p) => {
      animerSortie([p], 'valide');
      toast.success('Paiement validé', `${p.numero} · ${formatFCFA(p.montant)} en ${MODE_PAIEMENT_LABELS[p.mode]}`);
    },
    onError: (e, p) => {
      toast.error(`Le paiement du dossier ${p.numero} n’a pas été validé`, messageErreur(e));
      rafraichir([p.dossier_id]);
    },
  });

  const groupe = useMutation({
    mutationFn: (ps: PaiementAdmin[]) => api.post<ResultatGroupe>('/paiements/valider-groupe', { ids: ps.map((p) => p.id) }),
    onSuccess: (r, ps) => {
      setConfirmGroupe(false);
      const valides = new Set(r.ids);
      animerSortie(
        ps.filter((p) => valides.has(p.id)),
        'valide',
      );
      if (r.refuses.length === 0) {
        toast.success(`${formatEntier(r.valides)} paiement${r.valides > 1 ? 's' : ''} validé${r.valides > 1 ? 's' : ''}`, `${formatFCFA(r.somme)} ajoutés à l’encaissé.`);
      } else {
        setResultat(r);
        rafraichir([]);
      }
    },
    onError: (e) => {
      setConfirmGroupe(false);
      toast.error('La sélection n’a pas été validée', messageErreur(e));
    },
  });

  const cocher = (p: PaiementAdmin, v: boolean) =>
    setSelection((s) => {
      const n = new Map(s);
      if (v) n.set(p.id, p);
      else n.delete(p.id);
      return n;
    });

  const changerOnglet = (o: Onglet) => {
    setOnglet(o);
    if (o !== 'a_valider') setSelection(new Map());
  };

  const filtresActifs = !!q || encaisseur !== null || !!mode || periode !== 'tout';
  const effacerFiltres = () => {
    setRecherche('');
    setQ('');
    setEncaisseur(null);
    setMode('');
    setPeriode('tout');
    setDu('');
    setAu('');
  };

  const nbImportes = importes.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Paiements"
        subtitle="Vérifiez l’argent encaissé par les livreurs et les préparateurs : un paiement ne compte dans l’encaissé qu’une fois validé."
      />

      <ResumePaiements
        caisse={caisse.data}
        chargement={caisse.isLoading}
        onglet={onglet}
        mode={mode}
        onAVerifier={() => {
          changerOnglet('a_valider');
          setMode('');
        }}
        onMode={(m) => {
          changerOnglet('a_valider');
          setMode((x) => (x === m ? '' : m));
        }}
      />

      {nbImportes > 0 && (
        <div className="pay-import">
          <div className="pay-import__texte">
            <strong>
              {formatEntier(nbImportes)} paiement{nbImportes > 1 ? 's' : ''} importé{nbImportes > 1 ? 's' : ''} de l’ancienne plateforme à vérifier ·{' '}
              {formatFCFA(importes.data?.somme ?? 0)}
            </strong>
            <span>Ce sont les encaissements « livreur » de l’ancienne application. Ceux des dossiers déjà livrés peuvent être validés d’un coup.</span>
          </div>
          <Button icon={<History />} onClick={() => setHistorique(true)}>
            Valider l’historique
          </Button>
        </div>
      )}

      <div className="pay-grille">
        <div className="stack" style={{ gap: 0 }}>
          <section className="pay-panneau" aria-label="Liste des paiements">
            <Tabs label="Paiements par état" tabs={ONGLETS.map((t) => ({ ...t, count: compteurs.data?.[t.value] }))} value={onglet} onChange={changerOnglet} />

            <div className="pay-filtres">
              <div className="ev-field">
                <label className="ev-label" htmlFor="pay-recherche">
                  Rechercher
                </label>
                <div className="ev-search">
                  <Search aria-hidden="true" />
                  <input
                    id="pay-recherche"
                    className="ev-input"
                    type="search"
                    placeholder="N° de dossier, client ou référence"
                    value={recherche}
                    maxLength={100}
                    onChange={(e) => setRecherche(e.target.value)}
                  />
                </div>
              </div>
              <SelectField
                label="Encaissé par"
                value={encaisseur === null ? '' : String(encaisseur)}
                onChange={(e) => setEncaisseur(e.target.value ? Number(e.target.value) : null)}
                options={[{ value: '', label: 'Tout le monde' }, ...encaisseurs]}
              />
              <SelectField
                label="Mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as ModePaiement | '')}
                options={[{ value: '', label: 'Tous les modes' }, ...MODES_PAIEMENT.map((m) => ({ value: m, label: MODE_PAIEMENT_LABELS[m] }))]}
              />
              <SelectField label="Période" value={periode} onChange={(e) => setPeriode(e.target.value as Periode)} options={PERIODES} />
              {periode === 'perso' && (
                <div className="pay-filtres__dates">
                  <TextField label="Du" type="date" value={du} onChange={(e) => setDu(e.target.value)} />
                  <TextField label="Au" type="date" value={au} onChange={(e) => setAu(e.target.value)} error={datesInversees ? 'Après la date de début.' : null} />
                </div>
              )}
            </div>

            <div className="pay-outils">
              <span aria-live="polite">
                {liste.data ? (
                  <>
                    <strong>
                      {formatEntier(liste.data.total)} paiement{liste.data.total > 1 ? 's' : ''}
                    </strong>{' '}
                    · <span className="ev-num">{formatFCFA(liste.data.somme)}</span>
                  </>
                ) : (
                  '…'
                )}
              </span>
              <div className="row">
                {selectionnables.length > 0 && (
                  <label className="ev-check">
                    <input
                      type="checkbox"
                      checked={toutCoche}
                      onChange={(e) =>
                        setSelection((s) => {
                          const n = new Map(s);
                          for (const p of selectionnables) {
                            if (e.target.checked) n.set(p.id, p);
                            else n.delete(p.id);
                          }
                          return n;
                        })
                      }
                    />
                    <span className="ev-check__box" aria-hidden="true" />
                    Tout sélectionner sur cette page
                  </label>
                )}
                {filtresActifs && (
                  <button type="button" className="pay-chip-btn" onClick={effacerFiltres}>
                    Effacer les filtres
                    <X aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {liste.isError ? (
              <div style={{ padding: 'var(--space-4)' }}>
                <Alert tone="error">La liste des paiements n’a pas pu être chargée : {messageErreur(liste.error)}</Alert>
              </div>
            ) : liste.isLoading ? (
              <div style={{ padding: 'var(--space-4)' }}>
                <LoadingRows rows={5} />
              </div>
            ) : visibles.length === 0 ? (
              <EmptyState
                title={filtresActifs ? 'Aucun paiement ne correspond' : VIDES[onglet].titre}
                icon={<Wallet aria-hidden="true" />}
                action={
                  filtresActifs ? (
                    <Button size="sm" onClick={effacerFiltres}>
                      Effacer les filtres
                    </Button>
                  ) : undefined
                }
              >
                {filtresActifs ? 'Modifiez la recherche, l’encaisseur, le mode ou la période.' : VIDES[onglet].texte}
              </EmptyState>
            ) : (
              <>
                <ul className="pay-liste">
                  {visibles.map((p) => (
                    <li key={p.id} className="pay-item" data-masque={(onglet === 'a_valider' && replies.has(p.id)) || undefined}>
                      <div>
                        <CartePaiement
                          p={p}
                          selectionnable={p.statut === 'a_valider'}
                          selectionne={selection.has(p.id)}
                          onSelection={(v) => cocher(p, v)}
                          onOuvrir={() => setApercu({ dossierId: p.dossier_id, paiementId: p.id })}
                          onValider={() => valider.mutate(p)}
                          onRefuser={() => setRefus(p)}
                          enCours={enCours.has(p.id) || (groupe.isPending && selection.has(p.id))}
                          bloque={groupe.isPending}
                          sortie={sorties.get(p.id)}
                          roles={roles}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
                <Pagination page={page} total={liste.data?.total ?? 0} limit={LIMITE} onPage={setPage} />
              </>
            )}
          </section>

          {selection.size > 0 && (
            <div className="pay-selection" role="region" aria-label="Paiements sélectionnés">
              <div className="pay-selection__texte">
                <strong>
                  {formatEntier(selection.size)} paiement{selection.size > 1 ? 's' : ''} sélectionné{selection.size > 1 ? 's' : ''}
                </strong>
                <span className="pay-selection__total">{formatFCFA(sommeSelection)}</span>
              </div>
              <div className="row">
                <Button size="sm" variant="ghost" onClick={() => setSelection(new Map())} disabled={groupe.isPending}>
                  Vider la sélection
                </Button>
                <Button
                  variant="primary"
                  icon={<Check />}
                  onClick={() => setConfirmGroupe(true)}
                  busy={groupe.isPending}
                  disabled={selection.size > 500}
                  title={selection.size > 500 ? '500 paiements au plus à la fois' : undefined}
                >
                  Valider la sélection ({formatEntier(selection.size)})
                </Button>
              </div>
            </div>
          )}
        </div>

        <CaisseDuJour
          caisse={caisse.data}
          erreur={caisse.isError ? messageErreur(caisse.error) : null}
          chargement={caisse.isLoading}
          actif={encaisseur}
          onChoisir={(id) => {
            setEncaisseur(id);
            if (id !== null) changerOnglet('a_valider');
          }}
        />
      </div>

      {apercu && <DossierApercu dossierId={apercu.dossierId} paiementId={apercu.paiementId} onClose={() => setApercu(null)} />}

      <RefusDialog
        paiement={refus}
        onClose={() => setRefus(null)}
        onRefuse={(p) => {
          animerSortie([p], 'refuse');
          toast.success('Paiement refusé', `${p.numero} · le motif est transmis à ${p.encaisse_par_nom ?? 'l’encaisseur'}.`);
        }}
      />

      <ConfirmDialog
        open={confirmGroupe}
        onClose={() => !groupe.isPending && setConfirmGroupe(false)}
        onConfirm={() => groupe.mutate(selectionnes)}
        busy={groupe.isPending}
        title={`Valider ${formatEntier(selection.size)} paiement${selection.size > 1 ? 's' : ''}`}
        confirmLabel={`Valider ${formatFCFA(sommeSelection)}`}
        description="Vérifiez que l’argent remis correspond : une fois validés, ces paiements comptent dans l’encaissé et ne peuvent plus être refusés. Chaque paiement est revérifié ; ceux qui dépasseraient le montant de leur dossier restent à vérifier."
      >
        <ul className="pay-refus-liste">
          {selectionnes.map((p) => (
            <li key={p.id}>
              <Ref>{p.numero}</Ref> · {p.client_nom} · <span className="ev-num">{formatFCFA(p.montant)}</span> · {MODE_PAIEMENT_LABELS[p.mode]}
            </li>
          ))}
        </ul>
      </ConfirmDialog>

      <ResultatGroupeDialog resultat={resultat} onClose={() => setResultat(null)} />
      <HistoriqueDialog open={historique} onClose={() => setHistorique(false)} />
    </>
  );
}
