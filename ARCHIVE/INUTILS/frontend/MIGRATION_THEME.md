# 🎨 Guide de Migration - Nouveau Système de Thème

## 📋 Vue d'ensemble

Ce guide explique comment migrer l'application vers le **nouveau système de thème professionnel** simplifié.

### ✨ Nouveau système
- ✅ **1 seul fichier CSS** : `design-system.css`
- ✅ **1 seul Provider** : `ThemeProvider` 
- ✅ **2 modes seulement** : Light & Dark
- ✅ **Variables CSS sémantiques** : Nommage basé sur l'usage
- ✅ **Architecture professionnelle** : Inspiré de Material Design 3, Tailwind v4, Shadcn/ui

### ❌ Ancien système (à supprimer)
- ❌ 3 ThemeProviders différents
- ❌ 4 fichiers CSS de thème
- ❌ 7 thèmes (light, dark, ocean, forest, sunset, midnight, rose)
- ❌ Mélange classes Tailwind + variables custom

---

## 🚀 Étapes de Migration

### Étape 1 : Installer le nouveau système

#### 1.1 Mettre à jour App.js

**Ancien code** (`src/App.js`) :
```javascript
import { ThemeProvider as NextThemeProvider } from 'next-themes';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeCustomProvider } from './theme/ThemeCustomProvider';
import './theme/theme.css';
import './styles/themes.css';
import './styles/theme-globals.css';
import './styles/theme.css';

function App() {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      themes={['light', 'dark', 'ocean', 'forest', 'sunset', 'midnight', 'rose']}
    >
      <ThemeProvider>
        <ThemeCustomProvider>
          {/* ... */}
        </ThemeCustomProvider>
      </ThemeProvider>
    </NextThemeProvider>
  );
}
```

**Nouveau code** :
```javascript
import { ThemeProvider } from './providers/ThemeProvider';
import './styles/design-system.css';
import './index.css';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="app-theme">
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
```

#### 1.2 Mettre à jour index.css

**Ajouter en haut** de `src/index.css` :
```css
@import './styles/design-system.css';
```

**Retirer** :
```css
/* Supprimer ces lignes */
.theme-transition * { ... }
```

---

### Étape 2 : Migrer les composants

#### 2.1 Utiliser le nouveau hook useTheme

**Ancien code** :
```javascript
import { useTheme } from 'next-themes';
// ou
import { useTheme } from './context/ThemeContext';

function MyComponent() {
  const { theme, setTheme } = useTheme();
  const handleChange = () => setTheme('ocean'); // ❌ N'existe plus
}
```

**Nouveau code** :
```javascript
import { useTheme } from '../providers/ThemeProvider';

function MyComponent() {
  const { isDark, toggleTheme, setTheme } = useTheme();
  
  // Basculer light/dark
  const handleToggle = () => toggleTheme();
  
  // Définir un thème spécifique
  const handleSetLight = () => setTheme('light');
  const handleSetDark = () => setTheme('dark');
  const handleSetSystem = () => setTheme('system');
}
```

#### 2.2 Migrer les classes CSS

| Ancien | Nouveau |
|--------|---------|
| `bg-neutral-50` | `bg-primary` |
| `bg-white` | `bg-surface` |
| `text-neutral-900` | `text-primary` |
| `text-neutral-600` | `text-secondary` |
| `text-neutral-500` | `text-tertiary` |
| `border-neutral-200` | `border-subtle` |
| `border-neutral-300` | `border-default` |
| `shadow-sm` | `elevation-1` |
| `shadow-md` | `elevation-2` |

**Exemple de migration** :

```jsx
// AVANT
<div className="bg-white border border-neutral-200 shadow-md rounded-lg p-6">
  <h2 className="text-neutral-900 font-semibold">Titre</h2>
  <p className="text-neutral-600">Description</p>
</div>

// APRÈS
<div className="card">
  <h2 className="card-header">Titre</h2>
  <p className="card-body">Description</p>
</div>
```

#### 2.3 Migrer les boutons

```jsx
// AVANT
<button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
  Action
</button>

// APRÈS
<button className="btn btn-primary">
  Action
</button>
```

