# 🎨 Intégration next-themes - Plateforme d'Imprimerie

## 📋 Vue d'ensemble

Ce guide explique comment intégrer **next-themes** avec votre système de thème actuel (ThemeCustomProvider) pour obtenir :
- ✅ Mode clair/sombre avec next-themes
- ✅ Couleurs personnalisables (ThemeCustomProvider)
- ✅ Synchronisation automatique
- ✅ Pas de flash de contenu non stylisé (FOUC)
- ✅ Support SSR (si migration vers Next.js)

---

## 🔧 Architecture Proposée

### Système à 2 Niveaux

```
┌─────────────────────────────────────────┐
│         next-themes                     │
│  (Mode: light / dark / system)          │
│  Gère: dark class sur <html>           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      ThemeCustomProvider                │
│  (Couleurs: primary, secondary, etc.)   │
│  Gère: CSS variables personnalisées     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         Votre Application               │
│  Utilise: dark:* + var(--primary-color) │
└─────────────────────────────────────────┘
```

---

## 📦 1. NOUVEAU CONTEXTE UNIFIÉ

Créez `src/context/UnifiedThemeProvider.js` :

```jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from 'next-themes';
import { systemConfigService } from '../services/apiAdapter';

// Thème de couleurs par défaut
const defaultColorTheme = {
  primaryColor: '#2563eb',        // Bleu moderne (Tailwind blue-600)
  secondaryColor: '#06b6d4',      // Cyan (Tailwind cyan-600)
  accentColor: '#ec4899',         // Rose (Tailwind pink-600)
  
  // Mode clair
  light: {
    backgroundColor: '#f9fafb',        // neutral-50
    backgroundSecondary: '#ffffff',   // white
    textColor: '#111827',             // neutral-900
    textSecondary: '#6b7280',         // neutral-500
    cardBg: '#ffffff',
    borderColor: '#e5e7eb',           // neutral-200
  },
  
  // Mode sombre
  dark: {
    backgroundColor: '#111827',       // neutral-900
    backgroundSecondary: '#1f2937',   // neutral-800
    textColor: '#f9fafb',             // neutral-50
    textSecondary: '#9ca3af',         // neutral-400
    cardBg: '#1f2937',                // neutral-800
    borderColor: '#374151',           // neutral-700
  },
  
  // États (identiques en clair/sombre)
  successColor: '#10b981',    // green-500
  warningColor: '#f59e0b',    // amber-500
  errorColor: '#ef4444',      // red-500
  infoColor: '#3b82f6',       // blue-500
};

// Context pour les couleurs personnalisées
const ColorThemeContext = createContext({
  colorTheme: defaultColorTheme,
  updateColorTheme: () => {},
  resetColorTheme: () => {},
  isLoading: false,
});

export const useColorTheme = () => {
  const context = useContext(ColorThemeContext);
  if (!context) {
    throw new Error('useColorTheme must be used within UnifiedThemeProvider');
  }
  return context;
};

// Hook combiné pour accès facile
export const useUnifiedTheme = () => {
  const { theme, setTheme, resolvedTheme, systemTheme } = useNextTheme();
  const colorTheme = useColorTheme();
  
  return {
    // next-themes
    mode: theme,              // 'light' | 'dark' | 'system'
    setMode: setTheme,
    resolvedMode: resolvedTheme, // 'light' | 'dark' (computed)
    systemTheme,
    
    // Custom colors
    ...colorTheme,
    
    // Helper
    isDark: resolvedTheme === 'dark',
  };
};

// Provider interne pour les couleurs
const ColorThemeProviderInner = ({ children }) => {
  const [colorTheme, setColorTheme] = useState(defaultColorTheme);
  const [isLoading, setIsLoading] = useState(true);
  const { resolvedTheme } = useNextTheme();
  
  // Appliquer les variables CSS en fonction du mode
  const applyColorThemeToDOM = (colors, mode) => {
    const root = document.documentElement;
    
    // Couleurs principales (indépendantes du mode)
    root.style.setProperty('--primary-color', colors.primaryColor);
    root.style.setProperty('--secondary-color', colors.secondaryColor);
    root.style.setProperty('--accent-color', colors.accentColor);
    
    // Couleurs dépendantes du mode
    const modeColors = mode === 'dark' ? colors.dark : colors.light;
    root.style.setProperty('--background-color', modeColors.backgroundColor);
    root.style.setProperty('--background-secondary', modeColors.backgroundSecondary);
    root.style.setProperty('--text-color', modeColors.textColor);
    root.style.setProperty('--text-secondary', modeColors.textSecondary);
    root.style.setProperty('--card-bg', modeColors.cardBg);
    root.style.setProperty('--border-color', modeColors.borderColor);
    
    // États
    root.style.setProperty('--success-color', colors.successColor);
    root.style.setProperty('--warning-color', colors.warningColor);
    root.style.setProperty('--error-color', colors.errorColor);
    root.style.setProperty('--info-color', colors.infoColor);
    
    // Dégradés
    root.style.setProperty('--gradient-primary', 
      `linear-gradient(135deg, ${colors.primaryColor} 0%, ${colors.secondaryColor} 100%)`);
    root.style.setProperty('--gradient-sidebar', 
      `linear-gradient(135deg, ${colors.primaryColor} 0%, ${colors.secondaryColor} 100%)`);
    
    // Sidebar (mode sombre adaptatif)
    if (mode === 'dark') {
      root.style.setProperty('--sidebar-bg', '#0f172a');           // slate-900
      root.style.setProperty('--sidebar-header-bg', '#1e293b');    // slate-800
      root.style.setProperty('--sidebar-border', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--sidebar-item-hover', 'rgba(59, 130, 246, 0.1)'); // blue-500/10
      root.style.setProperty('--sidebar-item-active', 'rgba(59, 130, 246, 0.15)');
    } else {
      root.style.setProperty('--sidebar-bg', '#1e293b');           // slate-800
      root.style.setProperty('--sidebar-header-bg', '#0f172a');    // slate-900
      root.style.setProperty('--sidebar-border', 'rgba(255, 255, 255, 0.2)');
      root.style.setProperty('--sidebar-item-hover', 'rgba(255, 255, 255, 0.05)');
      root.style.setProperty('--sidebar-item-active', 'rgba(255, 255, 255, 0.1)');
    }
  };
  
  // Charger le thème depuis le backend
  const loadColorTheme = async () => {
    try {
      setIsLoading(true);
      const response = await systemConfigService.get('custom_theme');
      const config = response?.value ?? response;
      
      if (config && config.enabled && config.colors) {
        const loadedTheme = { ...defaultColorTheme, ...config.colors };
        setColorTheme(loadedTheme);
        applyColorThemeToDOM(loadedTheme, resolvedTheme);
      } else {
        applyColorThemeToDOM(defaultColorTheme, resolvedTheme);
      }
    } catch (error) {
      console.warn('Erreur chargement thème couleurs, utilisation par défaut:', error);
      applyColorThemeToDOM(defaultColorTheme, resolvedTheme);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Mettre à jour le thème de couleurs
  const updateColorTheme = async (newColors) => {
    try {
      const updatedTheme = { ...colorTheme, ...newColors };
      setColorTheme(updatedTheme);
      applyColorThemeToDOM(updatedTheme, resolvedTheme);
      
      // Sauvegarder en backend
      await systemConfigService.set('custom_theme', {
        enabled: true,
        colors: updatedTheme
      });
      
      return { success: true };
    } catch (error) {
      console.error('Erreur mise à jour thème couleurs:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Réinitialiser le thème
  const resetColorTheme = async () => {
    try {
      setColorTheme(defaultColorTheme);
      applyColorThemeToDOM(defaultColorTheme, resolvedTheme);
      
      await systemConfigService.set('custom_theme', {
        enabled: false,
        colors: defaultColorTheme
      });
      
      return { success: true };
    } catch (error) {
      console.error('Erreur réinitialisation thème couleurs:', error);
      return { success: false, error: error.message };
    }
  };
  
  // Charger au montage
  useEffect(() => {
    loadColorTheme();
  }, []);
  
  // Réappliquer quand le mode change
  useEffect(() => {
    if (resolvedTheme && !isLoading) {
      applyColorThemeToDOM(colorTheme, resolvedTheme);
    }
  }, [resolvedTheme, colorTheme, isLoading]);
  
  const value = {
    colorTheme,
    updateColorTheme,
    resetColorTheme,
    isLoading,
  };
  
  return (
    <ColorThemeContext.Provider value={value}>
      {children}
    </ColorThemeContext.Provider>
  );
};

// Provider principal unifié
export const UnifiedThemeProvider = ({ children }) => {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="app-theme"
    >
      <ColorThemeProviderInner>
        {children}
      </ColorThemeProviderInner>
    </NextThemeProvider>
  );
};

export default UnifiedThemeProvider;
```

