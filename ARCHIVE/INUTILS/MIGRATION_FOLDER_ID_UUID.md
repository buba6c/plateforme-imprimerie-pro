# Migration vers folder_id UUID et Synchronisation Temps Réel

## 📋 Résumé

Cette migration résout le problème "Dossier non trouvé" en introduisant des identifiants UUID (`folder_id`) uniques pour les dossiers, couplés à une synchronisation temps réel via Socket.IO. L'approche est **non-destructive** : les ID integer existants sont conservés pour assurer la compatibilité pendant la transition.

## 🎯 Objectifs

1. **Éliminer les conflits d'ID** : Utiliser des UUID au lieu d'ID séquentiels
2. **Synchronisation temps réel** : Mettre à jour automatiquement tous les clients connectés
3. **Permissions granulaires** : Contrôler l'accès selon le rôle et le dossier
4. **Traçabilité** : Logger toutes les actions sur les dossiers
5. **Compatibilité** : Support des anciens ID integer pendant la transition

---

## 🗄️ 1. Migration Base de Données

### Fichier : `backend/migrations/20251005_add_folder_id_uuid.sql`

#### Actions effectuées :
- ✅ Ajout de la colonne `folder_id` (UUID) aux tables :
  - `dossiers`
  - `fichiers`
  - `dossier_status_history`
- ✅ Génération automatique d'UUIDs pour les 9 dossiers existants
- ✅ Création de la table `activity_logs` pour tracer les actions
- ✅ Fonction PostgreSQL `log_dossier_activity()` pour le logging

#### Exécution :
```bash
psql -U imprimerie_user -d imprimerie_db -f backend/migrations/20251005_add_folder_id_uuid.sql
```

#### Résultat :
```
✅ Migration terminée
   Dossiers total: 9
   Dossiers avec folder_id: 9
   Table activity_logs créée
```

