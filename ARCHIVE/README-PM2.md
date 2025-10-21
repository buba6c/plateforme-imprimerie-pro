# 🚀 Plateforme d'Imprimerie - Gestion PM2

## Installation et Configuration

PM2 est maintenant installé et configuré pour gérer votre plateforme d'imprimerie.

## 📋 Commandes Disponibles

### Démarrage
```bash
./start.sh start    # ou simplement ./start.sh
```

### Arrêt
```bash
./start.sh stop
```

### Redémarrage
```bash
./start.sh restart
```

### Status
```bash
./start.sh status
```

### Logs en temps réel
```bash
./start.sh logs
```

### Monitoring complet
```bash
./start.sh monit
```

## 🔧 Commandes PM2 Directes

### Status de tous les processus
```bash
pm2 status
```

### Logs spécifiques
```bash
pm2 logs plateforme-frontend
pm2 logs plateforme-frontend --lines 100
```

### Monitoring en temps réel
```bash
pm2 monit
```

### Redémarrage d'un processus spécifique
```bash
pm2 restart plateforme-frontend
```

### Arrêt d'un processus spécifique
```bash
pm2 stop plateforme-frontend
```

### Suppression d'un processus
```bash
pm2 delete plateforme-frontend
```

## 📊 Fonctionnalités PM2

- ✅ **Auto-restart** : Redémarrage automatique en cas de crash
- ✅ **Logging** : Logs centralisés avec horodatage
- ✅ **Monitoring** : Interface de surveillance en temps réel
- ✅ **Memory limit** : Redémarrage automatique si usage mémoire > 1GB
- ✅ **Gestion des erreurs** : Logs d'erreurs séparés

## 📁 Configuration

Le fichier `pm2.config.js` contient toute la configuration :
- Port : 3000
- Environment : development
- Memory limit : 1GB
- Logs : `/Users/mac/.pm2/logs/`

## 🌐 Accès à l'Application

Une fois démarrée, l'application est accessible sur :
**http://localhost:3000**

## 🆘 Dépannage

### Vérifier si PM2 daemon tourne
```bash
pm2 ping
```

### Redémarrer PM2 daemon
```bash
pm2 kill
pm2 ping
```

### Vider les logs
```bash
pm2 flush
```

### Status détaillé
```bash
pm2 describe plateforme-frontend
```