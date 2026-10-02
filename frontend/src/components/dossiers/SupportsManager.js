import React from 'react';
import SupportForm from './SupportForm';

/**
 * Composant conteneur pour gérer plusieurs supports Roland
 * Permet d'ajouter, modifier, supprimer des supports dynamiquement
 */
const SupportsManager = ({ supports, onChange }) => {
  const handleAddSupport = () => {
    const newSupport = {
      type_support: 'bache',
      largeur: 0,
      hauteur: 0,
      unite: 'm',
      exemplaires: 1,
      finitions: []
    };
    onChange([...supports, newSupport]);
  };

  const handleUpdateSupport = (index, updatedSupport) => {
    const updated = supports.map((support, i) => i === index ? updatedSupport : support);
    onChange(updated);
  };

  const handleRemoveSupport = (index) => {
    // Les supports sont optionnels, on peut tous les supprimer
    const updated = supports.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Affichage des supports existants */}
      <div className="space-y-4">
        {supports.map((support, index) => (
          <SupportForm
            key={index}
            support={support}
            index={index}
            onUpdate={handleUpdateSupport}
            onRemove={handleRemoveSupport}
          />
        ))}
      </div>
    </div>
  );
};

export default SupportsManager;