---

## 🔄 2. MISE À JOUR DE index.js

Remplacez l'ancien ThemeProvider par le nouveau :

```jsx
// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './theme/theme.css';  // Vos styles custom
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { UnifiedThemeProvider } from './context/UnifiedThemeProvider'; // ← NOUVEAU
import { ToastProvider } from './components/ui/Toast';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <UnifiedThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </UnifiedThemeProvider>
  </React.StrictMode>
);
```

---

## 🎨 3. MISE À JOUR DU CSS (theme.css)

Adaptez vos styles pour utiliser les variables CSS + dark: :

```css
/* src/theme/theme.css */

/* ============================================
   VARIABLES CSS - Compatible next-themes
   ============================================ */

:root {
  /* Couleurs principales (définies par ThemeCustomProvider) */
  --primary-color: #2563eb;
  --secondary-color: #06b6d4;
  --accent-color: #ec4899;
  
  /* Mode clair (par défaut) */
  --background-color: #f9fafb;
  --background-secondary: #ffffff;
  --text-color: #111827;
  --text-secondary: #6b7280;
  --card-bg: #ffffff;
  --border-color: #e5e7eb;
  
  /* États */
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
  --info-color: #3b82f6;
  
  /* Dégradés */
  --gradient-primary: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  --gradient-sidebar: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  
  /* Sidebar */
  --sidebar-bg: #1e293b;
  --sidebar-header-bg: #0f172a;
  --sidebar-border: rgba(255, 255, 255, 0.2);
  --sidebar-item-hover: rgba(255, 255, 255, 0.05);
  --sidebar-item-active: rgba(255, 255, 255, 0.1);
  
  /* Espacements */
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  
  /* Rayons de bordure */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  
  /* Ombres */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1);
}

/* Mode sombre (géré par next-themes via class="dark") */
.dark {
  --background-color: #111827;
  --background-secondary: #1f2937;
  --text-color: #f9fafb;
  --text-secondary: #9ca3af;
  --card-bg: #1f2937;
  --border-color: #374151;
  
  /* Sidebar en mode sombre */
  --sidebar-bg: #0f172a;
  --sidebar-header-bg: #1e293b;
  --sidebar-border: rgba(255, 255, 255, 0.1);
  --sidebar-item-hover: rgba(59, 130, 246, 0.1);
  --sidebar-item-active: rgba(59, 130, 246, 0.15);
  
  /* Ombres adaptées au dark */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.5);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.6);
}

/* Transition douce lors du changement de thème */
* {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* ============================================
   COMPOSANTS DE BASE
   ============================================ */

/* Cards */
.card {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 200ms;
}

.card:hover {
  box-shadow: var(--shadow-md);
}

.card-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.card-body {
  padding: 1.5rem;
}

.card-footer {
  padding: 1rem 1.5rem;
  background-color: var(--background-color);
  border-top: 1px solid var(--border-color);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
  line-height: 1.4;
}

/* Boutons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: all 200ms;
  cursor: pointer;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}

.btn-md {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

.btn-primary {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover {
  opacity: 0.9;
  box-shadow: var(--shadow-md);
}

.btn-secondary {
  background-color: var(--background-secondary);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background-color: var(--background-color);
}

.btn-danger {
  background-color: var(--error-color);
  color: white;
}

.btn-danger:hover {
  opacity: 0.9;
}

/* Inputs */
.form-input {
  width: 100%;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  background-color: var(--background-secondary);
  color: var(--text-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: all 200ms;
}

.form-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.form-input::placeholder {
  color: var(--text-secondary);
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 0.375rem;
}

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
}

.badge-primary {
  background-color: rgba(37, 99, 235, 0.1);
  color: var(--primary-color);
}

.badge-success {
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--success-color);
}

.badge-warning {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--warning-color);
}

.badge-danger {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
}

.badge-gray {
  background-color: var(--background-color);
  color: var(--text-secondary);
}

/* ============================================
   SIDEBAR
   ============================================ */

.sidebar {
  background-color: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background-color: var(--sidebar-header-bg);
  border-bottom: 1px solid var(--sidebar-border);
}

.sidebar-item {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-md);
  transition: all 200ms;
  cursor: pointer;
  border: none;
  background: transparent;
}

.sidebar-item:hover {
  background-color: var(--sidebar-item-hover);
  color: white;
}

.sidebar-item.active {
  background-color: var(--sidebar-item-active);
  color: white;
  border-left: 2px solid var(--primary-color);
  box-shadow: 0 0 10px rgba(37, 99, 235, 0.1);
}

.sidebar-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.5);
}

.sidebar-toggle {
  padding: 0.5rem;
  color: rgba(255, 255, 255, 0.8);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 200ms;
}

.sidebar-toggle:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.1);
}

/* ============================================
   TYPOGRAPHIE
   ============================================ */

.page-title {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: var(--text-color);
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-color);
}

.body-text {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-color);
}

.text-small {
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-secondary);
}

/* ============================================
   UTILITAIRES
   ============================================ */

.text-primary {
  color: var(--primary-color);
}

.text-secondary {
  color: var(--secondary-color);
}

.text-success {
  color: var(--success-color);
}

.text-warning {
  color: var(--warning-color);
}

.text-error {
  color: var(--error-color);
}

.bg-primary {
  background-color: var(--primary-color);
}

.bg-card {
  background-color: var(--card-bg);
}

.border-default {
  border-color: var(--border-color);
}
```

