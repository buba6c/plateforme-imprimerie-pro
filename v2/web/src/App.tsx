import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { Role } from '@evocom/shared';
import { accueilPour, RequireAuth, RequireRole, useAuth } from './auth/AuthContext';
import { AppShell } from './layout/AppShell';
import Connexion from './pages/compte/Connexion';

const ListeDossiers = lazy(() => import('./pages/dossiers/ListeDossiers'));
const NouveauDossier = lazy(() => import('./pages/dossiers/NouveauDossier'));
const FicheDossier = lazy(() => import('./pages/dossiers/FicheDossier'));
const FileImpression = lazy(() => import('./pages/atelier/FileImpression'));
const ALivrer = lazy(() => import('./pages/livraisons/ALivrer'));
const Livrees = lazy(() => import('./pages/livraisons/Livrees'));
const Encaissements = lazy(() => import('./pages/livraisons/Encaissements'));
const ListeDevis = lazy(() => import('./pages/commercial/ListeDevis'));
const EditeurDevis = lazy(() => import('./pages/commercial/EditeurDevis'));
const FicheDevis = lazy(() => import('./pages/commercial/FicheDevis'));
const ListeFactures = lazy(() => import('./pages/commercial/ListeFactures'));
const FicheFacture = lazy(() => import('./pages/commercial/FicheFacture'));
const ListeClients = lazy(() => import('./pages/commercial/ListeClients'));
const FicheClient = lazy(() => import('./pages/commercial/FicheClient'));
const Paiements = lazy(() => import('./pages/admin/Paiements'));
const TableauDeBord = lazy(() => import('./pages/admin/TableauDeBord'));
const Statistiques = lazy(() => import('./pages/admin/Statistiques'));
const Utilisateurs = lazy(() => import('./pages/admin/Utilisateurs'));
const Tarifs = lazy(() => import('./pages/admin/Tarifs'));
const Parametres = lazy(() => import('./pages/admin/Parametres'));
const Journal = lazy(() => import('./pages/admin/Journal'));
const Corbeille = lazy(() => import('./pages/admin/Corbeille'));
const Sante = lazy(() => import('./pages/admin/Sante'));
const Profil = lazy(() => import('./pages/compte/Profil'));
const Fichiers = lazy(() => import('./pages/admin/Fichiers'));
const Permissions = lazy(() => import('./pages/admin/Permissions'));
const AssistantIA = lazy(() => import('./pages/admin/AssistantIA'));
const Planning = lazy(() => import('./pages/livraisons/Planning'));
const HistoriqueLivraisons = lazy(() => import('./pages/livraisons/Historique'));
const NotFound = lazy(() => import('./pages/NotFound'));

const ADMIN: Role[] = ['admin'];
const BUREAU: Role[] = ['admin', 'preparateur'];
const IMPRIMEURS: Role[] = ['imprimeur_roland', 'imprimeur_xerox'];

function R({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  return roles ? <RequireRole roles={roles}>{children}</RequireRole> : <>{children}</>;
}

function Accueil() {
  const { user } = useAuth();
  return <Navigate to={user ? accueilPour(user.role) : '/connexion'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Accueil />} />
        <Route path="dossiers" element={<Lazy><ListeDossiers /></Lazy>} />
        <Route path="dossiers/nouveau" element={<Lazy><R roles={BUREAU}><NouveauDossier /></R></Lazy>} />
        <Route path="dossiers/:id" element={<Lazy><FicheDossier /></Lazy>} />
        <Route path="dossiers/:id/modifier" element={<Lazy><R roles={BUREAU}><NouveauDossier /></R></Lazy>} />
        <Route path="atelier" element={<Lazy><R roles={[...IMPRIMEURS, 'admin']}><FileImpression /></R></Lazy>} />
        <Route path="livraisons" element={<Lazy><R roles={['livreur', 'admin']}><ALivrer /></R></Lazy>} />
        <Route path="livraisons/livrees" element={<Lazy><R roles={['livreur', 'admin']}><Livrees /></R></Lazy>} />
        <Route path="encaissements" element={<Lazy><R roles={['livreur', 'preparateur']}><Encaissements /></R></Lazy>} />
        <Route path="devis" element={<Lazy><R roles={BUREAU}><ListeDevis /></R></Lazy>} />
        <Route path="devis/nouveau" element={<Lazy><R roles={BUREAU}><EditeurDevis /></R></Lazy>} />
        <Route path="devis/:id" element={<Lazy><R roles={BUREAU}><FicheDevis /></R></Lazy>} />
        <Route path="devis/:id/modifier" element={<Lazy><R roles={BUREAU}><EditeurDevis /></R></Lazy>} />
        <Route path="factures" element={<Lazy><R roles={BUREAU}><ListeFactures /></R></Lazy>} />
        <Route path="factures/:id" element={<Lazy><R roles={BUREAU}><FicheFacture /></R></Lazy>} />
        <Route path="clients" element={<Lazy><R roles={BUREAU}><ListeClients /></R></Lazy>} />
        <Route path="clients/:id" element={<Lazy><R roles={BUREAU}><FicheClient /></R></Lazy>} />
        <Route path="paiements" element={<Lazy><R roles={ADMIN}><Paiements /></R></Lazy>} />
        <Route path="tableau-de-bord" element={<Lazy><R roles={ADMIN}><TableauDeBord /></R></Lazy>} />
        <Route path="statistiques" element={<Lazy><R roles={ADMIN}><Statistiques /></R></Lazy>} />
        <Route path="admin/utilisateurs" element={<Lazy><R roles={ADMIN}><Utilisateurs /></R></Lazy>} />
        <Route path="admin/tarifs" element={<Lazy><R roles={ADMIN}><Tarifs /></R></Lazy>} />
        <Route path="admin/parametres" element={<Lazy><R roles={ADMIN}><Parametres /></R></Lazy>} />
        <Route path="admin/journal" element={<Lazy><R roles={ADMIN}><Journal /></R></Lazy>} />
        <Route path="admin/corbeille" element={<Lazy><R roles={ADMIN}><Corbeille /></R></Lazy>} />
        <Route path="admin/sante" element={<Lazy><R roles={ADMIN}><Sante /></R></Lazy>} />
        <Route path="fichiers" element={<Lazy><R roles={BUREAU}><Fichiers /></R></Lazy>} />
        <Route path="admin/permissions" element={<Lazy><R roles={ADMIN}><Permissions /></R></Lazy>} />
        <Route path="admin/assistant-ia" element={<Lazy><R roles={ADMIN}><AssistantIA /></R></Lazy>} />
        <Route path="livraisons/planning" element={<Lazy><R roles={['livreur', 'admin']}><Planning /></R></Lazy>} />
        <Route path="livraisons/historique" element={<Lazy><R roles={['livreur', 'admin']}><HistoriqueLivraisons /></R></Lazy>} />
        <Route path="profil" element={<Lazy><Profil /></Lazy>} />
        <Route path="*" element={<Lazy><NotFound /></Lazy>} />
      </Route>
    </Routes>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="page-loading">Chargement…</div>}>{children}</Suspense>;
}
