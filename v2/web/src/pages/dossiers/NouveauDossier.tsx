// Création et modification d'un dossier : un seul formulaire, pleine page.
// Sections : machine, client, travail, spécifications (lignes), remise au client et délai, fichiers et BAT.
// Le prix est calculé en direct par le moteur partagé ; le serveur le recalcule et fait foi.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FileUp, Save, X, LayoutGrid } from 'lucide-react';
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
import { FichiersEtBat, RemiseClient, UrgenceChoix, type ModeRemise } from '../../features/specs/Commande';
import { SuggestionIA } from '../../features/ia/SuggestionIA';
import { appliquerModele, EnregistrerModele, ModelesDossier, useModeles } from '../../features/modeles/ModelesDossier';
import { Predefinis } from '../../features/modeles/Predefinis';
import { MiniatureLocale } from '../../features/fichiers/MiniatureLocale';
import { useLibelles, useParamsPrix, useTarifs } from '../../features/specs/useTarifs';
import { deposerEnAttente } from '../../features/fichiers/enAttente';
import { ImpositionRapide, imposable, type ResultatRapide } from '../../features/imposition/ImpositionRapide';
import { formatTaille } from '@evocom/shared';
import { Alert, Button, Card, Checkbox, EmptyState, LoadingRows, MachineChip, PageHeader, Segmented, SelectField, TextareaField, TextField, useToast, MachineIcone } from '../../ui';
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
  /** '' : pas encore choisi (nouveau dossier). */
  mode_remise: '' | ModeRemise;
  /** Dossier au prix convenu (devis, reprise…) : garder ce prix quand les spécifications changent. */
  garderPrixConvenu: boolean;
}

type DossierAvecContact = DossierDetail & { client_email?: string | null; mode_remise?: ModeRemise | null };

