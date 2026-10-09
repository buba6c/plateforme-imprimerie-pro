// Paramètres > Facturation : liaison avec VosFactures.fr (sous-domaine du compte, clé API chiffrée
// et jamais réaffichée, envoi automatique, vendeur par défaut, test de connexion).
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { KeyRound, PlugZap, Save, Trash2, Undo2 } from 'lucide-react';
import { formatDateHeure } from '@evocom/shared';
import { messageErreur } from '../../../lib/api';
import { Alert, Button, Card, Checkbox, ConfirmDialog, LoadingRows, TextField, useToast } from '../../../ui';
import { champsErreur } from '../../admin/hooks';
import { useConfigVosFactures, useEnregistrerConfigVosFactures, useTesterVosFactures } from '../../commercial/hooks';
import type { ConfigVosFactures, ConfigVosFacturesInput } from '../../commercial/types';
import '../../commercial/commercial.css';

interface Brouillon {
  sous_domaine: string;
  envoi_auto: boolean;
  vendeur: ConfigVosFactures['vendeur'];
}

function depuis(c: ConfigVosFactures | undefined): Brouillon {
  return { sous_domaine: c?.sous_domaine ?? '', envoi_auto: c?.envoi_auto ?? false, vendeur: { nom: '', adresse: '', nif: '', email: '', telephone: '', ...(c?.vendeur ?? {}) } };
}

