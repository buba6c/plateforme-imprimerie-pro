# 🚀 Quick Start - Interface Livreur V2

## Installation et Utilisation Rapide

### 1. Vérifier les dépendances

```bash
# Les packages requis doivent être installés
npm list framer-motion
npm list @heroicons/react
npm list prop-types
```

Si manquants :
```bash
npm install framer-motion @heroicons/react prop-types
```

### 2. Importer les composants

```jsx
import {
  // Badges
  DeliveryStatusBadge,
  DeliveryPriorityBadge,
  ZoneBadge,
  
  // Cartes
  DeliveryDossierCardV2,
  
  // Sections
  ALivrerSectionV2,
  ProgrammeesSectionV2,
  TermineesSectionV2
} from './components/livreur-v2';

// Ou imports spécifiques
import { DeliveryStatusBadge } from './components/livreur-v2/cards';
import { EmptyState, LoadingState } from './components/livreur-v2/common';
```

### 3. Utilisation Basique

#### Badge de Statut

```jsx
<DeliveryStatusBadge status="pret_livraison" />
<DeliveryStatusBadge status="en_livraison" size="md" />
```

#### Badge de Priorité

```jsx
<DeliveryPriorityBadge 
  priority="urgent" 
  estimatedTime={15} 
  distance={3.2} 
/>
```

#### Carte de Dossier

```jsx
const dossier = {
  id: 'D001',
  displayNumber: 'D-2024-001',
  displayClient: 'Restaurant Le Gourmet',
  displayAdresse: '15 Rue de la Paix, 75001 Paris',
  displayTelephone: '01 42 86 17 89',
  deliveryStatus: 'pret_livraison',
  deliveryZone: 'paris',
  deliveryPriority: 'high',
  isUrgentDelivery: true,
  amount: 125.50,
  estimatedTime: 15,
  distance: 3.2
};

<DeliveryDossierCardV2
  dossier={dossier}
  onStartDelivery={(d) => console.log('Démarrer', d)}
  onShowDetails={(d) => console.log('Détails', d)}
  onNavigateToAddress={(d) => console.log('Navigation', d)}
  onCallClient={(d) => console.log('Appel', d)}
/>
```

#### Section Complète

```jsx
function MaPageLivraison() {
  const [dossiers, setDossiers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Charger les dossiers
    fetchDossiers().then(data => {
      setDossiers(data);
      setLoading(false);
    });
  }, []);
  
  return (
    <ALivrerSectionV2
      dossiers={dossiers}
      loading={loading}
      onProgrammer={(dossier) => {
        console.log('Programmer:', dossier);
      }}
      onVoirDetails={(dossier) => {
        console.log('Détails:', dossier);
      }}
      onNavigation={(dossier) => {
        const address = encodeURIComponent(dossier.displayAdresse);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`);
      }}
      onAppel={(dossier) => {
        window.location.href = `tel:${dossier.displayTelephone}`;
      }}
    />
  );
}
```

### 4. Tester la Démo

```jsx
import BadgesAndCardsDemo from './components/livreur-v2/demo/BadgesAndCardsDemo';

// Dans votre route de test
<Route path="/demo-livreur" element={<BadgesAndCardsDemo />} />
```

## Exemples de Données

### Structure de Dossier Minimale

```javascript
const dossierMinimal = {
  id: 'D001',
  displayNumber: 'D-2024-001',
  displayClient: 'Client Name',
  displayAdresse: '123 Rue Example, 75001 Paris',
  deliveryStatus: 'pret_livraison'
};
```

### Structure Complète

```javascript
const dossierComplet = {
  id: 'D001',
  displayNumber: 'D-2024-001',
  displayClient: 'Restaurant Le Gourmet',
  displayAdresse: '15 Rue de la Paix, 75001 Paris',
  displayTelephone: '01 42 86 17 89',
  deliveryStatus: 'pret_livraison',
  deliveryZone: 'paris',
  deliveryPriority: 'high',
  isUrgentDelivery: true,
  amount: 125.50,
  estimatedTime: 15,
  distance: 3.2,
  deliveryDate: '2024-01-15',
  comments: 'Livraison en urgence',
  retryCount: 0,
  progress: 0
};
```

## Statuts Disponibles

```javascript
// Pour DeliveryStatusBadge
const statuts = [
  'imprime',
  'pret_livraison',
  'en_livraison',
  'livre',
  'retour',
  'echec_livraison',
  'reporte',
  'annule'
];

// Pour DeliveryPriorityBadge
const priorites = ['urgent', 'high', 'medium', 'low'];

// Pour ZoneBadge
const zones = [
  'paris',
  'banlieue',
  'petite_couronne',
  'grande_couronne',
  'idf',
  'province',
  'autre'
];
```

## Configuration Dark Mode

### Dans tailwind.config.js

```javascript
module.exports = {
  darkMode: 'class', // ou 'media'
  // ... reste de la config
}
```

### Activer le dark mode

```jsx
// Ajouter la classe 'dark' au html ou body
document.documentElement.classList.add('dark');

// Ou utiliser un toggle
const [darkMode, setDarkMode] = useState(false);

useEffect(() => {
  if (darkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}, [darkMode]);
```

## Personnalisation

### Modifier les couleurs des badges

Éditer `cards/DeliveryStatusBadge.js` :

```javascript
const statusConfigs = {
  pret_livraison: {
    bg: 'bg-votre-couleur-100',
    text: 'text-votre-couleur-700',
    label: 'Votre Label',
    icon: '🎨'
  }
  // ...
};
```

### Ajouter des actions personnalisées

```jsx
<DeliveryDossierCardV2
  dossier={dossier}
  // Actions standards
  onStartDelivery={handleStart}
  
  // Action personnalisée
  onCustomAction={(dossier) => {
    // Votre logique
  }}
/>
```

## Troubleshooting

### Erreur : "Module not found: Can't resolve 'framer-motion'"

```bash
npm install framer-motion
```

### Erreur : "Cannot find module '@heroicons/react/24/outline'"

```bash
npm install @heroicons/react
```

### Les animations ne fonctionnent pas

Vérifier que Framer Motion est bien installé et importé correctement.

### Dark mode ne s'active pas

1. Vérifier `tailwind.config.js` : `darkMode: 'class'`
2. Ajouter la classe `dark` sur l'élément HTML
3. Purger le cache Tailwind : `npm run build`

## Performance

### Optimisations déjà intégrées

- ✅ React.memo sur tous les composants
- ✅ useMemo pour calculs statistiques
- ✅ useCallback pour handlers
- ✅ Lazy loading des métadonnées

### Conseils additionnels

```jsx
// Virtualisation pour grandes listes
import { FixedSizeList } from 'react-window';

// Pagination côté client
const ITEMS_PER_PAGE = 12;
const paginatedDossiers = dossiers.slice(0, page * ITEMS_PER_PAGE);

// Debounce pour recherche
const debouncedSearch = useMemo(
  () => debounce((term) => setSearchTerm(term), 300),
  []
);
```

## Support et Documentation

- 📚 Documentation complète : `IMPLEMENTATION_COMPLETE.md`
- 📦 Guide des badges : `cards/README.md`
- 🎯 État d'avancement : `STATUS.txt`
- 🧪 Démo interactive : `demo/BadgesAndCardsDemo.js`

## Ressources

- Framer Motion : https://www.framer.com/motion/
- Heroicons : https://heroicons.com/
- Tailwind CSS : https://tailwindcss.com/

---

*Pour toute question, consultez la documentation complète ou les exemples dans le dossier `demo/`*