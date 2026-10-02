// Liste des dossiers (admin, préparateur) et historique des imprimeurs.
// Tous les filtres vivent dans l'adresse (?onglet=&q=&machine=&urgent=1&mine=1&tri=&page=).

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FolderOpen, Plus, Search, X } from 'lucide-react';
import { formatDate, formatFCFA, MACHINE_LABELS, MACHINES, type Machine, type Role, type Statut } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { messageErreur } from '../../lib/api';
import type { DossierResume } from '../../lib/types';
import { useDossiers } from '../../features/dossiers/hooks';
import { CarteDossier, enRetard, resumeSpecs, useMediaQuery } from '../../features/dossiers-ui/CarteDossier';
import { useLibelles, useTarifs } from '../../features/specs/useTarifs';
import { Alert, Button, Card, EmptyState, LoadingRows, MachineChip, PageHeader, Pagination, PaymentBadge, StatusBadge, Tabs, UrgentTag } from '../../ui';
import '../../features/dossiers-ui/dossiers-ui.css';

interface Onglet {
  id: string;
  label: string;
  statuts: Statut[] | null;
}

function ongletsPour(role: Role): Onglet[] {
  switch (role) {
    case 'admin':
      return [
        { id: 'tous', label: 'Tous', statuts: null },
        { id: 'preparation', label: 'En préparation', statuts: ['en_cours', 'a_revoir'] },
        { id: 'impression', label: 'À l’impression', statuts: ['pret_impression', 'en_impression'] },
        { id: 'livraison', label: 'En livraison', statuts: ['pret_livraison', 'en_livraison'] },
        { id: 'livres', label: 'Livrés', statuts: ['livre'] },
        { id: 'termines', label: 'Terminés', statuts: ['termine'] },
      ];
    case 'preparateur':
      return [
        { id: 'a_traiter', label: 'À traiter', statuts: ['en_cours', 'a_revoir'] },
        { id: 'production', label: 'En production', statuts: ['pret_impression', 'en_impression'] },
        { id: 'livraison', label: 'En livraison', statuts: ['pret_livraison', 'en_livraison'] },
        { id: 'livres', label: 'Livrés', statuts: ['livre', 'termine'] },
        { id: 'tous', label: 'Tous', statuts: null },
      ];
    case 'imprimeur_roland':
    case 'imprimeur_xerox':
      return [
        { id: 'tous', label: 'Tous', statuts: null },
        { id: 'a_imprimer', label: 'À imprimer', statuts: ['pret_impression'] },
        { id: 'en_impression', label: 'En impression', statuts: ['en_impression'] },
        { id: 'imprimes', label: 'Imprimés', statuts: ['pret_livraison', 'en_livraison', 'livre', 'termine'] },
        { id: 'a_revoir', label: 'Renvoyés en révision', statuts: ['a_revoir'] },
      ];
    case 'livreur':
      return [
        { id: 'tous', label: 'Tous', statuts: null },
        { id: 'a_livrer', label: 'À livrer', statuts: ['pret_livraison'] },
        { id: 'en_livraison', label: 'En livraison', statuts: ['en_livraison'] },
        { id: 'livres', label: 'Livrés', statuts: ['livre', 'termine'] },
      ];
  }
}

const LIMIT = 25;
const TRIS = [
  { value: 'priorite', label: 'Urgents et échéances d’abord' },
  { value: 'recent', label: 'Plus récents d’abord' },
  { value: 'ancien', label: 'Plus anciens d’abord' },
] as const;
type Tri = (typeof TRIS)[number]['value'];

