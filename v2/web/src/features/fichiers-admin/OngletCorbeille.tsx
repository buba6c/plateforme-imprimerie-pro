// Corbeille des fichiers (administrateur) : même grille que les fichiers, sélection, restauration
// et suppression définitive (mot de passe + mot SUPPRIMER).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArchiveRestore, Search, Trash2 } from 'lucide-react';
import { formatDateHeure, formatEntier, formatTaille } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Card, EmptyState, LoadingRows, Pagination, useToast } from '../../ui';
import { BarreSelection, BasculeVue, CarteFichier, CaseSelection, IconeType, PuceMachine, ToutSelectionner, useSelection, useVue } from './Cartes';
import { DialoguePurge } from './DialoguePurge';
import { useCorbeilleFichiers, useRafraichirFichiers } from './hooks';
import type { FichierSupprime, ResultatRestaurationGroupee } from './types';

const LIMIT = 48;

function Etiquettes({ f }: { f: FichierSupprime }) {
  return (
    <>
      {f.dossier_supprime && (
        <span className="fa-etiquette" data-ton="danger" title={f.dossier_deleted_at ? `Commande supprimée le ${formatDateHeure(f.dossier_deleted_at)}` : undefined}>
          Commande à la corbeille
        </span>
      )}
      {f.partage && (
        <span className="fa-etiquette" data-ton="info" title="Le même fichier est aussi rangé ailleurs (ancienne application ou sauvegardes).">
          Partagé
        </span>
      )}
      {!f.present && (
        <span className="fa-etiquette" data-ton="warning">
          Absent du disque
        </span>
      )}
    </>
  );
}

function LienCommande({ f }: { f: FichierSupprime }) {
  // Une commande à la corbeille ne s'ouvre pas : on renvoie vers la corbeille des commandes.
  return (
    <Link className="ev-link ev-ref" to={f.dossier_supprime ? '/admin/corbeille' : `/dossiers/${f.dossier_id}`} onClick={(e) => e.stopPropagation()}>
      {f.dossier_numero}
    </Link>
  );
}

