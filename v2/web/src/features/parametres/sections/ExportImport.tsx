import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileUp, Upload } from 'lucide-react';
import { formatFCFA, MACHINE_LABELS } from '@evocom/shared';
import { api, ApiError, messageErreur } from '../../../lib/api';
import { Alert, Button, Card, ConfirmDialog, useToast } from '../../../ui';
import type { Differences } from '../types';

const SECTIONS: Record<string, string> = {
  entreprise: 'Entreprise',
  prix: 'Prix et TVA',
  livreur_jours_historique: 'Livraison',
  fuseau: 'Fuseau horaire',
  securite: 'Sécurité',
  fichiers: 'Fichiers',
  documents: 'Documents',
  notifications: 'Notifications',
};

const CHAMPS_TARIF: Record<string, string> = {
  prix: 'prix',
  libelle: 'libellé',
  actif: 'actif',
  ordre: 'ordre',
  unite: 'unité',
  categorie: 'catégorie',
  description: 'description',
};

function valeur(v: unknown, champ?: string): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  if (typeof v === 'number' && champ === 'prix') return formatFCFA(v);
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const machine = (m: string) => (m === 'global' ? 'Toutes machines' : (MACHINE_LABELS[m as keyof typeof MACHINE_LABELS] ?? m));

/** Corps de l'import en cours : fichier lu et différences calculées par le serveur. */
interface Analyse {
  nom: string;
  contenu: unknown;
  differences: Differences;
}

