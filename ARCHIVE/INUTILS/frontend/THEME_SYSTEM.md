# 🎨 Système de Thème CSS - Documentation

## Vue d'ensemble

Ce système de thème CSS permet de gérer facilement les modes clair et sombre de votre application React avec **next-themes** et des variables CSS.

### Caractéristiques principales

✅ Mode clair et sombre dynamique  
✅ Variables CSS pour toutes les couleurs  
✅ Composants stylés (boutons, menu, cartes)  
✅ Persistance du choix utilisateur (localStorage)  
✅ Support du thème système  
✅ Transitions fluides entre thèmes  
✅ Palette professionnelle prédéfinie  

---

## 📁 Fichiers créés

### 1. `src/styles/theme.css`
Fichier CSS principal avec toutes les variables de thème et les styles de composants.

**Variables disponibles :**
- `--color-primary` : Couleur principale (#1A73E8)
- `--color-secondary` : Couleur secondaire (#0F4C81)
- `--color-accent` : Couleur d'accent (#FF6F61)
- `--bg-page` : Fond de page (adapté au thème)
- `--text-body` : Couleur du texte principal
- `--button-primary-bg` : Fond des boutons primaires
- `--menu-bg` : Fond des menus
- `--card-bg` : Fond des cartes
- Et bien d'autres...

### 2. `src/components/ThemeSwitcher.js`
Composant React pour basculer entre les thèmes.

**Fonctionnalités :**
- Toggle clair/sombre
- Boutons individuels (clair, sombre, système)
- Indicateur du thème actuel
- Évite les problèmes d'hydratation SSR

### 3. `src/pages/ThemeDemo.js`
Page de démonstration complète du système de thème.

**Contenu :**
- Exemples de tous les composants stylés
- Boutons primaires et secondaires
- Menu avec éléments actifs
- Cartes avec contenu
- Dégradé principal
- Liste des variables CSS

---

## 🚀 Installation et Configuration

### Étape 1 : Vérifier next-themes

Le package `next-themes` est déjà installé dans votre projet. Si besoin de le réinstaller :

```bash
cd frontend
npm install next-themes
```

### Étape 2 : Configuration dans App.js

Le `ThemeProvider` de next-themes est déjà configuré dans `src/App.js` :

```javascript
import { ThemeProvider as NextThemeProvider } from 'next-themes';
import './styles/theme.css';

function App() {
  return (
    <NextThemeProvider
      attribute="data-theme"           // Utilise data-theme sur <html>
      defaultTheme="light"             // Thème par défaut
      enableSystem={false}             // Désactive la détection système
      storageKey="evocom-theme"        // Clé localStorage
      themes={['light', 'dark']}       // Thèmes disponibles
      disableTransitionOnChange={false}
    >
      {/* Reste de l'app */}
    </NextThemeProvider>
  );
}
```

### Étape 3 : Tester la page de démo

Pour accéder à la page de démo, ajoutez une route dans votre application ou accédez directement au composant :

```javascript
import ThemeDemo from './pages/ThemeDemo';

// Dans vos routes ou en remplacement temporaire
<ThemeDemo />
```

---

## 💻 Utilisation

### 1. Utiliser le ThemeSwitcher

Importez et utilisez le composant ThemeSwitcher n'importe où dans votre app :

```javascript
import ThemeSwitcher from './components/ThemeSwitcher';

function MonComposant() {
  return (
    <div>
      <h1>Ma page</h1>
      <ThemeSwitcher />
    </div>
  );
}
```

### 2. Créer des composants avec les variables CSS

Tous les composants peuvent utiliser les variables CSS définies :

```javascript
// Exemple de carte personnalisée
function MaCarte() {
  return (
    <div className="card">
      <div className="card-header">Mon titre</div>
      <p style={{ color: 'var(--text-body)' }}>
        Mon contenu utilise automatiquement les bonnes couleurs
      </p>
      <button className="btn btn-primary">Action</button>
    </div>
  );
}
```

### 3. Classes CSS disponibles

**Boutons :**
```html
<button className="btn btn-primary">Primaire</button>
<button className="btn btn-secondary">Secondaire</button>
```

**Menu :**
```html
<div className="menu">
  <div className="menu-header">Navigation</div>
  <button className="menu-item active">Accueil</button>
  <button className="menu-item">Profil</button>
</div>
```

**Cartes :**
```html
<div className="card">
  <div className="card-header">Titre de la carte</div>
  <p>Contenu de la carte</p>
</div>
```

**Dégradé :**
```html
<div className="bg-gradient-primary">
  Contenu avec dégradé
</div>
```

### 4. Utiliser next-themes dans vos composants

Pour accéder au thème actuel ou le changer :

```javascript
import { useTheme } from 'next-themes';

function MonComposant() {
  const { theme, setTheme, systemTheme } = useTheme();
  
  const currentTheme = theme === 'system' ? systemTheme : theme;
  
  return (
    <div>
      <p>Thème actuel : {currentTheme}</p>
      <button onClick={() => setTheme('dark')}>Mode sombre</button>
      <button onClick={() => setTheme('light')}>Mode clair</button>
    </div>
  );
}
```

---

## 🎨 Personnalisation

### Modifier les couleurs

Éditez `src/styles/theme.css` et changez les valeurs dans `:root` et `[data-theme="dark"]` :

```css
:root {
  --color-primary: #YOUR_COLOR;
  --color-secondary: #YOUR_COLOR;
  /* etc. */
}
```

### Ajouter de nouvelles variables

1. Définissez la variable dans `:root` :
```css
:root {
  --ma-nouvelle-couleur: #FF5733;
}
```

2. Override pour le mode sombre si nécessaire :
```css
[data-theme="dark"] {
  --ma-nouvelle-couleur: #AA3311;
}
```

3. Utilisez-la dans votre CSS ou inline :
```css
.mon-element {
  color: var(--ma-nouvelle-couleur);
}
```

### Ajouter de nouveaux thèmes

Pour ajouter d'autres thèmes (ex: "ocean", "forest") :

1. Dans `App.js`, ajoutez-les à la liste :
```javascript
<NextThemeProvider
  themes={['light', 'dark', 'ocean', 'forest']}
  // ...
>
```

2. Dans `theme.css`, ajoutez les sélecteurs :
```css
[data-theme="ocean"] {
  --bg-page: #001f3f;
  --text-body: #7FDBFF;
  /* etc. */
}
```

---

## 🔧 Dépannage

### Le thème ne change pas

1. Vérifiez que `theme.css` est bien importé dans `App.js`
2. Vérifiez que le `ThemeProvider` enveloppe toute votre app
3. Ouvrez les DevTools et inspectez `<html>` : l'attribut `data-theme` doit changer

### Flash de thème au chargement

Ajoutez `disableTransitionOnChange={true}` dans le `ThemeProvider` :
```javascript
<NextThemeProvider
  disableTransitionOnChange={true}
  // ...
>
```

### Les variables CSS ne fonctionnent pas

1. Vérifiez que votre navigateur supporte les variables CSS (tous les navigateurs modernes)
2. Inspectez l'élément dans les DevTools et vérifiez que la variable est définie
3. Vérifiez qu'il n'y a pas de fautes de frappe : `var(--bg-page)` et non `var(--bg_page)`

---

## 📚 Ressources

- [Documentation next-themes](https://github.com/pacocoursey/next-themes)
- [Variables CSS (MDN)](https://developer.mozilla.org/fr/docs/Web/CSS/Using_CSS_custom_properties)
- [Guide des modes sombre/clair](https://web.dev/prefers-color-scheme/)

---

## ✅ Checklist de migration

Pour migrer vos composants existants vers ce système :

- [ ] Remplacer les couleurs hardcodées par des variables CSS
- [ ] Utiliser les classes `.btn`, `.card`, `.menu` au lieu de styles inline
- [ ] Ajouter `ThemeSwitcher` dans votre interface
- [ ] Tester en mode clair et sombre
- [ ] Vérifier que le thème persiste après rechargement de page

---

## 🎯 Prochaines étapes

1. **Intégrez le ThemeSwitcher** dans votre barre de navigation ou menu utilisateur
2. **Migrez progressivement** vos composants existants pour utiliser les variables CSS
3. **Testez** la page de démo : visitez `ThemeDemo.js`
4. **Personnalisez** les couleurs selon votre charte graphique

Bon développement ! 🚀
