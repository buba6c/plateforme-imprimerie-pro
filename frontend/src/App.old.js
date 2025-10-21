import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as NextThemeProvider } from 'next-themes';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/LoginModern';
import Layout from './components/LayoutImproved';
import Dashboard from './components/admin/Dashboard';
import { 
  PreparateurDashboardUltraModern,
  ImprimeurDashboardUltraModern
} from './components/dashboards';
import LivreurBoard from './components/livreur/LivreurBoard';
import LivreurDossiers from './components/LivreurDossiers';
import LivreurPlanning from './pages/LivreurPlanning';
import LivreurHistorique from './pages/LivreurHistorique';
import Statistics from './components/admin/Statistics';
import UserManagement from './components/admin/UserManagement';
import RolePermissions from './components/admin/RolePermissions';
import Settings from './components/admin/Settings';
import DossierManagement from './components/dossiers/DossierManagement';
import FileManager from './components/admin/FileManager';
import './index.css';
import './theme/theme.css';
import './styles/themes.css';
import './styles/theme-globals.css';
import './styles/theme.css';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeCustomProvider } from './theme/ThemeCustomProvider';
import { ToastProvider } from './components/ui/Toast';

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
        if (user.role === 'preparateur') {
          return <PreparateurDashboardUltraModern user={user} />;
        }
        if (user.role === 'imprimeur_roland' || user.role === 'imprimeur_xerox') {
          return <ImprimeurDashboardUltraModern user={user} />;
        }
        return <Dashboard user={user} onNavigate={handleNavigation} />;
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
      default:
        return <Dashboard user={user} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-300">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
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
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      storageKey="evocom-theme"
      themes={['light', 'dark', 'ocean', 'forest', 'sunset', 'midnight', 'rose']}
      disableTransitionOnChange={false}
    >
      <ThemeProvider>
        <ThemeCustomProvider>
          <ToastProvider>
            <Router>
              <AuthProvider>
                <div className="App">
                  <AppContent />
                </div>
              </AuthProvider>
            </Router>
          </ToastProvider>
        </ThemeCustomProvider>
      </ThemeProvider>
    </NextThemeProvider>
  );
}

export default App;
