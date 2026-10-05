// Panneau « Assistant de saisie » des formulaires de dossier et de devis. L'assistant propose
// des spécifications à partir d'une description ; l'utilisateur relit la proposition, l'applique
// au formulaire, la corrige si besoin puis enregistre lui-même. Le prix affiché vient du serveur.

import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ChevronDown, Sparkles } from 'lucide-react';
import { formatFCFA, MACHINE_LABELS, MACHINES, type Machine } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, ConfirmDialog, MachineChip, SelectField, TextareaField, useToast } from '../../ui';
import { SpecsLecture } from '../dossiers-ui/SpecsLecture';
import { LignesPrix, TotauxPrix } from '../specs/PrixPanel';
import type { SpecsDraft } from '../specs/draft';
import { useLibelles, useParamsPrix, useTarifs } from '../specs/useTarifs';
import { appliquerProposition, saisieRemplacee, useStatutIA } from './hooks';
import type { PropositionIA } from './types';
import './ia.css';

interface Props {
  /** Brouillon actuel des spécifications du formulaire. */
  brouillon: SpecsDraft;
  /** Machine imposée (dossier dont la machine ne peut plus changer). */
  machineImposee?: Machine;
  /** Reçoit la machine et le brouillon complet à mettre dans le formulaire. */
  onAppliquer: (machine: Machine, specs: SpecsDraft) => void;
}

/** N'affiche rien tant que l'assistant n'est pas activé par l'administrateur. */
export function SuggestionIA(props: Props) {
  const statut = useStatutIA();
  if (!statut.data?.actif) return null;
  return <Panneau {...props} />;
}

const CLE_OUVERT = 'evocom.ia.ouvert';

function lireOuvert(): boolean {
  try {
    return localStorage.getItem(CLE_OUVERT) === '1';
  } catch {
    return false;
  }
}

