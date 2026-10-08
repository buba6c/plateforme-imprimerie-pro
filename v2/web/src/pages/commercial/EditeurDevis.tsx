// Création et modification d'un devis : même éditeur de spécifications, même en-tête (remise au
// client, délai, fichiers, BAT) et même calcul de prix que le dossier. En plus : délai de
// fabrication, acompte et conditions de paiement, imprimés sur le devis. Le serveur recalcule et
// refuse (422) un devis incalculable ; mode de remise et adresse sont repris à la conversion.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import {
  formatFCFA,
  MACHINE_DESCRIPTIONS,
  MACHINE_LABELS,
  MACHINES,
  STATUT_DEVIS_LABELS,
  telephoneSchema,
  type Machine,
  type Specs,
  type StatutDevis,
} from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { api, ApiError, messageErreur } from '../../lib/api';
import { ClientAutocomplete } from '../../features/dossiers-ui/ClientAutocomplete';
import { convertirSpecs, ligneRolandVide, ligneXeroxVide, lignesDe, specsDraftVide, specsVersDraft, type SpecsDraft } from '../../features/specs/draft';
import { PrixPanel, usePrix } from '../../features/specs/PrixPanel';
import { SpecsEditor } from '../../features/specs/SpecsEditor';
import { FichiersEtBat, RemiseClient, UrgenceChoix, type ModeRemise } from '../../features/specs/Commande';
import { SuggestionIA } from '../../features/ia/SuggestionIA';
import { useLibelles, useParamsPrix, useTarifs } from '../../features/specs/useTarifs';
import { useRegles } from '../../features/parametres/api';
import { Alert, Button, Card, EmptyState, LoadingRows, PageHeader, Segmented, TextareaField, TextField, useToast } from '../../ui';
import '../../features/dossiers-ui/dossiers-ui.css';

interface Devis {
  id: number;
  numero: string;
  statut: StatutDevis;
  machine: Machine;
  client_id: number | null;
  client_nom: string;
  client_telephone: string | null;
  client_email: string | null;
  description: string | null;
  notes: string | null;
  validite_jours: number;
  specs: Specs;
  total_ttc: number;
  peut_modifier?: boolean;
  mode_remise?: ModeRemise | null;
  adresse_livraison?: string | null;
  delai_jours?: number | null;
  acompte_pourcent?: number | null;
  conditions_paiement?: string | null;
}

interface Formulaire {
  machine: Machine;
  client_id: number | null;
  client_nom: string;
  client_telephone: string;
  client_email: string;
  description: string;
  notes: string;
  validite: string;
  specs: SpecsDraft;
  /** '' : pas encore choisi. */
  mode_remise: '' | ModeRemise;
  adresse_livraison: string;
  delai: string;
  acompte: string;
  conditions_paiement: string;
}

const VALIDITE_DEFAUT = '15';

function vide(): Formulaire {
  return {
    machine: 'xerox',
    client_id: null,
    client_nom: '',
    client_telephone: '',
    client_email: '',
    description: '',
    notes: '',
    validite: VALIDITE_DEFAUT,
    specs: specsDraftVide('xerox'),
    mode_remise: '',
    adresse_livraison: '',
    delai: '',
    acompte: '',
    conditions_paiement: '',
  };
}

function depuisDevis(d: Devis): Formulaire {
  const specs = specsVersDraft(d.machine, d.specs);
  if (!lignesDe(d.machine, specs).length) {
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
    notes: d.notes ?? '',
    validite: String(d.validite_jours ?? VALIDITE_DEFAUT),
    specs,
    mode_remise: d.mode_remise ?? 'livraison',
    adresse_livraison: d.adresse_livraison ?? '',
    delai: d.delai_jours === null || d.delai_jours === undefined ? '' : String(d.delai_jours),
    acompte: d.acompte_pourcent === null || d.acompte_pourcent === undefined ? '' : String(d.acompte_pourcent),
    conditions_paiement: d.conditions_paiement ?? '',
  };
}

const entierOuNull = (s: string) => (s.trim() === '' ? null : Number(s.trim()));

const t = (s: string) => (s.trim() === '' ? null : s.trim());

function construire(f: Formulaire, specs: unknown) {
  return {
    machine: f.machine,
    client_id: f.client_id,
    client_nom: f.client_nom.trim(),
    client_telephone: t(f.client_telephone),
    client_email: t(f.client_email),
    description: t(f.description),
    notes: t(f.notes),
    validite_jours: Number(f.validite),
    specs,
    mode_remise: f.mode_remise || undefined,
    adresse_livraison: f.mode_remise === 'retrait' ? null : t(f.adresse_livraison),
    delai_jours: entierOuNull(f.delai),
    acompte_pourcent: entierOuNull(f.acompte),
    conditions_paiement: t(f.conditions_paiement),
  };
}

