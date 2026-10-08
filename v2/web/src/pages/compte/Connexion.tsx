import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { FileCheck, Printer, Truck } from 'lucide-react';
import { accueilPour, useAuth } from '../../auth/AuthContext';
import { messageErreur } from '../../lib/api';
import { Alert, Button, TextField } from '../../ui';

const ETAPES = [
  { icone: FileCheck, titre: 'Préparation', texte: 'Fichiers vérifiés, devis et bon de commande' },
  { icone: Printer, titre: 'Impression', texte: 'Files Roland et Xerox en temps réel' },
  { icone: Truck, titre: 'Livraison', texte: 'Tournées, remise au client et encaissement' },
];

export default function Connexion() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={loc.state?.from ?? accueilPour(user.role)} replace />;

  return (
    <div className="login">
      <aside className="login__aside" aria-hidden="true">
        <img className="login__filigrane" src="/marque/evocom-oiseau.webp" alt="" />
        <div className="login__marque">
          <img src="/marque/evocom-oiseau.webp" alt="" width={40} height={40} />
          <span>
            Evocom <em>Print</em>
          </span>
        </div>
        <div className="login__pitch">
          <p className="login__surtitre">Imprimerie Evocom · Dakar</p>
          <p className="login__headline">
            Du fichier au client, <span>chaque dossier suivi.</span>
          </p>
          <ul className="login__etapes">
            {ETAPES.map(({ icone: Icone, titre, texte }) => (
              <li key={titre}>
                <span className="login__etape-icone">
                  <Icone size={20} />
                </span>
                <span>
                  <strong>{titre}</strong>
                  {texte}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="login__pied">evocom-sn.com</p>
      </aside>
      <main className="login__panel">
        <form
          className="login__form"
          onSubmit={async (e) => {
            e.preventDefault();
            setErreur(null);
            setBusy(true);
            try {
              const u = await login(email.trim(), password);
              navigate(loc.state?.from ?? accueilPour(u.role), { replace: true });
            } catch (err) {
              setErreur(messageErreur(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <img className="login__logo" src="/marque/evocom-logo.webp" alt="Evocom" width={640} height={345} />
          <div className="stack-sm">
            <h1 className="login__titre">Connexion</h1>
            <p className="ev-muted" style={{ margin: 0 }}>Utilisez l'adresse e-mail de votre compte Evocom Print.</p>
          </div>
          {erreur && <Alert tone="error">{erreur}</Alert>}
          <TextField label="Adresse e-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          <TextField label="Mot de passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" variant="primary" size="lg" block busy={busy}>
            Se connecter
          </Button>
          <p className="ev-help" style={{ margin: 0 }}>Mot de passe oublié : demandez à l'administrateur de le réinitialiser.</p>
        </form>
      </main>
    </div>
  );
}
