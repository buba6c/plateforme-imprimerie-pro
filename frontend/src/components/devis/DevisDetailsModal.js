import React, { useEffect, useMemo, useState } from 'react';
import {
  XMarkIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  CalendarIcon,
  UserIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { systemConfigService } from '../../services/api';
import { devisTemplates, defaultDocumentsSettings } from '../../utils/documentTemplates';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const DevisDetailsModal = ({ devis, isOpen, onClose }) => {
  const [viewMode, setViewMode] = useState('details'); // 'details' | 'preview'
  const [documentsSettings, setDocumentsSettings] = useState(defaultDocumentsSettings);
  const [companyInfo, setCompanyInfo] = useState({ name: 'Votre Entreprise', logo: '', address: '', email: '', phone: '' });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await systemConfigService.list();
        const params = res?.params || [];
        const map = {};
        params.forEach(p => { map[p.key] = p.value; });
        // documents_settings
        const rawDocs = map['documents_settings'];
        try {
          const parsed = typeof rawDocs === 'string' && rawDocs.trim().startsWith('{') ? JSON.parse(rawDocs) : rawDocs;
          if (parsed && typeof parsed === 'object') setDocumentsSettings({ ...defaultDocumentsSettings, ...parsed });
        } catch {}
        // company info
        const name = map['company_name'] || 'Votre Entreprise';
        const logo = map['company_logo'] || '';
        setCompanyInfo(ci => ({ ...ci, name, logo }));
      } catch {
        // silencieux si indisponible
      }
    };
    if (isOpen) {
      loadSettings();
      setViewMode('details');
    }
  }, [isOpen]);


  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatutBadge = (statut) => {
    const badges = {
      brouillon: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      en_attente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      valide: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      refuse: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      converti: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    };
    
    const labels = {
      brouillon: 'Brouillon',
      en_attente: 'En attente',
      valide: 'Validé',
      refuse: 'Refusé',
      converti: 'Converti'
    };
    
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${badges[statut]}`}>
        {labels[statut]}
      </span>
    );
  };

  const renderDataJson = () => {
    let dataJson;
    try {
      dataJson = typeof devis.data_json === 'string' ? JSON.parse(devis.data_json) : devis.data_json;
    } catch {
      return <p className="text-red-500">Erreur lors de l'affichage des données</p>;
    }

    if (devis.machine_type === 'roland') {
      return (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type de support</label>
              <p className="text-gray-900 dark:text-white">
                {dataJson.type_support}
                {dataJson.type_support === 'Autre' && dataJson.type_support_autre && (
                  <span className="text-gray-600 dark:text-gray-400"> ({dataJson.type_support_autre})</span>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Dimensions</label>
              <p className="text-gray-900 dark:text-white">
                {dataJson.largeur} × {dataJson.hauteur} {dataJson.unite}
                {dataJson.surface && (
                  <span className="text-sm text-blue-600 dark:text-blue-400"> ({dataJson.surface} m²)</span>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre d'exemplaires</label>
              <p className="text-gray-900 dark:text-white">{dataJson.nombre_exemplaires || 1}</p>
            </div>
            {dataJson.finition_oeillets && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Finition</label>
                <p className="text-gray-900 dark:text-white">
                  {dataJson.finition_oeillets}
                  {dataJson.finition_position && (
                    <span className="text-gray-600 dark:text-gray-400"> - {dataJson.finition_position}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (devis.machine_type === 'xerox') {
      return (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type de document</label>
              <p className="text-gray-900 dark:text-white">
                {dataJson.type_document}
                {dataJson.type_document === 'Autre' && dataJson.type_document_autre && (
                  <span className="text-gray-600 dark:text-gray-400"> ({dataJson.type_document_autre})</span>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Format</label>
              <p className="text-gray-900 dark:text-white">
                {dataJson.format}
                {dataJson.format === 'Personnalisé' && dataJson.format_personnalise && (
                  <span className="text-gray-600 dark:text-gray-400"> ({dataJson.format_personnalise})</span>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mode d'impression</label>
              <p className="text-gray-900 dark:text-white">
                {dataJson.mode_impression === 'recto_simple' ? 'Recto simple' : 'Recto-verso'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Couleur</label>
              <p className="text-gray-900 dark:text-white">
                {dataJson.couleur_impression === 'couleur' ? 'Couleur' : 'Noir & Blanc'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre d'exemplaires</label>
              <p className="text-gray-900 dark:text-white">{dataJson.nombre_exemplaires}</p>
            </div>
            {dataJson.grammage && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Grammage/Papier</label>
                <p className="text-gray-900 dark:text-white">
                  {dataJson.grammage}
                  {dataJson.grammage === 'Autre' && dataJson.grammage_autre && (
                    <span className="text-gray-600 dark:text-gray-400"> ({dataJson.grammage_autre})</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {dataJson.finition && dataJson.finition.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Finitions</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {dataJson.finition.map((f, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded text-sm">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {dataJson.faconnage && dataJson.faconnage.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Façonnages</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {dataJson.faconnage.map((f, index) => (
                  <span key={index} className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-sm">
                    {f}
                  </span>
                ))}
                {dataJson.faconnage.includes('Autre') && dataJson.faconnage_autre && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 rounded text-sm">
                    {dataJson.faconnage_autre}
                  </span>
                )}
              </div>
            </div>
          )}

          {dataJson.conditionnement && dataJson.conditionnement.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Conditionnement</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {dataJson.conditionnement.map((c, index) => (
                  <span key={index} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded text-sm">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return <p className="text-gray-500">Données non reconnues</p>;
  };

  const renderEstimationDetails = () => {
    if (!devis.details_prix) return null;

    let details;
    try {
      details = typeof devis.details_prix === 'string' ? JSON.parse(devis.details_prix) : devis.details_prix;
    } catch (error) {
      return null;
    }

    return (
      <div className="space-y-3">
        {details.base && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Prix de base</span>
            <span className="text-gray-900 dark:text-white font-medium">{details.base} FCFA</span>
          </div>
        )}
        {details.finitions > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Finitions</span>
            <span className="text-gray-900 dark:text-white font-medium">{details.finitions} FCFA</span>
          </div>
        )}
        {details.options > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Options</span>
            <span className="text-gray-900 dark:text-white font-medium">{details.options} FCFA</span>
          </div>
        )}
        {details.remises && details.remises < 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Remises</span>
            <span className="text-green-600 dark:text-green-400 font-medium">{details.remises} FCFA</span>
          </div>
        )}
      </div>
    );
  };

  const SelectedTemplate = useMemo(() => devisTemplates[documentsSettings.devis_template] || devisTemplates.simple, [documentsSettings]);

  const previewData = useMemo(() => {
    if (!devis) {
      return {
        company: { name: companyInfo.name, logo: companyInfo.logo, address: '', email: '', phone: '' },
        client: { name: 'Client', address: '', email: '', phone: '' },
        meta: { number: '', date: '', validUntil: '' },
        items: [],
        totals: { subtotal: 0, tax: 0, total: 0, currency: 'FCFA' },
        notes: ''
      };
    }
    // extraire data_json
    let dataJson = {};
    try { dataJson = typeof devis.data_json === 'string' ? JSON.parse(devis.data_json) : (devis.data_json || {}); } catch {}
    const qty = parseInt(dataJson.nombre_exemplaires || 1, 10) || 1;
    const total = Number(devis.prix_final || devis.prix_estime || 0) || 0;
    const unitPrice = qty > 0 ? Math.round(total / qty) : total;
    const description = devis.machine_type === 'roland'
      ? `Impression grand format • ${dataJson.type_support || ''} ${dataJson.largeur || ''}x${dataJson.hauteur || ''} ${dataJson.unite || ''}`.trim()
      : `Impression numérique • ${dataJson.type_document || ''} ${dataJson.format || ''}`.trim();
    return {
      company: {
        name: companyInfo.name,
        logo: companyInfo.logo,
        address: companyInfo.address,
        email: companyInfo.email,
        phone: companyInfo.phone,
      },
      client: {
        name: devis.client_nom || 'Client',
        address: '',
        email: devis.client_contact?.includes('@') ? devis.client_contact : '',
        phone: devis.client_contact && !devis.client_contact?.includes('@') ? devis.client_contact : '',
      },
      meta: {
        number: devis.numero,
        date: new Date(devis.created_at).toLocaleDateString('fr-FR'),
        validUntil: new Date(new Date(devis.created_at).getTime() + 30*24*3600*1000).toLocaleDateString('fr-FR'),
      },
      items: [
        { description, detail: '', qty, unitPrice, total }
      ],
      totals: { subtotal: total, tax: 0, total, currency: 'FCFA' },
      notes: devis.notes || '',
    };
  }, [devis, companyInfo]);

  const downloadPDFServer = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get(`${API_URL}/devis/${devis.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${devis.numero}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Erreur lors du téléchargement du PDF');
    }
  };

  const validateDevis = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir valider ce devis ? Il pourra ensuite être converti en dossier.')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      await axios.put(`${API_URL}/devis/${devis.id}`, {
        statut: 'valide',
        prix_final: devis.prix_estime // Utiliser le prix estimé comme prix final
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Devis validé avec succès !');
      onClose(); // Fermer le modal
      
      // Recharger pour mettre à jour la liste
      if (window.location.pathname.includes('/devis')) {
        window.location.reload();
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Erreur lors de la validation');
    }
  };

  const convertToFolder = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir convertir ce devis en dossier ? Cette action est irréversible.')) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(`${API_URL}/devis/${devis.id}/convert`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Devis converti en dossier avec succès !');
      onClose(); // Fermer le modal
      
      // Optionnel: rediriger vers les dossiers
      if (window.location.pathname.includes('/devis')) {
        window.location.reload(); // Recharger pour mettre à jour la liste
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Erreur lors de la conversion');
    }
  };

  const printPreview = () => {
    // Simple: utilise l'impression du navigateur
    window.print();
  };

  if (!isOpen || !devis) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-5xl w-full max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Devis {devis.numero}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {devis.machine_type === 'roland' ? 'Roland (Grand Format)' : 'Xerox (Numérique)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'details' ? 'preview' : 'details')}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {viewMode === 'details' ? 'Prévisualiser (modèle)' : 'Voir détails'}
            </button>
            {(devis.statut === 'brouillon' || devis.statut === 'en_attente') && (
              <button
                onClick={validateDevis}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                title="Valider le devis"
              >
                Valider le devis
              </button>
            )}
            {devis.statut === 'valide' && (
              <button
                onClick={convertToFolder}
                className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-700"
                title="Convertir en dossier"
              >
                Convertir en dossier
              </button>
            )}
            {viewMode === 'preview' && (
              <>
                <button
                  onClick={downloadPDFServer}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                  title="Télécharger PDF (serveur)"
                >
                  Télécharger PDF
                </button>
                <button
                  onClick={printPreview}
                  className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-black"
                  title="Imprimer depuis le navigateur"
                >
                  Imprimer
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-6 h-6 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {viewMode === 'preview' ? (
            <div id="devis-template-preview" className="bg-white dark:bg-neutral-900">
              <SelectedTemplate data={previewData} />
            </div>
          ) : (
            <>
            {/* Informations générales */}
            <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Client</h3>
              </div>
              <div className="pl-7 space-y-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nom</label>
                  <p className="text-gray-900 dark:text-white">{devis.client_nom || 'Non renseigné'}</p>
                </div>
                {devis.client_contact && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contact</label>
                    <p className="text-gray-900 dark:text-white">{devis.client_contact}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Informations</h3>
              </div>
              <div className="pl-7 space-y-2">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Statut</label>
                  <div className="mt-1">
                    {getStatutBadge(devis.statut)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Créé le</label>
                  <p className="text-gray-900 dark:text-white">{formatDate(devis.created_at)}</p>
                </div>
                {devis.updated_at !== devis.created_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Modifié le</label>
                    <p className="text-gray-900 dark:text-white">{formatDate(devis.updated_at)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Spécifications techniques */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <WrenchScrewdriverIcon className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Spécifications techniques</h3>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              {renderDataJson()}
            </div>
          </div>

          {/* Notes */}
          {devis.notes && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Notes</h3>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <p className="text-gray-700 dark:text-gray-300">{devis.notes}</p>
              </div>
            </div>
          )}

          {/* Prix et estimation */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CurrencyDollarIcon className="w-5 h-5 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Tarification</h3>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-4">
              {renderEstimationDetails()}
              
              <div className="border-t border-blue-200 dark:border-blue-800 pt-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-gray-900 dark:text-white">Prix estimé</span>
                    {devis.details_prix && JSON.parse(devis.details_prix)?.ia_used && (
                      <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <SparklesIcon className="w-4 h-4" />
                        <span className="text-xs">IA</span>
                      </div>
                    )}
                  </div>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {devis.prix_final || devis.prix_estime} FCFA
                  </span>
                </div>
              </div>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DevisDetailsModal;