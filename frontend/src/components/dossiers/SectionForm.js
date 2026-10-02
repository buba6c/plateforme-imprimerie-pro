import React, { useState } from 'react';
import { DocumentIcon } from '@heroicons/react/24/outline';

/**
 * Composant pour gérer une section Xerox (couverture, intérieur, etc.)
 * Design identique au formulaire Xerox principal avec mode sombre
 */
const SectionForm = ({ section, index, onUpdate, onRemove }) => {
  // Listes identiques au formulaire principal
  const xeroxFormats = ['A3', 'A4', 'A5', 'A6', 'Carte de visite (85x55mm)', '10x15cm', '13x18cm', '20x30cm', 'Personnalisé'];
  const xeroxGrammages = ['80g', '135g', '170g', '250g', '300g', '350g', 'Offset', 'Autocollant', 'Autre'];
  const xeroxFinitions = [
    'Pelliculage Brillant Recto',
    'Pelliculage Brillant Verso',
    'Pelliculage Mat Recto',
    'Pelliculage Mat Verso',
    'Vernis UV',
  ];
  const xeroxFaconnages = [
    'Coupe',
    'Piquée',
    'Dos carré',
    'Perforation',
    'Spirale',
    'Reliure',
    'Rabat',
    'Rainage',
    'Découpe forme',
    'Encochage',
    'Autre',
  ];

  const [formData, setFormData] = useState(section || {
    type: 'Intérieur',
    mode_impression: 'recto_verso',
    copies: 1,
    paper_types: [{ format: 'A4', couleur: 'nb', grammage: '80g', pages: 1 }],
    finitions: [],
    faconnage: []
  });

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(index, updated);
  };

  const handlePaperTypeChange = (ptIndex, field, value) => {
    const updatedPaperTypes = [...formData.paper_types];
    updatedPaperTypes[ptIndex] = { ...updatedPaperTypes[ptIndex], [field]: value };
    handleChange('paper_types', updatedPaperTypes);
  };

  const addPaperType = () => {
    const newPaperType = { format: 'A4', couleur: 'nb', grammage: '80g', pages: 1 };
    handleChange('paper_types', [...formData.paper_types, newPaperType]);
  };

  const removePaperType = (ptIndex) => {
    if (formData.paper_types.length > 1) {
      const updated = formData.paper_types.filter((_, i) => i !== ptIndex);
      handleChange('paper_types', updated);
    }
  };

  const toggleFinition = (finition) => {
    const updated = formData.finitions.includes(finition)
      ? formData.finitions.filter(f => f !== finition)
      : [...formData.finitions, finition];
    handleChange('finitions', updated);
  };

  const toggleFaconnage = (operation) => {
    const updated = formData.faconnage.includes(operation)
      ? formData.faconnage.filter(f => f !== operation)
      : [...formData.faconnage, operation];
    handleChange('faconnage', updated);
  };

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border-2 border-blue-300 dark:border-blue-600 p-6 mb-4 shadow-md">
      {/* En-tête avec numéro et bouton supprimer */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
        <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300 flex items-center gap-2">
          <DocumentIcon className="h-6 w-6" />
          Section {index + 1}: {formData.type}
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

      {/* Type de section */}
      <div className="mb-6">
        <label className="form-label">Type de section *</label>
        <select
          value={formData.type}
          onChange={(e) => handleChange('type', e.target.value)}
          className="form-input"
        >
          <option value="Couverture">Couverture</option>
          <option value="Intérieur">Intérieur</option>
          <option value="Affiche">Affiche</option>
          <option value="Flyer">Flyer</option>
          <option value="Brochure">Brochure</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mode d'impression */}
        <div>
          <fieldset>
            <legend className="form-label">Mode d'impression *</legend>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.mode_impression === 'recto_simple'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-neutral-200 dark:border-neutral-600 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name={`mode-${index}`}
                  value="recto_simple"
                  checked={formData.mode_impression === 'recto_simple'}
                  onChange={(e) => handleChange('mode_impression', e.target.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Recto simple
                </span>
              </label>
              <label
                className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.mode_impression === 'recto_verso'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-neutral-200 dark:border-neutral-600 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name={`mode-${index}`}
                  value="recto_verso"
                  checked={formData.mode_impression === 'recto_verso'}
                  onChange={(e) => handleChange('mode_impression', e.target.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Recto-verso
                </span>
              </label>
            </div>
          </fieldset>
        </div>

        {/* Nombre d'exemplaires */}
        <div>
          <label className="form-label">Nombre d'exemplaires *</label>
          <input
            type="number"
            min="1"
            value={formData.copies}
            onChange={(e) => handleChange('copies', parseInt(e.target.value) || 1)}
            className="form-input"
            placeholder="Ex: 100"
          />
        </div>
      </div>

      {/* Types de papier */}
      <div className="mt-6">
        <label className="form-label mb-3 block">Types de papier *</label>
        <div className="space-y-3">
          {formData.paper_types.map((pt, ptIndex) => (
            <div key={ptIndex} className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-600">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {/* Format */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Format
                  </label>
                  <select
                    value={pt.format}
                    onChange={(e) => handlePaperTypeChange(ptIndex, 'format', e.target.value)}
                    className="form-input text-sm"
                  >
                    {xeroxFormats.map(format => (
                      <option key={format} value={format}>{format}</option>
                    ))}
                  </select>
                </div>

                {/* Couleur */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Couleur
                  </label>
                  <select
                    value={pt.couleur}
                    onChange={(e) => handlePaperTypeChange(ptIndex, 'couleur', e.target.value)}
                    className="form-input text-sm"
                  >
                    <option value="couleur">Couleur</option>
                    <option value="nb">Noir & Blanc</option>
                  </select>
                </div>

                {/* Grammage */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Grammage
                  </label>
                  <select
                    value={pt.grammage}
                    onChange={(e) => handlePaperTypeChange(ptIndex, 'grammage', e.target.value)}
                    className="form-input text-sm"
                  >
                    {xeroxGrammages.map(grammage => (
                      <option key={grammage} value={grammage}>{grammage}</option>
                    ))}
                  </select>
                </div>

                {/* Pages */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Pages
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={pt.pages}
                      onChange={(e) => handlePaperTypeChange(ptIndex, 'pages', parseInt(e.target.value) || 1)}
                      className="form-input text-sm flex-1"
                    />
                    {formData.paper_types.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePaperType(ptIndex)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addPaperType}
          className="mt-3 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium flex items-center gap-1"
        >
          <span>➕</span>
          <span>Ajouter un type de papier</span>
        </button>
      </div>

      {/* Finitions */}
      <div className="mt-6">
        <label className="form-label mb-3 block">Finitions (optionnel)</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {xeroxFinitions.map(finition => (
            <label
              key={finition}
              className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded"
            >
              <input
                type="checkbox"
                checked={formData.finitions.includes(finition)}
                onChange={() => toggleFinition(finition)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-neutral-600 rounded"
              />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {finition}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Façonnage */}
      <div className="mt-6">
        <label className="form-label mb-3 block">Façonnage (optionnel)</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {xeroxFaconnages.map(faconnage => (
            <label
              key={faconnage}
              className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded"
            >
              <input
                type="checkbox"
                checked={formData.faconnage.includes(faconnage)}
                onChange={() => toggleFaconnage(faconnage)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-neutral-600 rounded"
              />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {faconnage}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SectionForm;
