import React from 'react';

/**
 * Composant d'affichage des supports Roland dans la vue détail
 */
const SupportsDisplay = ({ supports }) => {
  if (!supports || !Array.isArray(supports) || supports.length === 0) {
    return null;
  }

  const calculateSurface = (support) => {
    const { largeur, hauteur, unite } = support;
    let surface = 0;
    
    if (unite === 'cm') {
      surface = (largeur * hauteur) / 10000;
    } else if (unite === 'm') {
      surface = largeur * hauteur;
    } else {
      surface = (largeur * hauteur) / 1000000;
    }
    
    return surface.toFixed(4);
  };

  return (
    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mt-4">
      <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center">
        🖨️ Supports à imprimer ({supports.length})
      </h3>
      
      <div className="space-y-4">
        {supports.map((support, index) => (
          <div key={index} className="bg-white rounded-lg border border-green-300 p-4">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-semibold text-gray-800">
                Support {index + 1}: {support.type_support}
              </h4>
              <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                {support.exemplaires} ex.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Dimensions:</span>
                <span className="ml-2 font-medium">
                  {support.largeur} × {support.hauteur} {support.unite}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Surface:</span>
                <span className="ml-2 font-medium">{calculateSurface(support)} m²</span>
              </div>
              <div>
                <span className="text-gray-600">Exemplaires:</span>
                <span className="ml-2 font-medium">{support.exemplaires}</span>
              </div>
              <div>
                <span className="text-gray-600">Surface totale:</span>
                <span className="ml-2 font-medium">
                  {(parseFloat(calculateSurface(support)) * support.exemplaires).toFixed(4)} m²
                </span>
              </div>
            </div>

            {/* Finitions */}
            {support.finitions && support.finitions.length > 0 && (
              <div className="mt-3">
                <span className="text-sm text-gray-600">Finitions: </span>
                <span className="text-sm font-medium">
                  {support.finitions.join(', ')}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupportsDisplay;
