// Réglage de l'assistant IA de saisie : activation, modèle, clé OpenAI (en écriture seule),
// test de connexion et derniers usages.

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, PlugZap, Sparkles, Trash2 } from 'lucide-react';
import { formatDateHeure, formatDecimal, formatEntier, formatRelatif } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Card, Checkbox, ConfirmDialog, EmptyState, LoadingRows, PageHeader, SelectField, TextField, useToast } from '../../ui';
import { champsErreur } from '../../features/admin/hooks';
import { useConfigIA, useUsagesIA } from '../../features/ia/hooks';
import { MODELES_IA, STATUT_USAGE_LABELS, type ConfigIA } from '../../features/ia/types';
import '../../features/admin/admin.css';
import '../../features/ia/ia.css';

export default function AssistantIA() {
  const config = useConfigIA();
  return (
    <div className="stack-lg">
      <PageHeader
        title="Assistant IA"
        subtitle="Dans les formulaires de dossier et de devis, l’assistant propose des spécifications à partir de la description d’une demande. Il ne crée ni ne modifie rien : la personne relit puis enregistre, et le prix est toujours calculé avec la grille tarifaire."
      />
      {config.isError ? (
        <Alert tone="error">Les réglages de l’assistant n’ont pas pu être chargés : {messageErreur(config.error)}</Alert>
      ) : !config.data ? (
        <LoadingRows rows={5} />
      ) : (
        <div className="grid-main">
          <Reglages c={config.data} />
          <Fonctionnement />
        </div>
      )}
      <Usages />
    </div>
  );
}

function Fonctionnement() {
  return (
    <Card title="Fonctionnement">
      <div className="stack">
        <ol className="ia-etapes">
          <li>La personne décrit la demande du client dans le formulaire de dossier ou de devis.</li>
          <li>L’assistant propose la machine, les supports, les dimensions, les quantités, les finitions et les forfaits.</li>
          <li>Le serveur contrôle la proposition : un tarif inconnu ou sans prix est retiré, avec un avertissement.</li>
          <li>Le prix est calculé avec la grille tarifaire, jamais par l’assistant.</li>
          <li>La personne applique la proposition au formulaire, la corrige si besoin, puis enregistre elle-même.</li>
        </ol>
        <p className="adm-explain">
          Ce qui part chez OpenAI : la description saisie et la liste des tarifs actifs (codes, libellés, unités), sans les prix ni les fiches clients. Le
          journal ci-dessous garde au plus les 120 premiers caractères de chaque demande.
        </p>
      </div>
    </Card>
  );
}

function Etat({ c }: { c: ConfigIA }) {
  if (!c.cle_configuree) return <span className="ev-badge ev-pay" data-pay="non_paye">Clé à saisir</span>;
  if (c.cle_lisible === false) return <span className="ev-badge ev-pay" data-pay="refuse">Clé illisible</span>;
  return c.actif ? (
    <span className="ev-badge ev-pay" data-pay="paye">Activé</span>
  ) : (
    <span className="ev-badge ev-pay" data-pay="non_paye">Désactivé</span>
  );
}

function verifierCle(v: string): string | null {
  const s = v.trim();
  if (!s) return 'Collez la clé API OpenAI.';
  if (!s.startsWith('sk-') || /\s/.test(s)) return 'Clé OpenAI invalide : elle commence par « sk- » et ne contient pas d’espace.';
  if (s.length < 20) return 'Clé trop courte : copiez la clé complète.';
  return null;
}