#### 2.4 Migrer les badges

```jsx
// AVANT
<span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
  Succès
</span>

// APRÈS
<span className="badge badge-success">
  Succès
</span>
```

---

### Étape 3 : Composants personnalisés avec variables CSS

#### 3.1 Utiliser les tokens sémantiques

```css
/* AVANT - Couleurs en dur */
.my-component {
  background-color: #ffffff;
  color: #171717;
  border: 1px solid #e5e5e5;
}

.dark .my-component {
  background-color: #171717;
  color: #fafafa;
  border: 1px solid #404040;
}

/* APRÈS - Variables sémantiques */
.my-component {
  background-color: var(--surface-base);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}
/* Pas besoin de règle .dark - c'est automatique ! */
```

#### 3.2 Variables disponibles

**Surfaces & Backgrounds**
```css
var(--surface-base)
var(--surface-raised)
var(--background-primary)
var(--background-secondary)
var(--background-tertiary)
```

**Text**
```css
var(--text-primary)
var(--text-secondary)
var(--text-tertiary)
var(--text-disabled)
var(--text-on-brand)
```

**Borders**
```css
var(--border-subtle)
var(--border-default)
var(--border-strong)
var(--border-brand)
```

**Interactive**
```css
var(--interactive-default)
var(--interactive-hover)
var(--interactive-active)
```

**Spacing**
```css
var(--space-1) /* 4px */
var(--space-2) /* 8px */
var(--space-3) /* 12px */
var(--space-4) /* 16px */
var(--space-6) /* 24px */
var(--space-8) /* 32px */
```

**Radius**
```css
var(--radius-sm)  /* 6px */
var(--radius-md)  /* 8px */
var(--radius-lg)  /* 12px */
var(--radius-xl)  /* 16px */
```

**Shadows**
```css
var(--elevation-0) /* none */
var(--elevation-1) /* subtle */
var(--elevation-2) /* small */
var(--elevation-3) /* medium */
var(--elevation-4) /* large */
```

---

### Étape 4 : Composant ThemeToggle

Créer un nouveau composant pour basculer le thème :

```jsx
// src/components/ThemeToggle.jsx
import React from 'react';
import { useTheme } from '../providers/ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setTheme('light')}
        className={`btn btn-sm ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`}
      >
        ☀️ Clair
      </button>
      
      <button
        onClick={() => setTheme('system')}
        className={`btn btn-sm ${theme === 'system' ? 'btn-primary' : 'btn-ghost'}`}
      >
        💻 Système
      </button>
      
      <button
        onClick={() => setTheme('dark')}
        className={`btn btn-sm ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
      >
        🌙 Sombre
      </button>
    </div>
  );
}

