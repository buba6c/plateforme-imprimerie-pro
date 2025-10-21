import React, { useState, useEffect } from 'react';
import { Palette, RefreshCw, Save, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Composant de personnalisation avancée du thème
 * Permet de modifier les couleurs et dégradés en temps réel
 */
const ThemeCustomizer = () => {
  const [colors, setColors] = useState({
    primary: '#1A73E8',
    secondary: '#0F4C81',
    accent: '#FF6F61',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  });

  const [previewMode, setPreviewMode] = useState('light');

  // Charger les couleurs personnalisées depuis localStorage
  useEffect(() => {
    const saved = localStorage.getItem('theme-custom-colors');
    if (saved) {
      try {
        setColors(JSON.parse(saved));
      } catch (e) {
        console.error('Erreur chargement couleurs:', e);
      }
    }
  }, []);

  // Appliquer les couleurs en temps réel
  useEffect(() => {
    const root = document.documentElement;
    
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--status-success', colors.success);
    root.style.setProperty('--status-warning', colors.warning);
    root.style.setProperty('--status-danger', colors.danger);
    root.style.setProperty('--status-info', colors.info);
    
    // Mettre à jour les dégradés
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`);
    root.style.setProperty('--gradient-success', `linear-gradient(135deg, ${colors.success}, ${darkenColor(colors.success, 15)})`);
    root.style.setProperty('--gradient-warning', `linear-gradient(135deg, ${colors.warning}, ${darkenColor(colors.warning, 15)})`);
    root.style.setProperty('--gradient-danger', `linear-gradient(135deg, ${colors.danger}, ${darkenColor(colors.danger, 15)})`);
    root.style.setProperty('--gradient-info', `linear-gradient(135deg, ${colors.info}, ${darkenColor(colors.info, 15)})`);
  }, [colors]);

  const handleColorChange = (key, value) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const saveColors = () => {
    try {
      localStorage.setItem('theme-custom-colors', JSON.stringify(colors));
      toast.success('Couleurs sauvegardées avec succès !');
    } catch (e) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const resetColors = () => {
    const defaults = {
      primary: '#1A73E8',
      secondary: '#0F4C81',
      accent: '#FF6F61',
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#3B82F6',
    };
    setColors(defaults);
    localStorage.removeItem('theme-custom-colors');
    toast.success('Couleurs réinitialisées');
  };

  const darkenColor = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;
    return '#' + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255))
      .toString(16).slice(1);
  };

  const ColorPicker = ({ label, value, onChange, description }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium" style={{ color: 'var(--text-body)' }}>
            {label}
          </label>
          {description && (
            <p className="text-xs" style={{ color: 'var(--text-body)', opacity: 0.6 }}>
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded-lg cursor-pointer border-2"
            style={{ borderColor: 'var(--card-border)' }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 px-3 py-2 rounded-lg border text-sm font-mono"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--card-border)',
              color: 'var(--text-body)'
            }}
            placeholder="#000000"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-body)' }}>
            <Palette size={24} />
            Personnalisation Avancée
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--text-body)', opacity: 0.7 }}>
            Personnalisez les couleurs et dégradés de votre plateforme
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetColors}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Réinitialiser
          </button>
          <button
            onClick={saveColors}
            className="btn btn-success flex items-center gap-2"
          >
            <Save size={16} />
            Sauvegarder
          </button>
        </div>
      </div>

      {/* Mode Preview Toggle */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Eye size={20} />
          Mode d'aperçu
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewMode('light')}
            className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
              previewMode === 'light'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-neutral-200 dark:border-neutral-700'
            }`}
            style={{ color: 'var(--text-body)' }}
          >
            ☀️ Clair
          </button>
          <button
            onClick={() => setPreviewMode('dark')}
            className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
              previewMode === 'dark'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-neutral-200 dark:border-neutral-700'
            }`}
            style={{ color: 'var(--text-body)' }}
          >
            🌙 Sombre
          </button>
        </div>
      </div>

      {/* Color Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">Couleurs Principales</div>
          <div className="space-y-4">
            <ColorPicker
              label="Couleur Primaire"
              description="Utilisée pour les boutons et liens principaux"
              value={colors.primary}
              onChange={(val) => handleColorChange('primary', val)}
            />
            <ColorPicker
              label="Couleur Secondaire"
              description="Complémente la couleur primaire"
              value={colors.secondary}
              onChange={(val) => handleColorChange('secondary', val)}
            />
            <ColorPicker
              label="Couleur d'Accent"
              description="Pour les éléments mis en valeur"
              value={colors.accent}
              onChange={(val) => handleColorChange('accent', val)}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">Couleurs de Statut</div>
          <div className="space-y-4">
            <ColorPicker
              label="Succès"
              description="Indique une action réussie"
              value={colors.success}
              onChange={(val) => handleColorChange('success', val)}
            />
            <ColorPicker
              label="Avertissement"
              description="Attire l'attention sur un élément"
              value={colors.warning}
              onChange={(val) => handleColorChange('warning', val)}
            />
            <ColorPicker
              label="Danger"
              description="Indique une erreur ou action critique"
              value={colors.danger}
              onChange={(val) => handleColorChange('danger', val)}
            />
            <ColorPicker
              label="Information"
              description="Messages informatifs"
              value={colors.info}
              onChange={(val) => handleColorChange('info', val)}
            />
          </div>
        </div>
      </div>

      {/* Preview Section */}
      <div className="card">
        <div className="card-header">Aperçu des Éléments</div>
        <div className="space-y-4">
          {/* Buttons Preview */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-body)' }}>
              Boutons avec Dégradés
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary">Primaire</button>
              <button className="btn btn-success">Succès</button>
              <button className="btn btn-warning">Avertissement</button>
              <button className="btn btn-danger">Danger</button>
              <button className="btn btn-info">Info</button>
              <button className="btn btn-secondary">Secondaire</button>
            </div>
          </div>

          {/* Status Badges Preview */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-body)' }}>
              Badges de Statut
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="status-badge success">✓ Validé</span>
              <span className="status-badge warning">⚠ En attente</span>
              <span className="status-badge danger">✗ Rejeté</span>
              <span className="status-badge info">ℹ Information</span>
              <span className="status-badge pending">⏳ En cours</span>
            </div>
          </div>

          {/* Gradient Backgrounds */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-body)' }}>
              Dégradés Disponibles
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-gradient-primary p-4 rounded-lg text-center">
                <span className="text-sm font-medium">Primaire</span>
              </div>
              <div className="bg-gradient-success p-4 rounded-lg text-center">
                <span className="text-sm font-medium">Succès</span>
              </div>
              <div className="bg-gradient-warning p-4 rounded-lg text-center">
                <span className="text-sm font-medium">Avertissement</span>
              </div>
              <div className="bg-gradient-danger p-4 rounded-lg text-center">
                <span className="text-sm font-medium">Danger</span>
              </div>
              <div className="bg-gradient-info p-4 rounded-lg text-center">
                <span className="text-sm font-medium">Info</span>
              </div>
            </div>
          </div>

          {/* Dossier Card Preview */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-body)' }}>
              Carte de Dossier
            </p>
            <div className="dossier-card max-w-md">
              <div className="dossier-card-header">
                <div>
                  <div className="dossier-card-title">Dossier #2024-001</div>
                  <div className="dossier-card-subtitle">Client: Entreprise ABC</div>
                </div>
                <span className="status-badge success">✓ Validé</span>
              </div>
              <p style={{ color: 'var(--text-body)', opacity: 0.8, fontSize: '0.875rem' }}>
                Description du dossier avec toutes les informations nécessaires.
              </p>
              <div className="dossier-card-actions">
                <button className="dossier-action-btn">👁️ Voir</button>
                <button className="dossier-action-btn">✏️ Modifier</button>
                <button className="dossier-action-btn">🗑️ Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export/Import Colors */}
      <div className="card">
        <div className="card-header">Import/Export</div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-body)' }}>
              Code de Configuration
            </label>
            <textarea
              readOnly
              value={JSON.stringify(colors, null, 2)}
              className="w-full px-3 py-2 rounded-lg border font-mono text-xs"
              style={{
                backgroundColor: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                color: 'var(--text-body)',
                minHeight: '120px'
              }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-body)', opacity: 0.6 }}>
            💡 Copiez ce code pour sauvegarder votre configuration ou la partager
          </p>
        </div>
      </div>
    </div>
  );
};

export default ThemeCustomizer;