### Structure de la table `activity_logs` :
```sql
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  folder_id UUID,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,  -- created, updated, deleted, status_changed, file_uploaded, etc.
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔒 2. Middleware de Permissions (Backend)

### Fichier : `backend/middleware/permissions.js`

#### Fonctionnalités :
- **Support dual ID** : Accepte les ID integer (legacy) et les folder_id UUID
- **Détection automatique** : Regex pour identifier le type d'identifiant
- **Permissions par action** :
  - `view` : admin, operateur, client (propres dossiers)
  - `create` : admin, operateur, client
  - `update` : admin, operateur
  - `delete` : admin uniquement
  - `upload_file` : admin, operateur, client
  - `delete_file` : admin, operateur
  - `change_status` : admin, operateur

#### Middleware disponibles :
```javascript
checkDossierPermission(action)  // Vérifie les permissions pour une action
requireRole(allowedRoles)       // Vérifie le rôle minimum requis
getDossierByIdentifier(id)      // Récupère un dossier par ID ou folder_id
logDossierActivity(...)         // Logger une action
```

#### Exemple d'utilisation :
```javascript
router.get('/:id', auth, checkDossierPermission('view'), async (req, res) => {
  // Le dossier est déjà chargé et vérifié dans req.dossier
  const dossier = req.dossier;
  res.json({ dossier });
});
```

---

## 🔌 3. Service Socket.IO (Backend)

### Fichier : `backend/services/socketService.js`

#### Événements émis :
1. **Dossiers** :
   - `dossier:created` : Nouveau dossier créé
   - `dossier:updated` : Dossier modifié
   - `dossier:deleted` : Dossier supprimé
   - `status:changed` : Statut changé

2. **Fichiers** :
   - `file:uploaded` : Fichier ajouté
   - `file:deleted` : Fichier supprimé
   - `file:updated` : Fichier modifié

3. **Autres** :
   - `machine:assigned` : Machine assignée
   - `notification` : Notifications génériques
   - `stats:updated` : Statistiques mises à jour

#### Système de Rooms :
- `dossier:{folder_id}` : Room pour un dossier spécifique
- `all_dossiers` : Room pour tous les dossiers (dashboard admin/operateur)
- `user:{user_id}` : Room pour un utilisateur spécifique

#### Initialisation :
```javascript
// server.js
const socketService = require('./services/socketService');
const io = socketService.initSocketIO(server, corsOptions);
```

---

## 🛣️ 4. Routes Backend Mises à Jour

### Fichier : `backend/routes/dossiers.js`

#### Changements principaux :

1. **Support folder_id UUID** :
   - Toutes les routes acceptent maintenant folder_id (UUID) ou ID integer
   - Les réponses retournent `folder_id` comme ID principal

2. **Intégration middleware permissions** :
   ```javascript
   router.get('/:id', auth, checkDossierPermission('view'), ...)
   router.put('/:id', auth, checkDossierPermission('update'), ...)
   router.delete('/:id', auth, checkDossierPermission('delete'), ...)
   router.post('/:id/fichiers', auth, checkDossierPermission('upload_file'), ...)
   ```

3. **Événements Socket.IO** :
   ```javascript
   // Création
   socketService.emitDossierCreated(dossier);
   
   // Mise à jour
   socketService.emitDossierUpdated(dossier, changes);
   
   // Suppression
   socketService.emitDossierDeleted(folderId, metadata);
   
   // Changement de statut
   socketService.emitStatusChanged(folderId, oldStatus, newStatus, dossier);
   ```

4. **Logging automatique** :
   ```javascript
   await logDossierActivity(folderId, userId, 'created', details);
   ```

#### Format de réponse :
```json
{
  "success": true,
  "dossier": {
    "id": "550e8400-e29b-41d4-a716-446655440000",  // folder_id UUID
    "legacy_id": 42,  // ID integer original
    "numero": "CMD-2025-0001",
    "client": "Client ABC",
    "statut": "en_cours",
    ...
  }
}
```

---

## ⚛️ 5. Hook React useSocket (Frontend)

### Fichier : `frontend/src/hooks/useSocket.js`

#### Fonctionnalités :
- Connexion automatique au serveur Socket.IO
- Gestion de la reconnexion automatique
- Callbacks pour tous les événements
- Fonctions pour rejoindre/quitter les rooms

#### Utilisation :
```javascript
import { useSocket } from '../hooks/useSocket';

const MyComponent = () => {
  const { joinDossier, leaveDossier, isConnected } = useSocket({
    onDossierCreated: (data) => {
      console.log('Nouveau dossier:', data.dossier);
    },
    onDossierUpdated: (data) => {
      console.log('Dossier modifié:', data.dossier);
    },
    onStatusChanged: (data) => {
      console.log('Statut changé:', data.oldStatus, '→', data.newStatus);
    },
    enabled: true,
  });

  useEffect(() => {
    if (dossier) {
      joinDossier(dossier.folder_id);
      return () => leaveDossier(dossier.folder_id);
    }
  }, [dossier]);

  return <div>Socket Status: {isConnected ? '✅' : '❌'}</div>;
};
```

---

## 🎯 6. Context React DossierContext (Frontend)

### Fichier : `frontend/src/contexts/DossierContext.js`

#### Fonctionnalités :
- Gestion centralisée de l'état des dossiers
- Intégration Socket.IO pour synchronisation automatique
- Fonctions pour toutes les opérations CRUD
- Support folder_id UUID

#### API disponible :
```javascript
import { useDossiers } from '../contexts/DossierContext';

