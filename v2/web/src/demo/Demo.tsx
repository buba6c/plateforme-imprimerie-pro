// Bandeau de la démonstration : choix du rôle (écran de connexion et « Changer de rôle »),
// réinitialisation, aperçus imprimables et messages venant de l'API simulée.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Printer, RotateCcw, UserRound } from 'lucide-react';
import { ROLE_LABELS, type Role } from '@evocom/shared';
import { accueilPour, useAuth } from '../auth/AuthContext';
import { api, messageErreur } from '../lib/api';
import type { User } from '../lib/types';
import { Button, ConfirmDialog, Dialog, useToast } from '../ui';
import { E, reinitialiser } from './etat';
import { oublierContenus } from './fichiers';
import { EVT_DOCUMENT, EVT_MESSAGE } from './installer';
import { MOT_DE_PASSE_DEMO } from './serveur';
import type { DocumentDemo } from './documents';
import './demo.css';

const COMPTES: { role: Role; email: string }[] = [
  { role: 'admin', email: 'admin@evocom.test' },
  { role: 'preparateur', email: 'prep@evocom.test' },
  { role: 'imprimeur_roland', email: 'roland@evocom.test' },
  { role: 'imprimeur_xerox', email: 'xerox@evocom.test' },
  { role: 'livreur', email: 'livreur@evocom.test' },
];

function ChoixRoles({ onChoisir, occupe }: { onChoisir: (email: string) => void; occupe: string | null }) {
  return (
    <div className="demo-roles">
      {COMPTES.map((c) => {
        const nom = E().users.find((u) => u.email === c.email)?.nom;
        return (
          <Button key={c.email} variant={c.role === 'preparateur' ? 'primary' : 'secondary'} busy={occupe === c.email} disabled={!!occupe} onClick={() => onChoisir(c.email)}>
            <span className="demo-roles__texte">
              Entrer comme {ROLE_LABELS[c.role]}
              {nom && <small>{nom}</small>}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

export function Demo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const [choix, setChoix] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentDemo | null>(null);
  const cadre = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const surMessage = (e: Event) => {
      const d = (e as CustomEvent<{ titre: string; message?: string; ton: 'info' | 'error' }>).detail;
      if (d.ton === 'error') toast.error(d.titre, d.message);
      else toast.info(d.titre, d.message);
    };
    const surDocument = (e: Event) => setDoc((e as CustomEvent<DocumentDemo>).detail);
    window.addEventListener(EVT_MESSAGE, surMessage);
    window.addEventListener(EVT_DOCUMENT, surDocument);
    return () => {
      window.removeEventListener(EVT_MESSAGE, surMessage);
      window.removeEventListener(EVT_DOCUMENT, surDocument);
    };
  }, [toast]);

  /** Change d'utilisateur sans vider le cache : les écrans affichés se rechargent pour le nouveau rôle. */
  const ouvrirSession = useCallback(
    async (u: User | null) => {
      qc.setQueryData(['me'], u);
      await qc.resetQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
      navigate(u ? accueilPour(u.role) : '/connexion', { replace: true });
    },
    [qc, navigate],
  );

  const entrer = async (email: string) => {
    setOccupe(email);
    try {
      const r = await api.post<{ user: User }>('/auth/login', { email, password: MOT_DE_PASSE_DEMO });
      setChoix(false);
      await ouvrirSession(r.user);
    } catch (e) {
      toast.error('Connexion impossible', messageErreur(e));
    } finally {
      setOccupe(null);
    }
  };

  const recommencer = async () => {
    const id = E().userId;
    reinitialiser();
    oublierContenus();
    const u = E().users.find((x) => x.id === id && x.is_active) ?? null;
    E().userId = u?.id ?? null;
    setConfirmer(false);
    await ouvrirSession(u ? { id: u.id, nom: u.nom, email: u.email, role: u.role, telephone: u.telephone, doit_changer_mdp: false } : null);
    toast.success('Démonstration réinitialisée', 'Les données de départ sont rétablies.');
  };

  const connexion = !user || loc.pathname === '/connexion';

  return (
    <>
      {connexion ? (
        <section className="demo-accueil" aria-labelledby="demo-accueil-titre">
          <div className="demo-accueil__texte">
            <h2 id="demo-accueil-titre" className="demo-accueil__titre">
              <FlaskConical aria-hidden="true" /> Démonstration d’Evocom Print
            </h2>
            <p>
              Choisissez un rôle pour entrer. Les données sont fictives et restent dans ce navigateur. Vous pouvez aussi utiliser le formulaire avec une adresse
              de démonstration et le mot de passe <span className="ev-mono">{MOT_DE_PASSE_DEMO}</span>.
            </p>
          </div>
          <ChoixRoles onChoisir={(email) => void entrer(email)} occupe={occupe} />
        </section>
      ) : (
        <div className="demo-bandeau" role="note">
          <FlaskConical aria-hidden="true" className="demo-bandeau__icone" />
          <p className="demo-bandeau__texte">
            <strong>
              Démo<span className="demo-bandeau__long">nstration</span>
            </strong>
            <span className="demo-bandeau__long"> : les données sont fictives et restent dans ce navigateur</span>
          </p>
          <div className="demo-bandeau__actions">
            <Button size="sm" variant="ghost" icon={<UserRound />} onClick={() => setChoix(true)}>
              Changer de rôle
            </Button>
            <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => setConfirmer(true)}>
              <span>
                Réinitialiser<span className="demo-bandeau__long"> la démo</span>
              </span>
            </Button>
          </div>
        </div>
      )}

      <Dialog open={choix} onClose={() => setChoix(false)} title="Changer de rôle" description="Entrez dans l’application avec un autre compte de démonstration. Vos modifications sont conservées.">
        <ChoixRoles onChoisir={(email) => void entrer(email)} occupe={occupe} />
      </Dialog>

      <ConfirmDialog
        open={confirmer}
        onClose={() => setConfirmer(false)}
        onConfirm={() => void recommencer()}
        title="Réinitialiser la démonstration"
        description="Les dossiers, paiements et réglages reviennent à leur état de départ. Les modifications faites dans ce navigateur sont effacées."
        confirmLabel="Réinitialiser"
      />

      <Dialog
        open={!!doc}
        onClose={() => setDoc(null)}
        title={doc?.titre ?? ''}
        description="Aperçu imprimable généré par la démonstration (le serveur produit un PDF)."
        width={920}
        footer={
          <>
            <Button onClick={() => setDoc(null)}>Fermer</Button>
            <Button variant="primary" icon={<Printer />} onClick={() => cadre.current?.contentWindow?.print()}>
              Imprimer
            </Button>
          </>
        }
      >
        {doc && <iframe ref={cadre} className="demo-document" srcDoc={doc.html} title={doc.titre} />}
      </Dialog>
    </>
  );
}
