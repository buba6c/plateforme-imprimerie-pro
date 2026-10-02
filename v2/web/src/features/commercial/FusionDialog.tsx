// Fusion de deux fiches du même client (administrateur).
// Étape 1 : chercher l'autre fiche. Étape 2 : choisir la fiche conservée et confirmer.
import { useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { messageErreur } from '../../lib/api';
import { Alert, Button, Dialog, Segmented } from '../../ui';
import { useDebounced, useFusionnerClient, useRechercheClients } from './hooks';
import { pluriel } from './format';
import type { ClientDetail, ClientRecherche, ResultatFusion } from './types';

type Fiche = Pick<ClientRecherche, 'id' | 'nom' | 'telephone' | 'email'>;

function coordonnees(f: Fiche): string {
  return [f.telephone, f.email].filter(Boolean).join(' · ') || 'Sans téléphone ni e-mail';
}

export function FusionDialog({ client, onClose, onDone }: { client: ClientDetail; onClose: () => void; onDone: (r: ResultatFusion) => void }) {
  const [q, setQ] = useState('');
  const terme = useDebounced(q, 250);
  const recherche = useRechercheClients(terme);
  const [autre, setAutre] = useState<Fiche | null>(null);
  const [etape, setEtape] = useState<1 | 2>(1);
  const [garde, setGarde] = useState<'courant' | 'autre'>('courant');

  const conservee: Fiche = garde === 'courant' ? client : (autre ?? client);
  const absorbee: Fiche = garde === 'courant' ? (autre ?? client) : client;
  // L'API fusionne la fiche :id DANS dans_id : la mutation part de la fiche absorbée.
  const mutation = useFusionnerClient(absorbee.id);
  const resultats = (recherche.data ?? []).filter((c) => c.id !== client.id);

  const fusionner = () => {
    if (!autre) return;
    mutation.mutate(conservee.id, { onSuccess: onDone });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      width={600}
      title={etape === 1 ? 'Fusionner avec une autre fiche' : 'Confirmer la fusion'}
      description={
        etape === 1
          ? `Cherchez le doublon de « ${client.nom} » : même client enregistré sous un autre nom ou un autre numéro.`
          : 'Vérifiez la fiche conservée : cette opération ne peut pas être annulée.'
      }
      footer={
        etape === 1 ? (
          <>
            <Button key="annuler" onClick={onClose}>Annuler</Button>
            <Button key="continuer" variant="primary" disabled={!autre} onClick={() => setEtape(2)}>
              Continuer
            </Button>
          </>
        ) : (
          <>
            <Button key="retour" onClick={() => setEtape(1)}>Retour</Button>
            <Button key="fusionner" variant="danger" busy={mutation.isPending} onClick={fusionner}>
              Fusionner les fiches
            </Button>
          </>
        )
      }
    >
      {etape === 1 ? (
        <div className="stack">
          <div className="ev-field">
            <label className="ev-label" htmlFor="fusion-recherche">
              Autre fiche
            </label>
            <div className="ev-search">
              <Search aria-hidden="true" />
              <input
                id="fusion-recherche"
                className="ev-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, téléphone ou e-mail"
                autoComplete="off"
                data-autofocus
              />
            </div>
          </div>
          {terme.trim().length < 2 ? (
            <p className="ev-help" style={{ margin: 0 }}>Saisissez au moins 2 caractères.</p>
          ) : recherche.isError ? (
            <Alert tone="error">La recherche a échoué : {messageErreur(recherche.error)}</Alert>
          ) : recherche.isLoading ? (
            <p className="ev-help" style={{ margin: 0 }}>Recherche…</p>
          ) : resultats.length === 0 ? (
            <p className="ev-help" style={{ margin: 0 }}>Aucune autre fiche ne correspond à « {terme.trim()} ».</p>
          ) : (
            <div className="cm-choix" role="group" aria-label="Fiches trouvées">
              {resultats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="cm-choix__item"
                  aria-pressed={autre?.id === c.id}
                  onClick={() => setAutre(c)}
                >
                  <span>
                    {c.nom}
                    <small>{coordonnees(c)}</small>
                  </span>
                  <span className="ev-ref ev-muted">n° {c.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        autre && (
          <div className="stack">
            <Segmented
              name="fiche-conservee"
              label="Fiche conservée"
              value={garde}
              onChange={setGarde}
              options={[
                { value: 'courant', label: `Garder « ${client.nom} »` },
                { value: 'autre', label: `Garder « ${autre.nom} »` },
              ]}
            />
            <div className="cm-fusion">
              <div className="cm-fusion__fiche">
                <small>Fiche absorbée</small>
                <strong>{absorbee.nom}</strong>
                <div className="ev-muted" style={{ fontSize: 13 }}>{coordonnees(absorbee)}</div>
              </div>
              <ArrowRight aria-hidden="true" />
              <div className="cm-fusion__fiche" data-garde="true">
                <small>Fiche conservée</small>
                <strong>{conservee.nom}</strong>
                <div className="ev-muted" style={{ fontSize: 13 }}>{coordonnees(conservee)}</div>
              </div>
            </div>
            <Alert tone="warning">
              Les dossiers, devis et factures de « {absorbee.nom} » seront rattachés à « {conservee.nom} ». Les coordonnées manquantes de la fiche
              conservée seront complétées par celles de l'autre fiche, puis « {absorbee.nom} » disparaîtra des listes. Les documents déjà émis
              gardent le nom imprimé à leur création.
            </Alert>
            {mutation.error && <Alert tone="error">La fusion a échoué : {messageErreur(mutation.error)}</Alert>}
          </div>
        )
      )}
    </Dialog>
  );
}

export function messageFusion(r: ResultatFusion): string {
  const f = r.fusion;
  return `${pluriel(f.dossiers, 'dossier')}, ${pluriel(f.devis, 'devis', 'devis')} et ${pluriel(f.factures, 'facture')} rattachés à « ${f.destination.nom} ».`;
}