export function OngletCorbeille() {
  const toast = useToast();
  const rafraichir = useRafraichirFichiers();
  const [saisie, setSaisie] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [vue, setVue] = useVue();
  const sel = useSelection<FichierSupprime>();
  const [purge, setPurge] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(saisie.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [saisie]);

  const liste = useCorbeilleFichiers({ q: q || undefined, page, limit: LIMIT });
  const items = liste.data?.items ?? [];
  const total = liste.data?.total ?? 0;

  const restaurer = useMutation({
    mutationFn: (ids: number[]) => api.post<ResultatRestaurationGroupee>('/gestion-fichiers/restaurer-groupe', { ids }),
    onSuccess: (r, ids) => {
      const ignores = new Set(r.ignores.map((i) => i.id));
      sel.retirer(ids.filter((id) => !ignores.has(id)));
      rafraichir();
      if (r.restaures) {
        toast.success(r.restaures > 1 ? `${r.restaures} fichiers restaurés` : 'Fichier restauré', 'Ils ont retrouvé leur place dans leur commande.');
      }
      if (r.ignores.length) {
        toast.error(
          r.ignores.length > 1 ? `${r.ignores.length} fichiers n’ont pas été restaurés` : 'Un fichier n’a pas été restauré',
          r.ignores
            .slice(0, 3)
            .map((i) => `${i.nom ? `« ${i.nom} » : ` : ''}${i.message}`)
            .join(' '),
        );
      }
    },
    onError: (e) => toast.error('Restauration impossible', messageErreur(e)),
  });

  const pagination = <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />;

  return (
    <div className="stack fa-onglet">
      <p className="ev-muted" style={{ margin: 0, maxWidth: '75ch' }}>
        Fichiers retirés de leur commande. Ils sont encore sur le serveur : vous pouvez les <strong>restaurer</strong>, ou les{' '}
        <strong>supprimer définitivement</strong> pour libérer de la place sur le disque.
      </p>
      <div className="fa-filtres" role="search" aria-label="Rechercher dans la corbeille des fichiers">
        <div className="ev-field ev-search" style={{ maxWidth: 420 }}>
          <Search aria-hidden="true" />
          <input
            className="ev-input"
            type="search"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder="Nom du fichier, numéro de commande ou client"
            aria-label="Rechercher un fichier dans la corbeille"
          />
        </div>
      </div>

      <div className="fa-outils">
        <span />
        <BasculeVue vue={vue} onChange={setVue} />
      </div>

      <BarreSelection nb={sel.nb} taille={sel.taille} onAnnuler={sel.vider}>
        <Button size="sm" icon={<ArchiveRestore />} busy={restaurer.isPending} onClick={() => restaurer.mutate(sel.liste.map((f) => f.id))}>
          Restaurer ({sel.nb})
        </Button>
        <Button size="sm" variant="danger" icon={<Trash2 />} onClick={() => setPurge(true)}>
          Supprimer définitivement ({sel.nb})
        </Button>
      </BarreSelection>

      {liste.isError ? (
        <Alert tone="error">La corbeille des fichiers n’a pas pu être chargée : {messageErreur(liste.error)}</Alert>
      ) : liste.isLoading ? (
        <LoadingRows rows={4} />
      ) : items.length === 0 ? (
        <Card>
          {q ? (
            <EmptyState title="Aucun fichier de la corbeille ne correspond" icon={<Search aria-hidden="true" />}>
              Modifiez la recherche.
            </EmptyState>
          ) : (
            <EmptyState title="La corbeille des fichiers est vide" icon={<Trash2 aria-hidden="true" />}>
              Les fichiers retirés d’une commande arrivent ici. Vous pourrez les restaurer ou les supprimer définitivement.
            </EmptyState>
          )}
        </Card>
      ) : (
        <>
          <div className="fa-entete-liste">
            <p className="fa-totaux">
              <strong className="ev-num">{formatEntier(total)}</strong> {total > 1 ? 'fichiers' : 'fichier'} dans la corbeille ·{' '}
              <strong className="ev-num">{formatTaille(liste.data?.taille_totale ?? 0)}</strong>
            </p>
            <ToutSelectionner items={items} sel={sel} />
          </div>
          <div className="fa-zone" style={{ opacity: liste.isPlaceholderData ? 0.6 : 1 }}>
            {vue === 'grille' ? (
              <div className="fa-grille">
                {items.map((f) => (
                  <CarteFichier
                    key={f.id}
                    f={f}
                    contenu={false}
                    selectionne={sel.a(f.id)}
                    onSelection={(v) => sel.basculer(f, v)}
                    meta={
                      <span className="fa-card__date">
                        Retiré le <span className="ev-ref">{formatDateHeure(f.deleted_at)}</span>
                        {f.deleted_by_nom ? ` par ${f.deleted_by_nom}` : ''}
                      </span>
                    }
                    badges={<Etiquettes f={f} />}
                  />
                ))}
              </div>
            ) : (
              <ul className="fa-liste" aria-label="Fichiers de la corbeille">
                {items.map((f) => (
                  <li key={f.id} className="fa-ligne" data-selected={sel.a(f.id)}>
                    <CaseSelection checked={sel.a(f.id)} onChange={(v) => sel.basculer(f, v)} label={`Sélectionner ${f.nom_original}`} />
                    <IconeType categorie={f.categorie} nom={f.nom_original} taille={32} />
                    <div className="fa-ligne__texte">
                      <span className="fa-ligne__nom" title={f.nom_original}>
                        {f.nom_original}
                      </span>
                      <span className="fa-ligne__meta">
                        <LienCommande f={f} />
                        <span>{f.client_nom}</span>
                        <span>
                          retiré le <span className="ev-ref">{formatDateHeure(f.deleted_at)}</span>
                          {f.deleted_by_nom ? ` par ${f.deleted_by_nom}` : ''}
                        </span>
                        <span className="fa-ligne__taille-etroit ev-num">{formatTaille(f.taille)}</span>
                      </span>
                    </div>
                    <span className="fa-ligne__badges">
                      <PuceMachine machine={f.machine} />
                      <Etiquettes f={f} />
                    </span>
                    <span className="fa-ligne__taille ev-num">{formatTaille(f.taille)}</span>
                    <span />
                  </li>
                ))}
              </ul>
            )}
            {pagination}
          </div>
        </>
      )}

      <DialoguePurge
        open={purge}
        fichiers={sel.liste}
        onClose={() => setPurge(false)}
        onTermine={(_r, ids) => {
          sel.retirer(ids);
          rafraichir();
        }}
      />
    </div>
  );
}
