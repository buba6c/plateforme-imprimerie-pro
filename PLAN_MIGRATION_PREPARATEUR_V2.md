# 📋 PLAN MIGRATION PRÉPARATEUR V2 - Architecture Modulaire

**Date** : 17 octobre 2025  
**Inspiré de** : Migration Livreur V2 (29 fichiers, 100% UX design)  
**Objectif** : Migrer PreparateurDashboardUltraModern vers architecture V2 modulaire

---

## 📊 ANALYSE ÉTAT ACTUEL

### **Dashboard Actuel : PreparateurDashboardUltraModern.js**

**Caractéristiques** :
- **Taille** : 1130 lignes (monolithique)
- **États** : 11 useState (dossiers, modals, filters, stats, etc.)
- **Sections** : 4 principales (brouillon, en_cours, a_revoir, termine)
- **Statuts gérés** :
  - `brouillon` - Dossiers en création
  - `en_cours` - Dossiers en préparation active
  - `a_revoir` - Dossiers nécessitant révision
  - `pret_impression` - Prêts pour imprimeur
  - `termine` - Dossiers complétés
  - `livre` - Dossiers livrés (héritage workflow)

**Fonctionnalités principales** :
- ✅ Gestion dossiers par statut
- ✅ Statistiques temps réel (8 KPIs)
- ✅ Filtres avancés (statut, type, priorité, recherche)
- ✅ Vue Kanban + Liste
- ✅ Modales détails, création
- ✅ Dark mode complet (52 occurrences)
- ✅ Animations Framer Motion
- ✅ Gradients purple/indigo/pink
- ✅ Calcul priorité automatique (urgent, high, medium, low)

**Limitations actuelles** :
- ⚠️ Code monolithique (1130 lignes)
- ⚠️ Logique mélangée présentation/métier
- ⚠️ Difficile à maintenir/tester
- ⚠️ Pas de hooks personnalisés
- ⚠️ Duplication code avec Imprimeur

---

## 🎯 ARCHITECTURE CIBLE V2

### **Structure Modulaire (28 fichiers)**

```
frontend/src/components/preparateur/v2/
├── dashboard/                          (3 fichiers)
│   ├── PreparateurDashboardV2.js      ← Orchestrateur principal
│   ├── PreparateurHeader.js           ← Header avec user, refresh, filters
│   └── PreparateurKPICards.js         ← 8 KPI cards avec stats
│
├── sections/                           (5 fichiers)
│   ├── BrouillonSectionV2.js          ← Dossiers brouillon
│   ├── EnCoursSectionV2.js            ← Dossiers en préparation
│   ├── ARevoirSectionV2.js            ← Dossiers à réviser
│   ├── PretImpressionSectionV2.js     ← Prêts pour impression
│   ├── TermineeSectionV2.js           ← Dossiers terminés
│   └── index.js
│
├── modals/                             (5 fichiers)
│   ├── CreateDossierModalV2.js        ← Création nouveau dossier
│   ├── DossierDetailsModalV2.js       ← Détails complets
│   ├── ValiderPreparationModalV2.js   ← Validation finale
│   ├── EnvoyerImpressionModalV2.js    ← Envoi imprimeur
│   └── index.js
│
├── navigation/                         (3 fichiers)
│   ├── PreparateurNavigation.js       ← Tabs sections
│   ├── PreparateurFilters.js          ← Filtres avancés
│   └── index.js
│
├── cards/                              (5 fichiers)
│   ├── DossierCardV2.js               ← Card dossier
│   ├── StatusBadge.js                 ← Badge statut
│   ├── PriorityBadge.js               ← Badge priorité
│   ├── TypeBadge.js                   ← Badge type machine
│   └── index.js
│
├── hooks/                              (3 fichiers)
│   ├── usePreparateurData.js          ← Fetch, stats, grouping
│   ├── usePreparateurActions.js       ← Actions métier
│   └── index.js
│
├── utils/                              (3 fichiers)
│   ├── preparateurConstants.js        ← Configs statuts/types
│   ├── preparateurUtils.js            ← Helpers format
│   └── index.js
│
└── common/                             (3 fichiers)
    ├── LoadingState.js                ← État chargement
    ├── EmptyState.js                  ← État vide
    └── index.js
```

