// Réglage de l'assistant IA de saisie : fournisseur utilisé (OpenAI, Google Gemini ou OpenRouter), activation,
// secours automatique, clés (en écriture seule) et modèle de chaque fournisseur, test de connexion,
// et journal de tout ce que l'assistant a fait (chaque essai, chaque erreur).

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, LifeBuoy, PlugZap, Sparkles, Trash2 } from 'lucide-react';
import { formatDateHeure, formatDecimal, formatEntier, formatRelatif } from '@evocom/shared';
import { api, messageErreur } from '../../lib/api';
import { Alert, Button, Card, Checkbox, ConfirmDialog, EmptyState, LoadingRows, PageHeader, Segmented, SelectField, TextField, useToast } from '../../ui';
import { champsErreur } from '../../features/admin/hooks';
import { useConfigIA, useUsagesIA } from '../../features/ia/hooks';
import { GardeIA } from '../../features/ia/GardeIA';
import { FOURNISSEUR_LABELS, FOURNISSEURS_IA, MODELE_OPENROUTER_RE, MODELES_PAR_FOURNISSEUR, STATUT_USAGE_LABELS, type ConfigIA, type FournisseurIA } from '../../features/ia/types';
import '../../features/admin/admin.css';
import '../../features/ia/ia.css';

type Corps = {
  actif?: boolean;
  fournisseur?: FournisseurIA;
  secours?: boolean;
  openai?: { cle?: string | null; modele?: string };
  gemini?: { cle?: string | null; modele?: string };
  openrouter?: { cle?: string | null; modele?: string };
};

function useEnregistrer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Corps) => api.put<ConfigIA>('/ia/config', body),
    onSuccess: (r) => {
      qc.setQueryData(['ia', 'config'], r);
      void qc.invalidateQueries({ queryKey: ['ia', 'statut'] });
    },
  });
}

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
        <>
          <div className="grid-main">
            <Pilotage c={config.data} />
            <Fonctionnement />
          </div>
          <GardeIA />
          <div className="ia-fournisseurs">
            {FOURNISSEURS_IA.map((f) => (
              <CarteFournisseur key={f} c={config.data!} f={f} />
            ))}
          </div>
        </>
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
          Ce qui part chez le fournisseur (OpenAI, Google ou OpenRouter) : la description saisie et la liste des tarifs actifs (codes, libellés, unités), sans les prix ni
          les fiches clients. Le journal ci-dessous garde chaque essai, avec au plus les 120 premiers caractères de la demande, jamais les clés.
        </p>
      </div>
    </Card>
  );
}

function Etat({ c }: { c: ConfigIA }) {
  const f = c.fournisseurs[c.fournisseur];
  if (!f.cle_configuree) return <span className="ev-badge ev-pay" data-pay="non_paye">Clé {FOURNISSEUR_LABELS[c.fournisseur]} à saisir</span>;
  if (f.cle_lisible === false) return <span className="ev-badge ev-pay" data-pay="refuse">Clé illisible</span>;
  return c.actif ? (
    <span className="ev-badge ev-pay" data-pay="paye">Activé · {FOURNISSEUR_LABELS[c.fournisseur]}</span>
  ) : (
    <span className="ev-badge ev-pay" data-pay="non_paye">Désactivé</span>
  );
}

