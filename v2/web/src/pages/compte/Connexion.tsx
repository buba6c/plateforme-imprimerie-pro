import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { accueilPour, useAuth } from '../../auth/AuthContext';
import { messageErreur } from '../../lib/api';
import { Alert, Button, TextField } from '../../ui';

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
        <div className="ev-brand login__brand">
          <span className="ev-brand__mark">e</span>
          Evocom <span>Print</span>
        </div>
        <svg className="login__art" viewBox="0 0 480 300">
          <rect x="0" y="40" width="150" height="220" rx="12" className="login__art-solid" />
          <rect x="166" y="0" width="190" height="200" rx="12" className="login__art-glass" />
          <rect x="166" y="216" width="56" height="26" rx="13" fill="var(--coral)" />
          <path d="M140 40h8M150 30v8M140 260h8M150 268v8M366 0h8M366 200h8" className="login__art-line" />
          <circle cx="300" cy="250" r="12" className="login__art-line" />
          <path d="M282 250h36M300 232v36" className="login__art-line" />
        </svg>
        <div className="login__pitch">
          <p className="login__headline">Du fichier au client, chaque dossier suivi.</p>
          <p>Préparation, impression Roland et Xerox, livraison et encaissement au même endroit.</p>
        </div>
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
          <div className="stack-sm">
            <h1 className="ev-h-display">Connexion</h1>
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