**Total** : 28 fichiers (vs 29 Livreur, -1 modale echec)

---

## 🔧 DÉTAILS TECHNIQUES PAR MODULE

### **1. Dashboard Principal (3 fichiers)**

#### **PreparateurDashboardV2.js** (200 lignes)
```javascript
import { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { AnimatePresence } from 'framer-motion';

// Hooks
import usePreparateurData from '../hooks/usePreparateurData';
import usePreparateurActions from '../hooks/usePreparateurActions';

// Components
import PreparateurHeader from './PreparateurHeader';
import PreparateurKPICards from './PreparateurKPICards';
import PreparateurNavigation from '../navigation/PreparateurNavigation';
import PreparateurFilters from '../navigation/PreparateurFilters';

// Sections
import BrouillonSectionV2 from '../sections/BrouillonSectionV2';
import EnCoursSectionV2 from '../sections/EnCoursSectionV2';
import ARevoirSectionV2 from '../sections/ARevoirSectionV2';
import PretImpressionSectionV2 from '../sections/PretImpressionSectionV2';
import TermineeSectionV2 from '../sections/TermineeSectionV2';

// Modals
import CreateDossierModalV2 from '../modals/CreateDossierModalV2';
import DossierDetailsModalV2 from '../modals/DossierDetailsModalV2';
import ValiderPreparationModalV2 from '../modals/ValiderPreparationModalV2';
import EnvoyerImpressionModalV2 from '../modals/EnvoyerImpressionModalV2';

export default function PreparateurDashboardV2({ user, initialSection = 'en_cours' }) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [viewMode, setViewMode] = useState('kanban');
  const [showFilters, setShowFilters] = useState(false);
  
  // Hooks personnalisés
  const { 
    dossiers, 
    stats, 
    loading, 
    refreshing, 
    groupedDossiers, 
    handleRefresh 
  } = usePreparateurData();
  
  const { 
    createDossier, 
    validerPreparation, 
    envoyerImpression,
    updateStatut 
  } = usePreparateurActions();
  
  // Gestion modales
  const [modalState, setModalState] = useState({
    create: { isOpen: false, dossier: null },
    details: { isOpen: false, dossier: null },
    valider: { isOpen: false, dossier: null },
    envoyer: { isOpen: false, dossier: null },
  });
  
  // ... render sections conditionnellement
}
```

**Responsabilités** :
- ✅ Orchestration générale
- ✅ Gestion état modales
- ✅ Wiring hooks → composants
- ✅ Routing sections

---

#### **PreparateurHeader.js** (250 lignes)
```javascript
import { motion } from 'framer-motion';
import {
  UserCircleIcon,
  ArrowPathIcon,
  FunnelIcon,
  MoonIcon,
  SunIcon,
  PlusCircleIcon,
  Squares2X2Icon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';

export default function PreparateurHeader({
  user,
  refreshing,
  onRefresh,
  showFilters,
  onToggleFilters,
  viewMode,
  onViewModeChange,
  onCreateDossier,
  stats
}) {
  return (
    <motion.div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700 p-5">
      {/* Logo + Titre */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/30">
          <FolderIcon className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1>Préparation Dossiers</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {user.nom || user.username} - {stats.total} dossiers
          </p>
        </div>
      </div>
      
      {/* Actions : Refresh, Filters, Dark mode, View mode, Create */}
      <div className="flex gap-2">
        <button onClick={onRefresh}>
          <ArrowPathIcon className={refreshing ? 'animate-spin' : ''} />
        </button>
        <button onClick={onToggleFilters}>
          <FunnelIcon />
        </button>
        <button onClick={onCreateDossier}>
          <PlusCircleIcon />
        </button>
        {/* ... autres boutons */}
      </div>
    </motion.div>
  );
}
```