const MyComponent = () => {
  const {
    dossiers,              // Liste des dossiers
    currentDossier,        // Dossier actuellement sélectionné
    loading,               // État de chargement
    error,                 // Erreurs
    fetchDossiers,         // Récupérer la liste
    fetchDossierById,      // Récupérer un dossier par folder_id
    createDossier,         // Créer un dossier
    updateDossier,         // Mettre à jour un dossier
    deleteDossier,         // Supprimer un dossier
    changeStatus,          // Changer le statut
    uploadFiles,           // Upload de fichiers
  } = useDossiers();

  // Les dossiers sont automatiquement mis à jour via Socket.IO
  useEffect(() => {
    fetchDossiers();
  }, []);

  return (
    <div>
      {dossiers.map(d => (
        <div key={d.folder_id}>{d.numero}</div>
      ))}
    </div>
  );
};
```

#### Synchronisation automatique :
- ✅ Nouveau dossier créé → Ajouté automatiquement à la liste
- ✅ Dossier modifié → Mis à jour automatiquement
- ✅ Dossier supprimé → Retiré automatiquement de la liste
- ✅ Statut changé → Mis à jour en temps réel
- ✅ Fichiers ajoutés/supprimés → Mis à jour automatiquement

---

## 📦 7. Composants Frontend à Mettre à Jour

### Fichiers à modifier :
1. `frontend/src/components/DossierManagement.js`
2. `frontend/src/components/FileManager.js`
3. `frontend/src/components/Dashboard.js`

### Changements nécessaires :

#### 1. Utiliser `folder_id` au lieu de `id` :
```javascript
// ❌ Avant
<Link to={`/dossiers/${dossier.id}`}>

// ✅ Après
<Link to={`/dossiers/${dossier.folder_id || dossier.id}`}>
```

#### 2. Utiliser le Context au lieu d'appels API directs :
```javascript
// ❌ Avant
import axios from 'axios';
const response = await axios.get(`/api/dossiers/${id}`);

// ✅ Après
import { useDossiers } from '../contexts/DossierContext';
const { fetchDossierById } = useDossiers();
const dossier = await fetchDossierById(folderId);
```

#### 3. Pas besoin de rafraîchir manuellement :
```javascript
// ❌ Avant
await deleteDossier(id);
await fetchDossiers(); // Rafraîchir manuellement

// ✅ Après
await deleteDossier(folderId);
// La liste est mise à jour automatiquement via Socket.IO
```

---

## 🧪 8. Tests et Validation

### Tests Backend

#### 1. Vérifier que les folder_id sont bien générés :
```sql
SELECT id, folder_id, numero, client FROM dossiers LIMIT 10;
```

#### 2. Tester le middleware de permissions :
```bash
# Test GET avec folder_id UUID
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/dossiers/550e8400-e29b-41d4-a716-446655440000

# Test GET avec ID integer (legacy)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5001/api/dossiers/42
```

#### 3. Vérifier le logging :
```sql
SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10;
```

### Tests Frontend

#### 1. Tester la connexion Socket.IO :
- Ouvrir la console du navigateur
- Chercher les messages : "✅ Socket.IO connecté"

#### 2. Tester la synchronisation temps réel :
- Ouvrir deux onglets avec la même page
- Créer un dossier dans l'onglet 1
- Vérifier qu'il apparaît automatiquement dans l'onglet 2

#### 3. Tester les opérations CRUD :
- Créer un dossier → Vérifier qu'il utilise folder_id
- Modifier un dossier → Vérifier la mise à jour temps réel
- Supprimer un dossier → Vérifier la suppression temps réel
- Changer le statut → Vérifier la mise à jour temps réel

---

## 🚀 9. Déploiement et Migration en Production

### Étapes recommandées :

1. **Backup de la base de données** :
   ```bash
   pg_dump -U imprimerie_user imprimerie_db > backup_avant_migration.sql
   ```

2. **Exécuter la migration SQL** :
   ```bash
   psql -U imprimerie_user -d imprimerie_db -f backend/migrations/20251005_add_folder_id_uuid.sql
   ```

3. **Redémarrer le backend** :
   ```bash
   cd backend
   npm install  # Si de nouvelles dépendances
   npm restart
   ```

4. **Redémarrer le frontend** :
   ```bash
   cd frontend
   npm install socket.io-client  # Si pas déjà installé
   npm start
   ```

5. **Vérifier les logs** :
   - Backend : Chercher "🚀 Socket.IO initialisé"
   - Frontend : Console navigateur pour "✅ Socket.IO connecté"

6. **Tests en production** :
   - Créer un dossier test
   - Vérifier la synchronisation sur plusieurs clients
   - Vérifier les permissions selon les rôles
   - Consulter les logs dans `activity_logs`

### Rollback si nécessaire :
```sql
-- Supprimer les colonnes folder_id
ALTER TABLE dossiers DROP COLUMN folder_id;
ALTER TABLE fichiers DROP COLUMN folder_id;
ALTER TABLE dossier_status_history DROP COLUMN folder_id;