function valider(f: Formulaire): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.client_nom.trim()) e.client_nom = 'Indiquez le client';
  const tel = telephoneSchema.safeParse(f.client_telephone);
  if (!tel.success) e.client_telephone = tel.error.issues[0]?.message ?? 'Numéro invalide';
  if (f.client_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.client_email.trim())) e.client_email = 'Adresse e-mail invalide';
  const v = Number(f.validite);
  if (!/^\d+$/.test(f.validite.trim()) || v < 1 || v > 365) e.validite_jours = 'Entre 1 et 365 jours';
  if (!f.mode_remise) e.mode_remise = 'Choisissez : à venir chercher sur place, ou à livrer.';
  if (f.delai.trim() && (!/^\d+$/.test(f.delai.trim()) || Number(f.delai) > 365)) e.delai_jours = 'Nombre de jours entre 0 et 365';
  if (f.acompte.trim() && (!/^\d+$/.test(f.acompte.trim()) || Number(f.acompte) > 100)) e.acompte_pourcent = 'Pourcentage entier entre 0 et 100';
  return e;
}

export default function EditeurDevis() {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : undefined;
  const edition = id !== undefined;
  const user = useUser();
  const navigate = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();

  const devis = useQuery({ queryKey: ['devis', id], queryFn: () => api.get<Devis>(`/devis/${id}`), enabled: edition, retry: false });
  const tarifs = useTarifs();
  const { params, parDefaut } = useParamsPrix();
  const libelle = useLibelles(tarifs.data);

  const [f, setF] = useState<Formulaire>(vide);
  const initial = useRef<Formulaire | null>(edition ? null : vide());
  const [pret, setPret] = useState(!edition);
  const [tente, setTente] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreurApi, setErreurApi] = useState<{ titre: string; lignes: string[]; champs: Record<string, string> } | null>(null);

  useEffect(() => {
    if (edition && devis.data && !initial.current) {
      const init = depuisDevis(devis.data);
      initial.current = init;
      setF(init);
      setPret(true);
    }
  }, [edition, devis.data]);

  // Nouveau devis : validité par défaut fixée dans Paramètres > Documents, tant que la personne ne l'a pas changée.
  const regles = useRegles();
  const validiteTouchee = useRef(false);
  useEffect(() => {
    const jours = regles.data?.documents.devis_validite_jours;
    if (edition || !jours || validiteTouchee.current) return;
    setF((x) => ({ ...x, validite: String(jours) }));
    if (initial.current) initial.current = { ...initial.current, validite: String(jours) };
  }, [edition, regles.data]);

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
  const erreursForm = useMemo(() => (tente ? { ...valider(f), ...(erreurApi?.champs ?? {}) } : erreurApi?.champs ?? {}), [tente, f, erreurApi]);
  const erreursSpecs = useMemo(() => {
    const out: Record<string, string> = tente ? { ...conversion.erreurs } : {};
    for (const [k, v] of Object.entries(erreurApi?.champs ?? {})) {
      const cle = k.replace(/^specs\./, '');
      if (/^(lignes|forfaits|remise)/.test(cle)) out[cle] = v;
    }
    return out;
  }, [tente, conversion.erreurs, erreurApi]);

  const d = devis.data;
  const modifiable = !edition || (d ? d.peut_modifier ?? ['brouillon', 'envoye'].includes(d.statut) : false);

  if (edition) {
    if (devis.isLoading || (!pret && !devis.isError)) {
      return (
        <>
          <PageHeader title="Modifier le devis" crumbs={<Link to="/devis">Devis</Link>} />
          <LoadingRows rows={6} />
        </>
      );
    }
    if (devis.isError || !d) {
      return (
        <>
          <PageHeader title="Modifier le devis" crumbs={<Link to="/devis">Devis</Link>} />
          <Card>
            <EmptyState title="Devis introuvable" action={<Button onClick={() => navigate('/devis')}>Revenir aux devis</Button>}>
              {messageErreur(devis.error)}
            </EmptyState>
          </Card>
        </>
      );
    }
  }

  const soumettre = async (e?: FormEvent) => {
    e?.preventDefault();
    setTente(true);
    setErreurApi(null);
    const ef = valider(f);
    if (Object.keys(ef).length || Object.keys(conversion.erreurs).length) {
      setErreurApi({ titre: 'Certains champs sont à corriger.', lignes: [], champs: {} });
      return;
    }
    if (!conversion.specs?.lignes.length) {
      setErreurApi({ titre: 'Ajoutez au moins une ligne pour chiffrer le devis.', lignes: [], champs: {} });
      return;
    }
    if (resultat && !resultat.ok) {
      setErreurApi({ titre: 'Le prix du devis ne peut pas être calculé.', lignes: resultat.erreurs, champs: {} });
      return;
    }
    const corps = construire(f, conversion.specs);
    setEnvoi(true);
    try {
      let res: Devis;
      if (!edition) {
        res = await api.post<Devis>('/devis', corps);
      } else {
        const avantConv = convertirSpecs(initial.current!.machine, initial.current!.specs);
        const avant = construire(initial.current!, avantConv.specs ?? avantConv.apercu) as Record<string, unknown>;
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(corps)) if (JSON.stringify(v) !== JSON.stringify(avant[k])) patch[k] = v;
        if (patch.machine !== undefined) patch.specs = corps.specs;
        if (!Object.keys(patch).length) {
          toast.info('Aucune modification', 'Le devis est inchangé.');
          navigate(`/devis/${id}`);
          return;
        }
        res = await api.patch<Devis>(`/devis/${id}`, patch);
      }
      qc.setQueryData(['devis', res.id], res);
      void qc.invalidateQueries({ queryKey: ['devis'] });
      toast.success(edition ? 'Devis enregistré' : `Devis ${res.numero} créé`, `${formatFCFA(res.total_ttc)} · ${res.client_nom}`);
      navigate(`/devis/${res.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErreurApi({ titre: err.message, lignes: Array.isArray(err.details?.erreurs) ? err.details.erreurs : [], champs: err.champs ?? {} });
      } else {
        setErreurApi({ titre: messageErreur(err), lignes: [], champs: {} });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnvoi(false);
    }
  };

  const total = resultat?.ok ? resultat.total_ttc : null;
  const acompteMontant = total !== null && /^\d+$/.test(f.acompte.trim()) && Number(f.acompte) <= 100 ? Math.round((total * Number(f.acompte)) / 100) : null;
  const titre = edition ? `Modifier ${d?.numero ?? 'le devis'}` : 'Nouveau devis';

  return (
    <>
      <PageHeader
        title={titre}
        crumbs={
          <>
            <Link to="/devis">Devis</Link>
            <span aria-hidden="true">/</span>
            {edition && d ? <Link to={`/devis/${d.id}`}>{d.numero}</Link> : <span>Nouveau</span>}
          </>
        }
        subtitle={edition && d ? `${d.client_nom} · ${STATUT_DEVIS_LABELS[d.statut]}` : 'Chiffrez le travail pour le client ; le devis accepté se convertit ensuite en dossier.'}
      />

      {!modifiable && d && (
        <Alert tone="warning">
          Un devis « {STATUT_DEVIS_LABELS[d.statut]} » ne se modifie plus. Créez un nouveau devis si le client demande un changement.
        </Alert>
      )}

      {erreurApi && (erreurApi.titre !== 'Certains champs sont à corriger.' || Object.keys(erreursForm).length + Object.keys(erreursSpecs).length > 0) && (
        <Alert tone="error">
          <strong>{erreurApi.titre}</strong>
          {erreurApi.lignes.length > 0 && (
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {erreurApi.lignes.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      <form id="form-devis" className="nd-layout" data-machine={f.machine} onSubmit={soumettre} noValidate>
        <fieldset disabled={!modifiable} className="nd-main" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          {modifiable && <SuggestionIA brouillon={f.specs} onAppliquer={(machine, specs) => setF((x) => ({ ...x, machine, specs }))} />}
          <Card title={<><span className="nd-section__num">1</span>Client</>} className="nd-section">
            <div className="nd-grid nd-grid--3">
              <ClientAutocomplete
                nom={f.client_nom}
                clientId={f.client_id}
                autoFocus={!edition}
                erreur={erreursForm.client_nom}
                onNom={(v) => maj('client_nom', v)}
                onSelect={(c) =>
                  setF((x) =>
                    c ? { ...x, client_id: c.id, client_nom: c.nom, client_telephone: c.telephone ?? x.client_telephone, client_email: c.email ?? x.client_email } : { ...x, client_id: null },
                  )
                }
              />
              <TextField label="Téléphone" type="tel" inputMode="tel" mono value={f.client_telephone} onChange={(e) => maj('client_telephone', e.target.value)} placeholder="77 123 45 67" error={erreursForm.client_telephone} autoComplete="off" />
              <TextField label="E-mail" type="email" value={f.client_email} onChange={(e) => maj('client_email', e.target.value)} placeholder="nom@exemple.sn" error={erreursForm.client_email} autoComplete="off" />
            </div>
          </Card>

          <Card title={<><span className="nd-section__num">2</span>Travail demandé</>} className="nd-section">
            <div className="stack">
              <div className="nd-machine">
                <Segmented
                  name="machine-devis"
                  label="Machine"
                  value={f.machine}
                  onChange={changerMachine}
                  options={MACHINES.map((m) => ({ value: m, label: MACHINE_LABELS[m], help: MACHINE_DESCRIPTIONS[m] }))}
                />
              </div>
              <TextField label="Description" value={f.description} onChange={(e) => maj('description', e.target.value)} placeholder="Ex. 500 flyers A5 pour l'ouverture du magasin" error={erreursForm.description} maxLength={2000} />
            </div>
          </Card>

          <Card title={<><span className="nd-section__num">3</span>Spécifications</>} className="nd-section">
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

          <Card title={<><span className="nd-section__num">4</span>Remise au client et délai</>} className="nd-section">
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
                erreurs={{ ...erreursForm, ...(erreursSpecs.livraison_contact ? { livraison_contact: erreursSpecs.livraison_contact } : {}) }}
              />
              <UrgenceChoix machine={f.machine} tarifs={tarifs.data} draft={f.specs} onDraft={(specs) => maj('specs', specs)} />
            </div>
          </Card>

          <Card title={<><span className="nd-section__num">5</span>Fichiers et BAT</>} className="nd-section">
            <FichiersEtBat machine={f.machine} tarifs={tarifs.data} draft={f.specs} onDraft={(specs) => maj('specs', specs)} />
          </Card>

          <Card title={<><span className="nd-section__num">6</span>Conditions du devis</>} className="nd-section">
            <div className="stack">
              <div className="nd-grid">
                <TextField label="Validité" required mono addon="jours" inputMode="numeric" value={f.validite} onChange={(e) => { validiteTouchee.current = true; maj('validite', e.target.value); }} error={erreursForm.validite_jours} help="Durée pendant laquelle les prix sont garantis." />
                <TextField label="Délai de fabrication" mono addon="jours" inputMode="numeric" value={f.delai} onChange={(e) => maj('delai', e.target.value)} error={erreursForm.delai_jours} help="Après validation du BAT. Facultatif." />
                <TextField
                  label="Acompte demandé"
                  mono
                  addon="%"
                  inputMode="numeric"
                  value={f.acompte}
                  onChange={(e) => maj('acompte', e.target.value)}
                  error={erreursForm.acompte_pourcent}
                  help={acompteMontant !== null ? `Soit ${formatFCFA(acompteMontant)} à la commande.` : 'À payer à la commande. Facultatif.'}
                />
              </div>
              <TextField
                label="Conditions de paiement"
                value={f.conditions_paiement}
                onChange={(e) => maj('conditions_paiement', e.target.value)}
                placeholder="Ex. Solde à la livraison, par Wave ou en espèces"
                error={erreursForm.conditions_paiement}
                maxLength={1000}
              />
              <TextareaField
                label="Remarques"
                rows={3}
                value={f.notes}
                onChange={(e) => maj('notes', e.target.value)}
                placeholder="Précisions pour le client"
                help="Imprimées sur le devis avec le délai, l’acompte et les conditions."
                error={erreursForm.notes}
                maxLength={2000}
              />
            </div>
          </Card>
        </fieldset>

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
            peutEditerTarifs={user.role === 'admin'}
            titre="Prix du devis"
          />
        </aside>
      </form>

      <div className="du-barre" role="region" aria-label="Enregistrer le devis">
        <div className="du-barre__info">
          <small>Total du devis</small>
          <span className="ev-num">{total === null ? '—' : formatFCFA(total)}</span>
        </div>
        <div className="du-barre__actions">
          <Button onClick={() => navigate(edition ? `/devis/${id}` : '/devis')}>Annuler</Button>
          <Button type="submit" form="form-devis" variant="primary" busy={envoi} disabled={!modifiable} icon={<Save />}>
            {edition ? 'Enregistrer le devis' : 'Créer le devis'}
          </Button>
        </div>
      </div>
    </>
  );
}
