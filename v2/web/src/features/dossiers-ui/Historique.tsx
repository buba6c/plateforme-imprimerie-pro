// Historique d'un dossier : changements de statut, commentaires, fichiers, paiements,
// modifications (détail avant → après pour l'administrateur), et ajout d'un commentaire.

import { useState, type ReactNode } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import {
  ACTIONS_BY_ID,
  formatDate,
  formatDateHeure,
  formatFCFA,
  formatTaille,
  isStatut,
  MACHINE_LABELS,
  MODE_PAIEMENT_LABELS,
  resumeLigne,
  ROLE_LABELS,
  type ActionId,
  type LigneRoland,
  type LigneXerox,
  type Machine,
  type ModePaiement,
  type Specs,
} from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import type { DossierDetail, Evenement } from '../../lib/types';
import { Button, StatusBadge, useToast } from '../../ui';
import { useDossierMutation } from '../dossiers/hooks';
import './dossiers-ui.css';

type Ton = 'accent' | 'warning' | 'success' | undefined;

interface Description {
  titre: ReactNode;
  ton?: Ton;
  note?: string | null;
  details?: ReactNode;
}

const CHAMPS: Record<string, string> = {
  client_nom: 'Client',
  client_telephone: 'Téléphone',
  client_email: 'E-mail',
  description: 'Description',
  consignes: 'Consignes',
  montant: 'Montant',
  mode_paiement_prevu: 'Paiement prévu',
  urgent: 'Urgent',
  date_promise: 'Date promise',
  adresse_livraison: 'Adresse de livraison',
  machine: 'Machine',
  specs: 'Spécifications',
};

const mode = (m: unknown) => (typeof m === 'string' && m in MODE_PAIEMENT_LABELS ? MODE_PAIEMENT_LABELS[m as ModePaiement] : String(m ?? ''));

function valeurChamp(champ: string, v: unknown, machine: Machine, libelle: (m: Machine, c: string) => string): string {
  if (v === null || v === undefined || v === '') return 'vide';
  switch (champ) {
    case 'montant':
      return formatFCFA(Number(v));
    case 'urgent':
      return v ? 'oui' : 'non';
    case 'date_promise':
      return formatDate(String(v));
    case 'mode_paiement_prevu':
      return mode(v);
    case 'machine':
      return MACHINE_LABELS[v as Machine] ?? String(v);
    case 'specs': {
      const lignes = ((v as Specs).lignes ?? []) as (LigneRoland | LigneXerox)[];
      if (!lignes.length) return 'aucune ligne';
      const premiere = resumeLigne(machine, lignes[0]!, libelle(machine, lignes[0]!.support));
      return lignes.length > 1 ? `${premiere} + ${lignes.length - 1} ligne${lignes.length > 2 ? 's' : ''}` : premiere;
    }
    default:
      return String(v);
  }
}

