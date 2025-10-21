import React, { useState, useEffect } from 'react';
import { 
  BanknotesIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  ArrowPathIcon,
  BellAlertIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const AdminPaiementsDashboard = () => {
  const [paiements, setPaiements] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('tous');
  const [dossiersNonPayes, setDossiersNonPayes] = useState([]);
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    fetchPaiements();
    fetchDossiersNonPayes();
  }, [filter]);

  const fetchPaiements = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const params = filter !== 'tous' ? { statut: filter } : {};
      
      const response = await axios.get(`${API_URL}/paiements`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      
      setPaiements(response.data.paiements || []);
      setStats(response.data.stats || {});
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDossiersNonPayes = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/paiements/rappels/dossiers-non-payes`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { jours: 3 }
      });
      
      setDossiersNonPayes(response.data.dossiers_non_payes || []);
    } catch (error) {
      console.error('Erreur chargement dossiers non payés:', error);
    }
  };

  const approuverPaiement = async (paiementId) => {
    const commentaire = prompt('Commentaire (optionnel) :');
    
    try {
      setProcessing(prev => ({ ...prev, [paiementId]: 'approving' }));
      const token = localStorage.getItem('auth_token');
      
      await axios.post(`${API_URL}/paiements/${paiementId}/approuver`, {
        commentaire
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('✅ Paiement approuvé avec succès');
      fetchPaiements();
    } catch (error) {
      console.error('Erreur approbation:', error);
      alert(`❌ ${error.response?.data?.error || 'Erreur lors de l\'approbation'}`);
    } finally {
      setProcessing(prev => ({ ...prev, [paiementId]: null }));
    }
  };

  const refuserPaiement = async (paiementId) => {
    const raison = prompt('Raison du refus (obligatoire) :');
    if (!raison) return;
    
    try {
      setProcessing(prev => ({ ...prev, [paiementId]: 'refusing' }));
      const token = localStorage.getItem('auth_token');
      
      await axios.post(`${API_URL}/paiements/${paiementId}/refuser`, {
        raison
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('✅ Paiement refusé');
      fetchPaiements();
    } catch (error) {
      console.error('Erreur refus:', error);
      alert(`❌ ${error.response?.data?.error || 'Erreur lors du refus'}`);
    } finally {
      setProcessing(prev => ({ ...prev, [paiementId]: null }));
    }
  };

  const getStatutBadge = (statut) => {
    const badges = {
      en_attente: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', label: '⏳ En attente' },
      approuve: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', label: '✅ Approuvé' },
      refuse: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', label: '❌ Refusé' },
    };
    
    const badge = badges[statut] || badges.en_attente;
    
    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getModePaiementIcon = (mode) => {
    const icons = {
      wave: '💙',
      orange_money: '🧡',
      virement: '🏦',
      cheque: '🧾',
      especes: '💵',
      carte: '💳'
    };
    return icons[mode] || '💰';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <BanknotesIcon className="w-8 h-8 text-green-600" />
            Gestion des Paiements
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Approuvez ou refusez les paiements en attente
          </p>
        </div>
        <button
          onClick={() => {
            fetchPaiements();
            fetchDossiersNonPayes();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg font-medium"
        >
          <ArrowPathIcon className="w-5 h-5" />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-5 border border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total paiements</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{stats.total || 0}</p>
            </div>
            <BanknotesIcon className="w-10 h-10 text-blue-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-5 border border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Montant approuvé</p>
              <p className="text-xl font-bold text-green-900 dark:text-green-100 mt-1">
                {parseInt(stats.total_approuve || 0).toLocaleString('fr-FR')} F
              </p>
            </div>
            <CheckCircleIcon className="w-10 h-10 text-green-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30 rounded-xl p-5 border border-yellow-200 dark:border-yellow-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">En attente</p>
              <p className="text-xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">
                {parseInt(stats.total_en_attente || 0).toLocaleString('fr-FR')} F
              </p>
            </div>
            <ClockIcon className="w-10 h-10 text-yellow-600 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 rounded-xl p-5 border border-red-200 dark:border-red-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Refusé</p>
              <p className="text-xl font-bold text-red-900 dark:text-red-100 mt-1">
                {parseInt(stats.total_refuse || 0).toLocaleString('fr-FR')} F
              </p>
            </div>
            <XCircleIcon className="w-10 h-10 text-red-600 opacity-50" />
          </div>
        </div>
      </div>

      {/* Rappels dossiers non payés */}
      {dossiersNonPayes.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <BellAlertIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                ⚠️ Rappels : {dossiersNonPayes.length} dossier(s) non payé(s) depuis plus de 3 jours
              </h3>
              <div className="space-y-2">
                {dossiersNonPayes.slice(0, 5).map(d => (
                  <div key={d.folder_id} className="text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                    <span className="font-mono font-semibold">{d.numero_commande}</span>
                    <span>•</span>
                    <span>{d.client_nom}</span>
                    <span>•</span>
                    <span className="font-bold">{parseInt(d.prix_final || 0).toLocaleString('fr-FR')} F</span>
                    {d.prenom && d.nom && (
                      <>
                        <span>•</span>
                        <span className="text-yellow-700 dark:text-yellow-400">{d.prenom} {d.nom}</span>
                      </>
                    )}
                  </div>
                ))}
                {dossiersNonPayes.length > 5 && (
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 italic">
                    ... et {dossiersNonPayes.length - 5} autre(s)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2">
        {['tous', 'en_attente', 'approuve', 'refuse'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {f === 'tous' ? 'Tous' : f === 'en_attente' ? 'En attente' : f === 'approuve' ? 'Approuvés' : 'Refusés'}
          </button>
        ))}
      </div>

      {/* Liste des paiements */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      ) : paiements.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
          <BanknotesIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-600 dark:text-gray-400">Aucun paiement trouvé</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {paiements.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {getStatutBadge(p.statut)}
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      {parseInt(p.montant).toLocaleString('fr-FR')} FCFA
                    </span>
                    <span className="text-xl">
                      {getModePaiementIcon(p.mode_paiement)}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {p.mode_paiement?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Type</span>
                      <span className="text-gray-900 dark:text-white font-medium capitalize">
                        {p.type || 'N/A'}
                      </span>
                    </div>

                    {p.dossier_numero && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Dossier</span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">
                          {p.dossier_numero}
                        </span>
                      </div>
                    )}

                    {p.facture_numero && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Facture</span>
                        <span className="text-purple-600 dark:text-purple-400 font-semibold">
                          {p.facture_numero}
                        </span>
                      </div>
                    )}

                    {p.dossier_client && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Client</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {p.dossier_client}
                        </span>
                      </div>
                    )}

                    {p.prenom && p.nom && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Préparateur</span>
                        <span className="text-gray-900 dark:text-white">
                          {p.prenom} {p.nom}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block mb-1">Date</span>
                      <span className="text-gray-900 dark:text-white">
                        {new Date(p.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>

                    {p.reference_transaction && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Référence</span>
                        <span className="text-gray-900 dark:text-white font-mono text-xs">
                          {p.reference_transaction}
                        </span>
                      </div>
                    )}
                  </div>

                  {p.commentaire && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        💬 <span className="font-medium">Commentaire:</span> {p.commentaire}
                      </p>
                    </div>
                  )}

                  {p.raison_refus && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                      <p className="text-sm text-red-700 dark:text-red-300">
                        ❌ <span className="font-medium">Raison du refus:</span> {p.raison_refus}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {p.statut === 'en_attente' && (
                  <div className="ml-4 flex flex-col gap-2">
                    <button
                      onClick={() => approuverPaiement(p.id)}
                      disabled={processing[p.id] === 'approving'}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg font-medium disabled:opacity-50"
                    >
                      <CheckCircleIcon className="w-5 h-5" />
                      {processing[p.id] === 'approving' ? 'Approbation...' : 'Approuver'}
                    </button>
                    
                    <button
                      onClick={() => refuserPaiement(p.id)}
                      disabled={processing[p.id] === 'refusing'}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-md hover:shadow-lg font-medium disabled:opacity-50"
                    >
                      <XCircleIcon className="w-5 h-5" />
                      {processing[p.id] === 'refusing' ? 'Refus...' : 'Refuser'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPaiementsDashboard;