/** Fournisseur utilisé, activation et secours. */
function Pilotage({ c }: { c: ConfigIA }) {
  const toast = useToast();
  const enregistrer = useEnregistrer();
  const occupe = enregistrer.isPending;
  const principal = c.fournisseurs[c.fournisseur];
  const autre = c.secours_fournisseur;
  const autres = FOURNISSEURS_IA.filter((f) => f !== c.fournisseur).map((f) => FOURNISSEUR_LABELS[f]).join(' ou ');
  const envoyer = (body: Corps, titre: string, detail?: string) =>
    enregistrer.mutate(body, { onSuccess: () => toast.success(titre, detail), onError: (e) => toast.error('Réglage non enregistré', messageErreur(e)) });
  return (
    <Card title="Pilotage" actions={<Etat c={c} />}>
      <div className="stack">
        <Segmented<FournisseurIA>
          name="ia-fournisseur"
          label="Fournisseur utilisé pour les propositions"
          value={c.fournisseur}
          onChange={(f) => envoyer({ fournisseur: f }, `Propositions confiées à ${FOURNISSEUR_LABELS[f]}`)}
          options={FOURNISSEURS_IA.map((f) => ({
            value: f,
            label: FOURNISSEUR_LABELS[f],
            help: c.fournisseurs[f].cle_configuree ? `Clé …${c.fournisseurs[f].cle_fin}` : 'clé à saisir',
          }))}
        />
        <div className="stack-sm">
          <Checkbox
            label="Activer l’assistant pour les administrateurs et les préparateurs"
            checked={c.actif}
            disabled={!principal.cle_configuree || occupe}
            onChange={(actif) =>
              envoyer({ actif }, actif ? 'Assistant activé' : 'Assistant désactivé', actif ? 'Il apparaît dans les formulaires de dossier et de devis.' : 'Il n’apparaît plus dans les formulaires.')
            }
          />
          <span className="ev-help">
            {principal.cle_configuree
              ? 'Activé, il apparaît replié en haut des formulaires de dossier et de devis. Chaque personne peut demander 30 propositions par heure.'
              : `Enregistrez d’abord une clé ${FOURNISSEUR_LABELS[c.fournisseur]} ci-dessous pour pouvoir activer l’assistant.`}
          </span>
        </div>
        <div className="stack-sm">
          <Checkbox
            label={`Secours automatique : si ${FOURNISSEUR_LABELS[c.fournisseur]} échoue, essayer ${autre ? FOURNISSEUR_LABELS[autre] : 'un autre fournisseur'}`}
            checked={c.secours}
            disabled={occupe}
            onChange={(secours) => envoyer({ secours }, secours ? 'Secours automatique activé' : 'Secours automatique désactivé')}
          />
          <span className="ev-help">
            {c.secours_possible && autre
              ? `Quota épuisé, service saturé ou en panne, clé refusée : la proposition est redemandée à ${FOURNISSEUR_LABELS[autre]} sans que la personne ait à réessayer. Chaque essai est au journal.`
              : `Pour que le secours fonctionne, enregistrez aussi une clé ${autres}. Sans secours, une panne passagère donne droit à un second essai automatique.`}
          </span>
        </div>
        {c.updated_at && (
          <span className="ev-muted" style={{ fontSize: 13 }}>
            Réglages modifiés {formatRelatif(c.updated_at)}
            {c.updated_by_nom ? ` par ${c.updated_by_nom}` : ''}
          </span>
        )}
      </div>
    </Card>
  );
}

const AIDE_CLE: Record<FournisseurIA, { placeholder: string; ou: string; verifier: (s: string) => string | null }> = {
  openai: {
    placeholder: 'sk-…',
    ou: 'Créez-la sur platform.openai.com, rubrique API keys.',
    verifier: (s) => {
      if (!s) return 'Collez la clé API OpenAI.';
      if (!s.startsWith('sk-') || /\s/.test(s)) return 'Clé OpenAI invalide : elle commence par « sk- » et ne contient pas d’espace.';
      if (s.length < 20) return 'Clé trop courte : copiez la clé complète.';
      return null;
    },
  },
  gemini: {
    placeholder: 'AIza…',
    ou: 'Créez-la sur aistudio.google.com, rubrique « Get API key » (gratuit pour commencer).',
    verifier: (s) => {
      if (!s) return 'Collez la clé API Gemini.';
      if (!/^[A-Za-z0-9_-]+$/.test(s)) return 'Clé Gemini invalide : elle ne contient ni espace ni caractère spécial.';
      if (s.length < 20) return 'Clé trop courte : copiez la clé complète.';
      return null;
    },
  },
  openrouter: {
    placeholder: 'sk-or-v1-…',
    ou: 'Créez-la sur openrouter.ai, rubrique Keys : une seule clé donne accès aux modèles OpenAI, Google, Anthropic, Mistral, DeepSeek…',
    verifier: (s) => {
      if (!s) return 'Collez la clé API OpenRouter.';
      if (!s.startsWith('sk-or-') || /\s/.test(s)) return 'Clé OpenRouter invalide : elle commence par « sk-or- » et ne contient pas d’espace.';
      if (s.length < 20) return 'Clé trop courte : copiez la clé complète.';
      return null;
    },
  },
};