---

## 🔧 4. MISE À JOUR DES COMPOSANTS

### Exemple 1 : Toggle Dark Mode

```jsx
// src/components/ThemeToggle.js
import { useUnifiedTheme } from '../context/UnifiedThemeProvider';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

const ThemeToggle = () => {
  const { mode, setMode, resolvedMode } = useUnifiedTheme();
  
  const cycleTheme = () => {
    if (mode === 'light') setMode('dark');
    else if (mode === 'dark') setMode('system');
    else setMode('light');
  };
  
  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      title={`Mode: ${mode} (${resolvedMode})`}
    >
      {resolvedMode === 'dark' ? (
        <SunIcon className="h-5 w-5 text-amber-500" />
      ) : (
        <MoonIcon className="h-5 w-5 text-blue-600" />
      )}
    </button>
  );
};

export default ThemeToggle;
```

### Exemple 2 : Settings avec Couleurs Personnalisées

```jsx
// src/components/admin/ThemeSettings.js
import { useUnifiedTheme } from '../../context/UnifiedThemeProvider';
import { HexColorPicker } from 'react-colorful';

const ThemeSettings = () => {
  const { 
    mode, 
    setMode, 
    colorTheme, 
    updateColorTheme, 
    resetColorTheme,
    isLoading 
  } = useUnifiedTheme();
  
  const [tempColors, setTempColors] = useState(colorTheme);
  
  const handleSave = async () => {
    const result = await updateColorTheme(tempColors);
    if (result.success) {
      toast.success('Thème sauvegardé !');
    }
  };
  
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Personnalisation du thème</h3>
      </div>
      
      <div className="card-body space-y-6">
        {/* Mode clair/sombre */}
        <div>
          <label className="form-label">Mode</label>
          <div className="flex gap-2">
            {['light', 'dark', 'system'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`btn btn-sm ${mode === m ? 'btn-primary' : 'btn-secondary'}`}
              >
                {m === 'light' ? '☀️' : m === 'dark' ? '🌙' : '💻'} {m}
              </button>
            ))}
          </div>
        </div>
        
        {/* Couleur primaire */}
        <div>
          <label className="form-label">Couleur primaire</label>
          <div className="flex items-center gap-4">
            <HexColorPicker
              color={tempColors.primaryColor}
              onChange={color => setTempColors(prev => ({ ...prev, primaryColor: color }))}
            />
            <div 
              className="w-16 h-16 rounded-lg border-2 border-neutral-300"
              style={{ backgroundColor: tempColors.primaryColor }}
            />
          </div>
        </div>
        
        {/* Couleur secondaire */}
        <div>
          <label className="form-label">Couleur secondaire</label>
          <div className="flex items-center gap-4">
            <HexColorPicker
              color={tempColors.secondaryColor}
              onChange={color => setTempColors(prev => ({ ...prev, secondaryColor: color }))}
            />
            <div 
              className="w-16 h-16 rounded-lg border-2 border-neutral-300"
              style={{ backgroundColor: tempColors.secondaryColor }}
            />
          </div>
        </div>
        
        {/* Preview */}
        <div>
          <label className="form-label">Aperçu</label>
          <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <button className="btn btn-primary btn-md">Bouton Primary</button>
            <div className="mt-4 p-4 rounded-lg" style={{ 
              background: `linear-gradient(135deg, ${tempColors.primaryColor} 0%, ${tempColors.secondaryColor} 100%)` 
            }}>
              <p className="text-white font-semibold">Dégradé sidebar</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="card-footer flex justify-between">
        <button onClick={resetColorTheme} className="btn btn-secondary">
          Réinitialiser
        </button>
        <button onClick={handleSave} className="btn btn-primary" disabled={isLoading}>
          Sauvegarder
        </button>
      </div>
    </div>
  );
};
```

