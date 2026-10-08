import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { queryClient } from './lib/query';
import { demarrerApparence } from './lib/theme';
import { ToastProvider } from './ui';
import App from './App';
import './styles/tokens.css';
import './styles/evocom.css';
import './styles/app.css';

// Après une mise à jour, un onglet resté ouvert peut réclamer un morceau de l'ancienne version qui
// n'existe plus : on recharge la page une fois (au plus une fois par minute) pour prendre la nouvelle.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const dernier = Number(sessionStorage.getItem('evocom-rechargement') ?? 0);
    if (Date.now() - dernier < 60_000) return;
    sessionStorage.setItem('evocom-rechargement', String(Date.now()));
  } catch {
    /* stockage indisponible : on recharge quand même */
  }
  e.preventDefault();
  window.location.reload();
});

// Démonstration hors ligne (build:demo) : API simulée installée avant tout appel, routeur par
// hachage (page servie à une seule adresse) et bandeau de démonstration. Absent du build normal.
async function demarrer() {
  let Demo: ComponentType | null = null;
  if (import.meta.env.MODE === 'demo') {
    const demo = await import('./demo');
    demo.installerDemo();
    Demo = demo.Demo;
  }
  const Router = import.meta.env.MODE === 'demo' ? HashRouter : BrowserRouter;

  demarrerApparence();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Router>
          <ToastProvider>
            <AuthProvider>
              {Demo && <Demo />}
              <App />
            </AuthProvider>
          </ToastProvider>
        </Router>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void demarrer();
