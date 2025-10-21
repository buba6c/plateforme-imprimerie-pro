# 🎨 Design System - Cartes de Dossiers

## Standards Unifiés pour Tous les Dashboards

### 📐 Dimensions & Espacement

```css
/* Carte de base */
.dossier-card {
  border-radius: 0.5rem;        /* mobile: 8px */
  border-radius: 0.75rem;       /* sm: 12px */
  padding: 1rem;                /* mobile: 16px */
  padding: 1.5rem;              /* sm: 24px */
  min-height: 280px;            /* hauteur minimale uniforme */
}

/* Grille responsive */
grid-cols-1                     /* mobile: 1 colonne */
lg:grid-cols-2                  /* large: 2 colonnes */
xl:grid-cols-3                  /* xl: 3 colonnes */
gap-4 sm:gap-6                  /* espacement entre cartes */
```

### 📝 Structure Uniforme

Chaque carte doit contenir dans cet ordre :

1. **En-tête** (toujours)
   - Nom du client : `text-base sm:text-lg font-bold`
   - Numéro de dossier : `text-xs sm:text-sm text-neutral-600`

2. **Badge personnalisé** (optionnel selon le rôle)
   - Machine (Imprimeur)
   - Adresse (Livreur)
   - Statut (Préparateur)

3. **Informations standards** (toujours dans cet ordre)
   - Date de création : icône ClockIcon
   - Nombre de fichiers : icône DocumentTextIcon
   - Créé par (si applicable) : icône UserIcon

4. **Informations additionnelles** (selon le rôle)
   - Téléphone (Livreur)
   - Mode de paiement (Livreur)

5. **Actions** (toujours)
   - Bouton "Voir détails" (toujours présent)
   - Bouton d'action principal (selon le contexte)

### 🎨 Classes CSS Standardisées

#### Carte Container
```jsx
<div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 shadow-md hover:shadow-lg transition-all duration-300 border border-neutral-200 hover:border-neutral-300">
```

#### En-tête
```jsx
<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
  <div className="flex-1 min-w-0">
    <h3 className="text-base sm:text-lg font-bold text-neutral-900 mb-1 truncate">
      {nom_client}
    </h3>
    <p className="text-xs sm:text-sm text-neutral-600">
      Dossier #{numero}
    </p>
  </div>
</div>
```

#### Badge
```jsx
<div className="mb-3">
  <span className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium inline-flex items-center gap-1.5">
```

#### Informations
```jsx
<div className="space-y-2 mb-4">
  <div className="flex items-center gap-2 text-xs sm:text-sm text-neutral-600">
    <Icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
    <span>...</span>
  </div>
</div>
```

#### Actions
```jsx
<div className="flex flex-col sm:flex-row gap-2">
  <button className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base flex items-center justify-center gap-2">
    <EyeIcon className="h-4 w-4 sm:h-5 sm:w-5" />
    Voir détails
  </button>
</div>
```

### 🎯 Mapping des Champs par Dashboard

#### Préparateur
```javascript
{
  nom_client: dossier.client_nom || dossier.nom_client,
  numero: dossier.numero_commande || dossier.numero,
  date: dossier.created_at || dossier.date_creation,
  fichiers: dossier.files_count || dossier.nombre_fichiers,
  machine: dossier.type_formulaire || dossier.displayType
}
```

#### Imprimeur
```javascript
{
  nom_client: dossier.nom_client || dossier.client,
  numero: dossier.numero || dossier.id,
  date: dossier.date_creation,
  fichiers: dossier.nombre_fichiers,
  machine: dossier.machine_impression || dossier.type_formulaire
}
```

#### Livreur
```javascript
{
  nom_client: dossier.nom_client || dossier.client,
  numero: dossier.numero || dossier.id,
  date: dossier.date_creation,
  fichiers: dossier.nombre_fichiers,
  adresse: dossier.adresse_livraison,
  telephone: dossier.telephone_contact,
  paiement: dossier.mode_paiement,
  montant: dossier.montant_a_encaisser
}
```

### 🔧 Fonction Utilitaire de Normalisation

```javascript
// À ajouter dans chaque dashboard
const normalizeDossierData = (dossier) => {
  return {
    id: dossier.id,
    numero: dossier.numero_commande || dossier.numero || dossier.id,
    nom_client: dossier.client_nom || dossier.nom_client || dossier.client || 'Client inconnu',
    date_creation: dossier.created_at || dossier.date_creation,
    nombre_fichiers: dossier.files_count || dossier.nombre_fichiers || 0,
    reference: dossier.reference,
    // Champs spécifiques selon le rôle
    ...dossier
  };
};
```

### ✅ Checklist d'Alignement

Pour chaque dashboard, vérifier :

- [ ] Padding de carte : `p-4 sm:p-6`
- [ ] Border radius : `rounded-lg sm:rounded-xl`
- [ ] Titre client : `text-base sm:text-lg font-bold`
- [ ] Numéro : `text-xs sm:text-sm text-neutral-600`
- [ ] Icônes : `h-4 w-4 sm:h-5 sm:w-5`
- [ ] Texte info : `text-xs sm:text-sm`
- [ ] Boutons : `px-3 sm:px-4 py-2`
- [ ] Gap entre éléments : `gap-2` (dans la carte), `gap-3 sm:gap-4` (header)
- [ ] Margin bottom : `mb-3` (badge), `mb-4` (sections)
- [ ] Hauteur minimale : Toutes les cartes dans une grille ont la même hauteur

### 🎨 Couleurs par Rôle

#### Préparateur
- Thème : Bleu-Indigo
- Header gradient : `from-blue-600 via-indigo-600 to-purple-600`
- Sections : Bordures bleues/orange

#### Imprimeur
- Thème : Violet-Pourpre
- Header gradient : `from-purple-600 via-violet-600 to-purple-700`
- Machine Roland : `from-rose-100 to-pink-100`, `text-rose-700`
- Machine Xerox : `from-emerald-100 to-green-100`, `text-emerald-700`

#### Livreur
- Thème : Ambre-Orange
- Header gradient : `from-amber-600 via-orange-600 to-amber-700`
- Sections : Ambre (à livrer), Bleu (en cours), Émeraude (livrés)

### 📱 Responsive Breakpoints

- **Mobile (default)** : < 640px - 1 colonne, padding réduit
- **SM (640px)** : ≥ 640px - Padding normal, textes plus grands
- **LG (1024px)** : ≥ 1024px - 2 colonnes
- **XL (1280px)** : ≥ 1280px - 3 colonnes

