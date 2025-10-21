# Dockerfile pour la plateforme d'imprimerie
# Image Node.js officielle
FROM node:18-alpine

# Répertoire de travail
WORKDIR /app

# Copier les fichiers de configuration
COPY backend/package*.json ./backend/

# Installer les dépendances backend
WORKDIR /app/backend
RUN npm ci --only=production

# Revenir au répertoire principal
WORKDIR /app

# Copier le code source
COPY backend/ ./backend/
COPY database/ ./database/

# Créer les répertoires nécessaires
RUN mkdir -p backend/uploads backend/temp backend/backups

# Exposer le port
EXPOSE 10000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=10000

# Commande de démarrage
CMD ["node", "backend/server.js"]