import React, { useState, useEffect } from 'react';
import { CalculatorIcon, SparklesIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const TarifManager = () => {
  const [tarifs, setTarifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [machineFilter, setMachineFilter] = useState('tous');

  useEffect(() => {
    fetchTarifs();
  }, []);

  const fetchTarifs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/tarifs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTarifs(response.data.tarifs || []);
    } catch (error) {
      console.error('Erreur chargement tarifs:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTarif = async (id) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.put(`${API_URL}/tarifs/${id}`, {
        valeur: parseFloat(editValue)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchTarifs();
      setEditingId(null);
      alert('Tarif mis à jour avec succès');
    } catch (error) {
      console.error('Erreur mise à jour tarif:', error);
      alert('Erreur lors de la mise à jour');
    }
  };

  const optimizeWithAI = async () => {
    if (!window.confirm('Lancer l\'optimisation IA des tarifs ?')) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(`${API_URL}/tarifs/optimize-ai`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        alert('Optimisation terminée. Consultez les suggestions.');
        console.log('Suggestions IA:', response.data);
      }
    } catch (error) {
      console.error('Erreur optimisation IA:', error);
      alert('Erreur lors de l\'optimisation IA');
    }
  };

  const filteredTarifs = machineFilter === 'tous' 
    ? tarifs 
    : tarifs.filter(t => t.type_machine === machineFilter);

  const groupedTarifs = filteredTarifs.reduce((acc, tarif) => {
    const key = `${tarif.type_machine}-${tarif.categorie}`;
    if (!acc[key]) {
      acc[key] = {
        type: tarif.type_machine,
        categorie: tarif.categorie,
        items: []
      };
    }
    acc[key].items.push(tarif);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestion des tarifs
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configurez les prix pour Roland, Xerox et options globales
          </p>
        </div>
        
        <button
          onClick={optimizeWithAI}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all"
        >
          <SparklesIcon className="w-5 h-5" />
          Optimiser avec IA
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-4">
        <select
          value={machineFilter}
          onChange={(e) => setMachineFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="tous">Toutes les machines</option>
          <option value="roland">Roland</option>
          <option value="xerox">Xerox</option>
          <option value="global">Global</option>
        </select>
      </div>

      {/* Tarifs groupés */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedTarifs).map((group, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              {/* Header du groupe */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full uppercase">
                    {group.type}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                    {group.categorie}
                  </h3>
                </div>
              </div>

              {/* Tableau des tarifs */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Tarif
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Description
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Prix
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Unité
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {group.items.map((tarif) => (
                      <tr key={tarif.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {tarif.label}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {tarif.description || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {editingId === tarif.id ? (
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-32 px-3 py-1 text-right border border-blue-500 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                              autoFocus
                            />
                          ) : (
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              {tarif.valeur} FCFA
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                          {tarif.unite || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {editingId === tarif.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => updateTarif(tarif.id)}
                                className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                              >
                                <CheckIcon className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              >
                                <XMarkIcon className="w-5 h-5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(tarif.id);
                                setEditValue(tarif.valeur);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TarifManager;
