# 🎨 Intégration Complète next-themes + Admin

## ✅ Ce qui a été fait

### 1. Installation ✅
```bash
npm install next-themes react-colorful
```

### 2. App.js mis à jour ✅
- NextThemeProvider configuré
- Support light/dark/system

### 3. ThemeTogglePro créé ✅
- 3 variantes (dropdown/toggle/button)
- Intégré dans LayoutImproved

### 4. ThemeManager créé ✅
**Nouveau fichier**: `frontend/src/components/admin/ThemeManager.js`

Interface admin complète pour:
- ✅ Voir les thèmes par défaut
- ✅ Créer des thèmes personnalisés
- ✅ Modifier les couleurs
- ✅ Appliquer/Supprimer des thèmes

---

## 📋 Ce qu'il reste à faire

### Phase 1: Backend API (Important)

#### 1.1 Créer la table themes

```sql
-- backend/database/migrations/create_themes_table.sql
CREATE TABLE themes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  colors JSONB NOT NULL,
  is_custom BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index
CREATE INDEX idx_themes_name ON themes(name);
CREATE INDEX idx_themes_custom ON themes(is_custom);

-- Thèmes par défaut
INSERT INTO themes (name, display_name, colors, is_custom) VALUES
('light', 'Clair (Par défaut)', '{"primary":"#007bff","secondary":"#6c757d","success":"#22c55e","warning":"#f59e0b","error":"#ef4444","background":"#ffffff","surface":"#f9fafb","text":"#1f2937","textSecondary":"#6b7280","border":"#e5e7eb"}', false),
('dark', 'Sombre (Par défaut)', '{"primary":"#3b82f6","secondary":"#8b92a5","success":"#22c55e","warning":"#f59e0b","error":"#ef4444","background":"#111827","surface":"#1f2937","text":"#f9fafb","textSecondary":"#d1d5db","border":"#374151"}', false);
```

#### 1.2 Créer les routes API