export default function ListeDossiers() {
  const user = useUser();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const mobile = useMediaQuery('(max-width: 767px)');
  const imprimeur = user.role === 'imprimeur_roland' || user.role === 'imprimeur_xerox';
  const bureau = user.role === 'admin' || user.role === 'preparateur';
  const montrerMontant = user.role !== 'imprimeur_roland' && user.role !== 'imprimeur_xerox';

  const onglets = useMemo(() => ongletsPour(user.role), [user.role]);
  const q = sp.get('q') ?? '';
  const ongletDefaut = q ? 'tous' : onglets[0]!.id;
  const onglet = onglets.find((o) => o.id === sp.get('onglet')) ?? onglets.find((o) => o.id === ongletDefaut)!;
  const machine = (MACHINES as readonly string[]).includes(sp.get('machine') ?? '') ? (sp.get('machine') as Machine) : undefined;
  const urgent = sp.get('urgent') === '1';
  const mine = sp.get('mine') === '1';
  const triDefaut: Tri = onglet.statuts && user.role !== 'livreur' && !imprimeur ? 'priorite' : 'recent';
  const tri = (TRIS.some((t) => t.value === sp.get('tri')) ? sp.get('tri') : triDefaut) as Tri;
  const page = Math.max(1, Number(sp.get('page')) || 1);

  const maj = (patch: Record<string, string | null>, garderPage = false) => {
    const n = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') n.delete(k);
      else n.set(k, v);
    }
    if (!garderPage) n.delete('page');
    setSp(n, { replace: true });
  };

  // Recherche : saisie locale, écrite dans l'adresse après une courte pause.
  const [saisie, setSaisie] = useState(q);
  useEffect(() => setSaisie(q), [q]);
  useEffect(() => {
    if (saisie.trim() === q) return;
    const t = setTimeout(() => maj({ q: saisie.trim() || null }), 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const liste = useDossiers({
    statut: onglet.statuts ?? undefined,
    machine,
    q: q || undefined,
    urgent: urgent || undefined,
    mine: mine || undefined,
    tri,
    page,
    limit: LIMIT,
  });
  const tarifs = useTarifs(bureau);
  const libelle = useLibelles(tarifs.data);

  const compteurs = liste.data?.compteurs ?? {};
  const compte = (o: Onglet) =>
    liste.data ? (o.statuts ?? (Object.keys(compteurs) as Statut[])).reduce((s, st) => s + (compteurs[st] ?? 0), 0) : undefined;
  const filtresActifs = !!(q || machine || urgent || mine);
  const items = liste.data?.items ?? [];
  const total = liste.data?.total ?? 0;

  const titre = imprimeur ? 'Historique' : 'Dossiers';
  const sousTitre = imprimeur
    ? `Dossiers ${user.role === 'imprimeur_roland' ? 'Roland' : 'Xerox'} passés par l’atelier.`
    : liste.data
      ? `${total} dossier${total > 1 ? 's' : ''}${onglet.statuts ? ` · ${onglet.label.toLowerCase()}` : ''}`
      : undefined;

  return (
    <>
      <PageHeader
        title={titre}
        subtitle={sousTitre}
        actions={
          bureau ? (
            <Button variant="primary" icon={<Plus />} onClick={() => navigate('/dossiers/nouveau')}>
              Nouveau dossier
            </Button>
          ) : undefined
        }
      />

      <div className="dl-toolbar">
        <Tabs
          label="Étapes du circuit"
          value={onglet.id}
          onChange={(v) => maj({ onglet: v === onglets[0]!.id && !q ? null : v, tri: null })}
          tabs={onglets.map((o) => ({ value: o.id, label: o.label, count: compte(o) }))}
        />
        <div className="dl-filtres" role="search">
          <div className="ev-search">
            <Search aria-hidden="true" />
            <input
              className="ev-input"
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Client, numéro, description"
              aria-label="Rechercher dans les dossiers"
            />
          </div>
          {!imprimeur && (
            <select className="ev-select" aria-label="Machine" value={machine ?? ''} onChange={(e) => maj({ machine: e.target.value || null })}>
              <option value="">Toutes les machines</option>
              {MACHINES.map((m) => (
                <option key={m} value={m}>
                  {MACHINE_LABELS[m]}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="ev-btn ev-btn--sm dl-toggle" data-tone="urgent" aria-pressed={urgent} onClick={() => maj({ urgent: urgent ? null : '1' })}>
            Urgents
          </button>
          {user.role === 'preparateur' && (
            <button type="button" className="ev-btn ev-btn--sm dl-toggle" aria-pressed={mine} onClick={() => maj({ mine: mine ? null : '1' })}>
              Mes dossiers
            </button>
          )}
          <select className="ev-select" aria-label="Ordre" value={tri} onChange={(e) => maj({ tri: e.target.value === triDefaut ? null : e.target.value })}>
            {TRIS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {filtresActifs && (
            <Button size="sm" variant="ghost" icon={<X />} onClick={() => maj({ q: null, machine: null, urgent: null, mine: null })}>
              Effacer les filtres
            </Button>
          )}
        </div>
      </div>

      {liste.isError ? (
        <Alert tone="error">
          La liste ne s’est pas chargée : {messageErreur(liste.error)}{' '}
          <button type="button" className="ev-link" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }} onClick={() => void liste.refetch()}>
            Réessayer
          </button>
        </Alert>
      ) : liste.isLoading ? (
        <LoadingRows rows={8} />
      ) : items.length === 0 ? (
        <Card>
          {filtresActifs ? (
            <EmptyState
              title="Aucun dossier ne correspond"
              icon={<Search aria-hidden="true" />}
              action={
                <Button size="sm" onClick={() => maj({ q: null, machine: null, urgent: null, mine: null })}>
                  Effacer les filtres
                </Button>
              }
            >
              Modifiez la recherche ou retirez des filtres{onglet.statuts ? `, ou regardez l’onglet « ${onglets.find((o) => !o.statuts)?.label ?? 'Tous'} »` : ''}.
            </EmptyState>
          ) : (
            <EmptyState
              title={onglet.id === 'a_traiter' ? 'Aucun dossier à traiter' : 'Aucun dossier ici'}
              icon={<FolderOpen aria-hidden="true" />}
              action={
                bureau ? (
                  <Button size="sm" variant="primary" icon={<Plus />} onClick={() => navigate('/dossiers/nouveau')}>
                    Créer un dossier
                  </Button>
                ) : undefined
              }
            >
              {bureau
                ? 'Les dossiers apparaissent ici dès leur création, puis changent d’onglet à chaque étape du circuit.'
                : 'Les dossiers apparaissent ici au fil du circuit.'}
            </EmptyState>
          )}
        </Card>
      ) : mobile ? (
        <div className="dl-cartes" aria-busy={liste.isFetching || undefined}>
          {items.map((d) => (
            <CarteDossier key={d.id} d={d} libelle={libelle} montrerMontant={montrerMontant} />
          ))}
          <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => maj({ page: String(p) }, true)} />
        </div>
      ) : (
        <div className="ev-table-wrap" aria-busy={liste.isFetching || undefined}>
          <table className="ev-table ev-table--clickable dl-table">
            <thead>
              <tr>
                <th scope="col">Numéro</th>
                <th scope="col">Client et travail</th>
                {!imprimeur && <th scope="col">Machine</th>}
                <th scope="col">Statut</th>
                {user.role !== 'livreur' && <th scope="col">Préparateur</th>}
                <th scope="col">Pour le</th>
                {montrerMontant && (
                  <>
                    <th scope="col" className="text-right">Montant</th>
                    <th scope="col">Paiement</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <Ligne key={d.id} d={d} imprimeur={imprimeur} montrerMontant={montrerMontant} montrerPrep={user.role !== 'livreur'} resume={resumeSpecs(d, libelle)} />
              ))}
            </tbody>
          </table>
          <div className="dl-foot">
            <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => maj({ page: String(p) }, true)} />
          </div>
        </div>
      )}
    </>
  );
}

function Ligne({ d, imprimeur, montrerMontant, montrerPrep, resume }: { d: DossierResume; imprimeur: boolean; montrerMontant: boolean; montrerPrep: boolean; resume: string }) {
  const navigate = useNavigate();
  const retard = enRetard(d);
  return (
    <tr onClick={() => navigate(`/dossiers/${d.id}`)}>
      <td className="dl-num">
        <Link className="ev-ref" to={`/dossiers/${d.id}`} onClick={(e) => e.stopPropagation()}>
          {d.numero}
        </Link>
      </td>
      <td className="dl-client">
        <span className="ev-cell-main row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <span className="truncate">{d.client_nom}</span>
          {d.urgent && <UrgentTag />}
        </span>
        <span className="ev-cell-sub" title={d.description ?? undefined}>
          {resume}
        </span>
      </td>
      {!imprimeur && (
        <td>
          <MachineChip machine={d.machine} />
        </td>
      )}
      <td>
        <StatusBadge statut={d.statut} />
      </td>
      {montrerPrep && <td className="nowrap">{d.preparateur_nom ?? '—'}</td>}
      <td className="nowrap">
        <span className="ev-ref dl-date" data-retard={retard} title={retard ? 'Date promise dépassée' : undefined}>
          {formatDate(d.date_promise)}
        </span>
      </td>
      {montrerMontant && (
        <>
          <td className="ev-cell-num">{d.montant === null || d.montant === undefined ? '—' : formatFCFA(d.montant)}</td>
          <td>{d.situation_paiement ? <PaymentBadge situation={d.situation_paiement} enAttente={d.en_attente_validation} /> : '—'}</td>
        </>
      )}
    </tr>
  );
}
