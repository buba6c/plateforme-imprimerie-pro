import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  SwatchIcon,
  EyeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  PaintBrushIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { useThemeCustom } from '../../theme/ThemeCustomProvider';
import useNotifications from '../../hooks/useNotifications';

const ThemeSettings = () => {
  const { theme, updateTheme, resetTheme, isLoading } = useThemeCustom();
  const { addNotification } = useNotifications();
  const [tempTheme, setTempTheme] = useState(theme);
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Mise à jour temporaire pour l'aperçu
  const handleColorChange = (key, value) => {
    setTempTheme(prev => ({ ...prev, [key]: value }));
  };

  // Aperçu en temps réel
  const togglePreview = () => {
    setPreviewMode(!previewMode);
    if (!previewMode) {
      // Appliquer temporairement le thème pour l'aperçu
      applyTemporaryTheme(tempTheme);
    } else {
      // Restaurer le thème actuel
      applyTemporaryTheme(theme);
    }
  };

  // Appliquer temporairement un thème (pour l'aperçu)
  const applyTemporaryTheme = (themeData) => {
    const root = document.documentElement;
    
    // Couleurs principales
    root.style.setProperty('--primary-color', themeData.primaryColor);
    root.style.setProperty('--secondary-color', themeData.secondaryColor);
    if (themeData.accentColor) {
      root.style.setProperty('--accent-color', themeData.accentColor);
    }
    
    // Arrière-plans
    root.style.setProperty('--background-color', themeData.backgroundColor);
    root.style.setProperty('--background-secondary', themeData.backgroundSecondary);
    root.style.setProperty('--card-bg', themeData.cardBg);
    
    // Texte
    root.style.setProperty('--text-color', themeData.textColor);
    
    // Variables dérivées pour le design professionnel
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${themeData.primaryColor} 0%, ${themeData.secondaryColor} 100%)`);
    root.style.setProperty('--gradient-sidebar', `linear-gradient(135deg, ${themeData.primaryColor} 0%, ${themeData.secondaryColor} 100%)`);
    root.style.setProperty('--sidebar-bg', 'var(--gradient-sidebar)');
    root.style.setProperty('--button-bg', 'var(--gradient-primary)');
    
    // Glow hover doux
    root.style.setProperty('--button-hover', 'rgba(0, 198, 255, 0.15)');
  };

  // Fonction utilitaire pour éclaircir une couleur hex
  const lightenHexColor = (hex, percent) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  };

  // Sauvegarder le thème
  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateTheme(tempTheme);
      if (result.success) {
        addNotification('Thème mis à jour avec succès!', 'success');
        setPreviewMode(false);
      } else {
        addNotification('Erreur lors de la sauvegarde du thème', 'error');
      }
    } catch (error) {
      addNotification('Erreur lors de la mise à jour du thème', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Réinitialiser au thème par défaut
  const handleReset = async () => {
    setSaving(true);
    try {
      const result = await resetTheme();
      if (result.success) {
        addNotification('Thème réinitialisé au défaut', 'success');
        setTempTheme(theme);
        setPreviewMode(false);
      } else {
        addNotification('Erreur lors de la réinitialisation', 'error');
      }
    } catch (error) {
      addNotification('Erreur lors de la réinitialisation du thème', 'error');
    } finally {
      setSaving(false);
    }
  };

  const colorFields = [
    {
      key: 'primaryColor',
      label: 'Bleu Principal',
      description: 'Couleur principale pour la sidebar, boutons et liens',
      icon: SwatchIcon,
      category: 'primary'
    },
    {
      key: 'secondaryColor',
      label: 'Bleu Turquoise',
      description: 'Couleur turquoise pour le dégradé et les accents',
      icon: SparklesIcon,
      category: 'primary'
    },
    {
      key: 'accentColor',
      label: 'Couleur d’action (Accent)',
      description: 'Utilisée pour les actions importantes (#ff4f70 recommandé)',
      icon: SparklesIcon,
      category: 'primary'
    },
    {
      key: 'backgroundColor',
      label: 'Arrière-plan Principal',
      description: 'Couleur de fond de l\'application (généralement blanc)',
      icon: SwatchIcon,
      category: 'background'
    },
    {
      key: 'backgroundSecondary',
      label: 'Arrière-plan Secondaire',
      description: 'Couleur de fond des zones de contenu',
      icon: SwatchIcon,
      category: 'background'
    },
    {
      key: 'textColor',
      label: 'Texte Principal',
      description: 'Couleur du texte principal (titres, contenu)',
      icon: SwatchIcon,
      category: 'text'
    },
    {
      key: 'cardBg',
      label: 'Cartes et Modales',
      description: 'Couleur de fond des cartes, modales et conteneurs',
      icon: SwatchIcon,
      category: 'background'
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-neutral-600">Chargement des paramètres...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-6 space-y-8"
    >
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black gradient-text flex items-center gap-3">
              <PaintBrushIcon className="h-8 w-8" />
              Personnalisation du Thème
            </h1>
            <p className="text-neutral-600 dark:text-neutral-300 mt-2">
              Personnalisez l'apparence globale de votre plateforme d'imprimerie
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={togglePreview}
              className={`btn-outline flex items-center gap-2 ${previewMode ? 'bg-primary-500 text-white' : ''}`}
            >
              <EyeIcon className="h-5 w-5" />
              {previewMode ? 'Désactiver l\'aperçu' : 'Aperçu'}
            </button>
          </div>
        </div>

        {previewMode && (
          <div className="bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-700 rounded-lg p-4 mb-6">
            <div className="flex items-center text-info-700 dark:text-info-300">
              <EyeIcon className="h-5 w-5 mr-2" />
              <span className="font-medium">Mode aperçu activé</span>
            </div>
            <p className="text-info-600 dark:text-info-400 text-sm mt-1">
              Les changements sont appliqués temporairement. Sauvegardez pour les conserver.
            </p>
          </div>
        )}
      </div>

      {/* Configurateur de couleurs */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Palette de Couleurs</h2>
          <p className="card-subtitle">
            Configurez les couleurs principales de votre interface
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {colorFields.map((field) => {
            const IconComponent = field.icon;
            return (
              <motion.div
                key={field.key}
                whileHover={{ scale: 1.02 }}
                className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white dark:bg-neutral-700 rounded-lg shadow-sm">
                    <IconComponent className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <label className="form-label">{field.label}</label>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
                      {field.description}
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={tempTheme[field.key]}
                        onChange={(e) => handleColorChange(field.key, e.target.value)}
                        className="w-12 h-12 rounded-lg border-2 border-neutral-300 dark:border-neutral-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={tempTheme[field.key]}
                        onChange={(e) => handleColorChange(field.key, e.target.value)}
                        className="form-input flex-1 font-mono text-sm"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Aperçu visuel */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Aperçu du Thème</h2>
          <p className="card-subtitle">
            Prévisualisation des éléments avec votre thème personnalisé
          </p>
        </div>

        <div className="space-y-6">
          {/* Boutons */}
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-3">Boutons</h3>
            <div className="flex flex-wrap gap-3">
              <button className="btn">Bouton Principal</button>
              <button className="btn-outline">Bouton Secondaire</button>
              <span className="badge badge-primary">Badge</span>
              <span className="badge badge-success">Succès</span>
            </div>
          </div>

          {/* Cartes */}
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-white mb-3">Cartes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card">
                <h4 className="font-semibold text-lg mb-2">Carte d'exemple</h4>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Cette carte utilise votre thème personnalisé pour l'arrière-plan et les bordures.
                </p>
              </div>
              <div className="card hover-lift">
                <h4 className="font-semibold text-lg mb-2">Avec effet hover</h4>
                <p className="text-neutral-600 dark:text-neutral-300">
                  Survolez cette carte pour voir l'animation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={handleReset}
          disabled={saving}
          className="btn-outline text-error-600 border-error-600 hover:bg-error-600 hover:text-white flex items-center gap-2"
        >
          <ArrowPathIcon className="h-5 w-5" />
          Réinitialiser au défaut
        </button>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setTempTheme(theme);
              setPreviewMode(false);
              applyTemporaryTheme(theme);
            }}
            disabled={saving}
            className="btn-outline"
          >
            <XCircleIcon className="h-5 w-5 mr-2" />
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn flex items-center gap-2"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <CheckCircleIcon className="h-5 w-5" />
            )}
            {saving ? 'Sauvegarde...' : 'Sauvegarder le Thème'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ThemeSettings;