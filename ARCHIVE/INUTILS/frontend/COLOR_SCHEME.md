# 🎨 Schéma de Couleurs - Plateforme d'Imprimerie

## Vue d'ensemble

Ce document décrit le schéma de couleurs officiel de la plateforme d'imprimerie. Toutes les couleurs sont définies dans `tailwind.config.js` et utilisées de manière cohérente à travers l'application.

---

## 🔵 Couleur Principale (Primary)

**Utilisation:** Actions principales, boutons CTA, liens, éléments interactifs importants

```js
primary: {
  50: '#eff6ff',   // Arrière-plans très légers
  100: '#dbeafe',  // Arrière-plans légers
  200: '#bfdbfe',  // Borders légères
  300: '#93c5fd',  // Hover states légers
  400: '#60a5fa',  // Éléments secondaires
  500: '#3b82f6',  // 🎯 COULEUR PRINCIPALE
  600: '#2563eb',  // Boutons principaux, actions importantes
  700: '#1d4ed8',  // Hover states sur boutons
  800: '#1e40af',  // États actifs
  900: '#1e3a8a',  // Texte sombre sur fond clair
  950: '#172554',  // Texte très sombre
}
```

**Exemples d'utilisation:**
- `bg-primary-600 hover:bg-primary-700` - Boutons principaux
- `text-primary-600` - Liens
- `border-primary-500` - Bordures actives
- `focus:ring-primary-500` - Focus states

---

## ⚪ Couleur Secondaire (Secondary / Gris)

**Utilisation:** Textes, arrière-plans, bordures, éléments neutres

```js
secondary: {
  50: '#f8fafc',   // Arrière-plan de la page (mode clair)
  100: '#f1f5f9',  // Arrière-plans de cartes secondaires
  200: '#e2e8f0',  // Bordures standards
  300: '#cbd5e1',  // Bordures d'inputs
  400: '#94a3b8',  // Placeholder text
  500: '#64748b',  // Texte secondaire
  600: '#475569',  // Texte normal
  700: '#334155',  // Bordures mode sombre
  800: '#1e293b',  // Arrière-plans mode sombre
  900: '#0f172a',  // Arrière-plan principal mode sombre
  950: '#020617',  // Texte très sombre mode sombre
}
```

**Exemples d'utilisation:**
- `bg-secondary-50` - Arrière-plan de page
- `text-secondary-900` - Texte principal
- `border-secondary-200` - Bordures
- `dark:bg-secondary-800` - Cartes en mode sombre

---

## ✅ Couleur de Succès (Success)

**Utilisation:** Messages de succès, confirmations, états validés

```js
success: {
  50: '#f0fdf4',   // Arrière-plans de notifications
  100: '#dcfce7',  // Badges de succès
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',  // 🎯 COULEUR DE SUCCÈS
  600: '#16a34a',  // Boutons de succès
  700: '#15803d',  // Hover states
  800: '#166534',
  900: '#14532d',
  950: '#052e16',
}
```

**Exemples d'utilisation:**
- `bg-success-600` - Boutons de validation
- `text-success-600` - Messages de succès
- `border-success-500` - Bordures de confirmation

---

## ⚠️ Couleur d'Avertissement (Warning)

**Utilisation:** Avertissements, actions nécessitant attention

```js
warning: {
  50: '#fffbeb',   // Arrière-plans d'alerte
  100: '#fef3c7',  // Badges d'avertissement
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',  // 🎯 COULEUR D'AVERTISSEMENT
  600: '#d97706',  // Boutons d'avertissement
  700: '#b45309',  // Hover states
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
}
```

**Exemples d'utilisation:**
- `bg-warning-100 text-warning-800` - Badges d'alerte
- `border-warning-500` - Bordures d'avertissement

---

## 🔴 Couleur de Danger (Danger / Error)

**Utilisation:** Erreurs, suppressions, actions destructives

```js
danger: {
  50: '#fef2f2',   // Arrière-plans d'erreur
  100: '#fee2e2',  // Badges d'erreur
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',  // 🎯 COULEUR DE DANGER
  600: '#dc2626',  // Boutons de suppression
  700: '#b91c1c',  // Hover states
  800: '#991b1b',
  900: '#7f1d1d',
  950: '#450a0a',
}
```