function Reglages({ c }: { c: ConfigIA }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [remplacer, setRemplacer] = useState(false);
  const [cle, setCle] = useState('');
  const [erreurCle, setErreurCle] = useState<string | null>(null);
  const [effacer, setEffacer] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  const enregistrer = useMutation({
    mutationFn: (body: { actif?: boolean; modele?: string; cle?: string | null }) => api.put<ConfigIA>('/ia/config', body),
    onSuccess: (r, body) => {
      qc.setQueryData(['ia', 'config'], r);
      void qc.invalidateQueries({ queryKey: ['ia', 'statut'] });
      setTest(null);
      if (body.cle === null) {
        setEffacer(false);
        toast.success('Clé effacée', 'L’assistant est désactivé jusqu’à l’enregistrement d’une nouvelle clé.');
      } else if (body.cle) {
        setCle('');
        setRemplacer(false);
        toast.success('Clé enregistrée', `Elle se termine par …${r.cle_fin ?? ''}. Testez la connexion pour la vérifier.`);
      } else if (body.actif !== undefined) {
        toast.success(r.actif ? 'Assistant activé' : 'Assistant désactivé', r.actif ? 'Il apparaît dans les formulaires de dossier et de devis.' : 'Il n’apparaît plus dans les formulaires.');
      } else {
        toast.success('Modèle enregistré', MODELES_IA.find((m) => m.value === r.modele)?.label ?? r.modele);
      }
    },
    onError: (e, body) => {
      if (body.cle) setErreurCle(champsErreur(e).cle ?? messageErreur(e));
      else toast.error('Réglage non enregistré', messageErreur(e));
    },
  });

  const tester = useMutation({
    mutationFn: () => api.post<{ ok: true; modele: string; duree_ms: number }>('/ia/test', {}),
    onSuccess: (r) => setTest({ ok: true, message: `Connexion réussie : le modèle ${r.modele} a répondu en ${formatDecimal(r.duree_ms / 1000, 1)} s.` }),
    onError: (e) => setTest({ ok: false, message: messageErreur(e) }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['ia', 'usages'] }),
  });

  const soumettreCle = (e: FormEvent) => {
    e.preventDefault();
    const err = verifierCle(cle);
    setErreurCle(err);
    if (!err) enregistrer.mutate({ cle: cle.trim() });
  };

  const saisie = !c.cle_configuree || remplacer;
  const modele = MODELES_IA.find((m) => m.value === c.modele);
  const occupe = enregistrer.isPending;

  return (
    <Card title="Réglages" actions={<Etat c={c} />}>
      <div className="stack">
        <div className="stack-sm">
          {!saisie && <span className="ev-label">Clé API OpenAI</span>}
          {c.cle_lisible === false && (
            <Alert tone="warning">
              La clé enregistrée ne peut plus être lue : saisissez-la de nouveau. Le secret de chiffrement du serveur a changé depuis son enregistrement.
            </Alert>
          )}
          {c.cle_configuree && !remplacer && (
            <div className="ia-cle">
              <div className="ia-cle__texte">
                <span>
                  Clé enregistrée se terminant par <span className="ev-ref">…{c.cle_fin}</span>
                </span>
                {c.updated_at && (
                  <span className="ev-muted" style={{ fontSize: 13 }}>
                    Réglages modifiés {formatRelatif(c.updated_at)}
                    {c.updated_by_nom ? ` par ${c.updated_by_nom}` : ''}
                  </span>
                )}
              </div>
              <div className="row">
                <Button size="sm" icon={<KeyRound />} onClick={() => (setRemplacer(true), setErreurCle(null))}>
                  Remplacer
                </Button>
                <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => setEffacer(true)}>
                  Effacer
                </Button>
              </div>
            </div>
          )}
          {saisie && (
            <form className="stack-sm" onSubmit={soumettreCle} noValidate>
              <TextField
                label={remplacer ? 'Nouvelle clé API OpenAI' : 'Clé API OpenAI'}
                type="password"
                mono
                autoComplete="new-password"
                spellCheck={false}
                placeholder="sk-…"
                value={cle}
                onChange={(e) => setCle(e.target.value)}
                error={erreurCle}
                help="Créez-la sur platform.openai.com, rubrique API keys. Elle est chiffrée sur le serveur et ne sera plus jamais affichée."
              />
              <div className="row">
                <Button type="submit" variant="primary" busy={occupe && !!cle}>
                  Enregistrer la clé
                </Button>
                {remplacer && (
                  <Button onClick={() => (setRemplacer(false), setCle(''), setErreurCle(null))} disabled={occupe}>
                    Annuler
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>

        <div className="stack-sm">
          <Checkbox
            label="Activer l’assistant pour les administrateurs et les préparateurs"
            checked={c.actif}
            disabled={!c.cle_configuree || occupe}
            onChange={(actif) => enregistrer.mutate({ actif })}
          />
          <span className="ev-help">
            {c.cle_configuree
              ? 'Activé, il apparaît replié en haut des formulaires de dossier et de devis. Chaque personne peut demander 30 propositions par heure.'
              : 'Enregistrez d’abord une clé pour pouvoir activer l’assistant.'}
          </span>
        </div>

        <SelectField
          label="Modèle"
          value={c.modele}
          disabled={occupe}
          onChange={(e) => enregistrer.mutate({ modele: e.target.value })}
          options={MODELES_IA.map((m) => ({ value: m.value, label: m.label }))}
          help={modele?.aide}
        />

        <div className="stack-sm">
          <div className="row">
            <Button icon={<PlugZap />} onClick={() => tester.mutate()} busy={tester.isPending} disabled={!c.cle_configuree || c.cle_lisible === false}>
              Tester la connexion
            </Button>
            <span className="ev-help">Envoie une demande minimale à OpenAI avec la clé enregistrée.</span>
          </div>
          {test && <Alert tone={test.ok ? 'success' : 'error'}>{test.message}</Alert>}
        </div>

      </div>

      <ConfirmDialog
        open={effacer}
        onClose={() => setEffacer(false)}
        onConfirm={() => enregistrer.mutate({ cle: null })}
        busy={occupe}
        danger
        title="Effacer la clé OpenAI ?"
        description="L’assistant sera désactivé pour toute l’équipe jusqu’à l’enregistrement d’une nouvelle clé."
        confirmLabel="Effacer la clé"
      />
    </Card>
  );
}

function Usages() {
  const q = useUsagesIA();
  const t = q.data?.totaux_30_jours;
  return (
    <section className="stack-sm" aria-labelledby="ia-usages">
      <div className="row-between">
        <h2 className="ev-h-heading" id="ia-usages">
          Derniers usages
        </h2>
        {t && (
          <span className="ev-muted" style={{ fontSize: 13 }}>
            30 derniers jours : {formatEntier(t.suggestions)} proposition{t.suggestions > 1 ? 's' : ''}
            {t.erreurs > 0 ? ` dont ${formatEntier(t.erreurs)} en erreur` : ''} · {formatEntier(t.jetons_entree + t.jetons_sortie)} jetons
          </span>
        )}
      </div>
      {q.isError ? (
        <Alert tone="error">Le journal d’usage n’a pas pu être chargé : {messageErreur(q.error)}</Alert>
      ) : q.isLoading ? (
        <LoadingRows rows={3} />
      ) : !q.data?.items.length ? (
        <div className="ev-card">
          <EmptyState title="Aucun usage pour l’instant" icon={<Sparkles aria-hidden="true" />}>
            Les propositions demandées depuis les formulaires et les tests de connexion apparaîtront ici.
          </EmptyState>
        </div>
      ) : (
        <div className="ev-table-wrap">
          <table className="ev-table adm-dense">
            <thead>
              <tr>
                <th>Date</th>
                <th>Personne</th>
                <th>Type</th>
                <th>Résultat</th>
                <th className="adm-num-th">Durée</th>
                <th className="adm-num-th">Jetons</th>
                <th>Demande</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((u) => (
                <tr key={u.id}>
                  <td className="nowrap">
                    <span className="ev-ref">{formatDateHeure(u.created_at)}</span>
                  </td>
                  <td className="nowrap">{u.user_nom ?? '—'}</td>
                  <td className="nowrap">{u.type === 'test' ? 'Test de connexion' : 'Proposition'}</td>
                  <td className="nowrap">
                    <span className="ev-badge ev-pay" data-pay={u.statut === 'ok' ? 'paye' : 'refuse'}>
                      {STATUT_USAGE_LABELS[u.statut] ?? u.statut}
                    </span>
                  </td>
                  <td className="ev-cell-num">{formatDecimal(u.duree_ms / 1000, 1)} s</td>
                  <td className="ev-cell-num">
                    {u.jetons_entree === null && u.jetons_sortie === null ? '—' : formatEntier((u.jetons_entree ?? 0) + (u.jetons_sortie ?? 0))}
                  </td>
                  <td>
                    {u.extrait ? (
                      <span className="ia-extrait" title={u.extrait}>
                        {u.extrait}
                        {u.longueur_demande && u.longueur_demande > u.extrait.length ? '…' : ''}
                      </span>
                    ) : (
                      <span className="ev-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
