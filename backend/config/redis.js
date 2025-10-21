/**
 * Configuration Redis optimisée pour Render
 * Gère les connexions Redis avec fallback et retry
 */

const redis = require('redis');

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 5;
  }

  async connect() {
    try {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 10000,
        lazyConnect: true,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        
        // Configuration spécifique pour Render
        ...(process.env.REDIS_URL && {
          url: process.env.REDIS_URL
        })
      };

      // Créer le client Redis
      if (process.env.REDIS_URL) {
        this.client = redis.createClient(process.env.REDIS_URL);
      } else {
        this.client = redis.createClient(redisConfig);
      }

      // Gestionnaires d'événements
      this.client.on('connect', () => {
        console.log('✅ Redis connecté');
        this.isConnected = true;
        this.retryAttempts = 0;
      });

      this.client.on('error', (error) => {
        console.error('❌ Erreur Redis:', error.message);
        this.isConnected = false;
        
        if (this.retryAttempts < this.maxRetries) {
          this.retryAttempts++;
          console.log(`🔄 Tentative de reconnexion Redis ${this.retryAttempts}/${this.maxRetries}...`);
          setTimeout(() => this.reconnect(), 5000 * this.retryAttempts);
        }
      });

      this.client.on('end', () => {
        console.log('🔌 Connexion Redis fermée');
        this.isConnected = false;
      });

      // Tenter la connexion
      await this.client.connect();
      
      // Test de la connexion
      await this.client.ping();
      console.log('✅ Redis opérationnel');

      return this.client;
    } catch (error) {
      console.error('❌ Échec connexion Redis:', error.message);
      
      // En cas d'échec, utiliser un cache mémoire de fallback
      return this.createMemoryFallback();
    }
  }

  async reconnect() {
    try {
      if (this.client) {
        await this.client.disconnect();
      }
      await this.connect();
    } catch (error) {
      console.error('❌ Échec reconnexion Redis:', error.message);
    }
  }

  createMemoryFallback() {
    console.log('⚠️  Utilisation du cache mémoire (Redis indisponible)');
    
    const memoryCache = new Map();
    
    return {
      // Simulation de l'API Redis avec cache mémoire
      set: async (key, value, options = {}) => {
        const serialized = JSON.stringify(value);
        memoryCache.set(key, {
          value: serialized,
          expires: options.EX ? Date.now() + (options.EX * 1000) : null
        });
        return 'OK';
      },
      
      get: async (key) => {
        const item = memoryCache.get(key);
        if (!item) return null;
        
        if (item.expires && Date.now() > item.expires) {
          memoryCache.delete(key);
          return null;
        }
        
        try {
          return JSON.parse(item.value);
        } catch {
          return item.value;
        }
      },
      
      del: async (key) => {
        const existed = memoryCache.has(key);
        memoryCache.delete(key);
        return existed ? 1 : 0;
      },
      
      exists: async (key) => {
        return memoryCache.has(key) ? 1 : 0;
      },
      
      expire: async (key, seconds) => {
        const item = memoryCache.get(key);
        if (item) {
          item.expires = Date.now() + (seconds * 1000);
          return 1;
        }
        return 0;
      },
      
      ping: async () => 'PONG',
      
      disconnect: async () => {
        memoryCache.clear();
      },
      
      // Indicateur que c'est un fallback
      _isMemoryFallback: true
    };
  }

  getClient() {
    return this.client;
  }

  isRedisConnected() {
    return this.isConnected;
  }

  async disconnect() {
    if (this.client && !this.client._isMemoryFallback) {
      await this.client.disconnect();
    }
    this.isConnected = false;
  }
}

// Singleton pour la gestion Redis
const redisManager = new RedisManager();

module.exports = {
  RedisManager,
  redisManager,
  
  // Fonctions utilitaires pour l'application
  async initRedis() {
    return await redisManager.connect();
  },
  
  async getRedisClient() {
    if (!redisManager.isRedisConnected()) {
      await redisManager.connect();
    }
    return redisManager.getClient();
  },
  
  // Session helper pour Express
  createSessionStore() {
    const client = redisManager.getClient();
    
    if (client && !client._isMemoryFallback) {
      const RedisStore = require('connect-redis');
      return new RedisStore({ client });
    }
    
    // Fallback vers session mémoire
    console.log('⚠️  Utilisation des sessions en mémoire');
    return null; // Express utilisera MemoryStore par défaut
  }
};