/** Sources de montant qui viennent d'un accord avec le client, pas de la grille du jour. */
const SOURCES_CONVENUES = ['devis', 'reprise', 'gratuit', 'import'];

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
    // Le montant se saisit le plus souvent à la main : la case est cochée d'office, préremplie par le calcul.
    montantManuel: true,
    montant: '',
    urgent: false,
    date_promise: '',
    adresse_livraison: '',
    mode_paiement_prevu: '',
    mode_remise: '',
    garderPrixConvenu: false,
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
    mode_remise: d.mode_remise ?? 'livraison',
    garderPrixConvenu: SOURCES_CONVENUES.includes(d.montant_source ?? '') && d.montant !== null && d.montant !== undefined,
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

  const voitPrix = user.role === 'admin' || user.role === 'preparateur';
  const [f, setF] = useState<Formulaire>(formulaireVide);
  /** Fichiers d'impression choisis dès la création : envoyés par la fiche juste après. */
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [imposes, setImposes] = useState<ResultatRapide[]>([]);
  /** Vrai dès que la personne a tapé un montant : le calcul ne le remplace plus. */
  const montantTouche = useRef(false);
  // Arrivée depuis la page Modèles (?modele=ID) : le modèle est appliqué dès qu'il est chargé.
  const [sp] = useSearchParams();
  const modeles = useModeles();
  const modeleDemande = Number(sp.get('modele')) || 0;
  const modeleApplique = useRef(0);
  useEffect(() => {
    if (!modeleDemande || modeleApplique.current === modeleDemande || !modeles.data) return;
    const m = modeles.data.find((x) => x.id === modeleDemande);
    if (!m) return;
    modeleApplique.current = modeleDemande;
    setF((x) => appliquerModele(x, m));
  }, [modeleDemande, modeles.data]);
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
  useEffect(() => {
    if (edition || !f.montantManuel || montantTouche.current) return;
    const calcule = resultat?.ok ? String(resultat.total_ttc) : '';
    setF((x) => (x.montant === calcule ? x : { ...x, montant: calcule }));
  }, [edition, f.montantManuel, resultat]);
  const montantSaisi = f.montantManuel ? parseMontant(f.montant) : null;
  const dConvenu = dossier.data as DossierAvecContact | undefined;
  const prixConvenu =
    edition && dConvenu && SOURCES_CONVENUES.includes(dConvenu.montant_source ?? '') && dConvenu.montant !== null && dConvenu.montant !== undefined ? dConvenu.montant : null;
  const garde = !f.montantManuel && prixConvenu !== null && f.garderPrixConvenu;
  const totalAffiche = f.montantManuel ? montantSaisi : garde ? prixConvenu : resultat?.ok ? resultat.total_ttc : null;

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
      setErreurGenerale({ titre: TITRE_A_CORRIGER, lignes: libellerErreurs(v.form, v.specs) });
      window.setTimeout(() => {
        const premier = document.querySelector<HTMLElement>('[aria-invalid="true"], .ev-error');
        premier?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (premier?.matches('input, select, textarea')) premier.focus({ preventScroll: true });
      }, 50);
      return;
    }
    const corps = construire(f, conversion.specs);
    setEnvoi(true);
    try {
      let res: DossierDetail | undefined;
      if (!edition) {
        res = await api.post<DossierDetail>('/dossiers', corps);
      } else {
        const avant = construire(initial.current!, conversionInitiale(initial.current!));
        const patch: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(corps)) {
          if (JSON.stringify(val) !== JSON.stringify((avant as Record<string, unknown>)[k])) patch[k] = val;
        }
        if (patch.machine !== undefined) patch.specs = corps.specs;
        // Retour au prix calculé : montant null demande à l'API de recalculer. Deux cas : après une saisie
        // manuelle, ou quand la personne renonce au prix convenu (devis…) pour la grille du jour (A6 : sinon
        // le prix convenu est gardé par le serveur). A2 : le recalcul part dans une requête à part, après
        // l'enregistrement des spécifications.
        const convenu = !!d && SOURCES_CONVENUES.includes(d.montant_source ?? '') && d.montant !== null && d.montant !== undefined;
        const revenirAuCalcul = !f.montantManuel && (initial.current!.montantManuel || (convenu && !f.garderPrixConvenu));
        if (revenirAuCalcul) delete patch.montant;
        if (!Object.keys(patch).length && !revenirAuCalcul) {
          toast.info('Aucune modification', 'Le dossier est inchangé.');
          navigate(`/dossiers/${id}`);
          return;
        }
        if (Object.keys(patch).length) res = await api.patch<DossierDetail>(`/dossiers/${id}`, patch);
        if (revenirAuCalcul) res = await api.patch<DossierDetail>(`/dossiers/${id}`, { montant: null });
      }
      if (!res) return;
      qc.setQueryData(['dossier', res.id], res);
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      if (edition) {
        toast.success('Dossier enregistré', res.numero);
        navigate(`/dossiers/${res.id}`);
      } else {
        deposerEnAttente(res.id, fichiers);
        // PDF imposés depuis le formulaire : rangés dans le dossier qui vient d'être créé.
        for (const r of imposes) {
          await api.post(`/imposition/libre/${r.jeton}/rattacher`, { dossier_id: res.id }).catch((e) => toast.error(`${r.nom} non ajouté`, messageErreur(e)));
        }
        toast.success(`Dossier ${res.numero} créé`, fichiers.length ? `${fichiers.length} fichier${fichiers.length > 1 ? 's' : ''} en cours d’envoi.` : 'Ajoutez maintenant les fichiers d’impression.');
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

      <form id="form-dossier" className="nd-layout" data-machine={f.machine} onSubmit={soumettre} noValidate>
        <div className="nd-main">
          <SuggestionIA
            brouillon={f.specs}
            machineImposee={machineModifiable ? undefined : f.machine}
            onAppliquer={(machine, specs) => setF((x) => ({ ...x, machine, specs }))}
          />
          {!edition && (
            <Card title="Partir d’un prédéfini ou d’un modèle" className="nd-section nd-modeles" actions={<span className="ev-muted" style={{ fontSize: 13 }}>Vos configurations habituelles, en un clic</span>}>
              <div className="stack">
                <Predefinis
                  machineImposee={machineModifiable ? undefined : f.machine}
                  onAppliquer={(p) => {
                    setF((x) => ({ ...x, machine: p.machine, specs: specsVersDraft(p.machine, p.specs), description: x.description || (p.description ?? '') }));
                    toast.success('Prédéfini appliqué', 'Vérifiez les quantités, le client et le prix, puis créez le dossier.');
                  }}
                />
                <ModelesDossier machineImposee={machineModifiable ? undefined : f.machine} onAppliquer={(m) => setF((x) => appliquerModele(x, m))} />
              </div>
            </Card>
          )}
          <Card title={<><span className="nd-section__num">1</span>Machine</>} className="nd-section">
            {machineModifiable ? (
              <div className="nd-machine">
                <Segmented
                  name="machine"
                  label="Machine"
                  value={f.machine}
                  onChange={changerMachine}
                  options={MACHINES.map((m) => ({ value: m, label: MACHINE_LABELS[m], help: MACHINE_DESCRIPTIONS[m], icon: <MachineIcone machine={m} taille={30} /> }))}
                />
              </div>
            ) : (
              <div className="row">
                <MachineChip machine={f.machine} />
                <span className="ev-muted">La machine ne peut plus changer après la validation du dossier.</span>
              </div>
            )}
          </Card>

          <Card title={<><span className="nd-section__num">2</span>Client</>} className="nd-section nd-section--client">
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
            </div>
          </Card>

          <Card title={<><span className="nd-section__num">3</span>Travail</>} className="nd-section nd-section--travail">
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

          <Card title={<><span className="nd-section__num">5</span>Remise au client et délai</>} className="nd-section nd-section--remise">
            <div className="stack">
              <RemiseClient
                machine={f.machine}
                tarifs={tarifs.data}
                draft={f.specs}
                onDraft={(specs) => maj('specs', specs)}
                mode={f.mode_remise}
                onMode={(m) => maj('mode_remise', m)}
                adresse={f.adresse_livraison}
                onAdresse={(v) => maj('adresse_livraison', v)}
                erreurs={{ ...erreurs, ...(erreursSpecs.livraison_contact ? { livraison_contact: erreursSpecs.livraison_contact } : {}) }}
              />
              <UrgenceChoix machine={f.machine} tarifs={tarifs.data} draft={f.specs} onDraft={(specs) => maj('specs', specs)} onUrgent={(v) => maj('urgent', v)} />
              <div className="nd-grid">
                <TextField label="Date promise au client" type="date" mono value={f.date_promise} onChange={(e) => maj('date_promise', e.target.value)} error={erreurs.date_promise} />
                <SelectField
                  label="Mode de paiement prévu"
                  value={f.mode_paiement_prevu}
                  onChange={(e) => maj('mode_paiement_prevu', e.target.value as ModePaiement | '')}
                  placeholder="Non précisé"
                  options={MODES_PAIEMENT.map((m) => ({ value: m, label: MODE_PAIEMENT_LABELS[m] }))}
                  help={f.mode_remise === 'retrait' ? 'Rappel pour l’encaissement au comptoir.' : 'Prérempli pour le livreur à l’encaissement.'}
                />
              </div>
              <Checkbox label="Dossier urgent : il passe en tête de la file d'impression" checked={f.urgent} onChange={(v) => maj('urgent', v)} />
            </div>
          </Card>

          <Card title={<><span className="nd-section__num">6</span>Fichiers et BAT</>} className="nd-section nd-section--fichiers">
            <div className="stack">
              {edition ? (
                d && (
                  <p className="adm-explain" style={{ margin: 0 }}>
                    Les fichiers d’impression se déposent sur <Link className="ev-link" to={`/dossiers/${d.id}`}>la fiche du dossier</Link>.
                  </p>
                )
              ) : (
                <DepotFichiers fichiers={fichiers} onChange={setFichiers} xerox={f.machine === 'xerox'} imposes={imposes} onImposes={setImposes} />
              )}
              <FichiersEtBat machine={f.machine} tarifs={tarifs.data} draft={f.specs} onDraft={(specs) => maj('specs', specs)} />
            </div>
          </Card>
        </div>

        {voitPrix && (
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
            montantRetenu={f.montantManuel ? montantSaisi : garde ? prixConvenu : undefined}
            libelleRetenu={garde ? (d?.montant_source === 'devis' ? 'Prix du devis' : 'Prix convenu') : undefined}
          >
            <Checkbox
              label="Saisir le montant à la main"
              checked={f.montantManuel}
              onChange={(v) => {
                montantTouche.current = false;
                setF((x) => ({ ...x, montantManuel: v, montant: v && !x.montant && resultat?.ok ? String(resultat.total_ttc) : x.montant }));
              }}
            />
            {prixConvenu !== null && !f.montantManuel && (
              <div className="stack-sm">
                <Checkbox
                  label={`Garder le prix ${d?.montant_source === 'devis' ? 'du devis' : 'convenu'} : ${formatFCFA(prixConvenu)}`}
                  checked={f.garderPrixConvenu}
                  onChange={(v) => maj('garderPrixConvenu', v)}
                />
                <span className="ev-help">
                  {f.garderPrixConvenu
                    ? 'Ce prix reste celui du dossier, même si vous modifiez les lignes.'
                    : 'Le dossier sera rechiffré avec la grille du jour : voir le total calculé ci-dessus.'}
                </span>
              </div>
            )}
            {f.montantManuel && (
              <TextField
                label="Montant TTC"
                mono
                addon="FCFA"
                inputMode="numeric"
                value={f.montant}
                onChange={(e) => {
                  montantTouche.current = true;
                  maj('montant', e.target.value);
                }}
                error={erreurs.montant}
                help={resultat?.ok ? 'Prérempli avec le prix calculé : corrigez-le si le prix convenu est différent.' : 'Le prix ne se calcule pas avec la grille : saisissez le montant convenu, ou laissez vide pour le fixer plus tard.'}
              />
            )}
          </PrixPanel>
        </aside>
        )}
      </form>

      <div className="du-barre" role="region" aria-label="Enregistrer le dossier">
        <div className="du-barre__info">
          {voitPrix ? (
            <>
              <small>{f.montantManuel ? 'Montant saisi' : garde ? (d?.montant_source === 'devis' ? 'Prix du devis' : 'Prix convenu') : 'Total calculé'}</small>
              <span className="ev-num">{totalAffiche === null ? 'À définir' : formatFCFA(totalAffiche)}</span>
            </>
          ) : (
            <small>Le prix est fixé par l’administrateur ou le préparateur.</small>
          )}
        </div>
        <div className="du-barre__actions">
          <EnregistrerModele
            disabled={!conversion.specs}
            contenu={() => ({ machine: f.machine, specs: conversion.specs, description: f.description, consignes: f.consignes, mode_remise: f.mode_remise })}
          />
          <Button onClick={() => navigate(edition ? `/dossiers/${id}` : '/dossiers')}>Annuler</Button>
          <Button type="submit" form="form-dossier" variant="primary" busy={envoi} icon={<Save />}>
            {edition ? 'Enregistrer les modifications' : 'Créer le dossier'}
          </Button>
        </div>
      </div>
    </>
  );
}

