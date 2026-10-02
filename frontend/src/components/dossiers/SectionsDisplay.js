import React from 'react';

/**
 * Composant d'affichage des sections Xerox dans la vue détail
 */
const SectionsDisplay = ({ sections }) => {
  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mt-4">
      <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center">
        📑 Sections du document ({sections.length})
      </h3>
      
      <div className="space-y-4">
        {sections.map((section, index) => (
          <div key={index} className="bg-white rounded-lg border border-blue-300 p-4">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-semibold text-gray-800">
                Section {index + 1}: {section.type}
              </h4>
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {section.copies} ex.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Mode:</span>
                <span className="ml-2 font-medium">
                  {section.mode_impression === 'recto_verso' ? 'Recto-verso' : 'Recto simple'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Exemplaires:</span>
                <span className="ml-2 font-medium">{section.copies}</span>
              </div>
            </div>

            {/* Types de papier */}
            {section.paper_types && section.paper_types.length > 0 && (
              <div className="mt-3">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Papiers:</h5>
                <div className="space-y-1">
                  {section.paper_types.map((pt, ptIndex) => (
                    <div key={ptIndex} className="text-sm bg-gray-50 p-2 rounded flex justify-between">
                      <span>
                        {pt.format || 'A4'} • {pt.couleur === 'couleur' ? 'Couleur' : 'Noir & Blanc'}
                        {pt.grammage && ` • ${pt.grammage}g`}
                      </span>
                      <span className="text-gray-600">{pt.pages} pages</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Finitions */}
            {section.finitions && section.finitions.length > 0 && (
              <div className="mt-3">
                <span className="text-sm text-gray-600">Finitions: </span>
                <span className="text-sm font-medium">
                  {section.finitions.join(', ')}
                </span>
              </div>
            )}

            {/* Façonnage */}
            {section.faconnage && section.faconnage.length > 0 && (
              <div className="mt-2">
                <span className="text-sm text-gray-600">Façonnage: </span>
                <span className="text-sm font-medium">
                  {section.faconnage.join(', ')}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SectionsDisplay;
