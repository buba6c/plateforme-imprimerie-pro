FROM node:20-alpine

# Installation des dépendances système
RUN apk add --no-cache \
    curl \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY ecosystem.config.js ./

# Installer les dépendances (utiliser npm install pour supporter lockfile non mis à jour)
RUN npm install --omit=dev && npm cache clean --force

# Installer PM2 globalement
RUN npm install -g pm2

# Créer les répertoires nécessaires
RUN mkdir -p uploads logs .pm2

# Copier le code source
COPY . .

# Définir les permissions
RUN chown -R node:node /app
USER node

# Exposer le port
EXPOSE 5001

# Définir PM2_HOME dans un répertoire accessible
ENV PM2_HOME=/app/.pm2

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5001/api/health || exit 1

# Commande de démarrage avec PM2 runtime
CMD ["pm2-runtime", "start", "ecosystem.config.js"]