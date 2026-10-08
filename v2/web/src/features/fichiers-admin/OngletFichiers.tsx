// Fichiers d'impression : grille de cartes (ou liste), tri très visible, filtres dans l'adresse de la page,
// sélection multiple avec barre d'actions, aperçu dans un panneau latéral.

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Download, Files, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { formatDateHeure, formatEntier, formatTaille, MACHINE_LABELS, MACHINES, STATUT_LABELS, STATUTS } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { api, fichierUrl, messageErreur } from '../../lib/api';
import { Alert, Button, Card, ConfirmDialog, EmptyState, LoadingRows, Pagination, StatusBadge, UrgentTag, useToast } from '../../ui';
import { ApercuPanneau } from './ApercuPanneau';
import {
  BarreSelection,
  BasculeVue,
  CarteFichier,
  CaseSelection,
  IconeType,
  PuceMachine,
  telechargerUnParUn,
  ToutSelectionner,
  Tris,
  useSelection,
  useVue,
} from './Cartes';
import { useAuteurs, useFichiersGlobaux, useRafraichirFichiers } from './hooks';
import type { FichierGlobal, ResultatCorbeilleGroupee } from './types';

const LIMIT = 48;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Images' },
  { value: 'autre', label: 'Autres formats' },
];

const TRIS = [
  { value: 'taille_desc', label: 'Plus lourds' },
  { value: 'taille_asc', label: 'Plus légers' },
  { value: 'date_desc', label: 'Plus récents' },
  { value: 'date_asc', label: 'Plus anciens' },
  { value: 'nom_asc', label: 'Nom' },
];
/** Aussi accepté dans l'adresse (lien partagé), sans bouton dédié. */
const TRIS_ADRESSE = [...TRIS.map((t) => t.value), 'nom_desc'];

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const choix = (v: string | null, permis: readonly string[]) => (v && permis.includes(v) ? v : '');
const envoyePar = (f: FichierGlobal) => f.uploaded_by_nom ?? (f.importe ? 'l’ancienne plateforme' : '—');