const AUTRE_MODELE = '__autre';

/** Choix du modèle OpenRouter : liste de suggestions, ou n'importe quel identifiant « éditeur/modèle ». */
function ModeleOpenRouter({ valeur, occupe, onChoisir }: { valeur: string; occupe: boolean; onChoisir: (m: string) => void }) {
  const modeles = MODELES_PAR_FOURNISSEUR.openrouter;
  const connu = modeles.some((m) => m.value === valeur);
  const [libre, setLibre] = useState(!connu);
  const [saisie, setSaisie] = useState(connu ? '' : valeur);
  const [erreur, setErreur] = useState<string | null>(null);
  const valider = () => {
    const m = saisie.trim();
    if (!MODELE_OPENROUTER_RE.test(m)) {
      setErreur('Identifiant « éditeur/modèle » attendu, par exemple openai/gpt-4o-mini (copiez-le depuis openrouter.ai/models).');
      return;
    }
    setErreur(null);
    onChoisir(m);
  };
  return (
    <div className="stack-sm">
      <SelectField
        label="Modèle"
        value={libre ? AUTRE_MODELE : valeur}
        disabled={occupe}
        onChange={(e) => {
          if (e.target.value === AUTRE_MODELE) {
            setLibre(true);
            setSaisie(connu ? '' : valeur);
          } else {
            setLibre(false);
            onChoisir(e.target.value);
          }
        }}
        options={[...modeles.map((m) => ({ value: m.value, label: m.label })), { value: AUTRE_MODELE, label: 'Autre modèle du catalogue OpenRouter…' }]}
        help={libre ? `Modèle actuel : ${valeur}` : modeles.find((m) => m.value === valeur)?.aide}
      />
      {libre && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            valider();
          }}
          noValidate
        >
          <TextField
            label="Identifiant du modèle"
            mono
            placeholder="éditeur/modèle, ex. qwen/qwen3-32b"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            error={erreur}
            spellCheck={false}
            autoComplete="off"
            className="grow"
          />
          <Button type="submit" disabled={occupe || !saisie.trim()} busy={occupe}>
            Utiliser ce modèle
          </Button>
        </form>
      )}
    </div>
  );
}