---

## 🎯 5. AVANTAGES DE CETTE APPROCHE

### ✅ Avantages

1. **Séparation des préoccupations**
   - next-themes → Mode clair/sombre
   - ThemeCustomProvider → Couleurs personnalisées
   
2. **Pas de flash (FOUC)**
   - next-themes injecte le script avant le rendu
   - class="dark" appliquée immédiatement
   
3. **Synchronisation système**
   - Mode "system" respecte les préférences OS
   - Mise à jour automatique si l'utilisateur change son OS
   
4. **Performance**
   - CSS variables = pas de re-render React
   - Changement instantané
   
5. **Compatible SSR**
   - Si migration vers Next.js → aucun changement nécessaire
   
6. **Personnalisable**
   - Admin peut changer les couleurs via interface
   - Mode clair/sombre indépendant des couleurs

### 📊 Comparaison

| Fonctionnalité | Ancien système | Nouveau système |
|---|---|---|
| Mode clair/sombre | ✅ Manuel | ✅ Automatique + système |
| Couleurs custom | ✅ Oui | ✅ Oui |
| FOUC | ❌ Possible | ✅ Aucun |
| SSR Ready | ❌ Non | ✅ Oui |
| Performance | ⚠️ Moyenne | ✅ Excellente |
| localStorage | ✅ Oui | ✅ Oui |
| Transitions | ⚠️ Manuelles | ✅ Automatiques |

