# 🎨 Composants Cards et Badges - Interface Livreur V2

Ce dossier contient les nouveaux composants modernes pour l'affichage des dossiers de livraison, remplaçant les anciens composants définis dans `LivreurDashboard.js`.

## 📦 Composants Disponibles

### Badges

#### `DeliveryStatusBadge`
Badge moderne pour l'affichage du statut de livraison.

**Props:**
- `status` (required): `'imprime' | 'pret_livraison' | 'en_livraison' | 'livre' | 'retour' | 'echec_livraison' | 'reporte' | 'annule'`
- `size`: `'xs' | 'sm' | 'md' | 'lg'` (défaut: `'sm'`)
- `className`: classes CSS personnalisées
- `showIcon`: afficher l'icône (défaut: `true`)
- `showLabel`: afficher le libellé (défaut: `true`)

**Exemples:**
```jsx
<DeliveryStatusBadge status="pret_livraison" />
<DeliveryStatusBadge status="en_livraison" size="md" />
<DeliveryStatusBadge status="livre" showIcon={false} />
```

#### `DeliveryPriorityBadge`
Badge pour l'affichage de la priorité avec détails de distance et temps.

**Props:**
- `priority` (required): `'urgent' | 'high' | 'medium' | 'low'`
- `estimatedTime`: temps estimé en minutes
- `distance`: distance en kilomètres
- `size`: `'xs' | 'sm' | 'md' | 'lg'` (défaut: `'sm'`)
- `layout`: `'vertical' | 'horizontal'` (défaut: `'vertical'`)
- `showDetails`: afficher les détails (défaut: `true`)

**Exemples:**
```jsx
<DeliveryPriorityBadge priority="urgent" estimatedTime={15} distance={3.2} />
<DeliveryPriorityBadge priority="high" layout="horizontal" />
```

#### `ZoneBadge`
Badge pour l'affichage des zones géographiques.

**Props:**
- `zone` (required): `'paris' | 'banlieue' | 'petite_couronne' | 'grande_couronne' | 'idf' | 'province' | 'autre'`
- `size`: `'xs' | 'sm' | 'md' | 'lg'` (défaut: `'sm'`)
- `variant`: `'default' | 'outlined' | 'subtle'` (défaut: `'default'`)
- `showIcon`: afficher l'icône (défaut: `true`)
- `showLabel`: afficher le libellé (défaut: `true`)

**Exemples:**
```jsx
<ZoneBadge zone="paris" />
<ZoneBadge zone="banlieue" variant="outlined" />
<ZoneBadge zone="idf" size="lg" variant="subtle" />
```

### Cartes

#### `DeliveryDossierCardV2`
Carte moderne et interactive pour l'affichage d'un dossier de livraison.

**Props:**
- `dossier` (required): objet contenant les données du dossier
- `index`: index pour l'animation (défaut: `0`)
- `onStartDelivery`: callback pour démarrer une livraison
- `onShowDetails`: callback pour afficher les détails
- `onNavigateToAddress`: callback pour la navigation
- `onCallClient`: callback pour appeler le client
- `onMarkComplete`: callback pour marquer comme terminé
- `onMarkFailed`: callback pour marquer en échec
- `onReschedule`: callback pour reporter
- `layout`: `'default' | 'compact' | 'expanded'` (défaut: `'default'`)
- `showActions`: afficher les boutons d'action (défaut: `true`)
- `showMetadata`: afficher les métadonnées étendues (défaut: `true`)

**Structure du dossier:**
```typescript
interface Dossier {
  displayNumber: string;
  displayClient: string;
  displayAdresse: string;
  displayTelephone?: string;
  deliveryStatus: string;
  deliveryZone?: string;
  deliveryPriority?: string;
  isUrgentDelivery?: boolean;
  amount?: number | string;
  estimatedTime?: number | string;
  distance?: number | string;
  deliveryDate?: string;
  comments?: string;
  retryCount?: number;
}
```

**Exemples:**
```jsx
<DeliveryDossierCardV2 
  dossier={dossier}
  onStartDelivery={handleStart}
  onShowDetails={handleDetails}
  onNavigateToAddress={handleNavigation}
  onCallClient={handleCall}
/>

// Version compacte sans actions
<DeliveryDossierCardV2 
  dossier={dossier}
  showActions={false}
  showMetadata={false}
  layout="compact"
/>
```

## 🎨 Caractéristiques

### Design System
- **Thème sombre**: Support complet du dark mode
- **Couleurs cohérentes**: Palette de couleurs unifiée
- **Typographie**: Utilisation de fonts modernes et lisibles
- **Espacement**: System de spacing cohérent

### Animations
- **Framer Motion**: Animations fluides et performantes
- **Hover effects**: Interactions visuelles engageantes
- **Loading states**: États de chargement élégants
- **Transitions**: Transitions douces entre les états

### Accessibilité
- **ARIA labels**: Labels descriptifs pour screen readers
- **Tooltips**: Informations contextuelles
- **Contrast**: Respect des ratios de contraste
- **Navigation clavier**: Support complet du clavier

### Performance
- **React.memo**: Optimisation des re-rendus
- **Lazy loading**: Chargement différé des composants
- **Bundle splitting**: Division optimisée du code
- **CSS optimisé**: Classes Tailwind optimisées

## 🚀 Migration depuis l'ancienne version

### Remplacement des anciens badges

**Avant (LivreurDashboard.js):**
```jsx
const DeliveryStatusBadge = ({ status, size = 'sm' }) => {
  // Ancienne implémentation...
};
```

**Après (DeliveryStatusBadge.js):**
```jsx
import { DeliveryStatusBadge } from './cards';

<DeliveryStatusBadge status="pret_livraison" size="sm" />
```

### Remplacement des anciennes cartes

**Avant:**
```jsx
const DeliveryDossierCard = ({ dossier, index }) => {
  // Ancienne implémentation...
};
```

**Après:**
```jsx
import { DeliveryDossierCardV2 } from './cards';

<DeliveryDossierCardV2 
  dossier={dossier}
  index={index}
  onStartDelivery={handleStartDelivery}
  onShowDetails={handleShowDetails}
  // ... autres props
/>
```

## 🧪 Tests et Démo

Un composant de démonstration est disponible dans `demo/BadgesAndCardsDemo.js` pour :
- Visualiser tous les composants
- Tester les interactions
- Valider les styles
- Vérifier l'accessibilité

Pour utiliser la démo :
```jsx
import BadgesAndCardsDemo from './demo/BadgesAndCardsDemo';

// Dans votre composant de test
<BadgesAndCardsDemo />
```

## 📋 TODO

- [ ] Tests unitaires avec Jest/RTL
- [ ] Tests d'accessibilité avec axe-core  
- [ ] Documentation Storybook
- [ ] Tests visuels avec Chromatic
- [ ] Optimisations performance supplémentaires
- [ ] Support RTL (right-to-left)
- [ ] Thèmes personnalisés
- [ ] Export des tokens design

## 🤝 Contribution

Les contributions sont les bienvenues ! Merci de :
1. Respecter les conventions de nommage
2. Maintenir la cohérence du design system
3. Ajouter des tests pour les nouveaux composants
4. Mettre à jour la documentation

---

*Ces composants font partie de la refonte complète de l'interface Livreur V2, conçue pour offrir une expérience utilisateur moderne et performante.*