import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { HexColorPicker } from 'react-colorful';
import {
  PaintBrushIcon,
  SwatchIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  EyeIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Button, Modal } from '../ui';
import { useToast } from '../ui/Toast';
import ThemeEditorModal from './ThemeEditorModal';

/**
 * ThemeManager - Interface admin complète pour gérer les thèmes
 * 
 * Fonctionnalités:
 * - Créer des thèmes personnalisés
 * - Modifier les couleurs
 * - Prévisualiser en temps réel
 * - Sauvegarder en base de données
 * - Gérer les thèmes par défaut
 */
const ThemeManager = () => {
  const { theme, setTheme, themes } = useTheme();
  const { showToast } = useToast();
  
  // États
  const [customThemes, setCustomThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Thème en cours d'édition
  const [editingTheme, setEditingTheme] = useState({
    name: '',
    displayName: '',
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      background: '#ffffff',
      surface: '#f9fafb',
      text: '#1f2937',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
    }
  });

  // Thèmes prédéfinis
  const defaultThemes = [
    {
      id: 'light',
      name: 'light',
      displayName: 'Clair (Par défaut)',
      icon: SunIcon,
      colors: {
        primary: '#007bff',
        secondary: '#6c757d',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        background: '#ffffff',
        surface: '#f9fafb',
        text: '#1f2937',
        textSecondary: '#6b7280',
        border: '#e5e7eb',
      }
    },
    {
      id: 'dark',
      name: 'dark',
      displayName: 'Sombre (Par défaut)',
      icon: MoonIcon,
      colors: {
        primary: '#3b82f6',
        secondary: '#8b92a5',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        background: '#111827',
        surface: '#1f2937',
        text: '#f9fafb',
        textSecondary: '#d1d5db',
        border: '#374151',
      }
    },
    {
      id: 'system',
      name: 'system',
      displayName: 'Système (Auto)',
      icon: ComputerDesktopIcon,
      colors: null, // Suit le système
    }
  ];

  // Charger les thèmes personnalisés depuis la base de données
  useEffect(() => {
    loadCustomThemes();
  }, []);

  const loadCustomThemes = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5001/api/themes/public');
      if (response.ok) {
        const data = await response.json();
        // Filtrer uniquement les thèmes personnalisés
        const customOnly = (data.themes || []).filter(t => t.is_custom);
        setCustomThemes(customOnly);
      }
    } catch (error) {
      console.error('Erreur chargement thèmes:', error);
      showToast('error', 'Impossible de charger les thèmes');
    } finally {
      setLoading(false);
    }
  };

  // Créer un nouveau thème
  const handleCreateTheme = () => {
    setIsCreating(true);
    setSelectedTheme(null);
    setIsEditorOpen(true);
  };

  // Modifier un thème existant
  const handleEditTheme = (themeData) => {
    setIsCreating(false);
    setSelectedTheme(themeData);
    setIsEditorOpen(true);
  };

  // Sauvegarder le thème depuis le modal
  const handleSaveThemeFromModal = async (themeData) => {
    try {
      if (!themeData.displayName) {
        showToast('error', 'Le nom du thème est requis');
        throw new Error('Nom requis');
      }

      setLoading(true);

      const token = localStorage.getItem('token');
      const response = await fetch(
        isCreating 
          ? 'http://localhost:5001/api/themes' 
          : `http://localhost:5001/api/themes/${selectedTheme.id}`,
        {
          method: isCreating ? 'POST' : 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify(themeData)
        }
      );

      if (response.ok) {
        showToast('success', isCreating ? 'Thème créé' : 'Thème modifié');
        setIsEditorOpen(false);
        setSelectedTheme(null);
        await loadCustomThemes();
        
        // Appliquer les changements CSS
        applyThemeColors(themeData);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur sauvegarde');
      }
    } catch (error) {
      showToast('error', error.message || 'Erreur lors de la sauvegarde');
      console.error(error);
      throw error; // Re-throw pour que le modal le gère
    } finally {
      setLoading(false);
    }
  };

  // Supprimer un thème
  const handleDeleteTheme = async (themeId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce thème ?')) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/themes/${themeId}`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });

      if (response.ok) {
        showToast('success', 'Thème supprimé');
        await loadCustomThemes();
      }
    } catch (error) {
      showToast('error', 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  // Appliquer les couleurs du thème
  const applyThemeColors = (themeData) => {
    if (!themeData.colors) return;

    const root = document.documentElement;
    Object.entries(themeData.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  };

  // Prévisualiser un thème
  const handlePreviewTheme = (themeData) => {
    setSelectedTheme(themeData);
    setShowPreview(true);
    applyThemeColors(themeData);
  };

  // Appliquer un thème
  const handleApplyTheme = (themeName) => {
    setTheme(themeName);
    showToast('success', `Thème "${themeName}" appliqué`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
            <SwatchIcon className="h-8 w-8 text-blue-600" />
            Gestion des Thèmes
          </h2>
          <p className="text-neutral-600 dark:text-neutral-300 mt-1">
            Personnalisez l'apparence de la plateforme
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleCreateTheme}
          leftIcon={<PlusIcon className="h-5 w-5" />}
        >
          Créer un thème
        </Button>
      </div>

      {/* Thème actuel */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-white dark:bg-neutral-800 rounded-xl shadow-lg">
            <SparklesIcon className="h-8 w-8 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              Thème actuel
            </h3>
            <p className="text-neutral-600 dark:text-neutral-300">
              <strong className="text-blue-600 dark:text-blue-400">{theme}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Thèmes par défaut */}
      <div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
          <SunIcon className="h-5 w-5" />
          Thèmes par défaut
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {defaultThemes.map((themeData) => {
            const Icon = themeData.icon;
            const isActive = theme === themeData.name;

            return (
              <div
                key={themeData.id}
                className={`
                  relative rounded-2xl p-6 border-2 transition-all cursor-pointer
                  ${isActive 
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950' 
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-400'
                  }
                `}
                onClick={() => handleApplyTheme(themeData.name)}
              >
                {isActive && (
                  <div className="absolute top-4 right-4">
                    <CheckIcon className="h-6 w-6 text-blue-600" />
                  </div>
                )}
                
                <div className="flex items-center gap-4 mb-4">
                  <div className={`p-3 rounded-xl ${isActive ? 'bg-blue-100 dark:bg-blue-900' : 'bg-neutral-100 dark:bg-neutral-700'}`}>
                    <Icon className={`h-6 w-6 ${isActive ? 'text-blue-600' : 'text-neutral-600 dark:text-neutral-300'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white">
                      {themeData.displayName}
                    </h4>
                  </div>
                </div>

                {themeData.colors && (
                  <div className="flex gap-2">
                    {Object.entries(themeData.colors).slice(0, 6).map(([key, color]) => (
                      <div
                        key={key}
                        className="w-8 h-8 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-600"
                        style={{ backgroundColor: color }}
                        title={key}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Thèmes personnalisés */}
      <div>
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
          <PaintBrushIcon className="h-5 w-5" />
          Thèmes personnalisés
        </h3>

        {customThemes.length === 0 ? (
          <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-600">
            <SwatchIcon className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
            <p className="text-neutral-600 dark:text-neutral-300 mb-4">
              Aucun thème personnalisé créé
            </p>
            <Button variant="secondary" onClick={handleCreateTheme}>
              Créer votre premier thème
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customThemes.map((themeData) => {
              const isActive = theme === themeData.name;

              return (
                <div
                  key={themeData.id}
                  className={`
                    relative rounded-2xl p-6 border-2 transition-all
                    ${isActive 
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950' 
                      : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                    }
                  `}
                >
                  {isActive && (
                    <div className="absolute top-4 right-4">
                      <CheckIcon className="h-6 w-6 text-blue-600" />
                    </div>
                  )}

                  <h4 className="font-bold text-neutral-900 dark:text-white mb-4">
                    {themeData.displayName}
                  </h4>

                  {/* Palette de couleurs */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(themeData.colors).map(([key, color]) => (
                      <div
                        key={key}
                        className="w-8 h-8 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-600"
                        style={{ backgroundColor: color }}
                        title={key}
                      />
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleApplyTheme(themeData.name)}
                      fullWidth
                    >
                      Appliquer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreviewTheme(themeData)}
                      leftIcon={<EyeIcon className="h-4 w-4" />}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditTheme(themeData)}
                      leftIcon={<PaintBrushIcon className="h-4 w-4" />}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteTheme(themeData.id)}
                      leftIcon={<TrashIcon className="h-4 w-4" />}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal d'édition avec color picker */}
      <ThemeEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedTheme(null);
        }}
        theme={selectedTheme}
        onSave={handleSaveThemeFromModal}
        isCreating={isCreating}
      />
    </div>
  );
};

export default ThemeManager;
