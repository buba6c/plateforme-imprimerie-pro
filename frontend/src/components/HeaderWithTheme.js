import React from 'react';
import ThemeToggle from './ThemeToggle';

/**
 * Exemple de Header avec le ThemeSwitcher intégré
 * Vous pouvez l'utiliser comme référence pour intégrer le switcher
 * dans votre Layout ou barre de navigation existante
 */
const HeaderWithTheme = ({ title = "Ma Plateforme", user }) => {
  return (
    <header style={{
      background: 'var(--card-bg)',
      borderBottom: '1px solid var(--card-border)',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '1rem',
      flexWrap: 'wrap',
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Logo / Titre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: 'var(--text-body)',
          margin: 0
        }}>
          {title}
        </h1>
      </div>

      {/* Zone centrale (peut contenir la navigation) */}
      <nav style={{ 
        display: 'flex', 
        gap: '1rem',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center'
      }}>
        <a href="/" style={{ 
          color: 'var(--link-color)',
          textDecoration: 'none',
          fontWeight: '500'
        }}>
          Accueil
        </a>
        <a href="/dossiers" style={{ 
          color: 'var(--link-color)',
          textDecoration: 'none',
          fontWeight: '500'
        }}>
          Dossiers
        </a>
        <a href="/statistiques" style={{ 
          color: 'var(--link-color)',
          textDecoration: 'none',
          fontWeight: '500'
        }}>
          Statistiques
        </a>
      </nav>

      {/* Zone droite : ThemeSwitcher + User info */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem',
        flexWrap: 'wrap'
      }}>
        {/* Compact Theme Switcher */}
        <ThemeToggle />

        {/* User info (optionnel) */}
        {user && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'var(--menu-bg)',
            borderRadius: '0.5rem',
            border: '1px solid var(--menu-border)'
          }}>
            <span style={{ 
              fontSize: '0.875rem',
              color: 'var(--text-body)',
              fontWeight: '500'
            }}>
              👤 {user.name || user.email}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};

export default HeaderWithTheme;


/**
 * EXEMPLE D'UTILISATION dans votre Layout principal :
 * 
 * import HeaderWithTheme from './components/HeaderWithTheme';
 * 
 * function Layout({ children, user }) {
 *   return (
 *     <div>
 *       <HeaderWithTheme title="Evocom Plateforme" user={user} />
 *       <main style={{ padding: '2rem' }}>
 *         {children}
 *       </main>
 *     </div>
 *   );
 * }
 * 
 * ALTERNATIVE : Intégration dans LayoutImproved.js existant
 * 
 * Dans votre composant LayoutImproved.js, ajoutez simplement :
 * 
 * import ThemeToggle from './ThemeToggle';
 * 
 * // Dans le JSX, quelque part dans votre header/navbar :
 * <div className="theme-toggle-container">
 *   <ThemeToggle />
 * </div>
 */
