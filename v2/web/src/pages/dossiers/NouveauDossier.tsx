// Création et modification d'un dossier : un seul formulaire, pleine page.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import {
  dossierCreateSchema,
  formatFCFA,
  MACHINE_DESCRIPTIONS,
  MACHINE_LABELS,
  MACHINES,
  MODE_PAIEMENT_LABELS,
  MODES_PAIEMENT,
  parseMontant,
  STATUTS_MODIFIABLES,
  type Machine,
  type ModePaiement,
} from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { api, ApiError, messageErreur } from '../../lib/api';
import type { DossierDetail } from '../../lib/types';
import { useDossier } from '../../features/dossiers/hooks';
import { ClientAutocomplete } from '../../features/dossiers-ui/ClientAutocomplete';
import { convertirSpecs, lignesDe, specsDraftVide, specsVersDraft, ligneRolandVide, ligneXeroxVide, type SpecsDraft } from '../../features/specs/draft';
import { PrixPanel, usePrix } from '../../features/specs/PrixPanel';
import { SpecsEditor } from '../../features/specs/SpecsEditor';
import { useLibelles, useParamsPrix, useTarifs } from '../../features/specs/useTarifs';
import { Alert, Button, Card, Checkbox, EmptyState, LoadingRows, MachineChip, PageHeader, Segmented, SelectField, TextareaField, TextField, useToast } from '../../ui';
import '../../features/dossiers-ui/dossiers-ui.css';

interface Formulaire {
  machine: Machine;
  client_id: number | null;
  client_nom: string;
  client_telephone: string;
  client_email: string;
  description: string;
  consignes: string;
  specs: SpecsDraft;
  montantManuel: boolean;
  montant: string;
  urgent: boolean;
  date_promise: string;
  adresse_livraison: string;
  mode_paiement_prevu: '' | ModePaiement;
}

type DossierAvecContact = DossierDetail & { client_email?: string | null };

function formulaireVide(): Formulaire {
  return {
    machine: 'roland',
    client_id: null,
    client_nom: '',
    client_telephone: '',
    client_email: '',
    description: '',
    consignes: '',
    specs: specsDraftVide('roland'),
    montantManuel: false,
    montant: '',
    urgent: false,
    date_promise: '',
    adresse_livraison: '',
    mode_paiement_prevu: '',
  };
}

function depuisDossier(d: DossierAvecContact): Formulaire {
  const specs = specsVersDraft(d.machine, d.specs);
  if (!lignesDe(d.machine, specs).length && !d.importe) {
    if (d.machine === 'roland') specs.roland = [ligneRolandVide()];
    else specs.xerox = [ligneXeroxVide()];
  }
  return {
    machine: d.machine,
    client_id: d.client_id,
    client_nom: d.client_nom ?? '',
    client_telephone: d.client_telephone ?? '',
    client_email: d.client_email ?? '',
    description: d.description ?? '',
    consignes: d.consignes ?? '',
    specs,
    montantManuel: d.montant_source === 'saisi',
    montant: d.montant_source === 'saisi' && d.montant !== null && d.montant !== undefined ? String(d.montant) : '',
    urgent: d.urgent,
    date_promise: d.date_promise ? d.date_promise.slice(0, 10) : '',
    adresse_livraison: d.adresse_livraison ?? '',
    mode_paiement_prevu: d.mode_paiement_prevu ?? '',
  };
}

const vide = (s: string) => (s.trim() === '' ? null : s.trim());

/** Clés d'erreurs de l'API ou des schémas : « lignes.0.largeur » ou « specs.lignes.0.largeur » vont à l'éditeur. */
function repartirErreurs(champs: Record<string, string>) {
  const form: Record<string, string> = {};
  const specs: Record<string, string> = {};
  for (const [k, v] of Object.entries(champs)) {
    const cle = k.replace(/^specs\./, '');
    if (/^(lignes|forfaits|remise)/.test(cle)) specs[cle] = v;
    else form[k] = v;
  }
  return { form, specs };
}