function decrire(e: Evenement, ctx: { machine: Machine; libelle: (m: Machine, c: string) => string; nomUtilisateur: (id: number) => string | null }): Description {
  const data = e.data ?? null;
  switch (e.type) {
    case 'creation':
      return { titre: 'Dossier créé', ton: 'accent' };
    case 'statut': {
      if (e.action === 'forcer') {
        return { titre: 'Statut forcé par l’administrateur', ton: 'warning', note: e.commentaire };
      }
      const def = e.action ? ACTIONS_BY_ID[e.action as ActionId] : undefined;
      const ton: Ton = e.action === 'demander_revision' ? 'warning' : e.vers_statut === 'livre' || e.vers_statut === 'termine' ? 'success' : 'accent';
      return { titre: def?.journal ?? 'Changement de statut', ton, note: e.commentaire };
    }
    case 'commentaire':
      return { titre: 'Commentaire', note: e.commentaire };
    case 'fichier': {
      const nom = data?.nom ? `« ${data.nom} »` : '';
      switch (e.action) {
        case 'ajout':
          return { titre: <>Fichier ajouté {nom}{data?.taille ? <span className="ev-muted ev-mono" style={{ fontSize: 12 }}> · {formatTaille(data.taille)}</span> : null}</> };
        case 'suppression':
          return { titre: `Fichier supprimé ${nom}` };
        case 'a_reimprimer':
          return { titre: `Fichier marqué à réimprimer ${nom}`, ton: 'warning' };
        case 'reimpression_annulee':
          return { titre: `Réimpression annulée ${nom}` };
        case 'restauration':
          return { titre: `Fichier restauré ${nom}` };
        default:
          return { titre: `Fichier ${nom}` };
      }
    }
    case 'paiement': {
      const montant = data?.montant ? `${formatFCFA(data.montant)}${data.mode ? ` en ${mode(data.mode)}` : ''}` : '';
      switch (e.action) {
        case 'encaisse':
          return { titre: `Encaissement à valider${montant ? ` : ${montant}` : ''}`, details: data?.reference ? <span className="ev-mono ev-muted" style={{ fontSize: 12 }}>Réf. {data.reference}</span> : null };
        case 'encaisse_valide':
          return { titre: `Paiement enregistré${montant ? ` : ${montant}` : ''}`, ton: 'success', details: data?.reference ? <span className="ev-mono ev-muted" style={{ fontSize: 12 }}>Réf. {data.reference}</span> : null };
        case 'valide':
          return { titre: `Paiement validé${montant ? ` : ${montant}` : ''}`, ton: 'success' };
        case 'refuse':
          return { titre: `Paiement refusé${montant ? ` : ${montant}` : ''}`, ton: 'warning', note: e.commentaire };
        default:
          return { titre: `Paiement${montant ? ` : ${montant}` : ''}` };
      }
    }
    case 'urgence':
      if (data && typeof data.urgent === 'boolean') return { titre: data.urgent ? 'Dossier marqué urgent' : 'Urgence retirée', ton: data.urgent ? 'warning' : undefined };
      return { titre: 'Urgence modifiée' };
    case 'affectation': {
      if (!data) return { titre: 'Affectation modifiée' };
      const parts: string[] = [];
      if ('imprimeur_id' in data) parts.push(`imprimeur : ${data.imprimeur_id ? ctx.nomUtilisateur(data.imprimeur_id) ?? `n° ${data.imprimeur_id}` : 'aucun'}`);
      if ('livreur_id' in data) parts.push(`livreur : ${data.livreur_id ? ctx.nomUtilisateur(data.livreur_id) ?? `n° ${data.livreur_id}` : 'aucun'}`);
      return { titre: `Affectation modifiée${parts.length ? ` (${parts.join(', ')})` : ''}` };
    }
    case 'livraison':
      if (e.action === 'reporter') {
        return { titre: `Livraison reportée${data?.apres ? ` au ${formatDateHeure(data.apres)}` : ''}`, ton: 'warning', note: e.commentaire };
      }
      return { titre: 'Livraison', note: e.commentaire };
    case 'suppression':
      return { titre: 'Dossier mis à la corbeille', ton: 'warning', note: e.commentaire };
    case 'restauration':
      return { titre: 'Dossier restauré depuis la corbeille', ton: 'accent' };
    case 'modification': {
      if (e.action === 'facture_emise') return { titre: `Facture émise${data?.numero ? ` : ${data.numero}` : ''}`, ton: 'success' };
      if (e.action === 'facture_annulee') return { titre: `Facture annulée${data?.numero ? ` : ${data.numero}` : ''}`, ton: 'warning', note: e.commentaire };
      if (e.action === 'devis_converti') return { titre: `Créé à partir du devis${data?.devis_numero ? ` ${data.devis_numero}` : ''}`, ton: 'accent' };
      const changes = data && typeof data === 'object' ? Object.entries(data as Record<string, { avant: unknown; apres: unknown }>) : [];
      const valides = changes.filter(([, c]) => c && typeof c === 'object' && 'apres' in c);
      return {
        titre: 'Dossier modifié',
        note: e.commentaire,
        details: valides.length ? (
          <ul className="fd-diff">
            {valides.map(([champ, c]) => (
              <li key={champ}>
                <span className="fd-diff__champ">{CHAMPS[champ] ?? champ}</span>
                <span className="fd-diff__avant">{valeurChamp(champ, c.avant, ctx.machine, ctx.libelle)}</span>
                <span aria-label="devient">→</span>
                <span>{valeurChamp(champ, c.apres, ctx.machine, ctx.libelle)}</span>
              </li>
            ))}
          </ul>
        ) : null,
      };
    }
    default:
      return { titre: e.type.charAt(0).toUpperCase() + e.type.slice(1).replace(/_/g, ' '), note: e.commentaire };
  }
}