/** Clé, modèle et test de connexion d'un fournisseur. */
function CarteFournisseur({ c, f }: { c: ConfigIA; f: FournisseurIA }) {
  const qc = useQueryClient();
  const toast = useToast();
  const enregistrer = useEnregistrer();
  const conf = c.fournisseurs[f];
  const label = FOURNISSEUR_LABELS[f];
  const aide = AIDE_CLE[f];
  const modeles = MODELES_PAR_FOURNISSEUR[f];
  const [remplacer, setRemplacer] = useState(false);
  const [cle, setCle] = useState('');
  const [erreurCle, setErreurCle] = useState<string | null>(null);
  const [effacer, setEffacer] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

  const tester = useMutation({
    mutationFn: (corps: { cle?: string }) => api.post<{ ok: true; fournisseur: FournisseurIA; modele: string; duree_ms: number }>('/ia/test', { fournisseur: f, ...corps }),
    onSuccess: (r) => setTest({ ok: true, message: `Connexion réussie : ${label}, modèle ${r.modele}, a répondu en ${formatDecimal(r.duree_ms / 1000, 1)} s.` }),
    onError: (e) => setTest({ ok: false, message: messageErreur(e) }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['ia', 'usages'] }),
  });

  const soumettreCle = (e: FormEvent) => {
    e.preventDefault();
    const s = cle.trim();
    const err = aide.verifier(s);
    setErreurCle(err);
    if (err) return;
    enregistrer.mutate(
      { [f]: { cle: s } },
      {
        onSuccess: (r) => {
          setCle('');
          setRemplacer(false);
          setTest(null);
          toast.success(`Clé ${label} enregistrée`, `Elle se termine par …${r.fournisseurs[f].cle_fin ?? ''}. Testez la connexion pour la vérifier.`);
        },
        onError: (e) => setErreurCle(champsErreur(e)[`${f}.cle`] ?? champsErreur(e).cle ?? messageErreur(e)),
      },
    );
  };

  const saisie = !conf.cle_configuree || remplacer;
  const modele = modeles.find((m) => m.value === conf.modele);
  const occupe = enregistrer.isPending;
  const actif = c.fournisseur === f;

  return (
    <Card
      className="ia-fournisseur"
      title={
        <span className="ia-fournisseur__titre">
          <img className="ia-fournisseur__logo" src={`/marque/ia/${f}.svg`} alt="" width={22} height={22} />
          {label}
        </span>
      }
      actions={
        actif ? (
          <span className="ev-badge ev-pay" data-pay="paye">Utilisé</span>
        ) : conf.cle_configuree && c.secours ? (
          <span className="ev-badge ev-pay" data-pay="partiel">
            <LifeBuoy aria-hidden="true" /> Secours
          </span>
        ) : undefined
      }
    >
      <div className="stack">
        <div className="stack-sm">
          {!saisie && <span className="ev-label">Clé API {label}</span>}
          {conf.cle_lisible === false && (
            <Alert tone="warning">La clé enregistrée ne peut plus être lue : saisissez-la de nouveau. Le secret de chiffrement du serveur a changé depuis son enregistrement.</Alert>
          )}
          {conf.cle_configuree && !remplacer && (
            <div className="ia-cle">
              <div className="ia-cle__texte">
                <span>
                  Clé enregistrée se terminant par <span className="ev-ref">…{conf.cle_fin}</span>
                </span>
                <span className="ev-muted" style={{ fontSize: 13 }}>Chiffrée sur le serveur, jamais affichée.</span>
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
                label={remplacer ? `Nouvelle clé API ${label}` : `Clé API ${label}`}
                type="password"
                mono
                autoComplete="new-password"
                spellCheck={false}
                placeholder={aide.placeholder}
                value={cle}
                onChange={(e) => setCle(e.target.value)}
                error={erreurCle}
                help={`${aide.ou} Elle est chiffrée sur le serveur et ne sera plus jamais affichée.`}
              />
              <div className="row">
                <Button type="submit" variant="primary" busy={occupe && !!cle}>
                  Enregistrer la clé
                </Button>
                <Button
                  icon={<PlugZap />}
                  disabled={!cle.trim() || tester.isPending}
                  busy={tester.isPending}
                  onClick={() => {
                    const err = aide.verifier(cle.trim());
                    setErreurCle(err);
                    if (!err) tester.mutate({ cle: cle.trim() });
                  }}
                >
                  Tester avant d’enregistrer
                </Button>
                {remplacer && (
                  <Button variant="ghost" onClick={() => (setRemplacer(false), setCle(''), setErreurCle(null))} disabled={occupe}>
                    Annuler
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>

        {f === 'openrouter' ? (
          <ModeleOpenRouter
            valeur={conf.modele}
            occupe={occupe}
            onChoisir={(m) =>
              enregistrer.mutate(
                { openrouter: { modele: m } },
                { onSuccess: () => toast.success('Modèle OpenRouter enregistré', modeles.find((x) => x.value === m)?.label ?? m), onError: (err) => toast.error('Modèle non enregistré', messageErreur(err)) },
              )
            }
          />
        ) : (
          <SelectField
            label="Modèle"
            value={conf.modele}
            disabled={occupe}
            onChange={(e) =>
              enregistrer.mutate(
                { [f]: { modele: e.target.value } },
                { onSuccess: () => toast.success(`Modèle ${label} enregistré`, modeles.find((m) => m.value === e.target.value)?.label), onError: (err) => toast.error('Modèle non enregistré', messageErreur(err)) },
              )
            }
            options={modeles.map((m) => ({ value: m.value, label: m.label }))}
            help={modele?.aide}
          />
        )}

        {conf.cle_configuree && (
          <div className="stack-sm">
            <div className="row">
              <Button icon={<PlugZap />} onClick={() => tester.mutate({})} busy={tester.isPending} disabled={conf.cle_lisible === false}>
                Tester la connexion
              </Button>
              <span className="ev-help">Envoie une demande minimale à {label} avec la clé enregistrée.</span>
            </div>
          </div>
        )}
        {test && <Alert tone={test.ok ? 'success' : 'error'}>{test.message}</Alert>}
      </div>

      <ConfirmDialog
        open={effacer}
        onClose={() => setEffacer(false)}
        onConfirm={() =>
          enregistrer.mutate(
            { [f]: { cle: null } },
            {
              onSuccess: (r) => {
                setEffacer(false);
                setTest(null);
                toast.success(`Clé ${label} effacée`, r.actif ? undefined : 'L’assistant est désactivé jusqu’à l’enregistrement d’une clé pour le fournisseur utilisé.');
              },
              onError: (e) => toast.error('Clé non effacée', messageErreur(e)),
            },
          )
        }
        busy={occupe}
        danger
        title={`Effacer la clé ${label} ?`}
        description={actif ? 'L’assistant sera désactivé pour toute l’équipe jusqu’à l’enregistrement d’une nouvelle clé.' : `${label} ne pourra plus servir de secours.`}
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
          Tout ce que l’assistant a fait
        </h2>
        {t && (
          <span className="ev-muted" style={{ fontSize: 13 }}>
            30 derniers jours : {formatEntier(t.suggestions)} proposition{t.suggestions > 1 ? 's' : ''}
            {t.erreurs > 0 ? ` dont ${formatEntier(t.erreurs)} en erreur` : ''}
            {t.secours > 0 ? ` · ${formatEntier(t.secours)} par le secours` : ''}
            {t.openai || t.gemini || t.openrouter ? ` · OpenAI ${formatEntier(t.openai)} / Gemini ${formatEntier(t.gemini)} / OpenRouter ${formatEntier(t.openrouter ?? 0)}` : ''} · {formatEntier(t.jetons_entree + t.jetons_sortie)} jetons
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
            Les propositions demandées depuis les formulaires et les tests de connexion apparaîtront ici, avec chaque essai et chaque erreur.
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
                <th>Fournisseur</th>
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
                    {u.fournisseur ? (
                      <span className="ia-fournisseur__cellule">
                        <img src={`/marque/ia/${u.fournisseur}.svg`} alt="" width={16} height={16} />
                        {FOURNISSEUR_LABELS[u.fournisseur]}
                        {u.secours && (
                          <span className="ev-badge ev-pay" data-pay="partiel" title="Essai de secours, après l’échec du premier">
                            secours
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                    {u.modele && <span className="ev-help"> {u.modele}</span>}
                  </td>
                  <td>
                    <span className="ev-badge ev-pay" data-pay={u.statut === 'ok' ? 'paye' : 'refuse'} title={u.erreur ?? undefined}>
                      {STATUT_USAGE_LABELS[u.statut] ?? u.statut}
                    </span>
                    {u.erreur && <span className="ia-erreur">{u.erreur}</span>}
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