**Exemples d'utilisation:**
- `bg-danger-600 hover:bg-danger-700` - Boutons de suppression
- `text-danger-600` - Messages d'erreur
- `border-danger-500` - Bordures d'erreur

---

## ℹ️ Couleur d'Information (Info)

**Utilisation:** Messages informatifs, tooltips

```js
info: {
  // Identique à primary pour cohérence
  500: '#3b82f6',
  600: '#2563eb',
}
```

---

## 📋 Classes CSS Personnalisées

### Boutons

```css
.btn-primary     /* Bouton principal bleu */
.btn-secondary   /* Bouton secondaire gris */
.btn-success     /* Bouton vert de succès */
.btn-warning     /* Bouton orange d'avertissement */
.btn-danger      /* Bouton rouge de danger */
```

### Cartes

```css
.card            /* Carte avec bordure secondaire */
.card-header     /* En-tête de carte */
.card-body       /* Corps de carte */
.card-footer     /* Pied de carte */
```

### Formulaires

```css
.form-input      /* Input de formulaire */
.form-label      /* Label de formulaire */
.form-error      /* Message d'erreur */
.form-help       /* Texte d'aide */
```

### Badges

```css
.badge-primary   /* Badge bleu */
.badge-success   /* Badge vert */
.badge-warning   /* Badge orange */
.badge-danger    /* Badge rouge */
.badge-secondary /* Badge gris */
```

### Badges de Statut (Dossiers)

```css
.status-nouveau           /* Nouveau dossier */
.status-en-preparation    /* En préparation */
.status-pret-impression   /* Prêt pour impression */
.status-en-impression     /* En cours d'impression */
.status-imprime           /* Imprimé */
.status-pret-livraison    /* Prêt pour livraison */
.status-en-livraison      /* En livraison */
.status-livre             /* Livré */
.status-termine           /* Terminé */
```

---

## 🌓 Mode Sombre

Le mode sombre utilise les mêmes couleurs mais avec des variantes plus sombres:

- **Arrière-plan principal:** `dark:bg-secondary-900`
- **Arrière-plan des cartes:** `dark:bg-secondary-800`
- **Texte principal:** `dark:text-secondary-100`
- **Bordures:** `dark:border-secondary-700`

**Activation:** Ajouter la classe `dark` sur l'élément `<html>`

---

## 🎨 Gradients

```css
.bg-gradient-primary    /* Gradient bleu */
.bg-gradient-secondary  /* Gradient gris */
.bg-gradient-success    /* Gradient vert */
```

---

## 📝 Bonnes Pratiques

### ✅ À FAIRE

- Utiliser `primary-600` pour les boutons principaux
- Utiliser `secondary-*` pour les textes et arrière-plans neutres
- Utiliser les couleurs fonctionnelles (success, warning, danger) pour les feedbacks
- Toujours inclure les variantes `dark:` pour le mode sombre
- Utiliser les classes utilitaires Tailwind plutôt que du CSS custom

### ❌ À ÉVITER

- Utiliser des couleurs hardcodées en hex dans les composants
- Mélanger `neutral-*` et `secondary-*` (utiliser uniquement `secondary-*`)
- Créer de nouvelles couleurs sans les ajouter à `tailwind.config.js`
- Oublier les variantes dark mode

---

## 🔄 Migration

Si vous trouvez du code utilisant des couleurs obsolètes:

```bash
# Remplacer neutral- par secondary-
neutral-50  →  secondary-50
neutral-100 →  secondary-100
etc.

# Remplacer error- par danger- (ou garder error- qui est un alias)
error-600   →  danger-600 (ou laisser error-600)
```

---

## 📚 Ressources

- Configuration: `frontend/tailwind.config.js`
- Styles globaux: `frontend/src/index.css`
- Documentation Tailwind: https://tailwindcss.com/docs/customizing-colors

---

**Dernière mise à jour:** 2025-10-09
**Version:** 1.0.0
