import React from 'react';
import SectionForm from './SectionForm';

/**
 * Composant conteneur pour gérer plusieurs sections Xerox
 * Permet d'ajouter, modifier, supprimer des sections dynamiquement
 */
const SectionsManager = ({ sections, onChange }) => {
  const handleAddSection = () => {
    const newSection = {
      type: 'Intérieur',
      mode_impression: 'recto_verso',
      copies: 1,
      paper_types: [{ format: 'A4', couleur: 'nb', grammage: '80', pages: 1 }],
      finitions: [],
      faconnage: []
    };
    onChange([...sections, newSection]);
  };

  const handleUpdateSection = (index, updatedSection) => {
    const updated = sections.map((section, i) => i === index ? updatedSection : section);
    onChange(updated);
  };

  const handleRemoveSection = (index) => {
    // Les sections sont optionnelles, on peut toutes les supprimer
    const updated = sections.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Affichage des sections existantes */}
      <div className="space-y-4">
        {sections.map((section, index) => (
          <SectionForm
            key={index}
            section={section}
            index={index}
            onUpdate={handleUpdateSection}
            onRemove={handleRemoveSection}
          />
        ))}
      </div>
    </div>
  );
};

export default SectionsManager;
