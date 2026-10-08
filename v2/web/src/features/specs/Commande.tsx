// En-tête commun au dossier et au devis : comment le client récupère son travail, urgence,
// fichiers et BAT. Ce qui a un prix passe par les forfaits du brouillon (livraison, urgence_24h,
// urgence_48h, conception_graphique, correction_fichiers, epreuve_numerique) : le moteur de prix
// les compte comme les autres lignes. Le reste (contact sur place) est enregistré dans les specs.

import { useMemo } from 'react';
import { CODES_TARIF, formatEntier, type Machine } from '@evocom/shared';
import type { Tarif } from '../../lib/types';
import { Checkbox, Segmented } from '../../ui';
import {
  avecFichiers,
  avecForfait,
  avecLivraison,
  avecUrgence,
  aForfait,
  fichiersDe,
  livraisonFacturee,
  urgenceDe,
  type EtatFichiers,
  type SpecsDraft,
  type Urgence,
} from './draft';
import { ChampTexte } from './SpecsEditor';
import './specs.css';

export type ModeRemise = 'livraison' | 'retrait';

function useTarif(tarifs: Tarif[] | undefined, machine: Machine) {
  return useMemo(() => {
    const m = new Map((tarifs ?? []).map((t) => [`${t.machine}:${t.code}`, t]));
    return (code: string) => {
      const t = m.get(`${machine}:${code}`) ?? m.get(`global:${code}`);
      return t && t.actif ? t : undefined;
    };
  }, [tarifs, machine]);
}

/** « +5 000 FCFA », « prix à définir » ou « absent de la grille ». */
function supplement(t: Tarif | undefined): string {
  if (!t) return 'absent de la grille';
  if (t.prix === null) return 'prix à définir';
  return `+${formatEntier(t.prix)} FCFA`;
}

interface RemiseProps {
  machine: Machine;
  tarifs: Tarif[] | undefined;
  draft: SpecsDraft;
  onDraft: (d: SpecsDraft) => void;
  /** '' : pas encore choisi (nouveau dossier ou devis). */
  mode: ModeRemise | '';
  onMode: (m: ModeRemise) => void;
  adresse: string;
  onAdresse: (v: string) => void;
  erreurs?: Record<string, string>;
}