-- Supprimer la table activity_logs
DROP TABLE activity_logs;

-- Supprimer la fonction de logging
DROP FUNCTION log_dossier_activity;
```

---

## 📊 10. Monitoring et Maintenance

### Requêtes SQL utiles :

#### Vérifier les dossiers sans folder_id :
```sql
SELECT COUNT(*) FROM dossiers WHERE folder_id IS NULL;
```

#### Statistiques d'activité :
```sql
SELECT 
  action,
  COUNT(*) as count,
  MAX(created_at) as last_occurrence
FROM activity_logs
GROUP BY action
ORDER BY count DESC;
```

#### Logs des dernières 24h :
```sql
SELECT 
  al.*,
  u.nom as user_name,
  d.numero as dossier_numero
FROM activity_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN dossiers d ON al.folder_id = d.folder_id
WHERE al.created_at > NOW() - INTERVAL '24 hours'
ORDER BY al.created_at DESC;
```

### Métriques Socket.IO :
```javascript
// Backend: Ajouter dans server.js
io.on('connection', socket => {
  console.log(`📊 Clients connectés: ${io.sockets.sockets.size}`);
});
```

---

## ✅ Checklist de Migration Complète

### Backend :
- [x] Migration SQL exécutée avec succès
- [x] Middleware de permissions créé
- [x] Service Socket.IO créé et initialisé
- [x] Routes dossiers mises à jour
- [x] Logging d'activités en place
- [x] Tests manuels effectués

### Frontend :
- [x] Hook useSocket créé
- [x] Context DossierContext créé
- [ ] Composants DossierManagement mis à jour
- [ ] Composants FileManager mis à jour
- [ ] Tests de synchronisation temps réel

### Tests :
- [ ] Test création dossier avec folder_id
- [ ] Test synchronisation multi-clients
- [ ] Test permissions selon les rôles
- [ ] Test upload/delete fichiers
- [ ] Test changement de statut
- [ ] Vérification logs activity_logs

### Production :
- [ ] Backup base de données effectué
- [ ] Migration SQL déployée
- [ ] Backend redémarré
- [ ] Frontend redémarré
- [ ] Monitoring en place
- [ ] Documentation équipe mise à jour

---

## 🆘 Troubleshooting

### Problème : Socket.IO ne se connecte pas
```javascript
// Vérifier l'URL dans useSocket.js
const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5001';
```

### Problème : "Dossier non trouvé" avec folder_id
```javascript
// Vérifier que le backend accepte les deux formats
const dossier = await getDossierByIdentifier(folderId);
```

### Problème : Permissions refusées
```sql
-- Vérifier les rôles utilisateur
SELECT id, nom, role FROM users WHERE id = <user_id>;
```

### Problème : Synchronisation lente
```javascript
// Augmenter la fréquence de reconnexion
reconnectionDelay: 500,  // Au lieu de 1000
```

---

## 📚 Ressources et Références

- [Socket.IO Documentation](https://socket.io/docs/)
- [PostgreSQL UUID Type](https://www.postgresql.org/docs/current/datatype-uuid.html)
- [React Context API](https://react.dev/learn/passing-data-deeply-with-context)
- [Axios HTTP Client](https://axios-http.com/)

---

**Date de migration** : 2025-01-05  
**Version** : 1.0.0  
**Auteur** : Migration automatisée
