import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Pencil, Plus, Tags, Undo2 } from 'lucide-react';
import {
  CATEGORIE_TARIF_LABELS,
  CATEGORIES_TARIF,
  formatEntier,
  MACHINE_LABELS,
  parseMontant,
  UNITE_TARIF_LABELS,
  UNITES_TARIF,
  type CategorieTarif,
  type Machine,
  type UniteTarif,
} from '@evocom/shared';
import { api, ApiError, messageErreur } from '../../lib/api';
import type { Tarif } from '../../lib/types';
import {
  Alert,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  IconButton,
  LoadingRows,
  PageHeader,
  SelectField,
  Tabs,
  TextareaField,
  TextField,
  useToast,
} from '../../ui';
import { champsErreur, estIndisponible, useParametres, useTarifs } from '../../features/admin/hooks';
import { Simulateur } from '../../features/admin/Simulateur';
import '../../features/admin/admin.css';

type Groupe = Machine | 'global';
const GROUPES: { value: Groupe; label: string }[] = [
  { value: 'roland', label: MACHINE_LABELS.roland },
  { value: 'xerox', label: MACHINE_LABELS.xerox },
  { value: 'global', label: 'Commun' },
];

const UNITE_OPTIONS = UNITES_TARIF.map((u) => ({ value: u, label: UNITE_TARIF_LABELS[u] }));
const CATEGORIE_OPTIONS = CATEGORIES_TARIF.map((c) => ({ value: c, label: CATEGORIE_TARIF_LABELS[c] }));

function libelleUnite(u: string): string {
  return UNITE_TARIF_LABELS[u as UniteTarif] ?? u;
}

/** Tarif de reliure compté une seule fois par ligne quel que soit le nombre d'exemplaires. */
function reliureAuForfait(t: Tarif): boolean {
  return t.unite === 'forfait' && /reliure/i.test(`${t.code} ${t.libelle}`);
}

function invalider(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['tarifs'] });
}