/** Dépôt des fichiers d'impression dès la création : glisser-déposer ou sélection, envoyés par la fiche juste après. */
function DepotFichiers({ fichiers, onChange, xerox, imposes, onImposes }: { fichiers: File[]; onChange: (f: File[]) => void; xerox: boolean; imposes: ResultatRapide[]; onImposes: (r: ResultatRapide[]) => void }) {
  const [aImposer, setAImposer] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);
  const ajouter = (liste: FileList | File[]) => {
    const nouveaux = Array.from(liste).filter((x) => x.size > 0 && !fichiers.some((y) => y.name === x.name && y.size === x.size));
    if (nouveaux.length) onChange([...fichiers, ...nouveaux]);
  };
  return (
    <div className="nd-depot">
      <div
        className="ev-dropzone fi-dropzone"
        data-over={survol}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!survol) setSurvol(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setSurvol(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          if (e.dataTransfer.files?.length) ajouter(e.dataTransfer.files);
        }}
      >
        <FileUp aria-hidden="true" className="fi-dropzone__icone" />
        <div>
          <strong>Déposez ici les fichiers d’impression (PDF…)</strong> <span>ou</span>{' '}
          <button type="button" className="ev-link fi-dropzone__choisir" onClick={() => input.current?.click()}>
            choisissez-les sur l’ordinateur
          </button>
        </div>
        <span className="fi-dropzone__aide">Ils partent dès que le dossier est créé ; vous pourrez en ajouter ensuite sur la fiche.</span>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) ajouter(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {fichiers.length > 1 && (
        <p className="nd-depot__compte">
          {fichiers.length} fichiers · {formatTaille(fichiers.reduce((t, x) => t + x.size, 0))}{' '}
          <button type="button" className="ev-link" onClick={() => onChange([])}>
            Tout retirer
          </button>
        </p>
      )}
      {fichiers.length > 0 && (
        <ul className="nd-depot__liste" aria-label="Fichiers à envoyer">
          {fichiers.map((x) => (
            <li key={`${x.name}-${x.size}`} className="nd-depot__item">
              <MiniatureLocale file={x} />
              <span className="nd-depot__nom">{x.name}</span>
              <span className="nd-depot__taille">{formatTaille(x.size)}</span>
              {xerox && imposable({ nom_original: x.name, mime: x.type || null }) && (
                <button type="button" className="ev-btn ev-btn--sm fi-imposer" onClick={() => setAImposer(x)} title="Imposition automatique avec prévisualisation">
                  <LayoutGrid aria-hidden="true" /> Imposer
                </button>
              )}
              <button type="button" className="ev-icon-btn ev-icon-btn--sm" aria-label={`Retirer ${x.name}`} onClick={() => onChange(fichiers.filter((y) => y !== x))}>
                <X />
              </button>
            </li>
          ))}
          {imposes.map((r) => (
            <li key={r.jeton} className="nd-depot__item nd-depot__item--impose">
              <span className="nd-depot__badge">Imposé</span>
              <span className="nd-depot__nom">{r.nom}</span>
              <span className="nd-depot__taille">{formatTaille(r.taille)}</span>
              <button type="button" className="ev-icon-btn ev-icon-btn--sm" aria-label={`Retirer ${r.nom}`} onClick={() => onImposes(imposes.filter((y) => y.jeton !== r.jeton))}>
                <X />
              </button>
            </li>
          ))}
        </ul>
      )}
      {aImposer && <ImpositionRapide fichierLocal={aImposer} onClose={() => setAImposer(null)} onImpose={(r) => onImposes([...imposes, r])} />}
    </div>
  );
}