export default function NouveauDossier() {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : undefined;
  const edition = id !== undefined;
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const dossier = useDossier(id);
  const tarifs = useTarifs();
  const { params, parDefaut } = useParamsPrix();
  const libelle = useLibelles(tarifs.data);

  const [f, setF] = useState<Formulaire>(formulaireVide);
  const initial = useRef<Formulaire | null>(edition ? null : formulaireVide());
  const [pret, setPret] = useState(!edition);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreursSpecs, setErreursSpecs] = useState<Record<string, string>>({});
  const [erreurGenerale, setErreurGenerale] = useState<{ titre: string; lignes: string[] } | null>(null);
  const [tente, setTente] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    if (edition && dossier.data && !initial.current) {
      const init = depuisDossier(dossier.data as DossierAvecContact);
      initial.current = init;
      setF(init);
      setPret(true);
    }
  }, [edition, dossier.data]);

  const maj = <K extends keyof Formulaire>(k: K, v: Formulaire[K]) => setF((x) => ({ ...x, [k]: v }));
  const changerMachine = (m: Machine) =>
    setF((x) => {
      const specs = { ...x.specs };
      if (!lignesDe(m, specs).length) {
        if (m === 'roland') specs.roland = [ligneRolandVide()];
        else specs.xerox = [ligneXeroxVide()];
      }
      return { ...x, machine: m, specs };
    });

  const { conversion, resultat } = usePrix(f.machine, f.specs, tarifs.data, params);
  const montantSaisi = f.montantManuel ? parseMontant(f.montant) : null;
  const totalAffiche = f.montantManuel ? montantSaisi : resultat?.ok ? resultat.total_ttc : null;

  // Erreurs de validation recalculées en direct après une première tentative d'envoi.
  const validation = useMemo(() => valider(f, conversion.erreurs), [f, conversion.erreurs]);
  useEffect(() => {
    if (tente) {
      setErreurs(validation.form);
      setErreursSpecs(validation.specs);
      if (!Object.keys(validation.form).length && !Object.keys(validation.specs).length) {
        setErreurGenerale((g) => (g?.titre === TITRE_A_CORRIGER ? null : g));
      }
    }
  }, [tente, validation]);

  const d = dossier.data as DossierAvecContact | undefined;
  const machineModifiable = !edition || (d ? STATUTS_MODIFIABLES.includes(d.statut) : false);

  if (edition) {
    if (dossier.isLoading || (!pret && !dossier.isError)) {
      return (
        <>
          <PageHeader title="Modifier le dossier" crumbs={<Link to="/dossiers">Dossiers</Link>} />
          <LoadingRows rows={6} />
        </>
      );
    }
    if (dossier.isError || !d) {
      return (
        <>
          <PageHeader title="Modifier le dossier" crumbs={<Link to="/dossiers">Dossiers</Link>} />
          <Card>
            <EmptyState title="Dossier introuvable">{messageErreur(dossier.error)}</EmptyState>
          </Card>
        </>
      );
    }
    if (!d.peut_modifier) {
      return (
        <>
          <PageHeader title={`Modifier ${d.numero}`} crumbs={<><Link to="/dossiers">Dossiers</Link><span>/</span><Link to={`/dossiers/${d.id}`}>{d.numero}</Link></>} />
          <Alert tone="warning">
            Ce dossier ne peut plus être modifié : il a été validé. Un administrateur peut le renvoyer en préparation si une correction est nécessaire.
          </Alert>
          <div>
            <Button onClick={() => navigate(`/dossiers/${d.id}`)}>Revenir au dossier</Button>
          </div>
        </>
      );
    }
  }

  const soumettre = async (e?: FormEvent) => {
    e?.preventDefault();
    setTente(true);
    setErreurGenerale(null);
    const v = valider(f, conversion.erreurs);
    setErreurs(v.form);
    setErreursSpecs(v.specs);
    if (Object.keys(v.form).length || Object.keys(v.specs).length) {
      setErreurGenerale({ titre: TITRE_A_CORRIGER, lignes: [] });
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (!f.montantManuel && resultat && !resultat.ok) {
      setErreurGenerale({ titre: 'Le prix ne peut pas être calculé. Corrigez les lignes ou saisissez le montant à la main.', lignes: resultat.erreurs });
      return;
    }
    const corps = construire(f, conversion.specs);
    setEnvoi(true);
    try {
      let res: DossierDetail;
      if (!edition) {
        res = await api.post<DossierDetail>('/dossiers', corps);
      } else {
        const avant = construire(initial.current!, conversionInitiale(initial.current!));
        const patch: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(corps)) {
          if (JSON.stringify(val) !== JSON.stringify((avant as Record<string, unknown>)[k])) patch[k] = val;
        }
        if (patch.machine !== undefined) patch.specs = corps.specs;
        // Retour au prix calculé après une saisie manuelle : l'API ne sait pas effacer la saisie
        // (montant: null viderait le montant), on envoie donc le total calculé.
        if (!f.montantManuel && initial.current!.montantManuel) {
          patch.montant = resultat?.ok ? resultat.total_ttc : null;
          patch.specs = corps.specs;
        }
        if (!Object.keys(patch).length) {
          toast.info('Aucune modification', 'Le dossier est inchangé.');
          navigate(`/dossiers/${id}`);
          return;
        }
        res = await api.patch<DossierDetail>(`/dossiers/${id}`, patch);
      }
      qc.setQueryData(['dossier', res.id], res);
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      if (edition) {
        toast.success('Dossier enregistré', res.numero);
        navigate(`/dossiers/${res.id}`);
      } else {
        toast.success(`Dossier ${res.numero} créé`, 'Ajoutez maintenant les fichiers d’impression.');
        navigate(`/dossiers/${res.id}?nouveau=1`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.champs) {
        const r = repartirErreurs(err.champs);
        setErreurs(r.form);
        setErreursSpecs(r.specs);
        setErreurGenerale({ titre: err.message, lignes: Object.entries(err.champs).filter(([k]) => !CHAMPS_FORM.includes(k)).map(([k, m]) => `${k} : ${m}`) });
      } else if (err instanceof ApiError && Array.isArray(err.details?.erreurs)) {
        setErreurGenerale({ titre: err.message, lignes: err.details.erreurs });
      } else {
        setErreurGenerale({ titre: messageErreur(err), lignes: [] });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnvoi(false);
    }
  };

  const titre = edition ? `Modifier ${d?.numero ?? 'le dossier'}` : 'Nouveau dossier';
  const peutEditerTarifs = user.role === 'admin';

  return (
    <>
      <PageHeader
        title={titre}
        crumbs={
          <>
            <Link to="/dossiers">Dossiers</Link>
            <span aria-hidden="true">/</span>
            {edition && d ? <Link to={`/dossiers/${d.id}`}>{d.numero}</Link> : <span>Nouveau</span>}
          </>
        }
        subtitle={edition ? `${d?.client_nom ?? ''}` : 'Renseignez le client et le travail ; les fichiers s’ajoutent ensuite sur la fiche du dossier.'}
      />

      {erreurGenerale && (
        <Alert tone="error">
          <strong>{erreurGenerale.titre}</strong>
          {erreurGenerale.lignes.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {erreurGenerale.lignes.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <form id="form-dossier" className="nd-layout" onSubmit={soumettre} noValidate>
        <div className="nd-main">
          <Card title={<><span className="nd-section__num">1</span>Machine</>} className="nd-section">
            {machineModifiable ? (
              <div className="nd-machine">
                <Segmented
                  name="machine"
                  label="Machine"
                  value={f.machine}
                  onChange={changerMachine}
                  options={MACHINES.map((m) => ({ value: m, label: MACHINE_LABELS[m], help: MACHINE_DESCRIPTIONS[m] }))}
                />
              </div>
            ) : (
              <div className="row">
                <MachineChip machine={f.machine} />
                <span className="ev-muted">La machine ne peut plus changer après la validation du dossier.</span>
              </div>
            )}
          </Card>

          <Card title={<><span className="nd-section__num">2</span>Client</>} className="nd-section">
            <div className="nd-grid nd-grid--3">
              <ClientAutocomplete
                nom={f.client_nom}
                clientId={f.client_id}
                autoFocus={!edition}
                erreur={erreurs.client_nom}
                onNom={(v) => maj('client_nom', v)}
                onSelect={(c) =>
                  setF((x) =>
                    c
                      ? { ...x, client_id: c.id, client_nom: c.nom, client_telephone: c.telephone ?? x.client_telephone, client_email: c.email ?? x.client_email }
                      : { ...x, client_id: null },
                  )
                }
              />
              <TextField label="Téléphone" type="tel" inputMode="tel" mono value={f.client_telephone} onChange={(e) => maj('client_telephone', e.target.value)} placeholder="77 123 45 67" error={erreurs.client_telephone} autoComplete="off" />
              <TextField label="E-mail" type="email" value={f.client_email} onChange={(e) => maj('client_email', e.target.value)} placeholder="nom@exemple.sn" error={erreurs.client_email} autoComplete="off" />
            </div>
          </Card>

          <Card title={<><span className="nd-section__num">3</span>Travail</>} className="nd-section">
            <div className="stack">
              <TextField label="Description du travail" value={f.description} onChange={(e) => maj('description', e.target.value)} placeholder="Ex. Bâche façade boutique, flyers campagne" error={erreurs.description} maxLength={2000} />
              <TextareaField
                label="Consignes pour l'atelier"
                value={f.consignes}
                onChange={(e) => maj('consignes', e.target.value)}
                rows={3}
                placeholder="Profil couleur, fond perdu, sens d'impression, contrôle avant tirage…"
                help="Visibles par l'imprimeur sur la fiche et le bon de travail."
                error={erreurs.consignes}
                maxLength={2000}
              />
            </div>
          </Card>

          <Card
            title={<><span className="nd-section__num">4</span>Spécifications</>}
            className="nd-section"
            actions={<MachineChip machine={f.machine} />}
          >
            {tarifs.isError ? (
              <Alert tone="warning">La grille tarifaire n'a pas pu être chargée : {messageErreur(tarifs.error)} Rechargez la page.</Alert>
            ) : tarifs.isLoading ? (
              <LoadingRows rows={3} />
            ) : (
              <SpecsEditor
                machine={f.machine}
                value={f.specs}
                onChange={(specs) => maj('specs', specs)}
                tarifs={tarifs.data}
                params={params}
                erreurs={erreursSpecs}
                resultat={resultat}
                conversion={conversion}
              />
            )}
          </Card>

          <Card title={<><span className="nd-section__num">5</span>Livraison et paiement</>} className="nd-section">
            <div className="nd-grid">
              <TextField label="Date promise au client" type="date" mono value={f.date_promise} onChange={(e) => maj('date_promise', e.target.value)} error={erreurs.date_promise} />
              <SelectField
                label="Mode de paiement prévu"
                value={f.mode_paiement_prevu}
                onChange={(e) => maj('mode_paiement_prevu', e.target.value as ModePaiement | '')}
                placeholder="Non précisé"
                options={MODES_PAIEMENT.map((m) => ({ value: m, label: MODE_PAIEMENT_LABELS[m] }))}
                help="Prérempli pour le livreur à l'encaissement."
              />
              <TextField className="nd-full" label="Adresse de livraison" value={f.adresse_livraison} onChange={(e) => maj('adresse_livraison', e.target.value)} placeholder="Quartier, rue, repère" error={erreurs.adresse_livraison} maxLength={500} />
              <div className="nd-full">
                <Checkbox label="Dossier urgent : il passe en tête de la file d'impression" checked={f.urgent} onChange={(v) => maj('urgent', v)} />
              </div>
            </div>
          </Card>
        </div>

        <aside className="nd-side">
          <PrixPanel
            machine={f.machine}
            draft={f.specs}
            conversion={conversion}
            resultat={resultat}
            params={params}
            parDefaut={parDefaut}
            tarifsCharges={!!tarifs.data}
            libelle={libelle}
            peutEditerTarifs={peutEditerTarifs}
            saisieManuelle
            montantRetenu={f.montantManuel ? montantSaisi : undefined}
          >
            <Checkbox
              label="Saisir le montant à la main"
              checked={f.montantManuel}
              onChange={(v) => setF((x) => ({ ...x, montantManuel: v, montant: v && !x.montant && resultat?.ok ? String(resultat.total_ttc) : x.montant }))}
            />
            {f.montantManuel && (
              <TextField
                label="Montant TTC"
                required
                mono
                addon="FCFA"
                inputMode="numeric"
                value={f.montant}
                onChange={(e) => maj('montant', e.target.value)}
                error={erreurs.montant}
                help="Remplace le prix calculé ; le détail reste enregistré pour information."
              />
            )}
          </PrixPanel>
        </aside>
      </form>

      <div className="du-barre" role="region" aria-label="Enregistrer le dossier">
        <div className="du-barre__info">
          <small>{f.montantManuel ? 'Montant saisi' : 'Total calculé'}</small>
          <span className="ev-num">{totalAffiche === null ? 'À définir' : formatFCFA(totalAffiche)}</span>
        </div>
        <div className="du-barre__actions">
          <Button onClick={() => navigate(edition ? `/dossiers/${id}` : '/dossiers')}>Annuler</Button>
          <Button type="submit" form="form-dossier" variant="primary" busy={envoi} icon={<Save />}>
            {edition ? 'Enregistrer les modifications' : 'Créer le dossier'}
          </Button>
        </div>
      </div>
    </>
  );
}

const TITRE_A_CORRIGER = 'Certains champs sont à corriger.';
const CHAMPS_FORM = ['client_nom', 'client_telephone', 'client_email', 'description', 'consignes', 'montant', 'date_promise', 'adresse_livraison', 'mode_paiement_prevu'];

function construire(f: Formulaire, specs: unknown) {
  return {
    machine: f.machine,
    client_id: f.client_id,
    client_nom: f.client_nom.trim(),
    client_telephone: vide(f.client_telephone),
    client_email: vide(f.client_email),
    description: vide(f.description),
    consignes: vide(f.consignes),
    specs,
    montant: f.montantManuel ? parseMontant(f.montant) : null,
    urgent: f.urgent,
    date_promise: f.date_promise || null,
    adresse_livraison: vide(f.adresse_livraison),
    mode_paiement_prevu: f.mode_paiement_prevu || null,
  };
}

/** Même conversion que pour l'état courant, pour comparer à l'identique. */
function conversionInitiale(f: Formulaire) {
  const c = convertirSpecs(f.machine, f.specs);
  return c.specs ?? c.apercu;
}

function valider(f: Formulaire, erreursSpecs: Record<string, string>) {
  const form: Record<string, string> = {};
  const r = dossierCreateSchema.safeParse(construire(f, {}));
  if (!r.success) {
    for (const i of r.error.issues) {
      const k = String(i.path[0] ?? '_');
      if (!form[k]) form[k] = i.message;
    }
  }
  if (f.montantManuel && parseMontant(f.montant) === null) form.montant = 'Saisissez un montant entier en FCFA, sans centimes.';
  return { form, specs: erreursSpecs };
}