export function SectionExportImport() {
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [erreur, setErreur] = useState<{ message: string; champs?: [string, string][] } | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  const apercu = useMutation({
    mutationFn: async (fichier: File) => {
      let contenu: unknown;
      try {
        contenu = JSON.parse(await fichier.text());
      } catch {
        throw new Error(`« ${fichier.name} » n’est pas un fichier JSON lisible. Choisissez un fichier exporté depuis cette page.`);
      }
      const differences = await api.post<Differences>('/systeme/configuration/apercu', contenu);
      return { nom: fichier.name, contenu, differences };
    },
    onMutate: () => {
      setErreur(null);
      setAnalyse(null);
    },
    onSuccess: setAnalyse,
    onError: (e) => {
      const champs = e instanceof ApiError && e.champs ? Object.entries(e.champs) : undefined;
      setErreur({ message: messageErreur(e), champs });
    },
  });

  const appliquer = useMutation({
    mutationFn: (contenu: unknown) => api.post<Differences>('/systeme/configuration/importer', contenu),
    onSuccess: (d) => {
      setConfirmer(false);
      setAnalyse(null);
      qc.invalidateQueries({ queryKey: ['parametres'] });
      qc.invalidateQueries({ queryKey: ['tarifs'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success('Configuration importée', `${d.nb_changements} changement${d.nb_changements > 1 ? 's' : ''} appliqué${d.nb_changements > 1 ? 's' : ''}.`);
    },
    onError: (e) => {
      setConfirmer(false);
      setErreur({ message: messageErreur(e) });
    },
  });

  const d = analyse?.differences;

  return (
    <div className="stack-lg">
      <Card title="Exporter">
        <div className="stack">
          <p className="adm-explain">
            Télécharge un fichier JSON avec tous les paramètres de cette page et la grille tarifaire complète. Il ne contient ni mot de passe, ni clé, ni donnée
            client : il sert à préparer un autre serveur ou à garder une copie des réglages.
          </p>
          <div>
            <a className="ev-btn" href="/api/systeme/configuration" download>
              <Download aria-hidden="true" />
              Télécharger la configuration
            </a>
          </div>
        </div>
      </Card>

      <Card title="Importer">
        <div className="stack">
          <p className="adm-explain">
            Choisissez un fichier exporté depuis Evocom Print. Les différences s’affichent d’abord : rien ne change avant votre confirmation. Les tarifs absents
            du fichier sont conservés tels quels.
          </p>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Fichier de configuration"
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              if (fichier) apercu.mutate(fichier);
              e.target.value = '';
            }}
          />
          <div>
            <Button icon={<FileUp />} busy={apercu.isPending} onClick={() => input.current?.click()}>
              Choisir un fichier
            </Button>
          </div>

          {erreur && (
            <Alert tone="error">
              {erreur.message}
              {erreur.champs && (
                <ul className="prm-liste">
                  {erreur.champs.slice(0, 12).map(([k, v]) => (
                    <li key={k}>
                      <span className="ev-ref">{k === '_' ? 'fichier' : k}</span> : {v}
                    </li>
                  ))}
                  {erreur.champs.length > 12 && <li>… et {erreur.champs.length - 12} autre(s) erreur(s).</li>}
                </ul>
              )}
            </Alert>
          )}

          {d && analyse && (
            <div className="stack">
              {d.nb_changements === 0 ? (
                <Alert tone="info">« {analyse.nom} » est identique à la configuration actuelle : il n’y a rien à importer.</Alert>
              ) : (
                <Alert tone="warning">
                  « {analyse.nom} » modifierait {d.nb_changements} élément{d.nb_changements > 1 ? 's' : ''}. Vérifiez la liste avant d’appliquer.
                </Alert>
              )}

              {d.parametres.length > 0 && (
                <div className="ev-table-wrap">
                  <table className="ev-table">
                    <thead>
                      <tr>
                        <th>Paramètre</th>
                        <th>Actuel</th>
                        <th>Après import</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.parametres.map((x) => (
                        <tr key={`${x.section}.${x.champ ?? ''}`}>
                          <td>
                            {SECTIONS[x.section] ?? x.section}
                            {x.champ && <span className="ev-muted"> · {x.champ}</span>}
                          </td>
                          <td className="prm-cellule">{valeur(x.avant)}</td>
                          <td className="prm-cellule">{valeur(x.apres)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(d.tarifs.ajoutes.length > 0 || d.tarifs.modifies.length > 0) && (
                <div className="ev-table-wrap">
                  <table className="ev-table">
                    <thead>
                      <tr>
                        <th>Tarif</th>
                        <th>Changement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.tarifs.ajoutes.map((t) => (
                        <tr key={`+${t.machine}:${t.code}`}>
                          <td>
                            {t.libelle}
                            <span className="ev-muted"> · {machine(t.machine)}</span>
                          </td>
                          <td>Nouveau tarif, {t.prix === null ? 'sans prix' : formatFCFA(t.prix)}</td>
                        </tr>
                      ))}
                      {d.tarifs.modifies.map((t) => (
                        <tr key={`${t.machine}:${t.code}`}>
                          <td>
                            {t.libelle}
                            <span className="ev-muted"> · {machine(t.machine)}</span>
                          </td>
                          <td>
                            {Object.entries(t.champs)
                              .map(([k, v]) => `${CHAMPS_TARIF[k] ?? k} : ${valeur(v.avant, k)} → ${valeur(v.apres, k)}`)
                              .join(' ; ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="adm-explain">
                {d.tarifs.inchanges} tarif{d.tarifs.inchanges > 1 ? 's' : ''} identique{d.tarifs.inchanges > 1 ? 's' : ''}
                {d.tarifs.absents_conserves.length > 0 &&
                  `, ${d.tarifs.absents_conserves.length} tarif${d.tarifs.absents_conserves.length > 1 ? 's' : ''} absent${d.tarifs.absents_conserves.length > 1 ? 's' : ''} du fichier (conservé${d.tarifs.absents_conserves.length > 1 ? 's' : ''})`}
                .
              </p>

              <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <Button onClick={() => setAnalyse(null)}>Annuler</Button>
                <Button variant="primary" icon={<Upload />} disabled={d.nb_changements === 0} onClick={() => setConfirmer(true)}>
                  Appliquer l’import
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmer}
        onClose={() => setConfirmer(false)}
        onConfirm={() => analyse && appliquer.mutate(analyse.contenu)}
        busy={appliquer.isPending}
        title="Appliquer l’import ?"
        description={`${d?.nb_changements ?? 0} changement(s) seront appliqués en une seule fois et inscrits au journal. Les nouveaux réglages s’appliquent immédiatement.`}
        confirmLabel="Appliquer l’import"
      />
    </div>
  );
}