**Design** :
- **Logo** : `bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/30`
- **Buttons** : `rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-neutral-700`
- **Progress bar** : Pendant refresh

---

#### **PreparateurKPICards.js** (300 lignes)
```javascript
export default function PreparateurKPICards({ stats, onSectionClick, activeSection }) {
  const kpiCards = [
    {
      id: 'brouillon',
      title: 'Brouillons',
      value: stats.brouillon,
      bgGradient: 'from-gray-500 to-gray-600',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
      Icon: DocumentIcon,
      description: 'En création'
    },
    {
      id: 'en_cours',
      title: 'En Cours',
      value: stats.enCours,
      bgGradient: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      Icon: ClockIcon,
      description: 'En préparation',
      trend: stats.weeklyTrend
    },
    {
      id: 'a_revoir',
      title: 'À Revoir',
      value: stats.aRevoir,
      bgGradient: 'from-orange-500 to-orange-600',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      Icon: ExclamationTriangleIcon,
      description: 'Nécessitent révision',
      urgent: true
    },
    {
      id: 'pret_impression',
      title: 'Prêts Impression',
      value: stats.pretImpression,
      bgGradient: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      Icon: PrinterIcon,
      description: 'Validés'
    },
    {
      id: 'termine',
      title: 'Terminés',
      value: stats.termine,
      bgGradient: 'from-green-500 to-green-600',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      Icon: CheckCircleIcon,
      description: 'Complétés'
    },
    {
      id: 'urgent',
      title: 'Urgents',
      value: stats.urgent,
      bgGradient: 'from-red-500 to-red-600',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      Icon: BoltIcon,
      description: '> 7 jours'
    },
    {
      id: 'productivity',
      title: 'Productivité',
      value: `${stats.productivity}%`,
      bgGradient: 'from-indigo-500 to-indigo-600',
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      Icon: ChartBarIcon,
      description: 'Cette semaine',
      progress: stats.productivity
    },
    {
      id: 'avgTime',
      title: 'Temps Moyen',
      value: `${stats.averageProcessingTime}j`,
      bgGradient: 'from-pink-500 to-pink-600',
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-600',
      Icon: ClockIcon,
      description: 'Par dossier'
    }
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpiCards.map((card, index) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
          className={`
            bg-white dark:bg-neutral-800 rounded-xl shadow-sm hover:shadow-md 
            border border-gray-100 dark:border-neutral-700 p-4 cursor-pointer
            transition-all duration-200
            ${activeSection === card.id ? 'ring-2 ring-purple-500' : ''}
          `}
          onClick={() => onSectionClick(card.id)}
        >
          {/* Card content avec gradient header */}
        </motion.div>
      ))}
    </div>
  );
}
```

**Palette couleurs** :
- **Brouillon** : Gray 500-600
- **En Cours** : Purple 500-600 (primaire)
- **À Revoir** : Orange 500-600
- **Prêt Impression** : Blue 500-600
- **Terminés** : Green 500-600
- **Urgents** : Red 500-600
- **Productivité** : Indigo 500-600
- **Temps Moyen** : Pink 500-600

---

### **2. Sections (5 fichiers)**

Chaque section suit le même pattern :

```javascript
// EnCoursSectionV2.js (exemple)
export default function EnCoursSectionV2({
  dossiers,
  loading,
  viewMode,
  onViewDetails,
  onValider,
  onEnvoyer,
  filters
}) {
  const filteredDossiers = useMemo(() => {
    return dossiers
      .filter(d => d.status === 'en_cours')
      .filter(applyFilters(filters));
  }, [dossiers, filters]);
  
  if (loading) return <LoadingState />;
  if (!filteredDossiers.length) return <EmptyState section="en_cours" />;
  
  return (
    <motion.div>
      {/* Stats card avec gradient purple */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-6">
        {/* Statistiques section */}
      </div>
      
      {/* Liste dossiers */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDossiers.map(dossier => (
            <DossierCardV2
              key={dossier.id}
              dossier={dossier}
              onView={() => onViewDetails(dossier)}
              onValider={() => onValider(dossier)}
              onEnvoyer={() => onEnvoyer(dossier)}
            />
          ))}
        </div>
      ) : (
        <table>{/* Vue liste */}</table>
      )}
    </motion.div>
  );
}
```

