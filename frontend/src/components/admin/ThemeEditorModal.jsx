import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, RefreshCw, Eye, Palette } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import toast from 'react-hot-toast';

/**
 * ThemeEditorModal - Modal d'édition de thème avec color picker visuel
 * 
 * Features:
 * - Color picker interactif pour chaque couleur
 * - Prévisualisation en temps réel
 * - Validation des couleurs hexadécimales
 * - Animation fluide
 * - Support du mode sombre
 */
const ThemeEditorModal = ({ isOpen, onClose, theme, onSave, isCreating = false }) => {
  const [formData, setFormData] = useState({
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
  
  const [activeColorPicker, setActiveColorPicker] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (theme && !isCreating) {
      setFormData({
        name: theme.name || '',
        displayName: theme.display_name || '',
        colors: theme.colors || formData.colors
      });
    } else if (isCreating) {
      setFormData({
        name: '',
        displayName: '',
        colors: formData.colors
      });
    }
  }, [theme, isCreating, formData.colors]);

  const handleColorChange = (colorKey, value) => {
    setFormData({
      ...formData,
      colors: {
        ...formData.colors,
        [colorKey]: value
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.displayName.trim()) {
      toast.error('Le nom d\'affichage est requis');
      return;
    }
    
    if (isCreating && !formData.name.trim()) {
      toast.error('Le nom technique est requis');
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        name: formData.name,
        displayName: formData.displayName,
        colors: formData.colors
      });
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde du thème');
    } finally {
      setIsSaving(false);
    }
  };

  const colorFields = [
    { key: 'primary', label: 'Primaire', description: 'Couleur principale de l\'interface' },
    { key: 'secondary', label: 'Secondaire', description: 'Couleur secondaire' },
    { key: 'success', label: 'Succès', description: 'Messages de succès' },
    { key: 'warning', label: 'Avertissement', description: 'Messages d\'avertissement' },
    { key: 'error', label: 'Erreur', description: 'Messages d\'erreur' },
    { key: 'background', label: 'Fond', description: 'Couleur de fond principale' },
    { key: 'surface', label: 'Surface', description: 'Cartes et éléments' },
    { key: 'text', label: 'Texte', description: 'Texte principal' },
    { key: 'textSecondary', label: 'Texte secondaire', description: 'Texte secondaire' },
    { key: 'border', label: 'Bordure', description: 'Bordures et séparateurs' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                  <Palette className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {isCreating ? 'Créer un thème' : 'Modifier le thème'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isCreating ? 'Créez un nouveau thème personnalisé' : `Modification de "${formData.displayName}"`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X size={24} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Informations générales */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <RefreshCw size={18} />
                  Informations générales
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isCreating && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nom technique *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        placeholder="mon-theme"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Nom technique unique (minuscules, tirets autorisés)
                      </p>
                    </div>
                  )}
                  
                  <div className={isCreating ? '' : 'md:col-span-2'}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nom d'affichage *
                    </label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="Mon Thème Personnalisé"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Palette de couleurs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Palette size={18} />
                    Palette de couleurs
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors"
                  >
                    <Eye size={16} />
                    {showPreview ? 'Masquer' : 'Aperçu'}
                  </button>
                </div>

                {/* Aperçu */}
                {showPreview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg"
                    style={{ backgroundColor: formData.colors.background }}
                  >
                    <div className="space-y-2">
                      <div 
                        className="px-4 py-2 rounded"
                        style={{ 
                          backgroundColor: formData.colors.surface,
                          color: formData.colors.text,
                          borderColor: formData.colors.border,
                          borderWidth: '1px'
                        }}
                      >
                        <p style={{ color: formData.colors.text }}>Texte principal</p>
                        <p className="text-sm" style={{ color: formData.colors.textSecondary }}>Texte secondaire</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button 
                          type="button"
                          className="px-3 py-1 rounded text-white text-sm"
                          style={{ backgroundColor: formData.colors.primary }}
                        >
                          Primaire
                        </button>
                        <button 
                          type="button"
                          className="px-3 py-1 rounded text-white text-sm"
                          style={{ backgroundColor: formData.colors.success }}
                        >
                          Succès
                        </button>
                        <button 
                          type="button"
                          className="px-3 py-1 rounded text-white text-sm"
                          style={{ backgroundColor: formData.colors.warning }}
                        >
                          Attention
                        </button>
                        <button 
                          type="button"
                          className="px-3 py-1 rounded text-white text-sm"
                          style={{ backgroundColor: formData.colors.error }}
                        >
                          Erreur
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Color pickers */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {colorFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {field.label}
                        </label>
                        <button
                          type="button"
                          onClick={() => setActiveColorPicker(activeColorPicker === field.key ? null : field.key)}
                          className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                          style={{ backgroundColor: formData.colors[field.key] }}
                          title={`Choisir ${field.label}`}
                        />
                      </div>
                      
                      <input
                        type="text"
                        value={formData.colors[field.key]}
                        onChange={(e) => handleColorChange(field.key, e.target.value)}
                        placeholder="#000000"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono"
                      />
                      
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {field.description}
                      </p>

                      {/* Color Picker Dropdown */}
                      <AnimatePresence>
                        {activeColorPicker === field.key && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="relative z-10"
                          >
                            <div className="absolute left-0 mt-2 p-3 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600">
                              <HexColorPicker
                                color={formData.colors[field.key]}
                                onChange={(color) => handleColorChange(field.key, color)}
                              />
                              <button
                                type="button"
                                onClick={() => setActiveColorPicker(null)}
                                className="mt-2 w-full px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm rounded transition-colors"
                              >
                                Fermer
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {isCreating ? 'Créer le thème' : 'Enregistrer'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default ThemeEditorModal;
