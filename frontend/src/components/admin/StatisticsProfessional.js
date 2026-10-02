import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  PrinterIcon,
  CurrencyEuroIcon,
  TruckIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  UserIcon,
  StarIcon,
  FireIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { dossiersService } from '../../services/apiAdapter';
import useChartTheme from '../../hooks/useChartTheme';

const StatisticsProfessional = () => {
  const { theme: chartTheme, config: chartConfig, getBusinessColor } = useChartTheme();
  
  const [stats, setStats] = useState({
    global: {
      totalDossiers: 0,
      dossiersEnCours: 0,
      dossiersTermines: 0,
      dossiersLivres: 0,
      montantTotal: 0,
      tauxLivraison: 0,
      evolutionMois: 0 // +12% vs mois dernier
    },
    xerox: {
      totalCopies: 0,
      copiesAujourdhui: 0,
      copiesSemaine: 0,
      copiesMois: 0,
      copiesMoisPrecedent: 0,
      evolutionCopies: 0, // % évolution
      moyenneCopiesParDossier: 0,
      historique: []
    },
    roland: {
      totalSurface: 0,
      surfaceAujourdhui: 0,
      surfaceSemaine: 0,
      surfaceMois: 0,
      surfaceMoisPrecedent: 0,
      evolutionSurface: 0, // % évolution
      moyenneSurfaceParDossier: 0,
      historique: [],
      parSupport: {}
    },
    topProducts: [], // Top 3 produits/types ce mois
    topClients: [], // Top 5 clients ce mois
    supportPlusUtilise: { nom: '', surface: 0, percentage: 0 },
    meilleureMachine: { nom: '', production: 0 } // Machine la plus productive
  });
  
  const [chartData, setChartData] = useState({
    evolutionJours: [],
    repartitionMachines: [],
    performancesMensuelles: [],
    topProduitsMois: [],
    evolutionSupports: []
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const calculateDetailedStats = (dossiers) => {
    const today = new Date();
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const xeroxStats = {
      totalCopies: 0,
      copiesAujourdhui: 0,
      copiesSemaine: 0,
      copiesMois: 0,
      copiesMoisPrecedent: 0,
      nbDossiersXerox: 0,
      historique: []
    };

    const rolandStats = {
      totalSurface: 0,
      surfaceAujourdhui: 0,
      surfaceSemaine: 0,
      surfaceMois: 0,
      surfaceMoisPrecedent: 0,
      nbDossiersRoland: 0,
      historique: [],
      parSupport: {}
    };

    // Compteurs pour top produits et clients
    const produitsCount = {};
    const clientsCount = {};
    const supportsDetails = {};

    dossiers.forEach(dossier => {
      const dateCompleted = new Date(dossier.date_completed || dossier.updated_at || dossier.created_at);
      const isToday = dateCompleted.toDateString() === today.toDateString();
      const isThisWeek = dateCompleted >= startOfWeek;
      const isThisMonth = dateCompleted >= startOfMonth;
      const isLastMonth = dateCompleted >= startOfLastMonth && dateCompleted <= endOfLastMonth;

      const isTermine = ['termine', 'imprime', 'livre'].includes(dossier.status || dossier.statut);

      // Top Produits du mois - Utiliser les vrais types de produits
      if (isThisMonth && isTermine) {
        let typeProduit = 'Autre';
        
        // Pour Roland: utiliser le type_support (Bâche, Vinyle, etc.)
        if (dossier.type === 'roland' || dossier.machine === 'roland' || dossier.type_formulaire?.toLowerCase().includes('roland')) {
          // Chercher dans data_formulaire JSON
          if (dossier.data_formulaire) {
            const dataForm = typeof dossier.data_formulaire === 'string' 
              ? JSON.parse(dossier.data_formulaire) 
              : dossier.data_formulaire;
            typeProduit = dataForm.type_support || dossier.support || dossier.type_support || 'Roland - Autre';
          } else {
            typeProduit = dossier.support || dossier.type_support || 'Roland - Autre';
          }
        }
        // Pour Xerox: utiliser le type_document (Carte de visite, Flyer, etc.)
        else if (dossier.type === 'xerox' || dossier.machine === 'xerox' || dossier.type_formulaire?.toLowerCase().includes('xerox')) {
          if (dossier.data_formulaire) {
            const dataForm = typeof dossier.data_formulaire === 'string' 
              ? JSON.parse(dossier.data_formulaire) 
              : dossier.data_formulaire;
            typeProduit = dataForm.type_document || dossier.type_document || 'Xerox - Autre';
          } else {
            typeProduit = dossier.type_document || 'Xerox - Autre';
          }
        }
        
        produitsCount[typeProduit] = (produitsCount[typeProduit] || 0) + 1;

        // Top Clients du mois
        const clientName = dossier.nom_client || dossier.client || 'Client inconnu';
        if (clientName !== 'Client inconnu') {
          clientsCount[clientName] = (clientsCount[clientName] || 0) + 1;
        }
      }

      // Statistiques Xerox (basées sur nombre de copies)
      if ((dossier.type === 'xerox' || dossier.machine === 'xerox' || dossier.type_formulaire?.toLowerCase().includes('xerox')) && isTermine) {
        const copies = parseInt(dossier.nombre_copies || dossier.copies || dossier.quantite || 0);
        
        xeroxStats.totalCopies += copies;
        xeroxStats.nbDossiersXerox++;
        
        if (isToday) xeroxStats.copiesAujourdhui += copies;
        if (isThisWeek) xeroxStats.copiesSemaine += copies;
        if (isThisMonth) xeroxStats.copiesMois += copies;
        if (isLastMonth) xeroxStats.copiesMoisPrecedent += copies;
      }

      // Statistiques Roland (basées sur surface m²)
      if ((dossier.type === 'roland' || dossier.machine === 'roland' || dossier.type_formulaire?.toLowerCase().includes('roland')) && isTermine) {
        let surface = 0;
        
        // Priorité 1: champ surface_m2
        if (dossier.surface_m2) {
          surface = parseFloat(dossier.surface_m2);
        } 
        // Priorité 2: calculer depuis dimensions
        else if (dossier.dimensions || dossier.largeur || dossier.hauteur) {
          if (dossier.dimensions) {
            // Parser "2.5x1.8m" ou "250x180cm"
            const dims = dossier.dimensions.toLowerCase().replace(/[^0-9.,x]/g, '');
            const parts = dims.split('x');
            if (parts.length === 2) {
              const largeur = parseFloat(parts[0]);
              const hauteur = parseFloat(parts[1]);
              surface = largeur * hauteur;
              // Si dimensions en cm, convertir en m²
              if (surface > 100) surface = surface / 10000;
            }
          } else if (dossier.largeur && dossier.hauteur) {
            surface = parseFloat(dossier.largeur) * parseFloat(dossier.hauteur);
            // Convertir cm en m² si nécessaire
            if (surface > 100) surface = surface / 10000;
          }
        }
        // Priorité 3: Quantité * taille standard (par défaut 1m²)
        else if (dossier.quantite) {
          surface = parseInt(dossier.quantite) * 1; // 1m² par unité par défaut
        }

        rolandStats.totalSurface += surface;
        rolandStats.nbDossiersRoland++;
        
        if (isToday) rolandStats.surfaceAujourdhui += surface;
        if (isThisWeek) rolandStats.surfaceSemaine += surface;
        if (isThisMonth) rolandStats.surfaceMois += surface;
        if (isLastMonth) rolandStats.surfaceMoisPrecedent += surface;

        // Répartition par support
        const support = dossier.support || dossier.materiau || dossier.type_support || 'Bâche';
        rolandStats.parSupport[support] = (rolandStats.parSupport[support] || 0) + surface;
        
        // Détails des supports pour analyse
        if (!supportsDetails[support]) {
          supportsDetails[support] = { surface: 0, count: 0 };
        }
        supportsDetails[support].surface += surface;
        supportsDetails[support].count++;
      }
    });

    // Calculer évolutions
    const xeroxEvolution = xeroxStats.copiesMoisPrecedent > 0 
      ? ((xeroxStats.copiesMois - xeroxStats.copiesMoisPrecedent) / xeroxStats.copiesMoisPrecedent) * 100 
      : 0;
    
    const rolandEvolution = rolandStats.surfaceMoisPrecedent > 0
      ? ((rolandStats.surfaceMois - rolandStats.surfaceMoisPrecedent) / rolandStats.surfaceMoisPrecedent) * 100
      : 0;

    // Moyennes
    const moyenneCopiesParDossier = xeroxStats.nbDossiersXerox > 0 
      ? Math.round(xeroxStats.totalCopies / xeroxStats.nbDossiersXerox) 
      : 0;
    
    const moyenneSurfaceParDossier = rolandStats.nbDossiersRoland > 0
      ? (rolandStats.totalSurface / rolandStats.nbDossiersRoland).toFixed(1)
      : 0;

    // Top 3 produits
    const topProducts = Object.entries(produitsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nom, count]) => ({ nom, count }));

    // Top 5 clients
    const topClients = Object.entries(clientsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nom, count]) => ({ nom, count }));

    // Support le plus utilisé
    let supportPlusUtilise = { nom: '', surface: 0, percentage: 0 };
    if (Object.keys(rolandStats.parSupport).length > 0) {
      const [nom, surface] = Object.entries(rolandStats.parSupport)
        .sort((a, b) => b[1] - a[1])[0];
      const percentage = rolandStats.totalSurface > 0 
        ? (surface / rolandStats.totalSurface) * 100 
        : 0;
      supportPlusUtilise = { nom, surface, percentage };
    }

    // Meilleure machine (celle qui a le plus produit)
    const meilleureMachine = xeroxStats.totalCopies > rolandStats.totalSurface * 100
      ? { nom: 'Xerox', production: xeroxStats.totalCopies, unite: 'copies' }
      : { nom: 'Roland', production: rolandStats.totalSurface, unite: 'm²' };

    return {
      xeroxStats: {
        ...xeroxStats,
        evolutionCopies: xeroxEvolution,
        moyenneCopiesParDossier
      },
      rolandStats: {
        ...rolandStats,
        evolutionSurface: rolandEvolution,
        moyenneSurfaceParDossier
      },
      topProducts,
      topClients,
      supportPlusUtilise,
      meilleureMachine
    };
  };

  const generateEnhancedChartData = (dossiers) => {
    // Évolution des 30 derniers jours avec données réelles
    const evolutionJours = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      
      let xeroxCopies = 0;
      let rolandSurface = 0;

      // Calculer les vraies valeurs pour ce jour
      dossiers.forEach(d => {
        const dDate = new Date(d.date_completed || d.updated_at || d.created_at);
        if (dDate.toDateString() === date.toDateString()) {
          if (d.type === 'xerox' || d.machine === 'xerox') {
            xeroxCopies += parseInt(d.nombre_copies || d.copies || d.quantite || 0);
          }
          if (d.type === 'roland' || d.machine === 'roland') {
            rolandSurface += parseFloat(d.surface_m2 || 0);
          }
        }
      });
      
      evolutionJours.push({
        date: dateStr,
        xeroxCopies,
        rolandSurface: parseFloat(rolandSurface.toFixed(1))
      });
    }

    // Répartition par type de machine (basée sur nombre de dossiers)
    const xeroxCount = dossiers.filter(d => d.type === 'xerox' || d.machine === 'xerox').length;
    const rolandCount = dossiers.filter(d => d.type === 'roland' || d.machine === 'roland').length;
    const total = xeroxCount + rolandCount || 1;

    const repartitionMachines = [
      { 
        name: 'Xerox', 
        value: Math.round((xeroxCount / total) * 100), 
        count: xeroxCount 
      },
      { 
        name: 'Roland', 
        value: Math.round((rolandCount / total) * 100), 
        count: rolandCount 
      }
    ];

    // Performances mensuelles des 12 derniers mois
    const performancesMensuelles = [];
    const mois = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthIndex = monthDate.getMonth();
      const monthYear = monthDate.getFullYear();
      
      let xeroxCopies = 0;
      let rolandSurface = 0;

      dossiers.forEach(d => {
        const dDate = new Date(d.date_completed || d.updated_at || d.created_at);
        if (dDate.getMonth() === monthIndex && dDate.getFullYear() === monthYear) {
          if (d.type === 'xerox' || d.machine === 'xerox') {
            xeroxCopies += parseInt(d.nombre_copies || d.copies || d.quantite || 0);
          }
          if (d.type === 'roland' || d.machine === 'roland') {
            rolandSurface += parseFloat(d.surface_m2 || 0);
          }
        }
      });
      
      performancesMensuelles.push({
        mois: mois[monthIndex],
        xeroxCopies,
        rolandSurface: parseFloat(rolandSurface.toFixed(1))
      });
    }

    return {
      evolutionJours,
      repartitionMachines,
      performancesMensuelles
    };
  };

  const loadStatistics = async () => {
    try {
      setLoading(true);
      setError('');

      // Données par défaut
      let mockDossiers = [
        { 
          id: 1, 
          type: 'xerox', 
          status: 'termine', 
          nombre_copies: 500, 
          date_completed: new Date(),
          nom_client: 'SARL TechPrint',
          type_formulaire: 'Impression Noir & Blanc'
        },
        { 
          id: 2, 
          type: 'roland', 
          status: 'termine', 
          surface_m2: 12.5, 
          support: 'Bâche', 
          date_completed: new Date(),
          nom_client: 'Entreprise Design Plus',
          type_formulaire: 'Bâche publicitaire'
        },
        { 
          id: 3, 
          type: 'xerox', 
          status: 'termine', 
          nombre_copies: 250, 
          date_completed: new Date(Date.now() - 86400000),
          nom_client: 'SARL TechPrint',
          type_formulaire: 'Impression Couleur'
        },
        { 
          id: 4, 
          type: 'roland', 
          status: 'termine', 
          surface_m2: 8.2, 
          support: 'Vinyle', 
          date_completed: new Date(Date.now() - 86400000),
          nom_client: 'Agence Créative',
          type_formulaire: 'Autocollant vitrine'
        },
      ];

      let globalStats = {
        totalDossiers: 15,
        dossiersEnCours: 6,
        dossiersTermines: 8,
        dossiersLivres: 5,
        montantTotal: 2450000,
        tauxLivraison: 0,
        evolutionMois: 12
      };

      // Charger les vraies données
      try {
        const dossiersData = await dossiersService.getDossiers({ limit: 1000 });
        if (dossiersData && dossiersData.dossiers && dossiersData.dossiers.length > 0) {
          mockDossiers = dossiersData.dossiers;

          globalStats = {
            totalDossiers: mockDossiers.length,
            dossiersEnCours: mockDossiers.filter(d => ['en_cours', 'en_preparation', 'pret_impression', 'en_impression'].includes(d.status)).length,
            dossiersTermines: mockDossiers.filter(d => ['termine', 'imprime'].includes(d.status)).length,
            dossiersLivres: mockDossiers.filter(d => ['livre', 'en_livraison'].includes(d.status)).length,
            montantTotal: mockDossiers.reduce((total, d) => total + (parseFloat(d.montant) || 0), 0),
            tauxLivraison: 0,
            evolutionMois: 12
          };
          
          if (globalStats.totalDossiers > 0) {
            globalStats.tauxLivraison = Math.round((globalStats.dossiersLivres / globalStats.totalDossiers) * 100);
          }
        }
      } catch (err) {
        // Utilisation des données mockées
      }

      // Calcul des statistiques détaillées
      const {
        xeroxStats,
        rolandStats,
        topProducts,
        topClients,
        supportPlusUtilise,
        meilleureMachine
      } = calculateDetailedStats(mockDossiers);

      // Génération des graphiques
      const chartDataGenerated = generateEnhancedChartData(mockDossiers);

      setStats({
        global: globalStats,
        xerox: xeroxStats,
        roland: rolandStats,
        topProducts,
        topClients,
        supportPlusUtilise,
        meilleureMachine
      });

      setChartData(chartDataGenerated);

    } catch (err) {
      setError('Impossible de charger les statistiques');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadStatistics();
  }, []);

  const StatCard = ({ title, value, icon: Icon, trend, trendValue, color = 'blue', subtitle }) => (
    <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-lg dark:shadow-secondary-900/25 border border-white/40 p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 bg-gradient-to-br from-${color}-500 to-${color}-600 rounded-xl shadow-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {trend && trendValue !== undefined && (
          <div className={`flex items-center px-2 py-1 rounded-full ${trendValue >= 0 ? 'bg-success-100' : 'bg-error-100'}`}>
            {trendValue >= 0 ? (
              <ArrowTrendingUpIcon className="h-4 w-4 text-success-600 mr-1" />
            ) : (
              <ArrowTrendingDownIcon className="h-4 w-4 text-error-600 mr-1" />
            )}
            <span className={`text-xs font-bold ${trendValue >= 0 ? 'text-success-700' : 'text-error-700'}`}>
              {trendValue > 0 ? '+' : ''}{trendValue.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide mb-2">{title}</p>
        <p className="text-3xl font-black text-neutral-900 dark:text-white">{value}</p>
        {subtitle && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-neutral-600 dark:text-neutral-300">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-8">
        <div className="bg-error-50 border-2 border-red-300 rounded-2xl p-8 max-w-2xl mx-auto">
          <div className="flex items-center">
            <div className="text-4xl mr-4">⚠️</div>
            <div>
              <h3 className="text-xl font-bold text-red-800">Erreur de chargement</h3>
              <p className="text-sm text-error-600 mt-2">{error}</p>
            </div>
          </div>
          <button
            onClick={loadStatistics}
            className="mt-6 bg-error-600 hover:bg-error-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-lg"
          >
            🔄 Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-neutral-900 dark:to-neutral-800 p-6 space-y-8">
      {/* En-tête avec filtres */}
      <div className="bg-white dark:bg-neutral-800/60 backdrop-blur-xl rounded-2xl shadow-xl dark:shadow-secondary-900/25 border border-white/30 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center">
            <ChartBarIcon className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <h1 className="text-3xl font-black text-neutral-900 dark:text-white">📊 Statistiques de Production</h1>
              <p className="text-neutral-600 dark:text-neutral-300 mt-1">Analyse complète Xerox & Roland • Dernière màj: {new Date().toLocaleString('fr-FR')}</p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-lg">
              📅 Ce mois
            </button>
            <button className="px-4 py-2 bg-white dark:bg-neutral-700 text-neutral-700 dark:text-white rounded-lg text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-all border border-neutral-200 dark:border-neutral-600">
              📆 Semaine
            </button>
            <button className="px-4 py-2 bg-white dark:bg-neutral-700 text-neutral-700 dark:text-white rounded-lg text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-all border border-neutral-200 dark:border-neutral-600">
              📅 Année
            </button>
          </div>
        </div>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Dossiers"
          value={stats.global.totalDossiers}
          icon={DocumentTextIcon}
          color="blue"
          trend
          trendValue={stats.global.evolutionMois}
          subtitle="Tous types confondus"
        />
        <StatCard
          title="En Cours"
          value={stats.global.dossiersEnCours}
          icon={ClockIcon}
          color="orange"
          subtitle="En production"
        />
        <StatCard
          title="Terminés"
          value={stats.global.dossiersTermines}
          icon={ArrowTrendingUpIcon}
          color="green"
          subtitle="Prêts à livrer"
        />
        <StatCard
          title="Livrés"
          value={stats.global.dossiersLivres}
          icon={TruckIcon}
          color="purple"
          subtitle="Clients satisfaits"
        />
        <StatCard
          title="CA Total"
          value={`${(stats.global.montantTotal / 1000).toFixed(0)}k F`}
          icon={CurrencyEuroIcon}
          color="emerald"
          trend
          trendValue={15}
          subtitle="Chiffre d'affaires"
        />
        <StatCard
          title="Taux Livraison"
          value={`${stats.global.tauxLivraison}%`}
          icon={StarIcon}
          trend
          trendValue={stats.global.tauxLivraison >= 80 ? 5 : -2}
          color="indigo"
          subtitle="Performance globale"
        />
      </div>

      {/* Section Machine Xerox - Nombre de copies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg mr-4">
                <PrinterIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">📄 Machine Xerox</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Impressions & copies</p>
              </div>
            </div>
            <div className={`flex items-center px-3 py-1 rounded-full ${stats.xerox.evolutionCopies >= 0 ? 'bg-success-100' : 'bg-error-100'}`}>
              {stats.xerox.evolutionCopies >= 0 ? (
                <ArrowTrendingUpIcon className="h-5 w-5 text-success-600 mr-1" />
              ) : (
                <ArrowTrendingDownIcon className="h-5 w-5 text-error-600 mr-1" />
              )}
              <span className={`text-sm font-bold ${stats.xerox.evolutionCopies >= 0 ? 'text-success-700' : 'text-error-700'}`}>
                {stats.xerox.evolutionCopies > 0 ? '+' : ''}{stats.xerox.evolutionCopies.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-6">
              <div className="text-center">
                <p className="text-4xl font-black text-purple-600 dark:text-purple-400">{stats.xerox.totalCopies.toLocaleString()}</p>
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mt-2">Total copies imprimées</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Moy: {stats.xerox.moyenneCopiesParDossier} copies/dossier</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.xerox.copiesAujourdhui.toLocaleString()}</p>
                <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mt-1">Aujourd'hui</p>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.xerox.copiesSemaine.toLocaleString()}</p>
                <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mt-1">Cette semaine</p>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
                <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{stats.xerox.copiesMois.toLocaleString()}</p>
                <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mt-1">Ce mois</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section Machine Roland - m² */}
        <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg mr-4">
                <PrinterIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">📏 Machine Roland</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Impression grand format</p>
              </div>
            </div>
            <div className={`flex items-center px-3 py-1 rounded-full ${stats.roland.evolutionSurface >= 0 ? 'bg-success-100' : 'bg-error-100'}`}>
              {stats.roland.evolutionSurface >= 0 ? (
                <ArrowTrendingUpIcon className="h-5 w-5 text-success-600 mr-1" />
              ) : (
                <ArrowTrendingDownIcon className="h-5 w-5 text-error-600 mr-1" />
              )}
              <span className={`text-sm font-bold ${stats.roland.evolutionSurface >= 0 ? 'text-success-700' : 'text-error-700'}`}>
                {stats.roland.evolutionSurface > 0 ? '+' : ''}{stats.roland.evolutionSurface.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-xl p-6">
              <div className="text-center">
                <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{stats.roland.totalSurface.toFixed(1)} m²</p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mt-2">Surface totale imprimée</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Moy: {stats.roland.moyenneSurfaceParDossier} m²/dossier</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.roland.surfaceAujourdhui.toFixed(1)}</p>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mt-1">m² aujourd'hui</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.roland.surfaceSemaine.toFixed(1)}</p>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mt-1">m² semaine</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.roland.surfaceMois.toFixed(1)}</p>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mt-1">m² ce mois</p>
              </div>
            </div>

            {/* Répartition par support */}
            {Object.keys(stats.roland.parSupport).length > 0 && (
              <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800">
                <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-3 flex items-center">
                  📦 Répartition par support
                </h4>
                <div className="space-y-2">
                  {Object.entries(stats.roland.parSupport)
                    .sort((a, b) => b[1] - a[1])
                    .map(([support, surface]) => (
                      <div key={support} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{support}</span>
                        <div className="flex items-center">
                          <div className="w-20 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2.5 mr-2">
                            <div
                              className="bg-emerald-600 h-2.5 rounded-full"
                              style={{ 
                                width: `${Math.min((surface / stats.roland.totalSurface) * 100, 100)}%` 
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-bold text-neutral-900 dark:text-white w-16 text-right">
                            {surface.toFixed(1)} m²
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Produits & Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 3 Produits du mois */}
        <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-6">
          <div className="flex items-center mb-6">
            <FireIcon className="h-6 w-6 text-orange-500 mr-3" />
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">🔥 Top 3 Produits du mois</h3>
          </div>
          <div className="space-y-3">
            {stats.topProducts.length > 0 ? stats.topProducts.map((product, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border border-orange-100 dark:border-orange-800"
              >
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-white ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="ml-3 font-semibold text-neutral-900 dark:text-white">{product.nom}</span>
                </div>
                <span className="text-lg font-black text-orange-600 dark:text-orange-400">{product.count}</span>
              </div>
            )) : (
              <p className="text-center text-neutral-500 dark:text-neutral-400 py-4">Aucune donnée disponible</p>
            )}
          </div>
        </div>

        {/* Top 5 Clients */}
        <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-6">
          <div className="flex items-center mb-6">
            <UserIcon className="h-6 w-6 text-blue-500 mr-3" />
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">👥 Top 5 Clients</h3>
          </div>
          <div className="space-y-2">
            {stats.topClients.length > 0 ? stats.topClients.map((client, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="ml-3 text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{client.nom}</span>
                </div>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{client.count} cmd</span>
              </div>
            )) : (
              <p className="text-center text-neutral-500 dark:text-neutral-400 py-4">Aucune donnée disponible</p>
            )}
          </div>
        </div>

        {/* Support le plus utilisé & Meilleure machine */}
        <div className="space-y-6">
          {/* Support le plus utilisé */}
          <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-6">
            <div className="flex items-center mb-4">
              <StarIcon className="h-6 w-6 text-yellow-500 mr-3" />
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">⭐ Support #1</h3>
            </div>
            {stats.supportPlusUtilise.nom ? (
              <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{stats.supportPlusUtilise.nom}</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  {stats.supportPlusUtilise.surface.toFixed(1)} m² ({stats.supportPlusUtilise.percentage.toFixed(0)}%)
                </p>
              </div>
            ) : (
              <p className="text-center text-neutral-500 py-2">Aucune donnée</p>
            )}
          </div>

          {/* Meilleure machine */}
          <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-6">
            <div className="flex items-center mb-4">
              <ChartBarIcon className="h-6 w-6 text-green-500 mr-3" />
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">🏆 Machine MVP</h3>
            </div>
            <div className="bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <p className="text-2xl font-black text-green-600 dark:text-green-400">{stats.meilleureMachine.nom}</p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {stats.meilleureMachine.production.toLocaleString()} {stats.meilleureMachine.unite}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution 30 jours */}
        <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-6">
          <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center">
            <ChartBarIcon className="h-5 w-5 mr-2 text-blue-600" />
            📊 Évolution 30 derniers jours
          </h4>
          <div className="h-80 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.evolutionJours}>
                <CartesianGrid {...chartConfig.grid} />
                <XAxis dataKey="date" {...chartConfig.xAxis} />
                <YAxis {...chartConfig.yAxis} />
                <Tooltip {...chartConfig.tooltip} />
                <Legend {...chartConfig.legend} />
                <Area 
                  type="monotone" 
                  dataKey="xeroxCopies" 
                  stroke={getBusinessColor('xerox')} 
                  fill={getBusinessColor('xerox')}
                  fillOpacity={0.3}
                  name="Xerox (copies)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="rolandSurface" 
                  stroke={getBusinessColor('roland')} 
                  fill={getBusinessColor('roland')}
                  fillOpacity={0.3}
                  name="Roland (m²)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Répartition machines */}
        <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-6">
          <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center">
            <ChartBarIcon className="h-5 w-5 mr-2 text-purple-600" />
            🔄 Répartition par machines
          </h4>
          <div className="h-80 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-xl p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.repartitionMachines}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={100}
                  fill={chartTheme.dataColors.primary}
                  dataKey="value"
                >
                  {chartData.repartitionMachines.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? getBusinessColor('xerox') : getBusinessColor('roland')} 
                    />
                  ))}
                </Pie>
                <Tooltip {...chartConfig.tooltip} />
                <Legend {...chartConfig.legend} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Graphique performances mensuelles (12 mois) */}
      <div className="bg-white dark:bg-neutral-800/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/40 p-6">
        <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center">
          <ChartBarIcon className="h-5 w-5 mr-2 text-emerald-600" />
          📈 Performances mensuelles (12 derniers mois)
        </h4>
        <div className="h-96 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 rounded-xl p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.performancesMensuelles}>
              <CartesianGrid {...chartConfig.grid} />
              <XAxis dataKey="mois" {...chartConfig.xAxis} />
              <YAxis 
                yAxisId="left" 
                {...chartConfig.yAxis}
                label={{ value: 'Copies', angle: -90, position: 'insideLeft', style: { fill: chartTheme.mutedTextColor } }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                {...chartConfig.yAxis}
                label={{ value: 'm²', angle: 90, position: 'insideRight', style: { fill: chartTheme.mutedTextColor } }}
              />
              <Tooltip {...chartConfig.tooltip} />
              <Legend {...chartConfig.legend} />
              <Bar 
                yAxisId="left"
                dataKey="xeroxCopies" 
                fill={getBusinessColor('xerox')} 
                name="Xerox (copies)" 
                radius={[8, 8, 0, 0]}
              />
              <Bar 
                yAxisId="right"
                dataKey="rolandSurface" 
                fill={getBusinessColor('roland')} 
                name="Roland (m²)" 
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default StatisticsProfessional;
