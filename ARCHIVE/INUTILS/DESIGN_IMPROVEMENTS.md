# Améliorations du Design - Plateforme d'Imprimerie

## 📋 Analyse Globale

Après analyse approfondie des interfaces (Dashboard, UserManagement, DossierManagement, Login, Layouts), voici les améliorations recommandées pour optimiser l'expérience utilisateur, la cohérence visuelle et l'alignement.

---

## 🎨 1. SYSTÈME DE DESIGN UNIFIÉ

### 1.1 Espacements Cohérents
**Problème actuel :** Espacements variables (p-3, p-4, p-6, p-8) sans logique claire
**Solution :**
```css
/* Système d'espacement standardisé */
--spacing-xs: 0.5rem;  /* 8px  - Éléments très proches */
--spacing-sm: 0.75rem; /* 12px - Espacement réduit */
--spacing-md: 1rem;    /* 16px - Espacement standard */
--spacing-lg: 1.5rem;  /* 24px - Section heading */
--spacing-xl: 2rem;    /* 32px - Grandes sections */
--spacing-2xl: 3rem;   /* 48px - Page sections */
```

**Application :**
- Cards internes : `p-6` (24px)
- Cards externes : `p-8` (32px)
- Gap entre éléments : `gap-4` (16px)
- Gap entre sections : `gap-8` (32px)
- Marges de page : `py-8 px-4 sm:px-6 lg:px-8`

### 1.2 Hiérarchie Typographique
**Problème actuel :** Tailles de texte incohérentes
**Solution :**
```css
/* Page Title */
.page-title { 
  font-size: 2rem;      /* 32px */
  font-weight: 800;     /* extrabold */
  line-height: 1.2;
  letter-spacing: -0.02em;
}

/* Section Title */
.section-title {
  font-size: 1.5rem;    /* 24px */
  font-weight: 700;     /* bold */
  line-height: 1.3;
}

/* Card Title */
.card-title {
  font-size: 1.125rem;  /* 18px */
  font-weight: 600;     /* semibold */
  line-height: 1.4;
}

/* Body Text */
.body-text {
  font-size: 0.875rem;  /* 14px */
  line-height: 1.5;
}

/* Small Text */
.text-small {
  font-size: 0.75rem;   /* 12px */
  line-height: 1.5;
}
```

### 1.3 Système de Grille
**Recommandations :**
```jsx
{/* Container principal - Max width responsive */}
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  
  {/* Grille 2 colonnes sur desktop, 1 sur mobile */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Cards */}
  </div>
  
  {/* Grille 3 colonnes responsive */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* Items */}
  </div>
  
  {/* Grille 4 colonnes pour stats */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {/* Stat cards */}
  </div>
</div>
```

---

## 🔧 2. COMPOSANTS À AMÉLIORER

### 2.1 Cards / Cartes
**Avant :**
```jsx
<div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-lg">
```

**Après (Standardisé) :**
```jsx
<div className="card">
  <div className="card-header">
    <h3 className="card-title">Titre</h3>
  </div>
  <div className="card-body">
    {/* Contenu */}
  </div>
  <div className="card-footer">
    {/* Actions */}
  </div>
</div>
```

**CSS :**
```css
.card {
  @apply bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 transition-shadow hover:shadow-md;
}

.card-header {
  @apply px-6 py-4 border-b border-neutral-200 dark:border-neutral-700;
}

.card-body {
  @apply px-6 py-4;
}

.card-footer {
  @apply px-6 py-4 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700;
}
```

### 2.2 Boutons
**Problème :** Tailles et styles incohérents
**Solution :**
```css
/* Tailles standardisées */
.btn-sm { @apply px-3 py-1.5 text-sm; }
.btn-md { @apply px-4 py-2 text-sm; }      /* Default */
.btn-lg { @apply px-6 py-3 text-base; }

/* Variantes */
.btn-primary {
  @apply bg-gradient-to-r from-blue-600 to-blue-700 text-white;
  @apply hover:from-blue-700 hover:to-blue-800;
  @apply focus:ring-4 focus:ring-blue-500/20;
  @apply disabled:opacity-50 disabled:cursor-not-allowed;
  @apply rounded-lg font-medium transition-all duration-200;
  @apply shadow-sm hover:shadow-md;
}

.btn-secondary {
  @apply bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200;
  @apply border border-neutral-300 dark:border-neutral-600;
  @apply hover:bg-neutral-50 dark:hover:bg-neutral-700;
}

.btn-danger {
  @apply bg-red-600 text-white hover:bg-red-700;
  @apply focus:ring-4 focus:ring-red-500/20;
}
```

