import React, { useState, useEffect } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';

/**
 * Composant pour gérer un support Roland (bâche, vinyle, etc.)
 * Design identique au formulaire Roland principal avec mode sombre
 */
const SupportForm = ({ support, index, onUpdate, onRemove }) => {
  // Listes identiques au formulaire principal
  const rolandTypesSupport = [
    'Bâche',
    'Vinyle',
    'Vinyle Transparent',
    'Micro-perforé',
    'Tissu',
    'Backlit',
    'Mesh',
    'Pré-découpe',
    'Kakemono',
    'Autre',
  ];
  const rolandFinitionsOeillets = ['Collage', 'Découpé', 'Oeillet'];
  const rolandPositions = ['Angles seulement', 'Tous les côtés'];

  const [formData, setFormData] = useState(support || {
    type_support: 'Bâche',
    type_support_autre: '',
    largeur: '',
    hauteur: '',
    unite: 'cm',
    nombre_exemplaires: '1',
    finition_oeillets: '',
    finition_position: ''
  });

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(index, updated);
  };

  // Calcul de la surface
  const calculateSurface = () => {
    const largeur = parseFloat(formData.largeur) || 0;
    const hauteur = parseFloat(formData.hauteur) || 0;
    
    if (formData.unite === 'cm') {
      return (largeur * hauteur) / 10000; // cm² → m²
    } else if (formData.unite === 'm') {
      return largeur * hauteur;
    }
    return 0;
  };

  const surfaceM2 = calculateSurface();

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border-2 border-green-300 dark:border-green-600 p-6 mb-4 shadow-md">
      {/* En-tête avec numéro et bouton supprimer */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-lg font-bold text-green-900 dark:text-green-300 flex items-center gap-2">
          <PrinterIcon className="h-6 w-6" />
          Support {index + 1}: {formData.type_support}
        </h3>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <span>🗑️</span>
          <span>Supprimer</span>
        </button>
      </div>

      {/* Type de support */}
      <div className="mb-6">
        <label className="form-label">Type de support *</label>
        <select
          value={formData.type_support}
          onChange={(e) => handleChange('type_support', e.target.value)}
          className="form-input"
        >
          {rolandTypesSupport.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        {formData.type_support === 'Autre' && (
          <input
            type="text"
            value={formData.type_support_autre}
            onChange={(e) => handleChange('type_support_autre', e.target.value)}
            className="form-input mt-2"
            placeholder="Préciser le type de support"
          />
        )}
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="form-label">Largeur *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.largeur}
            onChange={(e) => handleChange('largeur', e.target.value)}
            className="form-input"
            placeholder="Ex: 100"
          />
        </div>

        <div>
          <label className="form-label">Hauteur *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.hauteur}
            onChange={(e) => handleChange('hauteur', e.target.value)}
            className="form-input"
            placeholder="Ex: 150"
          />
        </div>

        <div>
          <label className="form-label">Unité *</label>
          <select
            value={formData.unite}
            onChange={(e) => handleChange('unite', e.target.value)}
            className="form-input"
          >
            <option value="cm">Centimètres (cm)</option>
            <option value="m">Mètres (m)</option>
          </select>
        </div>
      </div>

      {/* Affichage de la surface calculée */}
      {surfaceM2 > 0 && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            📐 Surface calculée: {surfaceM2.toFixed(4)} m²
          </p>
        </div>
      )}

      {/* Nombre d'exemplaires */}
      <div className="mb-6">
        <label className="form-label">Nombre d'exemplaires *</label>
        <input
          type="number"
          min="1"
          value={formData.nombre_exemplaires}
          onChange={(e) => handleChange('nombre_exemplaires', e.target.value)}
          className="form-input"
          placeholder="Ex: 1"
        />
      </div>

      {/* Finitions - Oeillets */}
      <div className="mb-6">
        <fieldset>
          <legend className="form-label">Oeillets (optionnel)</legend>
          <div className="grid grid-cols-3 gap-3">
            {rolandFinitionsOeillets.map(finition => (
              <label
                key={finition}
                className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.finition_oeillets === finition
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-neutral-200 dark:border-neutral-600 hover:border-green-300'
                }`}
              >
                <input
                  type="radio"
                  name={`finition-${index}`}
                  value={finition}
                  checked={formData.finition_oeillets === finition}
                  onChange={(e) => handleChange('finition_oeillets', e.target.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {finition}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Position des oeillets (si applicable) */}
      {formData.finition_oeillets && formData.finition_oeillets !== 'Collage' && (
        <div className="mb-6">
          <fieldset>
            <legend className="form-label">Position</legend>
            <div className="grid grid-cols-2 gap-3">
              {rolandPositions.map(position => (
                <label
                  key={position}
                  className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.finition_position === position
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-neutral-200 dark:border-neutral-600 hover:border-green-300'
                  }`}
                >
                  <input
                    type="radio"
                    name={`position-${index}`}
                    value={position}
                    checked={formData.finition_position === position}
                    onChange={(e) => handleChange('finition_position', e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                    {position}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
};

export default SupportForm;
