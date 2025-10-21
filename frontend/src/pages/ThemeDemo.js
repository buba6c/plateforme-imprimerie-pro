import React from 'react';
import ThemeToggle from '../components/ThemeToggle';

/**
 * Page de démonstration du système de thème
 * Affiche tous les composants stylés avec les variables CSS du theme.css
 */
const ThemeDemo = () => {
  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* En-tête */}
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ 
          fontSize: '2rem', 
          fontWeight: '700',
          marginBottom: '0.5rem',
          color: 'var(--text-body)'
        }}>
          🎨 Système de Thème CSS
        </h1>
        <p style={{ 
          fontSize: '1rem',
          color: 'var(--text-body)',
          opacity: 0.8,
          marginBottom: '1.5rem'
        }}>
          Démonstration complète du système de thème avec mode clair/sombre dynamique
        </p>
        
        {/* Contrôles de thème */}
        <ThemeToggle />
      </header>

      {/* Section Boutons */}
      <section className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">Boutons</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary">Bouton primaire</button>
          <button className="btn btn-primary" disabled>Primaire désactivé</button>
          <button className="btn btn-secondary">Bouton secondaire</button>
          <button className="btn btn-secondary" disabled>Secondaire désactivé</button>
        </div>
      </section>

      {/* Section Menu */}
      <section className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">Menu</div>
        <div className="menu">
          <div className="menu-header">Navigation</div>
          <button className="menu-item active" aria-current="page">
            🏠 Accueil
          </button>
          <button className="menu-item">
            📊 Tableau de bord
          </button>
          <button className="menu-item">
            ⚙️ Paramètres
          </button>
          <button className="menu-item">
            👤 Profil
          </button>
        </div>
      </section>

      {/* Section Dégradé */}
      <section className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">Dégradé principal</div>
        <div 
          className="bg-gradient-primary" 
          style={{ 
            padding: '2rem',
            borderRadius: '0.75rem',
            textAlign: 'center'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
            Section avec dégradé
          </h3>
          <p style={{ margin: '0.5rem 0 0', opacity: 0.9 }}>
            linear-gradient(135deg, #1A73E8, #0F4C81)
          </p>
        </div>
      </section>

      {/* Section Cartes multiples */}
      <section style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div className="card">
          <div className="card-header">Carte 1</div>
          <p style={{ color: 'var(--text-body)', margin: 0 }}>
            Cette carte utilise les variables CSS pour s'adapter automatiquement au thème.
          </p>
        </div>
        
        <div className="card">
          <div className="card-header">Carte 2</div>
          <p style={{ color: 'var(--text-body)', margin: 0 }}>
            Le fond, les bordures et les ombres changent avec le thème.
          </p>
        </div>
        
        <div className="card">
          <div className="card-header">Carte 3</div>
          <p style={{ color: 'var(--text-body)', margin: 0 }}>
            Aucun code JavaScript nécessaire pour gérer les couleurs.
          </p>
        </div>
      </section>

      {/* Section Liens */}
      <section className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">Liens et typographie</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--text-body)', margin: 0 }}>
            Voici un <a href="#demo">lien avec la couleur primaire</a> qui change au survol.
          </p>
          <p style={{ color: 'var(--text-body)', margin: 0 }}>
            Texte principal avec <strong>gras</strong> et <em>italique</em>.
          </p>
          <p style={{ 
            color: 'var(--text-body)', 
            opacity: 0.7,
            fontSize: '0.875rem',
            margin: 0 
          }}>
            Texte secondaire avec opacité réduite.
          </p>
        </div>
      </section>

      {/* Section Variables CSS */}
      <section className="card">
        <div className="card-header">Variables CSS disponibles</div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          fontSize: '0.875rem'
        }}>
          <div>
            <strong style={{ color: 'var(--text-body)' }}>Couleurs principales</strong>
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              margin: '0.5rem 0 0',
              color: 'var(--text-body)',
              opacity: 0.8
            }}>
              <li>--color-primary</li>
              <li>--color-secondary</li>
              <li>--color-accent</li>
            </ul>
          </div>
          
          <div>
            <strong style={{ color: 'var(--text-body)' }}>Fonds et textes</strong>
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              margin: '0.5rem 0 0',
              color: 'var(--text-body)',
              opacity: 0.8
            }}>
              <li>--bg-page</li>
              <li>--text-body</li>
              <li>--link-color</li>
            </ul>
          </div>
          
          <div>
            <strong style={{ color: 'var(--text-body)' }}>Composants</strong>
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              margin: '0.5rem 0 0',
              color: 'var(--text-body)',
              opacity: 0.8
            }}>
              <li>--menu-bg</li>
              <li>--card-bg</li>
              <li>--button-primary-bg</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer avec informations */}
      <footer style={{ 
        marginTop: '3rem',
        padding: '2rem 0',
        borderTop: '1px solid var(--card-border)',
        textAlign: 'center'
      }}>
        <p style={{ 
          color: 'var(--text-body)',
          opacity: 0.7,
          fontSize: '0.875rem',
          margin: 0
        }}>
          💡 Le système de thème utilise <strong>next-themes</strong> avec l'attribut <code>data-theme</code>
        </p>
        <p style={{ 
          color: 'var(--text-body)',
          opacity: 0.7,
          fontSize: '0.875rem',
          margin: '0.5rem 0 0'
        }}>
          Toutes les couleurs sont définies via des variables CSS dans <code>styles/theme.css</code>
        </p>
      </footer>
    </div>
  );
};

export default ThemeDemo;
