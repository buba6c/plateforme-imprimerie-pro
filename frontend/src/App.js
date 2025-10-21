import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './providers/ThemeProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/LoginModern';
import Layout from './components/LayoutImproved';
import AdminDashboardProfessional from './components/admin/AdminDashboardProfessional';
import { 
  PreparateurDashboardUltraModern,
  ImprimeurDashboardUltraModern
} from './components/dashboards';
import LivreurBoard from './components/livreur/LivreurBoard';
import LivreurDossiers from './components/LivreurDossiers';
import LivreurPlanning from './pages/LivreurPlanning';
import LivreurHistorique from './pages/LivreurHistorique';
import Statistics from './components/admin/StatisticsProfessional';
import UserManagement from './components/admin/UserManagement';
import RolePermissions from './components/admin/RolePermissions';
import Settings from './components/admin/Settings';
import DossierManagement from './components/dossiers/DossierManagement';
import FileManager from './components/admin/FileManager';
import { ToastProvider } from './components/ui/Toast';
import './styles/scrollbar.css';

// Pages Livreur dédiées
import ALivrerPage from './components/pages/ALivrerPage';
import EnLivraisonPage from './components/pages/EnLivraisonPage';
import LivresPage from './components/pages/LivresPage';

// Composants Devis & Facturation
import DevisCreation from './components/devis/DevisCreation';
import DevisList from './components/devis/DevisList';
import FacturesList from './components/factures/FacturesList';
import TarifManager from './components/admin/TarifManager';
import OpenAISettings from './components/admin/OpenAISettings';
import AdminPaiementsDashboard from './components/admin/AdminPaiementsDashboard';

// Import du nouveau système de design
import './styles/design-system.css';
import './index.css';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');

  const handleNavigation = section => {
    setActiveSection(section);
  };

  const renderContent = () => {
    // Gestion spécialisée pour les livreurs avec leurs sections
    if (user?.role === 'livreur') {
      switch (activeSection) {
        // Nouvelles sections livreur (3 principales)
        case 'a_livrer':
        case 'programmees':
        case 'terminees':
        case 'dashboard':
        default:
          return <LivreurBoard user={user} initialSection={activeSection} />;
        case 'planning':
          return <LivreurPlanning user={user} />;
        case 'historique':
          return <LivreurHistorique user={user} />;
        case 'dossiers':
          return <LivreurDossiers user={user} />;
      }
    }

    // Logique standard pour les autres rôles
    switch (activeSection) {
      case 'dashboard':
        if (!user) return null;
        if (user.role === 'admin') {
          return <AdminDashboardProfessional user={user} onNavigate={handleNavigation} />;
        }
        if (user.role === 'preparateur') {
          return <PreparateurDashboardUltraModern user={user} />;
        }
        if (user.role === 'imprimeur_roland' || user.role === 'imprimeur_xerox') {
          return <ImprimeurDashboardUltraModern user={user} />
        }
        return <AdminDashboardProfessional user={user} onNavigate={handleNavigation} />;
      case 'users':
        return <UserManagement />;
      case 'permissions':
        return <RolePermissions />;
      case 'dossiers':
        if (user?.role === 'livreur') {
          return <LivreurDossiers user={user} />;
        }
        return <DossierManagement user={user} />;
      case 'files':
        return <FileManager user={user} />;
      case 'statistics':
        return <Statistics />;
      case 'settings':
        return <Settings />;
      // Routes Devis & Facturation
      case 'devis-create':
        return <DevisCreation user={user} onNavigate={handleNavigation} />;
      case 'mes-devis':
        return <DevisList user={user} />;
      case 'mes-factures':
        return <FacturesList user={user} />;
      case 'tous-devis':
        return <DevisList user={user} />;
      case 'toutes-factures':
        return <FacturesList user={user} />;
      case 'tarifs-config':
        return <TarifManager />;
      case 'openai-config':
        return <OpenAISettings />;
      case 'paiements':
        return <AdminPaiementsDashboard />;
      default:
        return <AdminDashboardProfessional user={user} onNavigate={handleNavigation} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-secondary">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      
      {/* Routes pages Livreur dédiées */}
      <Route 
        path="/a-livrer" 
        element={
          user && user.role === 'livreur' ? (
            <Layout activeSection="a-livrer" onNavigate={handleNavigation} onSearch={() => {}}>
              <ALivrerPage />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
      <Route 
        path="/en-livraison" 
        element={
          user && user.role === 'livreur' ? (
            <Layout activeSection="en-livraison" onNavigate={handleNavigation} onSearch={() => {}}>
              <EnLivraisonPage />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />
      <Route 
        path="/livres" 
        element={
          user && user.role === 'livreur' ? (
            <Layout activeSection="livres" onNavigate={handleNavigation} onSearch={() => {}}>
              <LivresPage />
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        } 
      />

      {/* Route IA Intelligente */}
      <Route
        path="/"
        element={
          user ? (
            <Layout 
              activeSection={activeSection} 
              onNavigate={handleNavigation}
              onSearch={(searchTerm) => {
                // Stocker le terme de recherche dans le localStorage pour le dashboard
                localStorage.setItem('dossierSearchTerm', searchTerm);
                // Naviguer vers dossiers si pas déjà dessus
                if (activeSection !== 'dossiers') {
                  handleNavigation('dossiers');
                }
              }}
            >
              {renderContent()}
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="evocom-theme">
      <ToastProvider>
        <Router>
          <AuthProvider>
            <div className="App">
              <AppContent />
            </div>
          </AuthProvider>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