```javascript
// backend/routes/themes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// GET /api/themes - Liste tous les thèmes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM themes ORDER BY is_custom ASC, created_at DESC'
    );
    res.json({ themes: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/themes/custom - Liste thèmes personnalisés
router.get('/custom', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM themes WHERE is_custom = true ORDER BY created_at DESC'
    );
    res.json({ themes: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/themes - Créer un thème (admin only)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, displayName, colors } = req.body;
    
    const result = await pool.query(
      `INSERT INTO themes (name, display_name, colors, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, displayName, JSON.stringify(colors), req.user.id]
    );
    
    res.json({ theme: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/themes/:id - Modifier un thème
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, colors } = req.body;
    
    const result = await pool.query(
      `UPDATE themes 
       SET display_name = $1, colors = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND is_custom = true
       RETURNING *`,
      [displayName, JSON.stringify(colors), id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Thème non trouvé ou non modifiable' });
    }
    
    res.json({ theme: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/themes/:id - Supprimer un thème
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM themes WHERE id = $1 AND is_custom = true RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Thème non trouvé ou non supprimable' });
    }
    
    res.json({ message: 'Thème supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

#### 1.3 Enregistrer les routes

```javascript
// backend/server.js
const themesRoutes = require('./routes/themes');
app.use('/api/themes', themesRoutes);
```

---

### Phase 2: Modal d'édition de thème

Créer `frontend/src/components/admin/ThemeEditorModal.js` :

```jsx
import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Modal, Button } from '../ui';

const ThemeEditorModal = ({ isOpen, onClose, theme, onSave }) => {
  const [editedTheme, setEditedTheme] = useState(theme);
  const [activeColor, setActiveColor] = useState(null);

  const colorLabels = {
    primary: 'Couleur principale',
    secondary: 'Couleur secondaire',
    success: 'Succès',
    warning: 'Avertissement',
    error: 'Erreur',
    background: 'Fond',
    surface: 'Surface',
    text: 'Texte principal',
    textSecondary: 'Texte secondaire',
    border: 'Bordures',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Éditer: ${theme?.displayName || 'Nouveau thème'}`}
      size="large"
    >
      <div className="space-y-6">
        {/* Nom du thème */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Nom d'affichage
          </label>
          <input
            type="text"
            value={editedTheme?.displayName || ''}
            onChange={(e) =>
              setEditedTheme({ ...editedTheme, displayName: e.target.value })
            }
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        {/* Sélection des couleurs */}
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(editedTheme?.colors || {}).map(([key, color]) => (
            <div key={key} className="space-y-2">
              <label className="block text-sm font-medium">
                {colorLabels[key]}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveColor(key)}
                  className="w-16 h-16 rounded-lg border-2 shadow-sm"
                  style={{ backgroundColor: color }}
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) =>
                    setEditedTheme({
                      ...editedTheme,
                      colors: { ...editedTheme.colors, [key]: e.target.value }
                    })
                  }
                  className="flex-1 px-3 py-2 border rounded-lg font-mono text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Color Picker */}
        {activeColor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setActiveColor(null)}
          >
            <div className="bg-white p-6 rounded-xl" onClick={(e) => e.stopPropagation()}>
              <HexColorPicker
                color={editedTheme.colors[activeColor]}
                onChange={(newColor) =>
                  setEditedTheme({
                    ...editedTheme,
                    colors: { ...editedTheme.colors, [activeColor]: newColor }
                  })
                }
              />
              <Button onClick={() => setActiveColor(null)} className="mt-4 w-full">
                Fermer
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={() => onSave(editedTheme)}>
            Sauvegarder
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ThemeEditorModal;
```

---

### Phase 3: Intégrer dans Settings

Modifier `frontend/src/components/admin/Settings.js` :

```jsx
import ThemeManager from './ThemeManager';

// Dans le composant Settings, ajouter un nouvel onglet
const tabs = [
  { id: 'general', name: 'Général', icon: CogIcon },
  { id: 'themes', name: 'Thèmes', icon: SwatchIcon }, // NOUVEAU
  { id: 'security', name: 'Sécurité', icon: ShieldCheckIcon },
  // ...
];

// Dans le rendu
{activeTab === 'themes' && <ThemeManager />}
```

---

### Phase 4: Hook personnalisé useThemeManager

Créer `frontend/src/hooks/useThemeManager.js` :

```javascript
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

export const useThemeManager = (userId) => {
  const { theme, setTheme, themes } = useTheme();
  const [customThemes, setCustomThemes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Charger les thèmes depuis l'API
  const loadThemes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/themes');
      const data = await response.json();
      setCustomThemes(data.themes);
    } catch (error) {
      console.error('Error loading themes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Charger au montage
  useEffect(() => {
    loadThemes();
  }, []);

  // Sauvegarder le thème de l'utilisateur en DB
  const saveUserTheme = async (themeName) => {
    try {
      await fetch(`/api/users/${userId}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeName })
      });
      setTheme(themeName);
    } catch (error) {
      console.error('Error saving user theme:', error);
    }
  };

  return {
    theme,
    setTheme: saveUserTheme,
    themes,
    customThemes,
    loading,
    reloadThemes: loadThemes
  };
};
```

---

## 🎯 Ordre d'implémentation recommandé

### Étape 1: Backend (1h)
1. Créer la table `themes`
2. Créer les routes API
3. Tester avec Postman/Insomnia

### Étape 2: Modal d'édition (30min)
1. Créer `ThemeEditorModal.js`
2. Intégrer dans `ThemeManager.js`

### Étape 3: Intégration Settings (15min)
1. Ajouter l'onglet dans Settings
2. Tester l'interface

### Étape 4: Hook personnalisé (30min)
1. Créer `useThemeManager.js`
2. Remplacer dans les composants

### Étape 5: Tests (30min)
1. Créer un thème
2. Le modifier
3. L'appliquer
4. Le supprimer

---

## 📊 Structure finale

```
frontend/
├── src/
│   ├── components/
│   │   ├── admin/
│   │   │   ├── ThemeManager.js ✅
│   │   │   ├── ThemeEditorModal.js (À créer)
│   │   │   └── Settings.js (À modifier)
│   │   ├── ThemeTogglePro.js ✅
│   │   └── ui/
│   ├── hooks/
│   │   └── useThemeManager.js (À créer)
│   └── App.js ✅

backend/
├── routes/
│   └── themes.js (À créer)
├── database/
│   └── migrations/
│       └── create_themes_table.sql (À créer)
└── server.js (À modifier)
```

---

## 🚀 Quick Start pour tester l'existant

```bash
cd frontend
npm start
```

1. Se connecter en tant qu'admin
2. Aller dans Paramètres
3. Cliquer sur l'onglet "Thèmes" (à ajouter)
4. Voir l'interface ThemeManager

---

## 📚 Documentation API

### GET /api/themes
Liste tous les thèmes (défaut + custom)

**Response**:
```json
{
  "themes": [
    {
      "id": 1,
      "name": "light",
      "display_name": "Clair (Par défaut)",
      "colors": { ... },
      "is_custom": false
    }
  ]
}
```

### POST /api/themes
Créer un thème custom (admin only)

**Body**:
```json
{
  "name": "ocean",
  "displayName": "Océan",
  "colors": {
    "primary": "#0077be",
    "secondary": "#00a9e0",
    ...
  }
}
```

### PUT /api/themes/:id
Modifier un thème custom

### DELETE /api/themes/:id
Supprimer un thème custom

---

## ✨ Fonctionnalités futures

### Phase avancée:
- [ ] Import/Export de thèmes (JSON)
- [ ] Thèmes par rôle (admin, préparateur, etc.)
- [ ] Marketplace de thèmes
- [ ] Prévisualisation avant application
- [ ] Mode automatique selon l'heure
- [ ] Thèmes saisonniers

---

**Status actuel**: 60% terminé  
**Prochaine étape**: Créer le backend API

Voulez-vous que je continue avec le backend ou un autre composant ?
