// Liste transversale des fichiers : filtres (dans l'adresse de la page), totaux, tableau ou cartes,
// aperçu dans un panneau latéral.

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Eye, Files, Search, SlidersHorizontal } from 'lucide-react';
import { formatDateHeure, formatEntier, formatTaille, MACHINE_LABELS, MACHINES, STATUT_LABELS, STATUTS } from '@evocom/shared';
import { fichierUrl, messageErreur } from '../../lib/api';
import { Alert, Button, Card, EmptyState, IconButton, LoadingRows, MachineChip, Pagination, StatusBadge, UrgentTag } from '../../ui';
import { extension } from '../fichiers/ListeFichiers';
import { ApercuPanneau } from './ApercuPanneau';
import { useAuteurs, useFichiersGlobaux } from './hooks';
import type { FichierGlobal } from './types';

const LIMIT = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Images' },
  { value: 'autre', label: 'Autres formats' },
];

const TRIS = [
  { value: 'date_desc', label: 'Plus récents d’abord' },
  { value: 'date_asc', label: 'Plus anciens d’abord' },
  { value: 'nom_asc', label: 'Nom, de A à Z' },
  { value: 'nom_desc', label: 'Nom, de Z à A' },
  { value: 'taille_desc', label: 'Plus volumineux d’abord' },
  { value: 'taille_asc', label: 'Plus légers d’abord' },
];

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const choix = (v: string | null, permis: readonly string[]) => (v && permis.includes(v) ? v : '');

export function OngletFichiers() {
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
  const tri =
    choix(
      params.get('tri'),
      TRIS.map((t) => t.value),
    ) || 'date_desc';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [apercu, setApercu] = useState<FichierGlobal | null>(null);
  const [filtresOuverts, setFiltresOuverts] = useState(false);

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

  const total = liste.data?.total ?? 0;
  const pagination = <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => maj({ page: p > 1 ? String(p) : null })} />;

  return (
    <div className="stack">
      <div className="fa-filtres" role="search" aria-label="Filtrer les fichiers" data-ouvert={filtresOuverts}>
        <div className="ev-field ev-search" style={{ alignSelf: 'flex-end' }}>
          <Search aria-hidden="true" />
          <input
            className="ev-input"
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Fichier, numéro de dossier ou client"
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
          {filtresOuverts ? 'Masquer les filtres' : nbFiltres ? `Filtres (${nbFiltres})` : 'Filtres et tri'}
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
              Statut du dossier
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
          <div className="ev-field">
            <label className="ev-label" htmlFor="fa-tri">
              Trier
            </label>
            <select
              id="fa-tri"
              className="ev-select"
              value={tri}
              onChange={(e) =>
                maj({
                  tri: e.target.value === 'date_desc' ? null : e.target.value,
                })
              }
            >
              {TRIS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {filtre && (
          <Button size="sm" variant="ghost" onClick={effacer}>
            Effacer les filtres
          </Button>
        )}
      </div>

      {periodeInvalide ? (
        <Alert tone="warning">La date de début est postérieure à la date de fin : corrigez la période.</Alert>
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
              Les fichiers déposés sur les fiches des dossiers apparaissent ici, avec leur dossier, leur client et leur auteur.
            </EmptyState>
          )}
        </Card>
      ) : (
        <>
          <p className="fa-totaux" aria-live="polite">
            <strong className="ev-num">{formatEntier(total)}</strong> {total > 1 ? 'fichiers' : 'fichier'} ·{' '}
            <strong className="ev-num">{formatTaille(liste.data?.taille_totale ?? 0)}</strong> au total
            {filtre ? ' (filtre en cours)' : ''}
          </p>
          <div className="fa-layout" data-apercu={!!apercu}>
            <div className="stack" style={{ minWidth: 0 }}>
              <div className="ev-table-wrap fa-large" style={{ opacity: liste.isPlaceholderData ? 0.6 : 1 }}>
                <table className="ev-table ev-table--clickable">
                  <thead>
                    <tr>
                      <th scope="col">Fichier</th>
                      <th scope="col" className="fa-detail">
                        Dossier
                      </th>
                      <th scope="col" className="fa-detail">
                        Client
                      </th>
                      <th scope="col">Statut</th>
                      <th scope="col" style={{ textAlign: 'right' }}>
                        Taille
                      </th>
                      <th scope="col" className="fa-detail">
                        Envoi
                      </th>
                      <th scope="col" className="ev-cell-actions">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((f) => (
                      <LigneFichier key={f.id} f={f} actif={apercu?.id === f.id} onApercu={() => setApercu(f)} />
                    ))}
                  </tbody>
                </table>
                {pagination}
              </div>
              <div className="fa-etroit fa-cartes">
                {items.map((f) => (
                  <CarteFichier key={f.id} f={f} onApercu={() => setApercu(f)} />
                ))}
                {pagination}
              </div>
            </div>
            {apercu && <ApercuPanneau fichier={apercu} onClose={fermer} />}
          </div>
        </>
      )}
    </div>
  );
}