export function SectionFacturation({ onModifie }: { onModifie: (m: boolean) => void }) {
  const q = useConfigVosFactures();
  const enregistrer = useEnregistrerConfigVosFactures();
  const tester = useTesterVosFactures();
  const toast = useToast();
  const initial = useMemo(() => depuis(q.data), [q.data]);
  const [f, setF] = useState<Brouillon>(initial);
  useEffect(() => setF(initial), [initial]);
  const [cle, setCle] = useState('');
  const [remplacer, setRemplacer] = useState(false);
  const [effacer, setEffacer] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultatTest, setResultatTest] = useState<string | null>(null);
  const modifie = JSON.stringify(f) !== JSON.stringify(initial) || cle.trim() !== '';
  useEffect(() => onModifie(modifie), [modifie, onModifie]);

  if (q.isError) return <Alert tone="error">Les réglages VosFactures n’ont pas pu être chargés : {messageErreur(q.error)}</Alert>;
  if (!q.data) return <LoadingRows rows={6} />;
  const c = q.data;
  const saisieCle = !c.cle_configuree || remplacer;

  const corps = (): { erreurs: Record<string, string> } | { body: ConfigVosFacturesInput } => {
    const e: Record<string, string> = {};
    const sd = f.sous_domaine.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.vosfactures\.fr.*$/, '').replace(/\/.*$/, '');
    if (sd && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sd)) e.sous_domaine = 'Indiquez seulement la partie avant .vosfactures.fr (lettres, chiffres, tirets).';
    const k = cle.trim();
    if (k && k.length < 16) e.cle = 'Clé trop courte : copiez la clé API complète affichée dans VosFactures.';
    if (f.vendeur.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.vendeur.email.trim())) e['vendeur.email'] = 'Adresse e-mail invalide.';
    if (f.envoi_auto && !sd) e.sous_domaine = 'Le sous-domaine est obligatoire pour l’envoi automatique.';
    if (f.envoi_auto && !k && !c.cle_configuree) e.cle = 'La clé API est obligatoire pour l’envoi automatique.';
    if (Object.keys(e).length) return { erreurs: e };
    const body: ConfigVosFacturesInput = { sous_domaine: sd, envoi_auto: f.envoi_auto, vendeur: Object.fromEntries(Object.entries(f.vendeur).map(([k2, v]) => [k2, v.trim()])) };
    if (k) body.cle = k;
    return { body };
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const v = corps();
    if ('erreurs' in v) {
      setErreurs(v.erreurs);
      setErreur('Certains champs sont invalides : corrigez-les puis enregistrez de nouveau.');
      return;
    }
    setErreurs({});
    setErreur(null);
    enregistrer.mutate(v.body, {
      onSuccess: (r) => {
        setCle('');
        setRemplacer(false);
        toast.success('Facturation : enregistré', r.actif ? `Liaison VosFactures prête (clé …${r.cle_fin}). Testez la connexion pour la vérifier.` : 'Les réglages s’appliquent dès maintenant.');
      },
      onError: (err) => {
        const ch = champsErreur(err);
        setErreurs(ch);
        setErreur(Object.keys(ch).length ? `Enregistrement refusé : ${Object.values(ch).join(' ; ')}.` : messageErreur(err));
      },
    });
  };

  const lancerTest = () => {
    setResultatTest(null);
    const v = corps();
    const sd = 'body' in v ? v.body.sous_domaine : undefined;
    const k = cle.trim() || undefined;
    tester.mutate(
      { ...(sd ? { sous_domaine: sd } : {}), ...(k ? { cle: k } : {}) },
      {
        onSuccess: (r) => setResultatTest(`Connexion réussie au compte « ${r.sous_domaine} » en ${r.duree_ms} ms (${r.nb_factures_visibles} facture visible sur la première page).`),
        onError: (err) => setResultatTest(`Échec : ${messageErreur(err)}`),
      },
    );
  };

  const testable = !!f.sous_domaine.trim() && (!!cle.trim() || (c.cle_configuree && c.cle_lisible !== false));

  return (
    <form className="stack-lg" onSubmit={submit} noValidate>
      {erreur && <Alert tone="error">{erreur}</Alert>}
      <Card title="Compte VosFactures">
        <div className="stack">
          <p className="adm-explain">
            VosFactures.fr tient votre facturation officielle. Une fois le compte relié, chaque facture Evocom peut y être envoyée (bouton sur la facture, ou
            automatiquement). Une facture annulée ici est annulée là-bas aussi. La clé API est chiffrée dans la base et n’est jamais réaffichée.
          </p>
          <TextField
            label="Sous-domaine du compte"
            mono
            addon=".vosfactures.fr"
            value={f.sous_domaine}
            onChange={(e) => setF({ ...f, sous_domaine: e.target.value })}
            error={erreurs.sous_domaine}
            placeholder="moncompte"
            help="La partie avant .vosfactures.fr dans l’adresse de votre compte (exemple : https://moncompte.vosfactures.fr → moncompte)."
          />
          {c.cle_configuree && c.cle_lisible === false && (
            <Alert tone="warning">La clé enregistrée ne peut plus être lue (le secret de chiffrement du serveur a changé) : saisissez-la de nouveau.</Alert>
          )}
          {c.cle_configuree && !remplacer ? (
            <div className="cm-vf-cle">
              <span>
                <KeyRound size={16} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />
                Clé API enregistrée se terminant par <span className="ev-ref">…{c.cle_fin}</span>
                {c.updated_at && <span className="ev-muted"> · modifiée le {formatDateHeure(c.updated_at)}{c.updated_by_nom ? ` par ${c.updated_by_nom}` : ''}</span>}
              </span>
              <span className="ev-btn-group">
                <Button size="sm" onClick={() => setRemplacer(true)}>
                  Remplacer la clé
                </Button>
                <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => setEffacer(true)}>
                  Effacer
                </Button>
              </span>
            </div>
          ) : (
            <TextField
              label={c.cle_configuree ? 'Nouvelle clé API' : 'Clé API'}
              type="password"
              mono
              autoComplete="off"
              value={cle}
              onChange={(e) => setCle(e.target.value)}
              error={erreurs.cle}
              help={
                <>
                  Dans VosFactures : Paramètres &gt; Paramètres du compte &gt; Intégration &gt; Code API. Elle n’est jamais réaffichée après enregistrement.
                  {remplacer && (
                    <>
                      {' '}
                      <button type="button" className="cm-lien-bouton" onClick={() => (setRemplacer(false), setCle(''))}>
                        Garder la clé actuelle
                      </button>
                    </>
                  )}
                </>
              }
            />
          )}
          <div className="row">
            <Button icon={<PlugZap />} onClick={lancerTest} busy={tester.isPending} disabled={!testable}>
              Tester la connexion
            </Button>
            <span className="ev-help">{saisieCle && !cle.trim() ? 'Saisissez la clé pour tester.' : 'Interroge la liste des factures du compte (page 1, une facture).'}</span>
          </div>
          {resultatTest && <Alert tone={resultatTest.startsWith('Échec') ? 'error' : 'success'}>{resultatTest}</Alert>}
          <Checkbox label="Envoyer automatiquement chaque facture émise vers VosFactures" checked={f.envoi_auto} onChange={(v) => setF({ ...f, envoi_auto: v })} />
          <p className="ev-help prm-aide-check" style={{ margin: 0 }}>
            Sinon, l’envoi se fait à la demande depuis chaque facture. En cas d’échec, l’émission reste faite et la facture indique l’erreur ; un nouvel essai est possible.
          </p>
        </div>
      </Card>

      <Card title="Vendeur sur les factures VosFactures">
        <div className="stack">
          <p className="adm-explain">Un champ vide reprend les coordonnées de Paramètres &gt; Entreprise (valeur actuelle indiquée en exemple).</p>
          <div className="ev-form-grid">
            <TextField label="Nom" value={f.vendeur.nom} onChange={(e) => setF({ ...f, vendeur: { ...f.vendeur, nom: e.target.value } })} placeholder={c.vendeur_effectif.nom} error={erreurs['vendeur.nom']} />
            <TextField label="NINEA / identifiant fiscal" mono value={f.vendeur.nif} onChange={(e) => setF({ ...f, vendeur: { ...f.vendeur, nif: e.target.value } })} placeholder={c.vendeur_effectif.nif || '—'} error={erreurs['vendeur.nif']} />
            <TextField label="E-mail" type="email" value={f.vendeur.email} onChange={(e) => setF({ ...f, vendeur: { ...f.vendeur, email: e.target.value } })} placeholder={c.vendeur_effectif.email || '—'} error={erreurs['vendeur.email']} />
            <TextField label="Téléphone" inputMode="tel" mono value={f.vendeur.telephone} onChange={(e) => setF({ ...f, vendeur: { ...f.vendeur, telephone: e.target.value } })} placeholder={c.vendeur_effectif.telephone || '—'} error={erreurs['vendeur.telephone']} />
          </div>
          <TextField label="Adresse" value={f.vendeur.adresse} onChange={(e) => setF({ ...f, vendeur: { ...f.vendeur, adresse: e.target.value } })} placeholder={c.vendeur_effectif.adresse || '—'} error={erreurs['vendeur.adresse']} />
        </div>
      </Card>

      <div className={modifie ? 'adm-savebar adm-savebar--sticky' : 'adm-savebar'}>
        <span className="ev-muted" style={{ fontSize: 13 }}>
          {modifie ? 'Modifications non enregistrées' : 'Tout est enregistré'}
        </span>
        <Button
          icon={<Undo2 />}
          disabled={!modifie || enregistrer.isPending}
          onClick={() => {
            setF(initial);
            setCle('');
            setRemplacer(false);
            setErreurs({});
            setErreur(null);
          }}
        >
          Annuler<span className="prm-cache-mobile"> les modifications</span>
        </Button>
        <Button type="submit" variant="primary" icon={<Save />} busy={enregistrer.isPending} disabled={!modifie}>
          Enregistrer
        </Button>
      </div>

      <ConfirmDialog
        open={effacer}
        onClose={() => setEffacer(false)}
        onConfirm={() =>
          enregistrer.mutate(
            { cle: null },
            {
              onSuccess: () => {
                setEffacer(false);
                toast.success('Clé VosFactures effacée', 'Plus aucun envoi vers VosFactures n’est possible tant qu’une clé n’est pas enregistrée.');
              },
              onError: (err) => {
                setEffacer(false);
                setErreur(messageErreur(err));
              },
            },
          )
        }
        busy={enregistrer.isPending}
        title="Effacer la clé API VosFactures ?"
        description="Les factures déjà envoyées restent dans VosFactures. L’envoi automatique est désactivé."
        confirmLabel="Effacer la clé"
      />
    </form>
  );
}