export function Historique({ dossier, libelle, nomUtilisateur }: {
  dossier: DossierDetail;
  libelle: (m: Machine, c: string) => string;
  nomUtilisateur: (id: number) => string | null;
}) {
  const toast = useToast();
  const [texte, setTexte] = useState('');
  const commenter = useDossierMutation((t: string) => api.post<DossierDetail>(`/dossiers/${dossier.id}/commentaires`, { texte: t }));
  const envoyer = () =>
    commenter.mutate(texte.trim(), {
      onSuccess: () => {
        setTexte('');
        toast.success('Commentaire ajouté', dossier.numero);
      },
      onError: (e) => toast.error('Commentaire non enregistré', messageErreur(e)),
    });

  return (
    <div>
      <form
        className="fd-histo-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (texte.trim().length >= 2) envoyer();
        }}
      >
        <label className="ev-label" htmlFor="fd-commentaire">
          Ajouter un commentaire
        </label>
        <textarea
          id="fd-commentaire"
          className="ev-textarea"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Information utile pour l’équipe : appel du client, précision sur le fichier…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && texte.trim().length >= 2) envoyer();
          }}
        />
        <div className="row-between">
          <span className="ev-help">Visible par toutes les personnes qui suivent le dossier.</span>
          <Button type="submit" size="sm" icon={<MessageSquarePlus />} busy={commenter.isPending} disabled={texte.trim().length < 2}>
            Ajouter le commentaire
          </Button>
        </div>
      </form>

      {dossier.historique.length === 0 ? (
        <p className="ev-muted" style={{ margin: 0 }}>Aucun événement pour l’instant.</p>
      ) : (
        <ol className="ev-timeline">
          {dossier.historique.map((e) => {
            const d = decrire(e, { machine: dossier.machine, libelle, nomUtilisateur });
            return (
              <li key={e.id} className="ev-timeline__item" data-tone={d.ton}>
                <span className="ev-timeline__dot" aria-hidden="true" />
                <div style={{ minWidth: 0 }}>
                  <div className="ev-timeline__title">{d.titre}</div>
                  {e.type === 'statut' && e.de_statut && e.vers_statut && isStatut(e.de_statut) && isStatut(e.vers_statut) && (
                    <div className="fd-transition" aria-label="Changement de statut">
                      <StatusBadge statut={e.de_statut} />
                      <span className="ev-muted" aria-hidden="true">→</span>
                      <StatusBadge statut={e.vers_statut} />
                    </div>
                  )}
                  <div className="ev-timeline__meta">
                    {e.user_nom ?? 'Système'}
                    {e.user_role ? ` · ${ROLE_LABELS[e.user_role]}` : ''} · <span className="ev-mono" style={{ fontSize: 12 }}>{formatDateHeure(e.created_at)}</span>
                  </div>
                  {d.details && <div style={{ marginTop: 4 }}>{d.details}</div>}
                  {d.note && <div className="ev-timeline__note">{d.note}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