### 2.3 Inputs / Champs de formulaire
**Standardisation :**
```css
.form-input {
  @apply w-full px-4 py-2.5 text-sm;
  @apply bg-white dark:bg-neutral-800;
  @apply border border-neutral-300 dark:border-neutral-600;
  @apply rounded-lg;
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent;
  @apply placeholder-neutral-400 dark:placeholder-neutral-500;
  @apply transition-all duration-200;
}

.form-label {
  @apply block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5;
}
```

---

## 📐 3. AMÉLIORATIONS PAR PAGE

### 3.1 Dashboard Admin
**Problèmes identifiés :**
1. Cards de stats trop larges sur desktop
2. Espacement incohérent entre sections
3. Activités récentes manquent de hiérarchie visuelle

**Solutions :**
```jsx
{/* Grid de stats - 4 colonnes max */}
<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
  <StatCard 
    icon={UsersIcon}
    title="Utilisateurs"
    value={stats.users.total}
    subtitle={`${stats.users.active} actifs`}
    trend="+12%"
    color="blue"
  />
</div>

{/* Activités - Amélioration visuelle */}
<div className="card">
  <div className="card-header">
    <div className="flex items-center justify-between">
      <h3 className="card-title">Activité récente</h3>
      <button className="text-sm text-blue-600 hover:text-blue-700">
        Voir tout
      </button>
    </div>
  </div>
  <div className="card-body p-0">
    <ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
      {activities.map(activity => (
        <li key={activity.id} className="px-6 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
          <div className="flex items-start gap-4">
            {/* Icon with color */}
            <div className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}>
              <ActivityIcon className="h-5 w-5" />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                {activity.title}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">
                {activity.description}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {formatDate(activity.date)}
              </p>
            </div>
            
            {/* Status badge */}
            <span className={`badge ${getStatusColor(activity.status)}`}>
              {activity.status}
            </span>
          </div>
        </li>
      ))}
    </ul>
  </div>
</div>
```

### 3.2 Gestion des Utilisateurs
**Améliorations :**
1. **En-tête de page mieux structuré**
```jsx
<div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 sm:px-6 lg:px-8 py-6">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="page-title">Gestion des utilisateurs</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''}
      </p>
    </div>
    <button className="btn-primary">
      <PlusIcon className="h-5 w-5 mr-2" />
      Nouvel utilisateur
    </button>
  </div>
</div>
```

2. **Filtres améliorés**
```jsx
<div className="card mb-6">
  <div className="card-body">
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Recherche principale */}
      <div className="flex-1">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email..."
            className="form-input pl-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Filtres */}
      <div className="flex gap-3">
        <select className="form-input min-w-[150px]" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">Tous les rôles</option>
          <option value="admin">Admin</option>
          {/* ... */}
        </select>
        
        <select className="form-input min-w-[120px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Tous</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>
        
        <button
          onClick={clearFilters}
          className="btn-secondary"
          title="Réinitialiser les filtres"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  </div>
</div>
```