// Version simplifiée - Toggle uniquement
export function ThemeToggleSimple() {
  const { toggleTheme, isDark } = useTheme();

  return (
    <button 
      onClick={toggleTheme}
      className="btn btn-ghost"
      aria-label="Basculer le thème"
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
```

---

### Étape 5 : Supprimer les anciens fichiers

⚠️ **À faire après avoir migré tous les composants** :

```bash
# Sauvegarder d'abord (au cas où)
mkdir -p backup-theme
cp -r src/styles backup-theme/
cp -r src/theme backup-theme/
cp -r src/context/ThemeContext.js backup-theme/

# Supprimer les anciens fichiers
rm -f src/styles/theme.css
rm -f src/styles/themes.css
rm -f src/styles/theme-globals.css
rm -f src/theme/theme.css
rm -f src/theme/ThemeCustomProvider.js
rm -f src/theme/themeSystem.js
rm -f src/context/ThemeContext.js

# Désinstaller next-themes si plus utilisé
npm uninstall next-themes
```

---

## 📝 Checklist de Migration

### Phase 1 : Préparation
- [ ] Lire ce guide complètement
- [ ] Créer une branche Git : `git checkout -b refactor/theme-system`
- [ ] Sauvegarder les anciens fichiers

### Phase 2 : Installation
- [ ] Nouveau `design-system.css` créé
- [ ] Nouveau `ThemeProvider.jsx` créé
- [ ] `App.js` mis à jour
- [ ] `index.css` mis à jour

### Phase 3 : Migration des composants
- [ ] Migrer les composants de layout (Header, Sidebar, Footer)
- [ ] Migrer les composants de formulaires (Input, Button, Select)
- [ ] Migrer les composants de cartes (Card, DossierCard)
- [ ] Migrer les composants de navigation (Nav, Menu)
- [ ] Migrer les pages admin
- [ ] Migrer les dashboards

### Phase 4 : Tests
- [ ] Tester le mode clair
- [ ] Tester le mode sombre
- [ ] Tester le mode système
- [ ] Tester la persistence (localStorage)
- [ ] Tester les transitions
- [ ] Vérifier l'accessibilité (contraste, focus)

### Phase 5 : Nettoyage
- [ ] Supprimer les anciens fichiers CSS
- [ ] Supprimer les anciens providers
- [ ] Désinstaller les dépendances inutiles
- [ ] Nettoyer les imports dans tous les fichiers
- [ ] Mettre à jour la documentation

### Phase 6 : Finalisation
- [ ] Commit des changements
- [ ] Créer une Pull Request
- [ ] Review du code
- [ ] Merge dans main

---

## 🎯 Exemples Complets

### Exemple 1 : Card de dossier

```jsx
// AVANT
<div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-6 shadow-sm hover:shadow-md transition-all">
  <div className="flex justify-between items-start mb-4">
    <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
      {dossier.nom}
    </h3>
    <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 px-2 py-1 rounded-full text-xs">
      {dossier.statut}
    </span>
  </div>
  <p className="text-neutral-600 dark:text-neutral-400 text-sm">
    {dossier.description}
  </p>
</div>

// APRÈS
<div className="card">
  <div className="card-header">
    <h3>{dossier.nom}</h3>
    <span className="badge badge-success">{dossier.statut}</span>
  </div>
  <p className="card-body">{dossier.description}</p>
</div>
```

### Exemple 2 : Formulaire

```jsx
// AVANT
<div>
  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
    Nom du dossier
  </label>
  <input
    type="text"
    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
    placeholder="Entrez le nom"
  />
</div>

// APRÈS
<div>
  <label className="label">Nom du dossier</label>
  <input
    type="text"
    className="input"
    placeholder="Entrez le nom"
  />
</div>
```

### Exemple 3 : Boutons d'action

```jsx
// AVANT
<div className="flex gap-2">
  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
    Valider
  </button>
  <button className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50">
    Annuler
  </button>
</div>

// APRÈS
<div className="flex gap-2">
  <button className="btn btn-primary">Valider</button>
  <button className="btn btn-secondary">Annuler</button>
</div>
```

---

## 🆘 Dépannage

### Problème : Les couleurs ne changent pas

**Solution** :
1. Vérifier que `design-system.css` est bien importé
2. Vérifier que `data-theme` est appliqué sur `<html>`
3. Vider le cache du navigateur : `Cmd+Shift+R`

### Problème : Conflit avec Tailwind

**Solution** :
Les nouvelles classes ont une spécificité plus faible que Tailwind. Si conflit :

```jsx
// Utiliser les variables CSS directement
<div style={{ 
  backgroundColor: 'var(--surface-base)',
  color: 'var(--text-primary)' 
}}>
  ...
</div>
```

### Problème : Transitions saccadées

**Solution** :
Ajouter la classe `theme-transitioning` pendant les changements :

```css
.theme-transitioning * {
  transition: background-color 200ms, color 200ms, border-color 200ms !important;
}
```

---

## 📚 Ressources

- **Design System CSS** : `src/styles/design-system.css`
- **ThemeProvider** : `src/providers/ThemeProvider.jsx`
- **Tailwind Config** : `tailwind.config.js`
- **Material Design 3** : https://m3.material.io
- **Shadcn/ui** : https://ui.shadcn.com

---

**Bonne migration ! 🚀**

Si vous rencontrez des problèmes, consultez les exemples dans ce guide ou vérifiez que tous les fichiers sont correctement importés.