export default function Tarifs() {
  const tarifs = useTarifs();
  const parametres = useParametres();
  const [groupe, setGroupe] = useState<Groupe>('roland');
  const [seulementManquants, setSeulementManquants] = useState(false);
  const [brouillons, setBrouillons] = useState<Record<number, string>>({});
  const [ajout, setAjout] = useState(false);
  const [edition, setEdition] = useState<Tarif | null>(null);
  const [passerExemplaire, setPasserExemplaire] = useState<Tarif | null>(null);

  const tous = tarifs.data ?? [];
  const manquants = tous.filter((t) => t.actif && t.prix === null);

  // Grille utilisée par le simulateur : prix saisis non enregistrés compris, s'ils sont valides.
  const grilleSimulee = useMemo(
    () =>
      tous.map((t) => {
        const b = brouillons[t.id];
        if (b === undefined) return t;
        const v = parseMontant(b);
        return v === null ? t : { ...t, prix: v };
      }),
    [tous, brouillons],
  );
  const nbBrouillons = Object.entries(brouillons).filter(([id, v]) => {
    const t = tous.find((x) => x.id === Number(id));
    const n = parseMontant(v);
    return t && n !== null && n !== t.prix;
  }).length;

  const duGroupe = tous.filter((t) => t.machine === groupe && (!seulementManquants || (t.actif && t.prix === null)));
  const tabs = GROUPES.map((g) => ({ ...g, count: tous.filter((t) => t.machine === g.value).length }));

  return (
    <>
      <PageHeader
        title="Tarifs"
        subtitle="Grille utilisée pour chiffrer les devis et les dossiers. Un prix modifié s’applique aux prochains calculs."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setAjout(true)}>
            Ajouter un tarif
          </Button>
        }
      />

      {manquants.length > 0 && (
        <Alert tone="warning">
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <span>
              <strong>
                {manquants.length} {manquants.length > 1 ? 'tarifs actifs sans prix' : 'tarif actif sans prix'}.
              </strong>{' '}
              Un devis ou un dossier qui les utilise ne peut pas être chiffré tant que le prix n’est pas défini.
            </span>
            <Button size="sm" onClick={() => setSeulementManquants((v) => !v)}>
              {seulementManquants ? 'Afficher toute la grille' : 'Afficher les prix à définir'}
            </Button>
          </div>
        </Alert>
      )}

      {tarifs.isError ? (
        <Alert tone="error">La grille tarifaire n’a pas pu être chargée : {messageErreur(tarifs.error)}</Alert>
      ) : (
        <div className="grid-main">
          <div className="stack-lg">
            <Tabs
              label="Machine"
              tabs={tabs}
              value={groupe}
              onChange={(g) => {
                setGroupe(g);
              }}
            />
            {tarifs.isLoading ? (
              <LoadingRows rows={8} />
            ) : duGroupe.length === 0 ? (
              <div className="ev-card">
                <EmptyState title={seulementManquants ? 'Tous les prix sont définis ici' : 'Aucun tarif'} icon={<Tags aria-hidden="true" />}>
                  {seulementManquants ? 'Choisissez un autre onglet ou affichez toute la grille.' : 'Ajoutez un tarif avec « Ajouter un tarif ».'}
                </EmptyState>
              </div>
            ) : (
              CATEGORIES_TARIF.map((cat) => {
                const lignes = duGroupe.filter((t) => t.categorie === cat).sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, 'fr'));
                if (!lignes.length) return null;
                return (
                  <section key={cat} className="stack-sm">
                    <h2 className="section-title">{CATEGORIE_TARIF_LABELS[cat]}</h2>
                    <div className="ev-table-wrap">
                      <table className="ev-table adm-dense adm-tarifs-table">
                        <colgroup>
                          <col />
                          <col style={{ width: 190 }} />
                          <col style={{ width: 140 }} />
                          <col style={{ width: 200 }} />
                          <col style={{ width: 64 }} />
                          <col style={{ width: 56 }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Libellé</th>
                            <th>Code</th>
                            <th>Unité</th>
                            <th className="adm-num-th">Prix (FCFA)</th>
                            <th>Actif</th>
                            <th className="ev-cell-actions">
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {lignes.map((t) => (
                            <LigneTarif
                              key={t.id}
                              t={t}
                              brouillon={brouillons[t.id]}
                              setBrouillon={(v) =>
                                setBrouillons((b) => {
                                  const n = { ...b };
                                  if (v === undefined) delete n[t.id];
                                  else n[t.id] = v;
                                  return n;
                                })
                              }
                              onModifier={() => setEdition(t)}
                              onPasserExemplaire={() => setPasserExemplaire(t)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })
            )}
          </div>
          {tarifs.data && (
            <Simulateur
              tarifs={grilleSimulee}
              params={parametres.data?.prix}
              paramsIndisponibles={parametres.isError}
              brouillons={nbBrouillons}
              machineInitiale={groupe === 'global' ? 'roland' : groupe}
            />
          )}
        </div>
      )}

      <AjoutDialog open={ajout} groupe={groupe} onClose={() => setAjout(false)} />
      <EditionDialog tarif={edition} onClose={() => setEdition(null)} />
      <PasserExemplaireDialog tarif={passerExemplaire} onClose={() => setPasserExemplaire(null)} />
    </>
  );
}

function LigneTarif({
  t,
  brouillon,
  setBrouillon,
  onModifier,
  onPasserExemplaire,
}: {
  t: Tarif;
  brouillon: string | undefined;
  setBrouillon: (v: string | undefined) => void;
  onModifier: () => void;
  onPasserExemplaire: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const valeur = brouillon ?? (t.prix === null ? '' : formatEntier(t.prix));
  const saisi = brouillon === undefined ? t.prix : parseMontant(brouillon);
  const invalide = brouillon !== undefined && brouillon.trim() !== '' && saisi === null;
  const modifie = brouillon !== undefined && saisi !== null && saisi !== t.prix;

  const prix = useMutation({
    mutationFn: (v: number) => api.patch<Tarif>(`/tarifs/${t.id}`, { prix: v }),
    onSuccess: (r) => {
      setBrouillon(undefined);
      invalider(qc);
      toast.success('Prix enregistré', `${r.libelle} : ${formatEntier(r.prix ?? 0)} ${r.unite === 'pourcent' ? '%' : 'FCFA'} ${libelleUnite(r.unite)}.`);
    },
    onError: (e) => toast.error(`Le prix de « ${t.libelle} » n’a pas été enregistré`, messageErreur(e)),
  });
  const actif = useMutation({
    mutationFn: (v: boolean) => api.patch<Tarif>(`/tarifs/${t.id}`, { actif: v }),
    onSuccess: (r) => {
      invalider(qc);
      toast.success(r.actif ? 'Tarif activé' : 'Tarif désactivé', r.actif ? `${r.libelle} est de nouveau proposé.` : `${r.libelle} n’est plus proposé dans les devis et les dossiers.`);
    },
    onError: (e) => toast.error(`« ${t.libelle} » n’a pas été modifié`, messageErreur(e)),
  });

  const enregistrer = () => {
    if (modifie && saisi !== null) prix.mutate(saisi);
  };
  const classe = [t.actif && t.prix === null && 'adm-tarif-missing', !t.actif && 'adm-tarif-inactive'].filter(Boolean).join(' ') || undefined;

  return (
    <tr className={classe}>
      <td>
        <div className="row" style={{ gap: 6 }}>
          <span className="ev-cell-main">{t.libelle}</span>
          {t.actif && t.prix === null && <span className="adm-tag-missing">Prix à définir</span>}
        </div>
        {t.description && <span className="adm-sub">{t.description}</span>}
        {reliureAuForfait(t) && (
          <div className="adm-note">
            <AlertTriangle aria-hidden="true" />
            <span>
              Facturée une seule fois par ligne, quel que soit le nombre d’exemplaires.{' '}
              <button type="button" className="ev-link adm-linkbtn" onClick={onPasserExemplaire}>
                Facturer par exemplaire
              </button>
            </span>
          </div>
        )}
      </td>
      <td>
        <span className="ev-ref">{t.code}</span>
      </td>
      <td className="nowrap">{libelleUnite(t.unite)}</td>
      <td className="ev-cell-num">
        <form
          className="adm-price"
          onSubmit={(e) => {
            e.preventDefault();
            enregistrer();
          }}
        >
          <input
            className="ev-input"
            inputMode="numeric"
            aria-label={`Prix de ${t.libelle} en ${t.unite === 'pourcent' ? 'pourcentage' : 'FCFA'}`}
            aria-invalid={invalide || undefined}
            placeholder="À définir"
            value={valeur}
            onChange={(e) => setBrouillon(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setBrouillon(undefined);
            }}
          />
          <span className="adm-price__unit" aria-hidden="true">
            {t.unite === 'pourcent' ? '%' : ''}
          </span>
          <span className="adm-price__actions">
            {modifie ? (
              <>
                <IconButton size="sm" label={`Enregistrer le prix de ${t.libelle}`} type="submit" disabled={prix.isPending} className="adm-save">
                  <Check />
                </IconButton>
                <IconButton size="sm" label="Annuler la saisie" onClick={() => setBrouillon(undefined)} disabled={prix.isPending}>
                  <Undo2 />
                </IconButton>
              </>
            ) : null}
          </span>
        </form>
        {invalide && <span className="ev-error" style={{ display: 'block', fontFamily: 'var(--font-sans)' }}>Nombre entier attendu</span>}
      </td>
      <td>
        <Checkbox label={<span className="sr-only">Actif : {t.libelle}</span>} checked={t.actif} disabled={actif.isPending} onChange={(v) => actif.mutate(v)} />
      </td>
      <td className="ev-cell-actions">
        <IconButton size="sm" label={`Modifier ${t.libelle}`} onClick={onModifier}>
          <Pencil />
        </IconButton>
      </td>
    </tr>
  );
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function initAjout(groupe: Groupe) {
  return {
    machine: groupe,
    categorie: (groupe === 'global' ? 'divers' : 'support') as CategorieTarif,
    code: '',
    codeTouche: false,
    libelle: '',
    unite: (groupe === 'roland' ? 'm2' : groupe === 'xerox' ? 'page' : 'forfait') as UniteTarif,
    prix: '',
    description: '',
  };
}

function AjoutDialog({ open, groupe, onClose }: { open: boolean; groupe: Groupe; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState(() => initAjout(groupe));
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setF(initAjout(groupe));
      setErreurs({});
      setErreur(null);
    }
  }, [open, groupe]);
  const code = f.codeTouche ? f.code : slug(f.libelle);
  const m = useMutation({
    mutationFn: () =>
      api.post<Tarif>('/tarifs', {
        machine: f.machine,
        categorie: f.categorie,
        code,
        libelle: f.libelle.trim(),
        unite: f.unite,
        prix: f.prix.trim() === '' ? null : parseMontant(f.prix),
        actif: true,
        description: f.description.trim() || null,
      }),
    onSuccess: (t) => {
      invalider(qc);
      toast.success('Tarif ajouté', t.prix === null ? `${t.libelle} : prix à définir avant de pouvoir chiffrer.` : `${t.libelle} est disponible pour les devis.`);
      onClose();
    },
    onError: (e) => {
      const c = champsErreur(e);
      if (e instanceof ApiError && e.status === 409) c.code = e.message;
      setErreurs(c);
      setErreur(Object.keys(c).length ? null : messageErreur(e));
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (f.libelle.trim().length < 2) local.libelle = 'Indiquez un libellé (2 caractères au moins).';
    if (!/^[a-z0-9_]{2,64}$/.test(code)) local.code = 'Lettres minuscules sans accent, chiffres et _ uniquement (2 à 64).';
    if (f.prix.trim() !== '' && parseMontant(f.prix) === null) local.prix = 'Nombre entier attendu, ou laissez vide.';
    setErreurs(local);
    if (!Object.keys(local).length) m.mutate();
  };
  return (
    <Dialog
      open={open}
      onClose={() => !m.isPending && onClose()}
      title="Ajouter un tarif"
      width={560}
      footer={
        <>
          <Button onClick={onClose} disabled={m.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="form-ajout-tarif" busy={m.isPending}>
            Ajouter le tarif
          </Button>
        </>
      }
    >
      <form id="form-ajout-tarif" className="stack" onSubmit={submit} noValidate>
        {erreur && <Alert tone="error">{erreur}</Alert>}
        <div className="ev-form-grid">
          <SelectField label="Machine" required value={f.machine} onChange={(e) => setF({ ...f, machine: e.target.value as Groupe })} options={GROUPES} error={erreurs.machine} />
          <SelectField label="Catégorie" required value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value as CategorieTarif })} options={CATEGORIE_OPTIONS} error={erreurs.categorie} />
        </div>
        <TextField label="Libellé" required data-autofocus value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} error={erreurs.libelle} placeholder="Vinyle adhésif mat" />
        <TextField
          label="Code"
          required
          mono
          value={code}
          onChange={(e) => setF({ ...f, code: e.target.value, codeTouche: true })}
          error={erreurs.code}
          help="Identifiant utilisé dans les dossiers : minuscules, chiffres et _. Il ne peut plus être changé ensuite."
        />
        <div className="ev-form-grid">
          <SelectField label="Unité" required value={f.unite} onChange={(e) => setF({ ...f, unite: e.target.value as UniteTarif })} options={UNITE_OPTIONS} error={erreurs.unite} />
          <TextField
            label="Prix"
            inputMode="numeric"
            mono
            value={f.prix}
            onChange={(e) => setF({ ...f, prix: e.target.value })}
            addon={f.unite === 'pourcent' ? '%' : 'FCFA'}
            error={erreurs.prix}
            help="Laissez vide si le prix n’est pas encore connu."
          />
        </div>
        <TextareaField label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} error={erreurs.description} rows={2} />
      </form>
    </Dialog>
  );
}

