/**
 * DEBUG COMPOSANT DOSSIER
 * ======================
 * 
 * Composant de debug pour tester les appels API dossiers avec authentification
 */

import React, { useState } from 'react';
import { dossiersService } from '../services/api';
import { isAuthenticated, getAuthToken } from '../utils/authUtils';

const DossierDebugger = ({ dossierId, onClose }) => {
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const runDebugTest = async () => {
    setLoading(true);
    const debug = {
      timestamp: new Date().toISOString(),
      dossierId,
      auth: {
        isAuthenticated: isAuthenticated(),
        hasToken: !!getAuthToken(),
        tokenLength: getAuthToken()?.length || 0,
        tokenPreview: getAuthToken()?.substring(0, 20) + '...' || 'N/A'
      },
      tests: []
    };

    // Test 1: Vérifier l'authentification
    debug.tests.push({
      name: 'Auth Check',
      result: isAuthenticated() ? 'PASS' : 'FAIL',
      details: `Token présent: ${!!getAuthToken()}`
    });

    // Test 2: Appel getDossier
    try {
      console.log('🧪 Test getDossier avec ID:', dossierId);
      const response = await dossiersService.getDossier(dossierId);
      debug.tests.push({
        name: 'getDossier API Call',
        result: 'PASS',
        details: `Dossier récupéré: ${response?.dossier?.client_nom || response?.client_nom || 'Nom non trouvé'}`,
        data: response
      });
    } catch (err) {
      debug.tests.push({
        name: 'getDossier API Call',
        result: 'FAIL',
        details: `Erreur: ${err.message}`,
        error: {
          status: err?.response?.status,
          code: err?.response?.data?.code,
          message: err?.response?.data?.message,
          fullError: err
        }
      });
    }

    // Test 3: Appel getDossiers (liste)
    try {
      console.log('🧪 Test getDossiers (liste)');
      const response = await dossiersService.getDossiers({ limit: 1 });
      debug.tests.push({
        name: 'getDossiers API Call',
        result: 'PASS',
        details: `${response?.dossiers?.length || 0} dossier(s) dans la liste`,
        data: response?.dossiers?.[0] || response?.data?.[0]
      });
    } catch (err) {
      debug.tests.push({
        name: 'getDossiers API Call', 
        result: 'FAIL',
        details: `Erreur: ${err.message}`,
        error: err
      });
    }

    setDebugInfo(debug);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-white dark:bg-neutral-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">🧪 Debug Dossier API</h2>
              <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-200">
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p><strong>Dossier ID:</strong> {dossierId}</p>
              <button
                onClick={runDebugTest}
                disabled={loading}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Test en cours...' : '🚀 Lancer les tests'}
              </button>
            </div>

            {debugInfo && (
              <div className="space-y-4">
                <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded">
                  <h3 className="font-bold mb-2">🔐 Informations d'authentification</h3>
                  <pre className="text-sm overflow-x-auto">
                    {JSON.stringify(debugInfo.auth, null, 2)}
                  </pre>
                </div>

                <div>
                  <h3 className="font-bold mb-2">🧪 Résultats des tests</h3>
                  {debugInfo.tests.map((test, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded mb-2 ${
                        test.result === 'PASS' 
                          ? 'bg-success-100 text-green-800' 
                          : 'bg-error-100 text-red-800'
                      }`}
                    >
                      <div className="font-bold">
                        {test.result === 'PASS' ? '✅' : '❌'} {test.name}
                      </div>
                      <div className="text-sm mt-1">{test.details}</div>
                      
                      {test.error && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs">Voir l'erreur complète</summary>
                          <pre className="text-xs mt-1 overflow-x-auto bg-white dark:bg-neutral-800 p-2 rounded">
                            {JSON.stringify(test.error, null, 2)}
                          </pre>
                        </details>
                      )}
                      
                      {test.data && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs">Voir les données</summary>
                          <pre className="text-xs mt-1 overflow-x-auto bg-white dark:bg-neutral-800 p-2 rounded max-h-40">
                            {JSON.stringify(test.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DossierDebugger;