const TITRE_A_CORRIGER = 'Certains champs sont à corriger.';

const LIBELLES_CHAMPS: Record<string, string> = {
  client_nom: 'Client (section 2) · nom',
  client_telephone: 'Client (section 2) · téléphone',
  client_email: 'Client (section 2) · e-mail',
  description: 'Travail (section 3) · description',
  consignes: 'Travail (section 3) · consignes',
  montant: 'Prix · montant',
  date_promise: 'Remise et délai (section 5) · date promise',
  adresse_livraison: 'Remise et délai (section 5) · adresse de livraison',
  mode_paiement_prevu: 'Remise et délai (section 5) · mode de paiement',
  mode_remise: 'Remise et délai (section 5) · comment le client récupère son travail',
  machine: 'Machine (section 1)',
  specs: 'Spécifications (section 4)',
};
const LIBELLES_SPECS: Record<string, string> = {
  support: 'support',
  support_autre: 'précision du support',
  largeur: 'largeur',
  hauteur: 'hauteur',
  unite: 'unité',
  quantite: 'exemplaires',
  pages: 'pages',
  format: 'format',
  format_largeur: 'largeur finie',
  format_hauteur: 'hauteur finie',
  papier: 'papier',
  finitions: 'finitions',
  options: 'options',
  description: 'précisions',
  'oeillets.espacement_cm': 'espacement des œillets',
  'numerotation.depart': 'numéro de départ',
  'numerotation.chiffres': 'nombre de chiffres',
};