function EditionDialog({ tarif, onClose }: { tarif: Tarif | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ libelle: '', categorie: 'support' as CategorieTarif, unite: 'forfait' as UniteTarif, description: '' });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (tarif) {
      setF({ libelle: tarif.libelle, categorie: tarif.categorie, unite: tarif.unite as UniteTarif, description: tarif.description ?? '' });
      setErreurs({});
      setErreur(null);
    }
  }, [tarif]);
  const changes: Record<string, unknown> = {};
  if (tarif) {
    if (f.libelle.trim() !== tarif.libelle) changes.libelle = f.libelle.trim();
    if (f.categorie !== tarif.categorie) changes.categorie = f.categorie;
    if (f.unite !== tarif.unite) changes.unite = f.unite;
    if ((f.description.trim() || null) !== (tarif.description ?? null)) changes.description = f.description.trim() || null;
  }
  const m = useMutation({
    mutationFn: () => api.patch<Tarif>(`/tarifs/${tarif!.id}`, changes),
    onSuccess: (t) => {
      invalider(qc);
      toast.success('Tarif modifié', t.libelle);
      onClose();
    },
    onError: (e) => {
      const c = champsErreur(e);
      setErreurs(c);
      setErreur(Object.keys(c).length ? null : messageErreur(e));
    },
  });
  return (
    <Dialog
      open={!!tarif}
      onClose={() => !m.isPending && onClose()}
      title="Modifier le tarif"
      description={tarif ? `${tarif.machine === 'global' ? 'Commun' : MACHINE_LABELS[tarif.machine]} · code ${tarif.code} (non modifiable)` : undefined}
      footer={
        <>
          <Button onClick={onClose} disabled={m.isPending}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="form-edition-tarif" busy={m.isPending} disabled={!Object.keys(changes).length}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        id="form-edition-tarif"
        className="stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (f.libelle.trim().length < 2) return setErreurs({ libelle: 'Indiquez un libellé (2 caractères au moins).' });
          m.mutate();
        }}
      >
        {erreur && <Alert tone="error">{erreur}</Alert>}
        <TextField label="Libellé" required value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} error={erreurs.libelle} />
        <div className="ev-form-grid">
          <SelectField label="Catégorie" value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value as CategorieTarif })} options={CATEGORIE_OPTIONS} error={erreurs.categorie} />
          <SelectField label="Unité" value={f.unite} onChange={(e) => setF({ ...f, unite: e.target.value as UniteTarif })} options={UNITE_OPTIONS} error={erreurs.unite} />
        </div>
        {'unite' in changes && (
          <Alert tone="warning">Changer l’unité modifie la façon dont ce tarif est compté dans les prochains devis et dossiers. Vérifiez avec le simulateur.</Alert>
        )}
        <TextareaField label="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} error={erreurs.description} rows={2} />
      </form>
    </Dialog>
  );
}

function PasserExemplaireDialog({ tarif, onClose }: { tarif: Tarif | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const m = useMutation({
    mutationFn: () => api.patch<Tarif>(`/tarifs/${tarif!.id}`, { unite: 'exemplaire' }),
    onSuccess: (t) => {
      invalider(qc);
      toast.success('Unité modifiée', `${t.libelle} est maintenant facturée par exemplaire.`);
      onClose();
    },
    onError: (e) => toast.error('L’unité n’a pas été modifiée', messageErreur(e)),
  });
  return (
    <ConfirmDialog
      open={!!tarif}
      onClose={() => !m.isPending && onClose()}
      onConfirm={() => m.mutate()}
      busy={m.isPending}
      title="Facturer par exemplaire"
      confirmLabel="Facturer par exemplaire"
      description={
        tarif
          ? `Aujourd’hui, « ${tarif.libelle} » est compté une fois par ligne : 50 brochures reliées coûtent le même prix qu’une seule. Par exemplaire, le prix est multiplié par le nombre d’exemplaires de la ligne. Les montants déjà enregistrés ne sont pas recalculés.`
          : undefined
      }
    />
  );
}