export function OngletFichiers() {
  const admin = useUser().role === 'admin';
  const toast = useToast();
  const rafraichir = useRafraichirFichiers();
  const [params, setParams] = useSearchParams();
  const [saisie, setSaisie] = useState(params.get('q') ?? '');
  const q = useDebounced(saisie.trim(), 300);
  const type = choix(
    params.get('type'),
    TYPES.map((t) => t.value),
  );
  const machine = choix(params.get('machine'), MACHINES);
  const statut = choix(params.get('statut'), STATUTS);
  const auteur = /^\d+$/.test(params.get('auteur') ?? '') ? params.get('auteur')! : '';
  const from = DATE.test(params.get('from') ?? '') ? params.get('from')! : '';
  const to = DATE.test(params.get('to') ?? '') ? params.get('to')! : '';
  const tri = choix(params.get('tri'), TRIS_ADRESSE) || 'date_desc';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [apercu, setApercu] = useState<FichierGlobal | null>(null);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [vue, setVue] = useVue();
  const sel = useSelection<FichierGlobal>();
  const [confirmer, setConfirmer] = useState(false);
  const [telechargement, setTelechargement] = useState(false);

  const maj = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    if ((params.get('q') ?? '') !== q) maj({ q: q || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const periodeInvalide = !!from && !!to && from > to;
  const [triCle, ordre] = tri.split('_') as [string, string];
  const liste = useFichiersGlobaux(
    {
      q: q || undefined,
      type: type || undefined,
      machine: machine || undefined,
      statut: statut || undefined,
      uploaded_by: auteur || undefined,
      from: from || undefined,
      to: to || undefined,
      tri: triCle,
      ordre,
      page,
      limit: LIMIT,
    },
    { enabled: !periodeInvalide },
  );
  const auteurs = useAuteurs();
  const items = liste.data?.items ?? [];
  const filtre = !!(q || type || machine || statut || auteur || from || to);
  const nbFiltres = [type, machine, statut, auteur, from || to].filter(Boolean).length;
  const fermer = useCallback(() => setApercu(null), []);

  // L'aperçu suit la liste : un fichier qui disparaît des résultats (supprimé, filtré) le ferme.
  useEffect(() => {
    if (apercu && liste.data && !liste.isPlaceholderData) {
      const frais = liste.data.items.find((f) => f.id === apercu.id);
      if (!frais) setApercu(null);
      else if (frais !== apercu) setApercu(frais);
    }
  }, [liste.data, liste.isPlaceholderData, apercu]);

  const effacer = () => {
    setSaisie('');
    setParams(
      (prev) => {
        const next = new URLSearchParams();
        const onglet = prev.get('onglet');
        if (onglet) next.set('onglet', onglet);
        return next;
      },
      { replace: true },
    );
  };

  const corbeille = useMutation({
    mutationFn: (ids: number[]) => api.post<ResultatCorbeilleGroupee>('/gestion-fichiers/corbeille-groupee', { ids }),
    onSuccess: (r, ids) => {
      setConfirmer(false);
      sel.retirer(ids);
      rafraichir();
      toast.success(
        r.mis_a_la_corbeille > 1 ? `${r.mis_a_la_corbeille} fichiers mis à la corbeille` : 'Fichier mis à la corbeille',
        `${formatTaille(r.taille)} au total. Vous pouvez les restaurer depuis l’onglet Corbeille.`,
      );
    },
    onError: (e) => toast.error('Mise à la corbeille impossible', messageErreur(e)),
  });

  const telecharger = async () => {
    setTelechargement(true);
    try {
      await telechargerUnParUn(sel.liste);
    } finally {
      setTelechargement(false);
    }
  };

  const total = liste.data?.total ?? 0;
  const pagination = <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => maj({ page: p > 1 ? String(p) : null })} />;

  return (
    <div className="stack fa-onglet">
      <div className="fa-filtres" role="search" aria-label="Filtrer les fichiers" data-ouvert={filtresOuverts}>
        <div className="ev-field ev-search" style={{ alignSelf: 'flex-end' }}>
          <Search aria-hidden="true" />
          <input
            className="ev-input"
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom du fichier, numéro de commande ou client"
            aria-label="Rechercher un fichier"
          />
        </div>
        <Button
          size="sm"
          className="fa-filtres__bascule"
          icon={<SlidersHorizontal />}
          aria-expanded={filtresOuverts}
          aria-controls="fa-filtres-plus"
          onClick={() => setFiltresOuverts((o) => !o)}
        >
          {filtresOuverts ? 'Masquer les filtres' : nbFiltres ? `Filtres (${nbFiltres})` : 'Filtres'}
        </Button>
        <div className="fa-filtres__plus" id="fa-filtres-plus">
          <div className="ev-field">
            <label className="ev-label" htmlFor="fa-type">
              Type
            </label>
            <select id="fa-type" className="ev-select" value={type} onChange={(e) => maj({ type: e.target.value || null })}>
              <option value="">Tous les types</option>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ev-field">
            <label className="ev-label" htmlFor="fa-machine">
              Machine
            </label>
            <select id="fa-machine" className="ev-select" value={machine} onChange={(e) => maj({ machine: e.target.value || null })}>
              <option value="">Toutes</option>
              {MACHINES.map((m) => (
                <option key={m} value={m}>
                  {MACHINE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="ev-field">
            <label className="ev-label" htmlFor="fa-statut">
              Statut de la commande
            </label>
            <select id="fa-statut" className="ev-select" value={statut} onChange={(e) => maj({ statut: e.target.value || null })}>
              <option value="">Tous</option>
              {STATUTS.map((s) => (
                <option key={s} value={s}>
                  {STATUT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="ev-field">
            <label className="ev-label" htmlFor="fa-auteur">
              Envoyé par
            </label>
            <select id="fa-auteur" className="ev-select" value={auteur} onChange={(e) => maj({ auteur: e.target.value || null })}>
              <option value="">Tout le monde</option>
              {(auteurs.data ?? []).map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.nom} ({u.nb})
                </option>
              ))}
            </select>
          </div>
          <div className="ev-field">
            <label className="ev-label" htmlFor="fa-from">
              Envoyés du
            </label>
            <input id="fa-from" className="ev-input" type="date" value={from} max={to || undefined} onChange={(e) => maj({ from: e.target.value || null })} />
          </div>
          <div className="ev-field">
            <label className="ev-label" htmlFor="fa-to">
              au
            </label>
            <input
              id="fa-to"
              className="ev-input"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => maj({ to: e.target.value || null })}
              aria-invalid={periodeInvalide || undefined}
            />
          </div>
        </div>
        {filtre && (
          <Button size="sm" variant="ghost" onClick={effacer}>
            Effacer les filtres
          </Button>
        )}
      </div>

      <div className="fa-outils">
        <Tris valeur={tri} options={TRIS} onChange={(v) => maj({ tri: v === 'date_desc' ? null : v })} />
        <BasculeVue vue={vue} onChange={setVue} />
      </div>

      <BarreSelection nb={sel.nb} taille={sel.taille} onAnnuler={sel.vider}>
        <Button size="sm" icon={<Download />} busy={telechargement} onClick={() => void telecharger()}>
          Télécharger
        </Button>
        {admin && (
          <Button size="sm" variant="danger" icon={<Trash2 />} onClick={() => setConfirmer(true)}>
            Mettre à la corbeille ({sel.nb})
          </Button>
        )}
      </BarreSelection>

      {periodeInvalide ? (
        <Alert tone="warning">La date de début est après la date de fin : corrigez la période.</Alert>
      ) : liste.isError ? (
        <Alert tone="error">
          La liste des fichiers n’a pas pu être chargée : {messageErreur(liste.error)}{' '}
          <Button size="sm" variant="ghost" onClick={() => void liste.refetch()}>
            Réessayer
          </Button>
        </Alert>
      ) : liste.isLoading ? (
        <LoadingRows rows={6} />
      ) : items.length === 0 ? (
        <Card>
          {filtre ? (
            <EmptyState
              title="Aucun fichier ne correspond"
              icon={<Search aria-hidden="true" />}
              action={
                <Button size="sm" onClick={effacer}>
                  Effacer les filtres
                </Button>
              }
            >
              Élargissez la période ou modifiez la recherche et les filtres.
            </EmptyState>
          ) : (
            <EmptyState title="Aucun fichier pour l’instant" icon={<Files aria-hidden="true" />}>
              Les fichiers déposés sur les commandes apparaissent ici, avec leur commande, leur client et la personne qui les a envoyés.
            </EmptyState>
          )}
        </Card>
      ) : (
        <>
          <div className="fa-entete-liste">
            <p className="fa-totaux" aria-live="polite">
              <strong className="ev-num">{formatEntier(total)}</strong> {total > 1 ? 'fichiers' : 'fichier'} ·{' '}
              <strong className="ev-num">{formatTaille(liste.data?.taille_totale ?? 0)}</strong> au total
              {filtre ? ' (filtre en cours)' : ''}
            </p>
            <ToutSelectionner items={items} sel={sel} />
          </div>
          <div className="fa-layout" data-apercu={!!apercu}>
            <div className="fa-zone" style={{ opacity: liste.isPlaceholderData ? 0.6 : 1 }}>
              {vue === 'grille' ? (
                <div className="fa-grille">
                  {items.map((f) => (
                    <CarteFichier
                      key={f.id}
                      f={f}
                      actif={apercu?.id === f.id}
                      selectionne={sel.a(f.id)}
                      onSelection={(v) => sel.basculer(f, v)}
                      onOuvrir={() => setApercu(f)}
                      meta={<span className="fa-card__date ev-ref">{formatDateHeure(f.created_at)}</span>}
                      badges={f.urgent ? <UrgentTag /> : f.a_reimprimer ? <span className="fi-tag-reimp">À réimprimer</span> : null}
                      pied={<Telecharger f={f} />}
                    />
                  ))}
                </div>
              ) : (
                <ul className="fa-liste" aria-label="Fichiers">
                  {items.map((f) => (
                    <LigneFichier key={f.id} f={f} actif={apercu?.id === f.id} selectionne={sel.a(f.id)} onSelection={(v) => sel.basculer(f, v)} onApercu={() => setApercu(f)} />
                  ))}
                </ul>
              )}
              {pagination}
            </div>
            {apercu && <ApercuPanneau fichier={apercu} onClose={fermer} />}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmer}
        onClose={() => setConfirmer(false)}
        onConfirm={() => corbeille.mutate(sel.liste.map((f) => f.id))}
        busy={corbeille.isPending}
        danger
        title={sel.nb > 1 ? `Mettre ${sel.nb} fichiers à la corbeille ?` : 'Mettre ce fichier à la corbeille ?'}
        confirmLabel={`Mettre à la corbeille (${sel.nb})`}
        description={
          <>
            {formatTaille(sel.taille)} au total. Les fichiers sont retirés de leur commande, même si elle est déjà validée ou livrée. Ils restent sur le
            serveur : vous pourrez les restaurer depuis l’onglet Corbeille, ou les supprimer définitivement pour libérer de la place.
          </>
        }
      />
    </div>
  );
}

function Telecharger({ f }: { f: FichierGlobal }) {
  return (
    <a
      className="ev-icon-btn ev-icon-btn--sm"
      href={fichierUrl(f.id, true)}
      download
      aria-label={`Télécharger ${f.nom_original}`}
      title="Télécharger"
      onClick={(e) => e.stopPropagation()}
    >
      <Download />
    </a>
  );
}

function LigneFichier({
  f,
  actif,
  selectionne,
  onSelection,
  onApercu,
}: {
  f: FichierGlobal;
  actif: boolean;
  selectionne: boolean;
  onSelection: (v: boolean) => void;
  onApercu: () => void;
}) {
  return (
    <li className="fa-ligne" data-selected={selectionne} data-actif={actif || undefined}>
      <CaseSelection checked={selectionne} onChange={onSelection} label={`Sélectionner ${f.nom_original}`} />
      <IconeType categorie={f.categorie} nom={f.nom_original} taille={32} />
      <div className="fa-ligne__texte">
        <button type="button" className="fa-ligne__nom" title={f.nom_original} onClick={onApercu}>
          {f.nom_original}
        </button>
        <span className="fa-ligne__meta">
          <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`}>
            {f.dossier_numero}
          </Link>
          <span>{f.client_nom}</span>
          <span className="ev-ref">{formatDateHeure(f.created_at)}</span>
          <span>par {envoyePar(f)}</span>
          <span className="fa-ligne__taille-etroit ev-num">{formatTaille(f.taille)}</span>
        </span>
      </div>
      <span className="fa-ligne__badges">
        <PuceMachine machine={f.machine} />
        <StatusBadge statut={f.dossier_statut} />
        {f.urgent && <UrgentTag />}
      </span>
      <span className="fa-ligne__taille ev-num">{formatTaille(f.taille)}</span>
      <Telecharger f={f} />
    </li>
  );
}