function NomFichier({ f, onApercu }: { f: FichierGlobal; onApercu: () => void }) {
  return (
    <div className="fa-nom">
      <span className="ev-file__type" aria-hidden="true">
        {extension(f.nom_original)}
      </span>
      <span className="fa-nom__texte">
        <button
          type="button"
          className="fa-nom__bouton"
          title={f.nom_original}
          onClick={(e) => {
            e.stopPropagation();
            onApercu();
          }}
        >
          {f.nom_original}
        </button>
        <span className="fa-sub fa-resume">
          <span className="ev-ref">{f.dossier_numero}</span> · {f.client_nom}
        </span>
        {f.a_reimprimer && <span className="fi-tag-reimp">À réimprimer</span>}
      </span>
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

function LigneFichier({ f, actif, onApercu }: { f: FichierGlobal; actif: boolean; onApercu: () => void }) {
  return (
    <tr aria-selected={actif || undefined} onClick={onApercu}>
      <td>
        <NomFichier f={f} onApercu={onApercu} />
      </td>
      <td className="nowrap fa-detail">
        <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`} onClick={(e) => e.stopPropagation()}>
            {f.dossier_numero}
          </Link>
          <MachineChip machine={f.machine} />
        </span>
      </td>
      <td className="fa-detail" style={{ minWidth: 160, maxWidth: 240 }}>
        <span className="ev-cell-main">{f.client_nom}</span>
        {f.urgent && (
          <span className="fa-sub">
            <UrgentTag />
          </span>
        )}
      </td>
      <td>
        <StatusBadge statut={f.dossier_statut} />
      </td>
      <td className="ev-cell-num">{formatTaille(f.taille)}</td>
      <td className="nowrap fa-detail">
        <span className="ev-ref">{formatDateHeure(f.created_at)}</span>
        <span className="fa-sub">par {f.uploaded_by_nom ?? (f.importe ? 'l’ancienne plateforme' : '—')}</span>
      </td>
      <td className="ev-cell-actions">
        <div className="fa-actions">
          <IconButton
            size="sm"
            label={`Aperçu de ${f.nom_original}`}
            onClick={(e) => {
              e.stopPropagation();
              onApercu();
            }}
          >
            <Eye />
          </IconButton>
          <Telecharger f={f} />
        </div>
      </td>
    </tr>
  );
}

function CarteFichier({ f, onApercu }: { f: FichierGlobal; onApercu: () => void }) {
  return (
    <article className="ev-card fa-carte">
      <div className="fa-carte__tete">
        <span className="ev-file__type" aria-hidden="true">
          {extension(f.nom_original)}
        </span>
        <span className="fa-nom__texte">
          <button type="button" className="fa-nom__bouton" onClick={onApercu}>
            {f.nom_original}
          </button>
          <span className="fa-sub">
            <span className="ev-num">{formatTaille(f.taille)}</span> · <span className="ev-ref">{formatDateHeure(f.created_at)}</span>
          </span>
        </span>
        <div className="fa-actions">
          <IconButton size="sm" label={`Aperçu de ${f.nom_original}`} onClick={onApercu}>
            <Eye />
          </IconButton>
          <Telecharger f={f} />
        </div>
      </div>
      <div className="fa-carte__ligne">
        <Link className="ev-link ev-ref" to={`/dossiers/${f.dossier_id}`}>
          {f.dossier_numero}
        </Link>
        <MachineChip machine={f.machine} />
        <StatusBadge statut={f.dossier_statut} />
        {f.urgent && <UrgentTag />}
        {f.a_reimprimer && <span className="fi-tag-reimp">À réimprimer</span>}
      </div>
      <div className="fa-carte__ligne">
        <span style={{ color: 'var(--text)' }}>{f.client_nom}</span>
        <span>· envoyé par {f.uploaded_by_nom ?? (f.importe ? 'l’ancienne plateforme' : '—')}</span>
      </div>
    </article>
  );
}