3. **Tableau responsive optimisé**
```jsx
{/* Sur mobile: Liste au lieu de tableau */}
<div className="lg:hidden space-y-4">
  {currentUsers.map(user => (
    <div key={user.id} className="card">
      <div className="card-body">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-semibold">
              {user.prenom?.charAt(0)}{user.nom?.charAt(0)}
            </span>
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-neutral-900 dark:text-white">
              {user.prenom} {user.nom}
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">
              {user.email}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`badge ${getRoleColor(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
              <span className={`badge ${user.is_active ? 'badge-success' : 'badge-gray'}`}>
                {user.is_active ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => handleEditUser(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
              <PencilIcon className="h-5 w-5" />
            </button>
            <button onClick={() => handleDeleteUser(user)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  ))}
</div>

{/* Sur desktop: Tableau */}
<div className="hidden lg:block card overflow-hidden">
  <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
    {/* ... */}
  </table>
</div>
```

### 3.3 Gestion des Dossiers
**Améliorations recommandées :**

1. **Vue en grille optimisée**
```jsx
{/* Toggle Vue Liste / Grille */}
<div className="flex items-center gap-2 ml-auto">
  <button
    onClick={() => setViewMode('grid')}
    className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-neutral-600 hover:bg-neutral-100'}`}
  >
    <Squares2X2Icon className="h-5 w-5" />
  </button>
  <button
    onClick={() => setViewMode('list')}
    className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-neutral-600 hover:bg-neutral-100'}`}
  >
    <ListBulletIcon className="h-5 w-5" />
  </button>
</div>

{/* Grille de dossiers */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {dossiers.map(dossier => (
    <DossierCard key={dossier.id} dossier={dossier} />
  ))}
</div>
```

2. **Card de dossier redesignée**
```jsx
<div className="card group cursor-pointer hover:shadow-lg transition-all duration-200">
  {/* Header avec statut */}
  <div className="card-body pb-0">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1">
        <h4 className="font-semibold text-neutral-900 dark:text-white truncate">
          {dossier.numero_commande}
        </h4>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate">
          {dossier.client_nom}
        </p>
      </div>
      <span className={`badge ${getStatusColor(dossier.status)}`}>
        {getStatusLabel(dossier.status)}
      </span>
    </div>
    
    {/* Métadonnées */}
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <PrinterIcon className="h-4 w-4" />
        <span>{dossier.type}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <CalendarIcon className="h-4 w-4" />
        <span>{formatDate(dossier.created_at)}</span>
      </div>
      {dossier.urgence && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <span className="font-medium">URGENT</span>
        </div>
      )}
    </div>
  </div>
  
  {/* Actions au survol */}
  <div className="card-footer opacity-0 group-hover:opacity-100 transition-opacity">
    <div className="flex gap-2">
      <button className="btn-sm btn-primary flex-1">
        <EyeIcon className="h-4 w-4 mr-1" />
        Voir
      </button>
      <button className="btn-sm btn-secondary">
        <PencilIcon className="h-4 w-4" />
      </button>
    </div>
  </div>
</div>
```

### 3.4 Page de Login
**Améliorations :**

1. **Centrage et responsive**
```jsx
<div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
  <div className="w-full max-w-md">
    {/* Logo centré */}
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg">
        <PrinterIcon className="w-8 h-8 text-white" />
      </div>
      <h1 className="mt-4 text-3xl font-bold text-white">
        EvocomPrint
      </h1>
      <p className="mt-2 text-blue-200">
        Plateforme d'imprimerie numérique
      </p>
    </div>
    
    {/* Card de connexion */}
    <div className="card">
      <div className="card-body p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Formulaire */}
        </form>
      </div>
    </div>
    
    {/* Comptes de test - Optionnel en dev */}
    {process.env.NODE_ENV === 'development' && (
      <div className="mt-6 card">
        <div className="card-body p-4">
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3 font-medium">
            Comptes de test
          </p>
          <div className="grid grid-cols-2 gap-2">
            {testAccounts.map(account => (
              <button
                key={account.email}
                onClick={() => quickFill(account)}
                className="text-xs btn-secondary justify-start"
              >
                {account.icon} {account.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )}
  </div>
</div>
```

---

## 🎯 4. SIDEBAR & NAVIGATION

### 4.1 Sidebar Améliorée
**Cohérence visuelle :**
```jsx
<aside className="sidebar">
  {/* Header */}
  <div className="sidebar-header">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
        <PrinterIcon className="h-5 w-5 text-white" />
      </div>
      <div>
        <h1 className="text-white font-bold text-sm leading-none">Plateforme</h1>
        <p className="text-white/60 text-xs mt-0.5">Impression</p>
      </div>
    </div>
    <button className="sidebar-toggle lg:hidden">
      <XMarkIcon className="h-5 w-5 text-white" />
    </button>
  </div>
  
  {/* User section */}
  <div className="px-4 py-3 border-b border-white/20">
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">
          {user.prenom?.charAt(0)}{user.nom?.charAt(0)}
        </span>
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[var(--sidebar-bg)]"></div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {user.prenom} {user.nom}
        </p>
        <p className="text-xs text-white/50 truncate">
          {getRoleLabel(user.role)}
        </p>
      </div>
    </div>
  </div>
  
  {/* Navigation */}
  <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
    {navigationItems.map(item => (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`sidebar-item ${activeSection === item.id ? 'active' : ''}`}
      >
        <item.icon className="h-5 w-5" />
        <span>{item.name}</span>
      </button>
    ))}
  </nav>
  
  {/* Footer */}
  <div className="px-4 py-3 border-t border-white/20 space-y-2">
    <button className="sidebar-item">
      <MoonIcon className="h-5 w-5" />
      <span>Mode sombre</span>
    </button>
    <button className="sidebar-item text-red-400 hover:text-red-300 hover:bg-red-500/10">
      <ArrowRightOnRectangleIcon className="h-5 w-5" />
      <span>Déconnexion</span>
    </button>
  </div>
</aside>
```

**CSS Sidebar :**
```css
.sidebar {
  @apply fixed inset-y-0 left-0 w-64 bg-[--sidebar-bg] border-r border-[--sidebar-border] flex flex-col;
}

.sidebar-header {
  @apply flex items-center justify-between px-4 py-4 border-b border-white/20 bg-[--sidebar-header-bg];
}

.sidebar-item {
  @apply w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/80;
  @apply rounded-lg transition-all duration-200;
  @apply hover:bg-white/5 hover:text-white;
}

.sidebar-item.active {
  @apply bg-white/10 text-white border-l-2 border-blue-500;
  @apply shadow-lg shadow-blue-500/10;
}

.sidebar-toggle {
  @apply p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-all;
}
```

---

## 🌈 5. COULEURS & THÈME

### 5.1 Palette de couleurs harmonisée
```css
:root {
  /* Primaire - Bleu */
  --color-primary-50: #eff6ff;
  --color-primary-100: #dbeafe;
  --color-primary-200: #bfdbfe;
  --color-primary-300: #93c5fd;
  --color-primary-400: #60a5fa;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;  /* Main */
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;
  
  /* Secondaire - Cyan */
  --color-secondary-500: #06b6d4;
  --color-secondary-600: #0891b2;
  
  /* Succès - Vert */
  --color-success-500: #10b981;
  --color-success-600: #059669;
  
  /* Attention - Amber */
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;
  
  /* Danger - Rouge */
  --color-danger-500: #ef4444;
  --color-danger-600: #dc2626;
  
  /* Neutre */
  --color-neutral-50: #f9fafb;
  --color-neutral-100: #f3f4f6;
  --color-neutral-200: #e5e7eb;
  --color-neutral-300: #d1d5db;
  --color-neutral-400: #9ca3af;
  --color-neutral-500: #6b7280;
  --color-neutral-600: #4b5563;
  --color-neutral-700: #374151;
  --color-neutral-800: #1f2937;
  --color-neutral-900: #111827;
}
```

### 5.2 Classes utilitaires
```css
/* Badges */
.badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}

.badge-primary { @apply bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400; }
.badge-success { @apply bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400; }
.badge-warning { @apply bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400; }
.badge-danger { @apply bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400; }
.badge-gray { @apply bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400; }

/* États */
.status-active { @apply bg-green-100 text-green-800; }
.status-pending { @apply bg-amber-100 text-amber-800; }
.status-error { @apply bg-red-100 text-red-800; }
```

---

## 📱 6. RESPONSIVITÉ

### 6.1 Breakpoints standardisés
```css
/* Mobile first approach */
/* xs: < 640px   - Mobile portrait */
/* sm: 640px+    - Mobile landscape */
/* md: 768px+    - Tablette portrait */
/* lg: 1024px+   - Tablette landscape / Desktop */
/* xl: 1280px+   - Desktop large */
/* 2xl: 1536px+  - Desktop extra large */
```

### 6.2 Patterns responsive
```jsx
{/* Container responsive */}
<div className="px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>

{/* Grille responsive */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
  {/* Items */}
</div>

{/* Stack horizontal → vertical */}
<div className="flex flex-col lg:flex-row gap-4">
  {/* Items */}
</div>

{/* Cache sur mobile */}
<div className="hidden lg:block">
  {/* Desktop only */}
</div>

{/* Affiche sur mobile uniquement */}
<div className="lg:hidden">
  {/* Mobile only */}
</div>
```

---

## ✅ 7. CHECKLIST D'IMPLÉMENTATION

### Phase 1 : Fondations (Priorité haute)
- [ ] Créer le système de design tokens (couleurs, espacements, typographie)
- [ ] Standardiser les classes CSS utilitaires
- [ ] Mettre à jour theme.css avec les nouvelles variables
- [ ] Créer les composants de base (Card, Button, Input, Badge)

### Phase 2 : Composants (Priorité haute)
- [ ] Refactoriser les cartes (Dashboard, UserManagement, etc.)
- [ ] Uniformiser tous les boutons
- [ ] Standardiser les formulaires
- [ ] Améliorer les badges de statut

### Phase 3 : Layouts (Priorité moyenne)
- [ ] Unifier la Sidebar dans tous les layouts
- [ ] Standardiser les en-têtes de page
- [ ] Améliorer la navigation responsive
- [ ] Optimiser la pagination

### Phase 4 : Pages spécifiques (Priorité moyenne)
- [ ] Dashboard : améliorer les stats cards et l'activité
- [ ] UserManagement : table responsive + filtres
- [ ] DossierManagement : vue grille + cartes optimisées
- [ ] Login : centrage et responsive

### Phase 5 : Polish (Priorité basse)
- [ ] Animations et transitions
- [ ] États de hover optimisés
- [ ] Loading states uniformes
- [ ] Empty states cohérents

---

## 🎨 8. EXEMPLES DE CODE

### StatCard Component
```jsx
const StatCard = ({ icon: Icon, title, value, subtitle, trend, color = 'blue' }) => {
  const colorClasses = {
    blue: 'from-blue-600 to-blue-700',
    green: 'from-green-600 to-green-700',
    purple: 'from-purple-600 to-purple-700',
    amber: 'from-amber-600 to-amber-700',
  };

  return (
    <div className="card group hover:shadow-lg transition-all duration-200">
      <div className="card-body">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {trend && (
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
              {trend}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
            {title}
          </p>
          <p className="text-3xl font-black text-neutral-900 dark:text-white mt-1">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
```

### PageHeader Component
```jsx
const PageHeader = ({ title, subtitle, actions, breadcrumbs }) => {
  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {breadcrumbs && (
          <nav className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                {index > 0 && <ChevronRightIcon className="h-4 w-4" />}
                <button className="hover:text-neutral-900 dark:hover:text-white">
                  {crumb}
                </button>
              </React.Fragment>
            ))}
          </nav>
        )}
        
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="page-title">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {subtitle}
              </p>
            )}
          </div>
          
          {actions && (
            <div className="flex items-center gap-3">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

---

## 🚀 RÉSUMÉ DES PRIORITÉS

### Haute Priorité (Semaine 1)
1. ✅ Créer le système de design tokens
2. ✅ Standardiser Card, Button, Input
3. ✅ Unifier la Sidebar
4. ✅ Améliorer la page Dashboard

### Moyenne Priorité (Semaine 2)
1. Refactoriser UserManagement (table responsive)
2. Améliorer DossierManagement (vue grille)
3. Optimiser les formulaires modaux
4. Standardiser les badges et statuts

### Basse Priorité (Semaine 3)
1. Animations et micro-interactions
2. Empty states
3. Loading states
4. Accessibilité (ARIA, focus)

---

**Note finale :** Ces améliorations garantissent une cohérence visuelle parfaite, une meilleure expérience utilisateur et une maintenance simplifiée du code. Tous les composants doivent suivre le même système de design pour une plateforme professionnelle et moderne.