**Sections** :
1. **BrouillonSectionV2** : Gray gradient, action "Commencer"
2. **EnCoursSectionV2** : Purple gradient, actions "Valider", "Envoyer"
3. **ARevoirSectionV2** : Orange gradient, action "Corriger"
4. **PretImpressionSectionV2** : Blue gradient, action "Voir détails"
5. **TermineeSectionV2** : Green gradient, historique complet

---

### **3. Modales (4 fichiers)**

#### **CreateDossierModalV2.js**
```javascript
export default function CreateDossierModalV2({ isOpen, onClose, onCreate, loading }) {
  const [formData, setFormData] = useState({
    numero_commande: '',
    client_nom: '',
    type_formulaire: 'roland',
    quantite: '',
    description: ''
  });
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h2>Créer un Nouveau Dossier</h2>
            <form>
              {/* Champs formulaire */}
            </form>
            <div className="flex gap-3">
              <button onClick={onClose}>Annuler</button>
              <button onClick={() => onCreate(formData)}>Créer</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

#### **DossierDetailsModalV2.js**
- Affichage complet dossier
- Historique modifications
- Actions disponibles selon statut

#### **ValiderPreparationModalV2.js**
- Checklist validation (fichiers, infos client, quantité)
- Commentaires optionnels
- Confirmation passage "prêt_impression"

#### **EnvoyerImpressionModalV2.js**
- Sélection imprimeur (si plusieurs)
- Message pour imprimeur
- Confirmation envoi

---

### **4. Navigation & Filtres (2 fichiers)**

#### **PreparateurNavigation.js**
```javascript
export default function PreparateurNavigation({ activeSection, onSectionChange }) {
  const sections = [
    { id: 'brouillon', label: 'Brouillons', icon: DocumentIcon, count: stats.brouillon },
    { id: 'en_cours', label: 'En Cours', icon: ClockIcon, count: stats.enCours },
    { id: 'a_revoir', label: 'À Revoir', icon: ExclamationTriangleIcon, count: stats.aRevoir },
    { id: 'pret_impression', label: 'Prêts', icon: PrinterIcon, count: stats.pretImpression },
    { id: 'termine', label: 'Terminés', icon: CheckCircleIcon, count: stats.termine }
  ];
  
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-3 flex gap-2">
      {sections.map(section => (
        <motion.button
          layoutId={activeSection === section.id ? 'activeTab' : undefined}
          className={`relative px-4 py-2 rounded-xl transition-all ${
            activeSection === section.id 
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white'
              : 'hover:bg-gray-100 dark:hover:bg-neutral-700'
          }`}
          onClick={() => onSectionChange(section.id)}
        >
          {section.label}
          {section.count > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-white/20 text-xs">
              {section.count}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}
```

#### **PreparateurFilters.js**
- Recherche textuelle
- Filtre statut
- Filtre type (roland, xerox, autre)
- Filtre priorité
- Tri (date, client, urgence)

---

### **5. Hooks Personnalisés (2 fichiers)**

#### **usePreparateurData.js** (150 lignes)
```javascript
export default function usePreparateurData() {
  const [dossiers, setDossiers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const fetchDossiers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dossiersService.getDossiers({});
      const enrichedDossiers = data.dossiers.map(enrichDossier);
      setDossiers(enrichedDossiers);
      calculateStats(enrichedDossiers);
    } catch (error) {
      notificationService.error('Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, []);
  
  const enrichDossier = (dossier) => ({
    ...dossier,
    status: normalizeStatus(dossier.statut),
    priority: calculatePriority(dossier),
    isUrgent: calculateUrgency(dossier),
    displayNumber: dossier.numero_commande || `#${dossier.id}`,
    displayClient: dossier.client_nom || 'Client inconnu',
    displayType: (dossier.type_formulaire || 'autre').toLowerCase()
  });
  
  const groupedDossiers = useMemo(() => ({
    brouillon: dossiers.filter(d => d.status === 'brouillon'),
    en_cours: dossiers.filter(d => d.status === 'en_cours'),
    a_revoir: dossiers.filter(d => d.status === 'a_revoir'),
    pret_impression: dossiers.filter(d => d.status === 'pret_impression'),
    termine: dossiers.filter(d => d.status === 'termine')
  }), [dossiers]);
  
  return {
    dossiers,
    stats,
    loading,
    refreshing,
    groupedDossiers,
    handleRefresh
  };
}
```

#### **usePreparateurActions.js** (200 lignes)
```javascript
export default function usePreparateurActions() {
  const [actionLoading, setActionLoading] = useState({});
  
  const createDossier = async (formData) => {
    setActionLoading(prev => ({ ...prev, create: true }));
    try {
      await dossiersService.createDossier(formData);
      notificationService.success('Dossier créé !');
      return true;
    } catch (error) {
      notificationService.error('Erreur création');
      return false;
    } finally {
      setActionLoading(prev => ({ ...prev, create: false }));
    }
  };
  
  const validerPreparation = async (dossierId, data) => {
    setActionLoading(prev => ({ ...prev, [`valider_${dossierId}`]: true }));
    try {
      await dossiersService.updateStatut(dossierId, { statut: 'pret_impression', ...data });
      notificationService.success('Dossier validé !');
      return true;
    } catch (error) {
      notificationService.error('Erreur validation');
      return false;
    } finally {
      setActionLoading(prev => ({ ...prev, [`valider_${dossierId}`]: false }));
    }
  };
  
  const envoyerImpression = async (dossierId, imprimeurId) => {
    // Notification imprimeur + changement statut
  };
  
  const updateStatut = async (dossierId, newStatut) => {
    // Update générique statut
  };
  
  return {
    createDossier,
    validerPreparation,
    envoyerImpression,
    updateStatut,
    actionLoading
  };
}
```

---

### **6. Utils & Constants (2 fichiers)**

#### **preparateurConstants.js**
```javascript
export const STATUS_CONFIGS = {
  brouillon: {
    label: 'Brouillon',
    color: 'gray',
    gradient: 'from-gray-500 to-gray-600',
    bgLight: 'bg-gray-50',
    textColor: 'text-gray-700',
    icon: 'DocumentIcon'
  },
  en_cours: {
    label: 'En Cours',
    color: 'purple',
    gradient: 'from-purple-500 to-purple-600',
    bgLight: 'bg-purple-50',
    textColor: 'text-purple-700',
    icon: 'ClockIcon'
  },
  // ... autres statuts
};

export const TYPE_CONFIGS = {
  roland: { label: 'Roland', color: 'blue', icon: 'PrinterIcon' },
  xerox: { label: 'Xerox', color: 'indigo', icon: 'PrinterIcon' },
  autre: { label: 'Autre', color: 'gray', icon: 'DocumentIcon' }
};

export const PRIORITY_CONFIGS = {
  urgent: { label: 'Urgent', color: 'red', days: '> 7 jours' },
  high: { label: 'Haute', color: 'orange', days: '> 5 jours' },
  medium: { label: 'Moyenne', color: 'yellow', days: '> 2 jours' },
  low: { label: 'Basse', color: 'green', days: '< 2 jours' }
};

export const DEFAULT_CONFIG = {
  refreshInterval: 30000,
  pageSize: 20,
  autoRefresh: true
};

export const MESSAGES = {
  create_success: 'Dossier créé avec succès !',
  validation_success: 'Dossier validé et envoyé à l\'impression',
  error_load: 'Erreur lors du chargement des dossiers',
  error_action: 'Erreur lors de l\'action'
};
```

#### **preparateurUtils.js**
```javascript
export const normalizeStatus = (statut) => {
  if (!statut) return 'brouillon';
  const val = String(statut).toLowerCase();
  if (val.includes('cours') || val.includes('preparation')) return 'en_cours';
  if (val.includes('revoir') || val.includes('revision')) return 'a_revoir';
  if (val.includes('pret') && val.includes('impression')) return 'pret_impression';
  if (val.includes('termine') || val.includes('finished')) return 'termine';
  if (val.includes('brouillon') || val.includes('draft')) return 'brouillon';
  return val.replace(/\s/g, '_');
};

export const calculatePriority = (dossier) => {
  const daysSince = daysSinceCreation(dossier.created_at);
  if (daysSince > 7) return 'urgent';
  if (daysSince > 5) return 'high';
  if (daysSince > 2) return 'medium';
  return 'low';
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const formatDuration = (days) => {
  if (days < 1) return "< 1 jour";
  if (days === 1) return "1 jour";
  return `${Math.round(days)} jours`;
};

export const daysSinceCreation = (createdAt) => {
  return (new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
};
```

---

### **7. Common Components (2 fichiers)**

#### **LoadingState.js**
```javascript
export default function LoadingState({ message = "Chargement..." }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-12 text-center"
    >
      <div className="animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-purple-700 dark:text-purple-300 font-medium">{message}</p>
    </motion.div>
  );
}
```

#### **EmptyState.js**
```javascript
export default function EmptyState({ section }) {
  const messages = {
    brouillon: { icon: '📄', title: 'Aucun brouillon', desc: 'Créez un nouveau dossier' },
    en_cours: { icon: '⏳', title: 'Aucun dossier en cours', desc: 'Commencez un brouillon' },
    a_revoir: { icon: '✅', title: 'Rien à revoir', desc: 'Tous les dossiers sont OK !' },
    pret_impression: { icon: '🖨️', title: 'Aucun dossier prêt', desc: 'Validez des préparations' },
    termine: { icon: '🎉', title: 'Aucun dossier terminé', desc: 'Historique vide' }
  };
  
  const msg = messages[section] || messages.en_cours;
  
  return (
    <motion.div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-sm border border-gray-100 dark:border-neutral-700 p-12 text-center">
      <div className="text-6xl mb-4">{msg.icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{msg.title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{msg.desc}</p>
    </motion.div>
  );
}
```

---

## 🎨 DESIGN SYSTEM V2

### **Palette Couleurs**

**Gradients principaux** :
- **Logo/Header** : `from-purple-500 to-indigo-600`
- **En Cours** : `from-purple-50 to-indigo-50` (section bg)
- **À Revoir** : `from-orange-50 to-amber-50`
- **Prêt Impression** : `from-blue-50 to-cyan-50`
- **Terminés** : `from-green-50 to-emerald-50`
- **Brouillon** : `from-gray-50 to-gray-100`

**Shadows** :
- Cards : `shadow-sm hover:shadow-md`
- Modales : `shadow-2xl`
- Logo : `shadow-lg shadow-purple-500/30`

**Rounded corners** :
- Modales : `rounded-2xl`
- Cards/Sections : `rounded-xl`
- Buttons : `rounded-xl`
- Badges : `rounded-lg`
- Progress bars : `rounded-full`

**Dark mode** :
- BG principal : `dark:bg-neutral-900`
- Cards : `dark:bg-neutral-800`
- Borders : `dark:border-neutral-700`
- Text : `dark:text-white`, `dark:text-gray-400`

---

## 📋 CHECKLIST MIGRATION

### **Phase 1 : Création Structure (1h)**
- [ ] Créer dossier `/frontend/src/components/preparateur/v2/`
- [ ] Créer sous-dossiers (dashboard, sections, modals, navigation, cards, hooks, utils, common)
- [ ] Créer tous fichiers index.js

### **Phase 2 : Dashboard Core (2h)**
- [ ] PreparateurDashboardV2.js (orchestrateur)
- [ ] PreparateurHeader.js (logo, actions, user)
- [ ] PreparateurKPICards.js (8 KPIs avec gradients)

### **Phase 3 : Sections (3h)**
- [ ] BrouillonSectionV2.js
- [ ] EnCoursSectionV2.js
- [ ] ARevoirSectionV2.js
- [ ] PretImpressionSectionV2.js
- [ ] TermineeSectionV2.js

### **Phase 4 : Modales (2h)**
- [ ] CreateDossierModalV2.js
- [ ] DossierDetailsModalV2.js
- [ ] ValiderPreparationModalV2.js
- [ ] EnvoyerImpressionModalV2.js

### **Phase 5 : Navigation (1h)**
- [ ] PreparateurNavigation.js (tabs avec layoutId)
- [ ] PreparateurFilters.js (filtres avancés)

### **Phase 6 : Cards & Badges (1h)**
- [ ] DossierCardV2.js (card principale)
- [ ] StatusBadge.js
- [ ] PriorityBadge.js
- [ ] TypeBadge.js

### **Phase 7 : Hooks (2h)**
- [ ] usePreparateurData.js (fetch + stats)
- [ ] usePreparateurActions.js (CRUD operations)

### **Phase 8 : Utils (1h)**
- [ ] preparateurConstants.js (configs)
- [ ] preparateurUtils.js (helpers)

### **Phase 9 : Common (30min)**
- [ ] LoadingState.js
- [ ] EmptyState.js

### **Phase 10 : Intégration (1h)**
- [ ] Créer PreparateurBoard.js wrapper
- [ ] Vérifier import dans App.js
- [ ] Tester compilation webpack

### **Phase 11 : Tests & Polish (2h)**
- [ ] npm run build
- [ ] PM2 restart
- [ ] Tests navigateur
- [ ] Corrections bugs
- [ ] Validation finale

---

## 🚀 COMMANDES

```bash
# Build frontend
npm --prefix frontend run build

# Restart PM2
pm2 restart plateforme-frontend

# Logs
pm2 logs plateforme-frontend --lines 50
```

---

## 🎯 DIFFÉRENCES AVEC LIVREUR V2

| Aspect | Livreur V2 | Préparateur V2 |
|--------|-----------|----------------|
| **Sections** | 3 (À Livrer, Programmées, Terminées) | 5 (Brouillon, En Cours, À Revoir, Prêt, Terminés) |
| **Modales** | 4 (Programmer, Valider, Détails, Echec) | 4 (Créer, Détails, Valider, Envoyer) |
| **KPIs** | 8 (livraison-centric) | 8 (préparation-centric) |
| **Couleur primaire** | Blue | Purple/Indigo |
| **Actions principales** | Programmer, Livrer, GPS | Créer, Valider, Envoyer |
| **Workflow** | Linéaire (À livrer → Livré) | Multi-étapes (Brouillon → Terminé) |
| **Fichiers** | 29 | 28 (-1 modale echec) |

---

## 📊 ESTIMATION TEMPS TOTAL

- **Création fichiers** : 1h
- **Développement composants** : 10h
- **Intégration** : 1h
- **Tests** : 2h
- **Total** : **~14h** (2 jours)

---

## ✅ RÉSULTAT ATTENDU

**Dashboard Préparateur V2** :
- ✅ 28 fichiers modulaires
- ✅ Architecture propre et maintenable
- ✅ Hooks personnalisés réutilisables
- ✅ Design system cohérent avec Livreur V2
- ✅ Dark mode 100%
- ✅ Animations Framer Motion
- ✅ Responsive complet
- ✅ 0 erreurs compilation
- ✅ Bundle optimisé
- ✅ Tests passants

**Prêt pour** :
- Migration Imprimeur V2 (même pattern)
- Tests utilisateurs
- Production

---

**Auteur** : EasyCode AI  
**Date** : 17 octobre 2025  
**Version** : v1.0