/** Mode de remise : sur place ou livraison (adresse, contact, forfait livraison). */
export function RemiseClient({ machine, tarifs, draft, onDraft, mode, onMode, adresse, onAdresse, erreurs = {} }: RemiseProps) {
  const tarif = useTarif(tarifs, machine);
  const tLivraison = tarif(CODES_TARIF.livraison);
  const changer = (m: ModeRemise) => {
    onMode(m);
    // À livrer : le forfait livraison s'ajoute (décochable si elle est offerte) ; sur place : il est retiré.
    if (m === 'retrait') onDraft(avecLivraison(draft, false));
    else if (mode !== 'livraison' && tLivraison) onDraft(avecLivraison(draft, true));
  };
  return (
    <div className="stack">
      <div className="ev-field sp-groupe">
        <span className="ev-label" aria-hidden="true">
          Comment le client récupère-t-il son travail ?<span className="ev-req">*</span>
        </span>
        <div className="sp-segment-large">
          <Segmented<ModeRemise | ''>
            name="mode-remise"
            label="Comment le client récupère-t-il son travail ?"
            value={mode}
            onChange={(m) => m && changer(m)}
            options={[
              { value: 'retrait', label: 'À venir chercher sur place', help: 'Le client passe à l’atelier' },
              { value: 'livraison', label: 'À livrer', help: tLivraison ? `Forfait livraison ${supplement(tLivraison).replace('+', '')}` : 'Le livreur l’apporte' },
            ]}
          />
        </div>
        {erreurs.mode_remise && <span className="ev-error">{erreurs.mode_remise}</span>}
      </div>
      {mode === 'livraison' && (
        <div className="sp-livraison">
          <ChampTexte className="sp-livraison__adresse" label="Adresse de livraison" value={adresse} onChange={onAdresse} placeholder="Quartier, rue, repère" erreur={erreurs.adresse_livraison} />
          <ChampTexte
            label="Contact sur place"
            value={draft.livraison_contact}
            onChange={(livraison_contact) => onDraft({ ...draft, livraison_contact })}
            placeholder="Nom et téléphone de la personne qui réceptionne"
            erreur={erreurs['livraison_contact']}
          />
          <div className="sp-livraison__forfait">
            <Checkbox
              label={
                <>
                  Facturer la livraison <span className="sp-pill__prix" data-manquant={!tLivraison || tLivraison.prix === null}>{supplement(tLivraison)}</span>
                </>
              }
              checked={livraisonFacturee(draft)}
              disabled={!tLivraison}
              onChange={(on) => onDraft(avecLivraison(draft, on))}
            />
            <span className="sp-aide">Décochez si la livraison est offerte.</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface UrgenceProps {
  machine: Machine;
  tarifs: Tarif[] | undefined;
  draft: SpecsDraft;
  onDraft: (d: SpecsDraft) => void;
  /** Appelé quand une urgence payante est choisie (le dossier passe en tête de file). */
  onUrgent?: (v: boolean) => void;
}

export function UrgenceChoix({ machine, tarifs, draft, onDraft, onUrgent }: UrgenceProps) {
  const tarif = useTarif(tarifs, machine);
  const u = urgenceDe(draft);
  const changer = (v: Urgence) => {
    onDraft(avecUrgence(draft, v));
    if (v !== 'normal') onUrgent?.(true);
  };
  return (
    <div className="ev-field sp-groupe">
      <span className="ev-label" aria-hidden="true">
        Délai
      </span>
      <div className="sp-segment-large">
        <Segmented<Urgence>
          name="urgence"
          label="Délai"
          value={u}
          onChange={changer}
          options={[
            { value: 'normal', label: 'Normal', help: 'Sans supplément' },
            { value: '48h', label: 'Urgent 48 h', help: supplement(tarif(CODES_TARIF.urgence48)) },
            { value: '24h', label: 'Urgent 24 h', help: supplement(tarif(CODES_TARIF.urgence24)) },
          ]}
        />
      </div>
    </div>
  );
}

interface FichiersProps {
  machine: Machine;
  tarifs: Tarif[] | undefined;
  draft: SpecsDraft;
  onDraft: (d: SpecsDraft) => void;
}

/** Fichiers fournis, à créer (conception, éventuellement offerte) ou à corriger ; BAT à valider. */
export function FichiersEtBat({ machine, tarifs, draft, onDraft }: FichiersProps) {
  const tarif = useTarif(tarifs, machine);
  const f = fichiersDe(draft);
  const tConception = tarif(CODES_TARIF.conception);
  const tBat = tarif(CODES_TARIF.bat);
  return (
    <div className="stack">
      <div className="ev-field sp-groupe">
        <span className="ev-label" aria-hidden="true">
          Les fichiers à imprimer
        </span>
        <div className="sp-segment-large">
          <Segmented<EtatFichiers>
            name="fichiers"
            label="Les fichiers à imprimer"
            value={f}
            onChange={(v) => onDraft(avecFichiers(draft, v))}
            options={[
              { value: 'fournis', label: 'Fournis par le client', help: 'Prêts à imprimer' },
              { value: 'a_creer', label: 'À créer', help: `Conception ${supplement(tConception)}` },
              { value: 'a_corriger', label: 'À corriger', help: supplement(tarif(CODES_TARIF.correction)) },
            ]}
          />
        </div>
      </div>
      {f === 'a_creer' && (
        <div className="sp-sousbloc">
          <Checkbox
            label="Conception offerte au client"
            checked={draft.conception_offerte}
            onChange={(conception_offerte) => onDraft({ ...draft, conception_offerte })}
          />
          <span className="sp-aide">Le montant de la conception est déduit et reste visible sur le devis et la facture.</span>
        </div>
      )}
      <div className="sp-sousbloc">
        <Checkbox
          label={
            <>
              BAT à faire valider par le client (épreuve numérique){' '}
              <span className="sp-pill__prix" data-manquant={!tBat || tBat.prix === null}>
                {supplement(tBat)}
              </span>
            </>
          }
          checked={aForfait(draft, CODES_TARIF.bat)}
          disabled={!tBat && !aForfait(draft, CODES_TARIF.bat)}
          onChange={(on) => onDraft(avecForfait(draft, CODES_TARIF.bat, on))}
        />
        <span className="sp-aide">Le client approuve une épreuve avant l’impression.</span>
      </div>
    </div>
  );
}