---

## 📋 6. CHECKLIST DE MIGRATION

### Phase 1 : Installation et Setup
- [x] next-themes déjà installé ✅
- [ ] Créer `UnifiedThemeProvider.js`
- [ ] Mettre à jour `index.js`
- [ ] Adapter `theme.css` avec variables CSS

### Phase 2 : Composants
- [ ] Créer `ThemeToggle.js`
- [ ] Mettre à jour `ThemeSettings.js`
- [ ] Adapter `Layout.js` / `LayoutImproved.js`
- [ ] Mettre à jour tous les composants utilisant `useTheme`

### Phase 3 : Nettoyage
- [ ] Supprimer l'ancien `ThemeContext.js` (ou le garder en backup)
- [ ] Supprimer `ThemeCustomProvider.js` ancien
- [ ] Vérifier que dark: fonctionne partout
- [ ] Tester les transitions

### Phase 4 : Tests
- [ ] Tester mode light → dark → system
- [ ] Tester sauvegarde des couleurs custom
- [ ] Vérifier pas de FOUC au rechargement
- [ ] Tester sur mobile
- [ ] Vérifier localStorage

---

## 🚀 7. COMMANDES POUR DÉMARRER

```bash
# 1. Vérifier que next-themes est installé
npm list next-themes
# Devrait afficher: next-themes@0.4.6

# 2. Créer le nouveau provider
touch frontend/src/context/UnifiedThemeProvider.js

# 3. Adapter le CSS
# Éditer: frontend/src/theme/theme.css

# 4. Mettre à jour index.js
# Remplacer ThemeProvider par UnifiedThemeProvider

# 5. Tester
npm start
```

---

## 🎨 8. EXEMPLE COMPLET D'UTILISATION

```jsx
// Dans n'importe quel composant
import { useUnifiedTheme } from '../context/UnifiedThemeProvider';

const MyComponent = () => {
  const { 
    mode,           // 'light' | 'dark' | 'system'
    setMode,        // Changer le mode
    resolvedMode,   // 'light' | 'dark' (computed)
    isDark,         // boolean
    colorTheme,     // { primaryColor, secondaryColor, ... }
    updateColorTheme,
  } = useUnifiedTheme();
  
  return (
    <div className="bg-white dark:bg-neutral-900">
      <p className="text-neutral-900 dark:text-white">
        Mode: {mode} ({resolvedMode})
      </p>
      
      {/* Utiliser les variables CSS */}
      <button 
        className="btn btn-primary"
        style={{ background: `var(--gradient-primary)` }}
      >
        Gradient dynamique
      </button>
      
      {/* Ou Tailwind dark: */}
      <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg">
        <p className="text-neutral-900 dark:text-white">
          Contenu adaptatif
        </p>
      </div>
    </div>
  );
};
```

---

## 💡 CONSEILS

1. **Toujours utiliser dark:** pour les classes Tailwind
2. **Utiliser var(--*)** pour les couleurs personnalisées
3. **Éviter les couleurs hardcodées** (#fff, #000)
4. **Tester les deux modes** systématiquement
5. **Documenter les variables CSS** pour l'équipe

---

**Prêt à implémenter ?** 🚀

Cette approche vous donne le meilleur des deux mondes : la puissance de next-themes + la flexibilité de votre système de couleurs personnalisé !