function Panneau({ brouillon, machineImposee, onAppliquer }: Props) {
  const id = useId();
  const toast = useToast();
  const tarifs = useTarifs();
  const libelle = useLibelles(tarifs.data);
  const { params } = useParamsPrix();
  const [ouvert, setOuvert] = useState(lireOuvert);
  const [description, setDescription] = useState('');
  const [machine, setMachine] = useState<'' | Machine>('');
  const [proposition, setProposition] = useState<PropositionIA | null>(null);
  const [voirCalcul, setVoirCalcul] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [appliquee, setAppliquee] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CLE_OUVERT, ouvert ? '1' : '0');
    } catch {
      /* préférence d'affichage seulement */
    }
  }, [ouvert]);

  const m = useMutation({
    mutationFn: () =>
      api.post<PropositionIA>('/ia/suggestion', { description: description.trim(), ...((machineImposee ?? machine) ? { machine: machineImposee ?? machine } : {}) }),
    onSuccess: (p) => {
      setProposition(p);
      setVoirCalcul(false);
      setAppliquee(false);
    },
    onError: () => setProposition(null),
  });

  const proposer = () => {
    if (!description.trim() || m.isPending) return;
    m.mutate();
  };
  const raccourci = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      proposer();
    }
  };

  const appliquer = () => {
    if (!proposition) return;
    onAppliquer(proposition.machine, appliquerProposition(brouillon, proposition.machine, proposition.specs));
    setConfirmer(false);
    setAppliquee(true);
    toast.success('Proposition appliquée au formulaire', 'Relisez les spécifications, corrigez-les si besoin, puis enregistrez.');
  };
  const demanderApplication = () => {
    if (!proposition) return;
    if (saisieRemplacee(brouillon, proposition.machine)) setConfirmer(true);
    else appliquer();
  };

  const p = proposition;
  const nbLignes = p?.specs.lignes.length ?? 0;

  return (
    <section className="ev-card ia-panel" data-ouvert={ouvert}>
      <button type="button" className="ia-panel__head" aria-expanded={ouvert} aria-controls={`${id}-corps`} onClick={() => setOuvert((o) => !o)}>
        <Sparkles aria-hidden="true" />
        <span className="ia-panel__titre">Assistant de saisie</span>
        <span className="ia-panel__aide">Décrivez la demande, il propose les lignes à vérifier</span>
        <ChevronDown aria-hidden="true" className="ia-panel__chevron" />
      </button>

      {ouvert && (
        <div id={`${id}-corps`} className="ia-panel__body">
          <TextareaField
            label="Décrivez la demande du client"
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={raccourci}
            placeholder="Ex. 2 bâches de 3 × 1 m avec œillets pour une façade, et la livraison"
            help={`Supports, dimensions, quantités, finitions. Inutile d’écrire le nom ou le téléphone du client. (${description.length}/2000)`}
          />
          <div className="ia-panel__demande">
            {machineImposee ? (
              <span className="ev-help">Machine du dossier : {MACHINE_LABELS[machineImposee]}</span>
            ) : (
              <SelectField
                label="Machine"
                value={machine}
                onChange={(e) => setMachine(e.target.value as '' | Machine)}
                options={[{ value: '', label: 'Au choix de l’assistant' }, ...MACHINES.map((x) => ({ value: x, label: MACHINE_LABELS[x] }))]}
              />
            )}
            <Button onClick={proposer} busy={m.isPending} disabled={!description.trim()}>
              {m.isPending ? 'Proposition en cours…' : 'Proposer'}
            </Button>
          </div>

          {m.isError && <Alert tone="error">{messageErreur(m.error)}</Alert>}

          {p && (
            <div className="ia-prop" aria-live="polite">
              <div className="row-between">
                <h3 className="section-title">Proposition à vérifier</h3>
                <MachineChip machine={p.machine} />
              </div>

              {nbLignes > 0 || p.specs.forfaits.length > 0 ? (
                <SpecsLecture machine={p.machine} specs={p.specs} libelle={libelle} />
              ) : (
                <p className="ev-muted ia-prop__vide">
                  Aucune ligne utilisable. Précisez la demande (support ou format, dimensions, quantité) puis proposez de nouveau.
                </p>
              )}

              {p.avertissements.length > 0 && (
                <Alert tone="warning">
                  <strong>Retiré ou à vérifier</strong>
                  <ul className="ia-prop__liste">
                    {p.avertissements.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              {p.remarques && (
                <Alert tone="info">
                  <strong>Note de l’assistant</strong>
                  <div>{p.remarques}</div>
                </Alert>
              )}

              {p.prix ? (
                <div className="ia-prop__prix">
                  <div className="ia-prop__total">
                    <span>Prix selon la grille</span>
                    <span className="ev-num">{formatFCFA(p.prix.total)}</span>
                  </div>
                  <div>
                    <Button size="sm" variant="ghost" aria-expanded={voirCalcul} onClick={() => setVoirCalcul((v) => !v)}>
                      {voirCalcul ? 'Masquer le calcul' : 'Voir le calcul'}
                    </Button>
                  </div>
                  {voirCalcul && (
                    <div className="stack-sm">
                      <LignesPrix
                        lignes={p.prix.lignes}
                        titreGroupe={(g) => (g === -1 ? 'Forfaits et services' : `Ligne ${g + 1} · ${libelle(p.machine, p.specs.lignes[g]?.support ?? '')}`)}
                      />
                      <TotauxPrix r={p.prix} params={params} />
                    </div>
                  )}
                </div>
              ) : nbLignes > 0 ? (
                <Alert tone="warning">Prix non calculable : {p.erreur_prix ?? 'vérifiez les lignes.'}</Alert>
              ) : null}

              <div className="row">
                <Button variant="primary" onClick={demanderApplication} disabled={nbLignes === 0}>
                  {appliquee ? 'Appliquer de nouveau' : 'Appliquer au formulaire'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setProposition(null);
                    setAppliquee(false);
                  }}
                >
                  Effacer la proposition
                </Button>
              </div>
              <p className="ev-help ia-prop__vide">
                {appliquee
                  ? 'Appliquée : relisez les spécifications du formulaire, corrigez-les si besoin, puis enregistrez.'
                  : 'Rien n’est enregistré : la proposition remplit seulement le formulaire, que vous relisez et enregistrez vous-même.'}
              </p>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmer}
        onClose={() => setConfirmer(false)}
        onConfirm={appliquer}
        title="Remplacer la saisie en cours ?"
        description={`Les lignes ${p ? MACHINE_LABELS[p.machine] : ''} et les forfaits déjà saisis seront remplacés par la proposition. La remise éventuelle est conservée.`}
        confirmLabel="Remplacer par la proposition"
      />
    </section>
  );
}
