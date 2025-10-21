import React, { useState } from 'react';
import FileUpload from './FileUpload';

const FileUploadExample = () => {
  const [showUpload, setShowUpload] = useState(false);

  const handleUpload = (files) => {
    console.log('📁 Fichiers uploadés (mode démo):', files.map(f => f.name));
    // En mode démo, on simule juste l'ajout à un état local
    alert(`✅ ${files.length} fichier(s) uploadé(s) avec succès (simulation)`);
    setShowUpload(false);
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-4">
          Gestionnaire de fichiers - Mode démonstration
        </h2>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-900 mb-2">🚀 Mode démonstration actif</h3>
          <p className="text-sm text-blue-800">
            Les fichiers sont simulés et ne sont pas réellement uploadés sur le serveur. 
            Cette démonstration montre l&apos;interface et le comportement attendu.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-800 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
            <h4 className="font-medium text-neutral-900 dark:text-white mb-2">Upload de fichiers</h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
              Testez l&apos;interface d&apos;upload avec la simulation intégrée.
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📤 Ouvrir l&apos;upload de fichiers
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">🔧 Configuration API</h4>
            <p className="text-sm text-amber-800">
              Pour activer l&apos;upload réel, configurez l&apos;API backend et passez{' '}
              <code className="bg-amber-100 px-1 rounded">demoMode={'{false}'}</code> au composant FileUpload.
            </p>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
            <h4 className="font-medium text-neutral-900 dark:text-white mb-2">📋 Fonctionnalités démontrées</h4>
            <ul className="text-sm text-neutral-600 dark:text-neutral-300 space-y-1">
              <li>• Interface drag & drop</li>
              <li>• Sélection multiple de fichiers</li>
              <li>• Barre de progression d&apos;upload</li>
              <li>• Gestion des erreurs</li>
              <li>• Validation des types de fichiers</li>
              <li>• Aperçu des statistiques</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Composant FileUpload en mode démonstration */}
      <FileUpload
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onUpload={handleUpload}
        currentPath="/exemple/dossier"
        demoMode={true} // Mode démonstration activé
      />
    </div>
  );
};

export default FileUploadExample;