/** Chaque erreur en clair, avec la section et le champ, pour savoir où corriger. */
function libellerErreurs(form: Record<string, string>, specs: Record<string, string>): string[] {
  const lignes: string[] = [];
  for (const [k, m] of Object.entries(form)) lignes.push(`${LIBELLES_CHAMPS[k] ?? k} : ${m}`);
  for (const [k, m] of Object.entries(specs)) {
    const ligne = /^lignes\.(\d+)\.(.+)$/.exec(k);
    if (ligne) {
      const champ = ligne[2]!;
      lignes.push(`Spécifications (section 4) · ligne ${Number(ligne[1]) + 1}, ${LIBELLES_SPECS[champ] ?? champ.replace(/_/g, ' ')} : ${m}`);
    } else if (k.startsWith('lignes')) lignes.push(`Spécifications (section 4) : ${m}`);
    else if (k.startsWith('forfaits')) lignes.push(`Forfaits (section 5 ou 6) : ${m}`);
    else if (k.startsWith('remise')) lignes.push(`Remise commerciale (section 4) : ${m}`);
    else lignes.push(`${k} : ${m}`);
  }
  return lignes;
}
const CHAMPS_FORM = ['client_nom', 'client_telephone', 'client_email', 'description', 'consignes', 'montant', 'date_promise', 'adresse_livraison', 'mode_paiement_prevu', 'mode_remise'];

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
    // Retrait sur place : pas d'adresse de livraison.
    adresse_livraison: f.mode_remise === 'retrait' ? null : vide(f.adresse_livraison),
    mode_paiement_prevu: f.mode_paiement_prevu || null,
    mode_remise: f.mode_remise || undefined,
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
  if (f.montantManuel && f.montant.trim() !== '' && parseMontant(f.montant) === null) form.montant = 'Saisissez un montant entier en FCFA, sans centimes.';
  if (!f.mode_remise) form.mode_remise = 'Choisissez : à venir chercher sur place, ou à livrer.';
  return { form, specs: erreursSpecs };
}
