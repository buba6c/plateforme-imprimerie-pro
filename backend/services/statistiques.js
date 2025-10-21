const db = require('../config/database');

class StatistiquesService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Obtenir les statistiques générales de la plateforme
   */
  async getStatistiquesGenerales(periode = 'month') {
    const cacheKey = `stats_generales_${periode}`;

    // Vérifier le cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    const dateCondition = this.getDateCondition(periode);

    const query = `
      SELECT 
        COUNT(*) as total_dossiers,
        COUNT(CASE WHEN statut = 'en_cours' THEN 1 END) as en_cours,
        COUNT(CASE WHEN statut = 'en_impression' THEN 1 END) as en_impression,
        COUNT(CASE WHEN statut = 'termine' THEN 1 END) as termine,
        COUNT(CASE WHEN statut = 'a_revoir' THEN 1 END) as a_revoir,
        COUNT(CASE WHEN statut = 'en_livraison' THEN 1 END) as en_livraison,
        COUNT(CASE WHEN statut = 'livre' THEN 1 END) as livre,
        0 as urgent,
        AVG(CASE 
          WHEN statut = 'livre' AND date_livraison IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (date_livraison - created_at))/3600 
        END) as temps_moyen_traitement_heures,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as nouveaux_aujourd_hui,
        COALESCE(SUM(CASE WHEN statut = 'livre' THEN COALESCE(prix_total, 0) END), 0) as chiffre_affaires,
        AVG(CASE 
          WHEN statut = 'livre' AND date_livraison IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (date_livraison - date_demande_livraison))/86400 
        END) as delai_moyen_livraison
      FROM dossiers 
      WHERE ${dateCondition}
    `;

    try {
      const result = await db.query(query);
      const stats = result.rows[0];

      // Convertir les chaînes en nombres
      Object.keys(stats).forEach(key => {
        if (stats[key] !== null && !isNaN(stats[key])) {
          stats[key] = key.includes('temps_moyen') ? parseFloat(stats[key]) : parseInt(stats[key]);
        }
      });

      // Obtenir les statistiques utilisateurs et système en parallèle
      const [utilisateursActifs, evolutionCA, chargeSysteme] = await Promise.all([
        this.getUtilisateursActifs(),
        this.getEvolutionCA(periode),
        this.getChargeSysteme(),
      ]);

      // Calculs additionnels
      const totalActifs = stats.total_dossiers - stats.livre;
      const tauxReussite =
        stats.total_dossiers > 0 ? Math.round((stats.livre / stats.total_dossiers) * 100) : 0;
      const tauxProblemes =
        stats.total_dossiers > 0 ? Math.round((stats.a_revoir / stats.total_dossiers) * 100) : 0;

      const statsComplete = {
        ...stats,
        total_actifs: totalActifs,
        taux_reussite: tauxReussite,
        taux_problemes: tauxProblemes,
        temps_moyen_traitement_heures: Math.round(stats.temps_moyen_traitement_heures || 0),
        chiffre_affaires: Math.round(stats.chiffre_affaires || 0),
        delai_moyen_livraison: Math.round(stats.delai_moyen_livraison || 0),
        utilisateurs_actifs: utilisateursActifs,
        evolution_ca: evolutionCA,
        charge_systeme: chargeSysteme,
      };

      // Mettre en cache
      this.cache.set(cacheKey, {
        data: statsComplete,
        timestamp: Date.now(),
      });

      return statsComplete;
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques générales:', error);
      throw error;
    }
  }

  /**
   * Obtenir les performances par utilisateur
   */
  async getPerformancesUtilisateurs(periode = 'month') {
    const cacheKey = `perf_users_${periode}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    const dateCondition = this.getDateCondition(periode);

    const query = `
      SELECT 
        u.nom,
        u.prenom,
        u.role,
        COUNT(DISTINCT dh.dossier_id) as dossiers_traites,
        AVG(
          CASE 
            WHEN dh.nouveau_statut = 'livre' 
            THEN EXTRACT(EPOCH FROM (dh.created_at - d.created_at))/3600 
          END
        ) as temps_moyen_traitement,
        COUNT(CASE WHEN dh.nouveau_statut = 'a_revoir' THEN 1 END) as dossiers_a_revoir,
        COUNT(CASE WHEN dh.nouveau_statut = 'livre' THEN 1 END) as dossiers_termines
      FROM utilisateurs u
      LEFT JOIN dossier_history dh ON u.id = dh.utilisateur_id
      LEFT JOIN dossiers d ON dh.dossier_id = d.id
      WHERE u.actif = true 
        AND dh.created_at IS NOT NULL 
        AND ${dateCondition.replace('created_at', 'dh.created_at')}
      GROUP BY u.id, u.nom, u.prenom, u.role
      HAVING COUNT(DISTINCT dh.dossier_id) > 0
      ORDER BY dossiers_traites DESC
    `;

    try {
      const result = await db.query(query);

      const performances = result.rows.map(row => ({
        ...row,
        dossiers_traites: parseInt(row.dossiers_traites),
        dossiers_a_revoir: parseInt(row.dossiers_a_revoir),
        dossiers_termines: parseInt(row.dossiers_termines),
        temps_moyen_traitement: Math.round(parseFloat(row.temps_moyen_traitement) || 0),
        taux_reussite:
          row.dossiers_traites > 0
            ? Math.round((row.dossiers_termines / row.dossiers_traites) * 100)
            : 0,
      }));

      this.cache.set(cacheKey, {
        data: performances,
        timestamp: Date.now(),
      });

      return performances;
    } catch (error) {
      console.error('Erreur lors du calcul des performances utilisateurs:', error);
      throw error;
    }
  }

  /**
   * Obtenir l'évolution des dossiers dans le temps
   */
  async getEvolutionDossiers(periode = 'month') {
    const cacheKey = `evolution_${periode}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    const { groupBy, dateFormat } = this.getGroupByPeriode(periode);
    const dateCondition = this.getDateCondition(periode);

    const query = `
      SELECT 
        ${dateFormat} as periode,
        COUNT(*) as total_crees,
        COUNT(CASE WHEN statut = 'livre' THEN 1 END) as total_livres,
        0 as total_urgents
      FROM dossiers
      WHERE ${dateCondition}
      GROUP BY ${groupBy}
      ORDER BY periode ASC
    `;

    try {
      const result = await db.query(query);

      const evolution = result.rows.map(row => ({
        periode: row.periode,
        total_crees: parseInt(row.total_crees),
        total_livres: parseInt(row.total_livres),
        total_urgents: parseInt(row.total_urgents),
        taux_completion:
          row.total_crees > 0 ? Math.round((row.total_livres / row.total_crees) * 100) : 0,
      }));

      this.cache.set(cacheKey, {
        data: evolution,
        timestamp: Date.now(),
      });

      return evolution;
    } catch (error) {
      console.error("Erreur lors du calcul de l'évolution:", error);
      throw error;
    }
  }

  /**
   * Obtenir la répartition par type de machine/imprimante
   */
  async getRepartitionMachines(periode = 'month') {
    const dateCondition = this.getDateCondition(periode);

    const query = `
      SELECT 
        type_formulaire as type_impression,
        COUNT(*) as nombre_dossiers,
        COUNT(CASE WHEN statut = 'livre' THEN 1 END) as dossiers_livres,
        AVG(CASE 
          WHEN statut = 'livre' AND date_livraison IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (date_livraison - created_at))/3600 
        END) as temps_moyen_heures
      FROM dossiers 
      WHERE ${dateCondition}
        AND type_formulaire IS NOT NULL
      GROUP BY type_formulaire
      ORDER BY nombre_dossiers DESC
    `;

    try {
      const result = await db.query(query);

      return result.rows.map(row => ({
        type_impression: row.type_impression,
        nombre_dossiers: parseInt(row.nombre_dossiers),
        dossiers_livres: parseInt(row.dossiers_livres),
        temps_moyen_heures: Math.round(parseFloat(row.temps_moyen_heures) || 0),
        taux_completion:
          row.nombre_dossiers > 0
            ? Math.round((row.dossiers_livres / row.nombre_dossiers) * 100)
            : 0,
      }));
    } catch (error) {
      console.error('Erreur lors du calcul de la répartition machines:', error);
      throw error;
    }
  }

  /**
   * Obtenir les alertes et indicateurs critiques
   */
  async getAlertes() {
    const queries = {
      dossiers_urgents_en_retard: `
        SELECT COUNT(*) as count
        FROM dossiers 
        WHERE statut = 'a_revoir'
          AND created_at < NOW() - INTERVAL '24 hours'
      `,
      dossiers_a_revoir: `
        SELECT COUNT(*) as count
        FROM dossiers 
        WHERE statut = 'a_revoir'
      `,
      dossiers_anciens: `
        SELECT COUNT(*) as count
        FROM dossiers 
        WHERE statut NOT IN ('livre', 'fini') 
          AND created_at < NOW() - INTERVAL '3 days'
      `,
      moyenne_temps_attente: `
        SELECT AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as heures
        FROM dossiers 
        WHERE statut NOT IN ('livre', 'termine')
      `,
    };

    try {
      const alertes = {};

      for (const [key, query] of Object.entries(queries)) {
        const result = await db.query(query);
        if (key === 'moyenne_temps_attente') {
          alertes[key] = Math.round(parseFloat(result.rows[0].heures) || 0);
        } else {
          alertes[key] = parseInt(result.rows[0].count) || 0;
        }
      }

      return alertes;
    } catch (error) {
      console.error('Erreur lors du calcul des alertes:', error);
      throw error;
    }
  }

  /**
   * Obtenir le nombre d'utilisateurs actifs
   */
  async getUtilisateursActifs() {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM utilisateurs 
        WHERE actif = true 
          AND last_login >= NOW() - INTERVAL '30 days'
      `;
      
      const result = await db.query(query);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      console.error('Erreur calcul utilisateurs actifs:', error);
      return 0;
    }
  }

  /**
   * Obtenir l'évolution du chiffre d'affaires par rapport à la période précédente
   */
  async getEvolutionCA(periode) {
    try {
      const currentCondition = this.getDateCondition(periode);
      const previousCondition = this.getPreviousDateCondition(periode);

      const query = `
        WITH current_period AS (
          SELECT COALESCE(SUM(prix_total), 0) as ca_current
          FROM dossiers 
          WHERE statut = 'livre' AND ${currentCondition}
        ),
        previous_period AS (
          SELECT COALESCE(SUM(prix_total), 0) as ca_previous
          FROM dossiers 
          WHERE statut = 'livre' AND ${previousCondition}
        )
        SELECT 
          cp.ca_current,
          pp.ca_previous,
          CASE 
            WHEN pp.ca_previous > 0 
            THEN ROUND((cp.ca_current - pp.ca_previous) / pp.ca_previous * 100, 1)
            ELSE 0 
          END as evolution_pourcent
        FROM current_period cp, previous_period pp
      `;

      const result = await db.query(query);
      return parseFloat(result.rows[0].evolution_pourcent) || 0;
    } catch (error) {
      console.error('Erreur calcul évolution CA:', error);
      return 0;
    }
  }

  /**
   * Obtenir la charge système (simulation)
   */
  async getChargeSysteme() {
    try {
      // Calcul basé sur l'activité récente des dossiers
      const query = `
        SELECT 
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) as activite_recente,
          COUNT(*) as total_actifs
        FROM dossiers 
        WHERE statut NOT IN ('livre', 'fini')
      `;

      const result = await db.query(query);
      const { activite_recente, total_actifs } = result.rows[0];
      
      // Simulation de la charge basée sur l'activité
      const baseLoad = Math.min((parseInt(total_actifs) || 0) * 2, 50);
      const recentActivity = Math.min((parseInt(activite_recente) || 0) * 10, 30);
      
      return Math.min(baseLoad + recentActivity + Math.random() * 20, 100);
    } catch (error) {
      console.error('Erreur calcul charge système:', error);
      return Math.random() * 30 + 20; // Valeur par défaut simulée
    }
  }

  /**
   * Obtenir les statistiques détaillées des utilisateurs par rôle
   */
  async getStatistiquesUtilisateurs() {
    try {
      const query = `
        SELECT 
          role,
          COUNT(*) as total,
          COUNT(CASE WHEN actif = true THEN 1 END) as actifs,
          COUNT(CASE WHEN last_login >= NOW() - INTERVAL '7 days' THEN 1 END) as actifs_semaine
        FROM utilisateurs 
        GROUP BY role
      `;

      const result = await db.query(query);
      
      const stats = {
        admins: 0,
        preparateurs: 0,
        clients: 0,
        inactifs: 0,
      };

      result.rows.forEach(row => {
        const role = row.role.toLowerCase();
        if (role === 'admin') stats.admins = parseInt(row.actifs);
        else if (role === 'preparateur') stats.preparateurs = parseInt(row.actifs);
        else if (role === 'client') stats.clients = parseInt(row.actifs);
        stats.inactifs += parseInt(row.total) - parseInt(row.actifs);
      });

      return stats;
    } catch (error) {
      console.error('Erreur statistiques utilisateurs:', error);
      return { admins: 0, preparateurs: 0, clients: 0, inactifs: 0 };
    }
  }

  /**
   * Obtenir l'évolution des revenus par période
   */
  async getEvolutionRevenus(periode = 'month') {
    const cacheKey = `evolution_revenus_${periode}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const { groupBy, dateFormat } = this.getGroupByPeriode(periode);
      const dateCondition = this.getDateCondition(periode);

      const query = `
        SELECT 
          ${dateFormat} as periode,
          COALESCE(SUM(CASE WHEN statut = 'livre' THEN prix_total END), 0) as chiffre_affaires,
          COUNT(CASE WHEN statut = 'livre' THEN 1 END) as dossiers_livres,
          AVG(CASE WHEN statut = 'livre' THEN prix_total END) as ticket_moyen,
          -- Simulation d'objectifs (à adapter selon vos besoins)
          CASE 
            WHEN EXTRACT(DOW FROM created_at) IN (0,6) THEN 5000  -- Weekend
            ELSE 8000  -- Semaine
          END as objectif
        FROM dossiers
        WHERE ${dateCondition}
        GROUP BY ${groupBy}
        ORDER BY periode ASC
      `;

      const result = await db.query(query);

      const evolution = result.rows.map(row => ({
        periode: row.periode,
        chiffre_affaires: parseFloat(row.chiffre_affaires) || 0,
        dossiers_livres: parseInt(row.dossiers_livres) || 0,
        ticket_moyen: Math.round(parseFloat(row.ticket_moyen) || 0),
        objectif: parseInt(row.objectif) || 0,
      }));

      this.cache.set(cacheKey, {
        data: evolution,
        timestamp: Date.now(),
      });

      return evolution;
    } catch (error) {
      console.error('Erreur évolution revenus:', error);
      return [];
    }
  }

  /**
   * Obtenir les données de performance système sur les dernières heures
   */
  async getPerformanceSysteme() {
    try {
      // Simulation de données de performance (à remplacer par de vraies métriques)
      const heures = [];
      const now = new Date();
      
      for (let i = 23; i >= 0; i--) {
        const heure = new Date(now.getTime() - i * 60 * 60 * 1000);
        
        // Calcul de l'activité réelle basée sur les dossiers
        const query = `
          SELECT COUNT(*) as activite
          FROM dossier_history 
          WHERE created_at BETWEEN $1 AND $2
        `;
        
        const startHour = new Date(heure);
        startHour.setMinutes(0, 0, 0);
        const endHour = new Date(startHour.getTime() + 60 * 60 * 1000);
        
        const result = await db.query(query, [startHour, endHour]);
        const activite = parseInt(result.rows[0].activite) || 0;
        
        // Simulation basée sur l'activité réelle
        const baseCPU = Math.min(activite * 2, 40);
        const baseMemoire = Math.min(activite * 1.5, 35);
        const requetes = activite + Math.random() * 10;
        
        heures.push({
          heure: heure.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          cpu: Math.min(baseCPU + Math.random() * 20, 100),
          memoire: Math.min(baseMemoire + Math.random() * 25, 100),
          requetes_par_minute: Math.round(requetes),
        });
      }

      return heures;
    } catch (error) {
      console.error('Erreur performance système:', error);
      
      // Données par défaut en cas d'erreur
      const heures = [];
      const now = new Date();
      
      for (let i = 23; i >= 0; i--) {
        const heure = new Date(now.getTime() - i * 60 * 60 * 1000);
        heures.push({
          heure: heure.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          cpu: Math.random() * 50 + 20,
          memoire: Math.random() * 40 + 30,
          requetes_par_minute: Math.round(Math.random() * 100 + 20),
        });
      }
      
      return heures;
    }
  }

  /**
   * Obtenir un tableau de bord complet
   */
  async getDashboardComplet(periode = 'month') {
    try {
      const [
        statistiquesGenerales,
        performancesUtilisateurs,
        evolutionDossiers,
        repartitionMachines,
        alertes,
        statistiquesUtilisateurs,
        evolutionRevenus,
        performanceSysteme,
      ] = await Promise.all([
        this.getStatistiquesGenerales(periode),
        this.getPerformancesUtilisateurs(periode),
        this.getEvolutionDossiers(periode),
        this.getRepartitionMachines(periode),
        this.getAlertes(),
        this.getStatistiquesUtilisateurs(),
        this.getEvolutionRevenus(periode),
        this.getPerformanceSysteme(),
      ]);

      return {
        periode,
        timestamp: new Date().toISOString(),
        statistiques_generales: statistiquesGenerales,
        performances_utilisateurs: performancesUtilisateurs,
        evolution_dossiers: evolutionDossiers,
        repartition_machines: repartitionMachines,
        alertes: alertes,
        statistiques_utilisateurs: statistiquesUtilisateurs,
        evolution_revenus: evolutionRevenus,
        performance_systeme: performanceSysteme,
      };
    } catch (error) {
      console.error('Erreur lors de la génération du dashboard complet:', error);
      throw error;
    }
  }

  /**
   * Utilitaires pour les requêtes SQL
   */
  getDateCondition(periode) {
    const conditions = {
      today: 'created_at >= CURRENT_DATE',
      yesterday: 'created_at >= CURRENT_DATE - INTERVAL \'1 day\' AND created_at < CURRENT_DATE',
      week: "created_at >= NOW() - INTERVAL '7 days'",
      last_week: "created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'",
      month: "created_at >= NOW() - INTERVAL '30 days'",
      last_month: "created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'",
      quarter: "created_at >= NOW() - INTERVAL '90 days'",
      year: "created_at >= NOW() - INTERVAL '365 days'",
      last_year: "created_at >= NOW() - INTERVAL '730 days' AND created_at < NOW() - INTERVAL '365 days'",
      all: 'TRUE',
    };

    return conditions[periode] || conditions['month'];
  }

  getPreviousDateCondition(periode) {
    const conditions = {
      today: 'created_at >= CURRENT_DATE - INTERVAL \'1 day\' AND created_at < CURRENT_DATE',
      week: "created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'",
      month: "created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'",
      quarter: "created_at >= NOW() - INTERVAL '180 days' AND created_at < NOW() - INTERVAL '90 days'",
      year: "created_at >= NOW() - INTERVAL '730 days' AND created_at < NOW() - INTERVAL '365 days'",
    };

    return conditions[periode] || conditions['month'];
  }

  getGroupByPeriode(periode) {
    const configs = {
      week: {
        groupBy: "DATE_TRUNC('day', created_at)",
        dateFormat: "TO_CHAR(created_at, 'YYYY-MM-DD')",
      },
      month: {
        groupBy: "DATE_TRUNC('day', created_at)",
        dateFormat: "TO_CHAR(created_at, 'YYYY-MM-DD')",
      },
      quarter: {
        groupBy: "DATE_TRUNC('week', created_at)",
        dateFormat: 'TO_CHAR(created_at, \'IYYY-"W"IW\')',
      },
      year: {
        groupBy: "DATE_TRUNC('month', created_at)",
        dateFormat: "TO_CHAR(created_at, 'YYYY-MM')",
      },
    };

    return configs[periode] || configs['month'];
  }

  /**
   * Vider le cache (utile pour forcer la mise à jour)
   */
  clearCache() {
    this.cache.clear();
    console.log('💾 Cache statistiques vidé');
  }
}

module.exports = new StatistiquesService();
