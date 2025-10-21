import React, { useState, useMemo, useEffect } from 'react';
import {
  DocumentTextIcon,
  SparklesIcon,
  CheckIcon,
  XMarkIcon,
  PrinterIcon,
  ArrowLeftIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import axios from 'axios';
import DevisCreationAI from './DevisCreationAI';
import DevisPrintTemplate from './DevisPrintTemplate';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const DevisCreation = ({ user, onNavigate }) => {
  const [step, setStep] = useState(1);
  const [machineType, setMachineType] = useState(null);
  const [creationMode, setCreationMode] = useState(null); // 'form', 'ai', ou 'import'
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [createdDevis, setCreatedDevis] = useState(null); // Pour afficher le devis créé
  const [showPrint, setShowPrint] = useState(false);

  // États pour l'estimation en temps réel
  const [estimationRealtime, setEstimationRealtime] = useState(null);
  const [estimationLoading, setEstimationLoading] = useState(false);
  const [estimationError, setEstimationError] = useState(null);

  // Informations client
  const [clientInfo, setClientInfo] = useState({
    client_nom: '',
    client_contact: '',
    notes: '',
  });

  // État du formulaire Roland
  const [rolandData, setRolandData] = useState({
    client: '',
    type_support: '',
    type_support_autre: '',
    largeur: '',
    hauteur: '',
    unite: 'cm',
    nombre_exemplaires: '1',
    finition_oeillets: '',
    finition_position: '',
  });

  // État du formulaire Xerox
  const [xeroxData, setXeroxData] = useState({
    client: '',
    type_document: '',
    type_document_autre: '',
    format: '',
    format_personnalise: '',
    mode_impression: 'recto_simple',
    nombre_exemplaires: '100',
    couleur_impression: 'couleur',
    grammage: '',
    grammage_autre: '',
    finition: [],
    faconnage: [],
    faconnage_autre: '',
    numerotation: false,
    debut_numerotation: '',
    nombre_chiffres: '',
    conditionnement: [],
  });

  // Options Roland
  const rolandTypesSupport = [
    'Bâche',
    'Vinyle',
    'Vinyle Transparent',
    'Micro-perforé',
    'Tissu',
    'Backlit',
    'Mesh',
    'Pré-découpe',
    'Kakemono',
    'Autre',
  ];

  const rolandFinitionsOeillets = ['Collage', 'Découpé', 'Oeillet'];
  const rolandPositions = ['Angles seulement', 'Tous les côtés'];

  // Options Xerox
  const xeroxTypesDocument = [
    'Carte de visite',
    'Flyer',
    'Brochure',
    'Dépliant',
    'Affiche',
    'Catalogue',
    'Autre',
  ];

  const xeroxFormats = [
    'A3',
    'A4',
    'A5',
    'A6',
    'Carte de visite (85x55mm)',
    'Carte de visite (90x50mm)',
    '10x15cm',
    '13x18cm',
    '20x30cm',
    '21x29.7cm (A4)',
    '30x40cm',
    'Personnalisé',
  ];

  const xeroxGrammages = [
    '135g',
    '170g',
    '250g',
    '300g',
    '350g',
    'Offset',
    'Autocollant',
    'Grimat',
    'Autre',
  ];

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

  const xeroxConditionnements = ['En liasse de 50', 'En liasse de 100', 'Filmé', 'Étiqueté'];

  // Calcul automatique de la surface en m²
  const calculatedSurface = useMemo(() => {
    const { largeur, hauteur, unite } = rolandData;
    if (!largeur || !hauteur) return 0;

    let w = parseFloat(largeur);
    let h = parseFloat(hauteur);

    if (isNaN(w) || isNaN(h)) return 0;

    // Conversion en mètres
    if (unite === 'mm') {
      w = w / 1000;
      h = h / 1000;
    } else if (unite === 'cm') {
      w = w / 100;
      h = h / 100;
    }

    return (w * h).toFixed(2);
  }, [rolandData.largeur, rolandData.hauteur, rolandData.unite]);

  // Handlers pour Roland
  const handleRolandChange = (name, value) => {
    setRolandData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handlers pour Xerox
  const handleXeroxChange = (name, value) => {
    setXeroxData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleXeroxCheckbox = (name, option, checked) => {
    setXeroxData(prev => ({
      ...prev,
      [name]: checked ? [...prev[name], option] : prev[name].filter(item => item !== option),
    }));
  };

  // Estimation en temps réel
  useEffect(() => {
    // Déclencher estimation uniquement en mode formulaire et quand on a des données
    if (creationMode !== 'form' || !machineType) {
      setEstimationRealtime(null);
      return;
    }

    const estimateRealtime = async () => {
      try {
        setEstimationLoading(true);
        setEstimationError(null);

        const formData = machineType === 'roland' ? rolandData : xeroxData;

        // Vérifier qu'on a au moins les champs obligatoires
        if (machineType === 'roland' && (!formData.largeur || !formData.hauteur)) {
          setEstimationRealtime(null);
          setEstimationLoading(false);
          return;
        }

        if (machineType === 'xerox' && (!formData.type_document || !formData.format)) {
          setEstimationRealtime(null);
          setEstimationLoading(false);
          return;
        }

        const token = localStorage.getItem('auth_token');
        const result = await axios.post(
          `${API_URL}/devis/estimate-realtime`,
          { formData, machineType },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setEstimationRealtime(result.data);
      } catch (error) {
        setEstimationError(error.response?.data?.message || error.message);
        setEstimationRealtime(null);
      } finally {
        setEstimationLoading(false);
      }
    };

    // Délai de debounce pour éviter trop d'appels API
    const timeoutId = setTimeout(() => {
      estimateRealtime();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [rolandData, xeroxData, machineType, creationMode]);

  // Validation du formulaire
  const validateForm = () => {
    const newErrors = {};

    if (!clientInfo.client_nom.trim()) {
      newErrors.client_nom = 'Nom du client requis';
    }

    if (machineType === 'roland') {
      if (!rolandData.type_support) {
        newErrors.type_support = 'Type de support requis';
      }
      if (!rolandData.largeur || parseFloat(rolandData.largeur) <= 0) {
        newErrors.largeur = 'Largeur valide requise';
      }
      if (!rolandData.hauteur || parseFloat(rolandData.hauteur) <= 0) {
        newErrors.hauteur = 'Hauteur valide requise';
      }
    }

    if (machineType === 'xerox') {
      if (!xeroxData.type_document) {
        newErrors.type_document = 'Type de document requis';
      }
      if (!xeroxData.format) {
        newErrors.format = 'Format requis';
      }
      if (!xeroxData.nombre_exemplaires || parseInt(xeroxData.nombre_exemplaires) <= 0) {
        newErrors.nombre_exemplaires = 'Nombre d\'exemplaires valide requis';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Création du devis
  const handleCreate = async () => {
    if (!validateForm()) {
      alert('Veuillez remplir tous les champs requis');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');

      if (!token) {
        alert('Session expirée. Veuillez vous reconnecter.');
        return;
      }

      const dataJson = machineType === 'roland' ? rolandData : xeroxData;

      const response = await axios.post(
        `${API_URL}/devis`,
        {
          machine_type: machineType,
          data_json: dataJson,
          client_nom: clientInfo.client_nom,
          client_contact: clientInfo.client_contact,
          notes: clientInfo.notes,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      alert('✅ Devis créé avec succès !');
      if (onNavigate) onNavigate('mes-devis');
    } catch (error) {
      console.error('Erreur création devis:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Erreur lors de la création du devis';
      alert(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Rendu Step 1: Sélection du mode de création
  const renderStep1 = () => (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Créer un devis
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Choisissez comment vous souhaitez créer votre devis
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Mode 1: Formulaire standard */}
        <button
          onClick={() => {
            setCreationMode('form');
            setStep(2);
          }}
          className="bg-white dark:bg-gray-800 p-8 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-all group h-full"
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <DocumentTextIcon className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Formulaire détaillé
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Remplissez tous les détails pour Roland ou Xerox
            </p>
            <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 p-2 rounded">
              ⚡ Édition en temps réel avec estimation
            </div>
          </div>
        </button>

        {/* Mode 2: Description IA */}
        <button
          onClick={() => {
            setCreationMode('ai');
            setStep(3);
          }}
          className="bg-white dark:bg-gray-800 p-8 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all group h-full"
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <SparklesIcon className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Description texte (IA)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Décrivez simplement votre besoin, l'IA se charge du reste
            </p>
            <div className="text-xs text-gray-500 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-700">
              🤖 Analyse IA + Prix automatique
            </div>
          </div>
        </button>

        {/* Mode 3: Import (futur) */}
        <button
          disabled
          className="bg-white dark:bg-gray-800 p-8 rounded-xl border-2 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed h-full"
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <DocumentTextIcon className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Importer devis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Importer depuis PDF ou Excel
            </p>
            <div className="text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded">
              ⏳ Bientôt disponible
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  // Rendu Step 2: Sélection du type de machine (formulaire uniquement)
  const renderStep2Machine = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Choisir le type de machine
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Sélectionnez la machine pour créer votre devis
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Roland */}
        <button
          onClick={() => {
            setMachineType('roland');
            setStep(3);
          }}
          className="bg-white dark:bg-gray-800 p-8 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-all group"
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <PrinterIcon className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Roland (Grand Format)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bâches, vinyle, enseignes, kakemonos, etc.
            </p>
          </div>
        </button>

        {/* Xerox */}
        <button
          onClick={() => {
            setMachineType('xerox');
            setStep(3);
          }}
          className="bg-white dark:bg-gray-800 p-8 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
        >
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <DocumentTextIcon className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Xerox (Numérique)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cartes de visite, flyers, brochures, catalogues, etc.
            </p>
          </div>
        </button>
      </div>

      {/* Bouton retour */}
      <div className="mt-8 text-center">
        <button
          onClick={() => setStep(1)}
          className="px-6 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Retour
        </button>
      </div>
    </div>
  );

  // Rendu Step 3: Formulaire complet avec estimation à droite
  const renderStep2 = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Retour
          </button>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Devis {machineType === 'roland' ? '🖨️ Roland' : '📄 Xerox'}
          </h2>
          <div className="w-20"></div>
        </div>

        {/* Layout deux colonnes: Formulaire à gauche, Estimation à droite */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* COLONNE 1-2: FORMULAIRE */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-8">
              {/* Informations client */}
              <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  📋 Informations Client
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nom du client *
                    </label>
                    <input
                      type="text"
                      value={clientInfo.client_nom}
                      onChange={e => setClientInfo({ ...clientInfo, client_nom: e.target.value })}
                      className={`w-full px-4 py-2 border ${errors.client_nom ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
                      placeholder="Nom du client"
                      required
                    />
                    {errors.client_nom && (
                      <p className="text-red-500 text-sm mt-1">{errors.client_nom}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contact
                    </label>
                    <input
                      type="text"
                      value={clientInfo.client_contact}
                      onChange={e => setClientInfo({ ...clientInfo, client_contact: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Téléphone ou email"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes / Instructions
                  </label>
                  <textarea
                    value={clientInfo.notes}
                    onChange={e => setClientInfo({ ...clientInfo, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    rows="3"
                    placeholder="Notes ou instructions particulières..."
                  />
                </div>
              </div>

              {/* Formulaire spécifique */}
              {machineType === 'roland' ? renderRolandForm() : renderXeroxForm()}

              {/* Boutons d'action */}
              <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900"
                  disabled={loading}
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <SparklesIcon className="w-5 h-5 animate-spin" />
                      Création en cours...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-5 h-5" />
                      Créer le devis
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* COLONNE 3: ESTIMATION STICKY À DROITE */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              {/* Titre estimation */}
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <SparklesIcon className="w-6 h-6 text-amber-500" />
                Estimation
              </h3>

              {/* Contenu estimation */}
              <div className="space-y-4">
                {estimationLoading && (
                  <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3">
                    <div className="animate-spin">
                      <SparklesIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-200">Calcul...</p>
                  </div>
                )}
                
                {estimationError && !estimationLoading && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-200">❌ {estimationError}</p>
                  </div>
                )}
                
                {estimationRealtime && !estimationLoading && (
                  <div className="p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/40 dark:to-green-900/40 border-2 border-emerald-400 dark:border-emerald-600 rounded-lg shadow-lg">
                    <div className="space-y-4">
                      {/* Prix principal */}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Prix Total</p>
                        <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-300 mt-2">
                          {estimationRealtime.prix_estime?.toLocaleString('fr-FR')}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">FCFA</p>
                      </div>

                      {/* Infos de calcul */}
                      <div className="pt-4 border-t border-emerald-200 dark:border-emerald-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 dark:text-gray-400">⚡ Calcul</span>
                          <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{estimationRealtime.calculation_time_ms}ms</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600 dark:text-gray-400">Source</span>
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            {estimationRealtime.from_cache ? '📦 Cache' : '🔄 Live'}
                          </span>
                        </div>
                      </div>

                      {/* Détails si disponibles */}
                      {estimationRealtime.details && estimationRealtime.details.base && (
                        <div className="pt-4 border-t border-emerald-200 dark:border-emerald-700">
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Détails</p>
                          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                            {estimationRealtime.details.base.support && (
                              <div className="flex justify-between">
                                <span>{estimationRealtime.details.base.support.type}</span>
                                <span className="font-mono">{estimationRealtime.details.base.support.prix_total?.toLocaleString()} F</span>
                              </div>
                            )}
                            {estimationRealtime.details.base.dimensions && (
                              <div className="flex justify-between">
                                <span>{estimationRealtime.details.base.dimensions.surface_m2} m²</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!estimationRealtime && !estimationLoading && !estimationError && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      👉 Complétez le formulaire pour voir l'estimation
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Formulaire Roland
  const renderRolandForm = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        🖨️ Spécifications Roland (Grand Format)
      </h3>

      {/* Type de support */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Type de support *
        </label>
        <select
          value={rolandData.type_support}
          onChange={e => handleRolandChange('type_support', e.target.value)}
          className={`w-full px-4 py-2 border ${errors.type_support ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
          required
        >
          <option value="">-- Sélectionner --</option>
          {rolandTypesSupport.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {errors.type_support && (
          <p className="text-red-500 text-sm mt-1">{errors.type_support}</p>
        )}
      </div>

      {/* Si "Autre" */}
      {rolandData.type_support === 'Autre' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Précisez le type *
          </label>
          <input
            type="text"
            value={rolandData.type_support_autre}
            onChange={e => handleRolandChange('type_support_autre', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Ex: Canvas, PVC, etc."
          />
        </div>
      )}

      {/* Dimensions */}
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Largeur *
          </label>
          <input
            type="number"
            value={rolandData.largeur}
            onChange={e => handleRolandChange('largeur', e.target.value)}
            className={`w-full px-4 py-2 border ${errors.largeur ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
            placeholder="Ex: 200"
            required
          />
          {errors.largeur && (
            <p className="text-red-500 text-sm mt-1">{errors.largeur}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Hauteur *
          </label>
          <input
            type="number"
            value={rolandData.hauteur}
            onChange={e => handleRolandChange('hauteur', e.target.value)}
            className={`w-full px-4 py-2 border ${errors.hauteur ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
            placeholder="Ex: 300"
            required
          />
          {errors.hauteur && (
            <p className="text-red-500 text-sm mt-1">{errors.hauteur}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Unité
          </label>
          <select
            value={rolandData.unite}
            onChange={e => handleRolandChange('unite', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="mm">mm</option>
            <option value="cm">cm</option>
            <option value="m">m</option>
          </select>
        </div>
      </div>

      {/* Surface calculée */}
      {calculatedSurface > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            📐 Surface calculée : <strong>{calculatedSurface} m²</strong>
          </p>
        </div>
      )}

      {/* Estimation en temps réel - VISIBLE EN HAUT */}
      <div>
        {estimationLoading && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
            <div className="animate-spin">
              <SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-200">
              Calcul de l'estimation en cours...
            </p>
          </div>
        )}
        
        {estimationError && !estimationLoading && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-200">
              ❌ Erreur lors du calcul: {estimationError}
            </p>
          </div>
        )}
        
        {estimationRealtime && !estimationLoading && (
          <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  💰 Prix Estimé
                </p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                  {estimationRealtime.prix_estime?.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                <p>⚡ {estimationRealtime.from_cache ? 'Cache' : 'Calcul direct'}</p>
                <p>{estimationRealtime.calculation_time_ms}ms</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Nombre d'exemplaires */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Nombre d'exemplaires
        </label>
        <input
          type="number"
          value={rolandData.nombre_exemplaires}
          onChange={e => handleRolandChange('nombre_exemplaires', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="1"
          min="1"
        />
      </div>

      {/* Finitions */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Type de finition
          </label>
          <select
            value={rolandData.finition_oeillets}
            onChange={e => handleRolandChange('finition_oeillets', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">-- Sélectionner --</option>
            {rolandFinitionsOeillets.map(finition => (
              <option key={finition} value={finition}>
                {finition}
              </option>
            ))}
          </select>
        </div>

        {rolandData.finition_oeillets && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Position
            </label>
            <select
              value={rolandData.finition_position}
              onChange={e => handleRolandChange('finition_position', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">-- Sélectionner --</option>
              {rolandPositions.map(position => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );

  // Formulaire Xerox
  const renderXeroxForm = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
        📄 Spécifications Xerox (Impression Numérique)
      </h3>

      {/* Type de document */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Type de document *
        </label>
        <select
          value={xeroxData.type_document}
          onChange={e => handleXeroxChange('type_document', e.target.value)}
          className={`w-full px-4 py-2 border ${errors.type_document ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
          required
        >
          <option value="">-- Sélectionner --</option>
          {xeroxTypesDocument.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {errors.type_document && (
          <p className="text-red-500 text-sm mt-1">{errors.type_document}</p>
        )}
      </div>

      {/* Si "Autre" */}
      {xeroxData.type_document === 'Autre' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Précisez le type *
          </label>
          <input
            type="text"
            value={xeroxData.type_document_autre}
            onChange={e => handleXeroxChange('type_document_autre', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Ex: Calendrier, Poster..."
          />
        </div>
      )}

      {/* Format */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Format *
        </label>
        <select
          value={xeroxData.format}
          onChange={e => handleXeroxChange('format', e.target.value)}
          className={`w-full px-4 py-2 border ${errors.format ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
          required
        >
          <option value="">-- Sélectionner --</option>
          {xeroxFormats.map(format => (
            <option key={format} value={format}>
              {format}
            </option>
          ))}
        </select>
        {errors.format && (
          <p className="text-red-500 text-sm mt-1">{errors.format}</p>
        )}
      </div>

      {/* Format personnalisé */}
      {xeroxData.format === 'Personnalisé' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Format personnalisé *
          </label>
          <input
            type="text"
            value={xeroxData.format_personnalise}
            onChange={e => handleXeroxChange('format_personnalise', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Ex: 15x21cm"
          />
        </div>
      )}

      {/* Mode impression + Couleur + Nombre */}
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Mode d'impression
          </label>
          <select
            value={xeroxData.mode_impression}
            onChange={e => handleXeroxChange('mode_impression', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="recto_simple">Recto simple</option>
            <option value="recto_verso">Recto-verso</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Couleur
          </label>
          <select
            value={xeroxData.couleur_impression}
            onChange={e => handleXeroxChange('couleur_impression', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="couleur">Couleur</option>
            <option value="nb">Noir & Blanc</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Nombre d'exemplaires *
          </label>
          <input
            type="number"
            value={xeroxData.nombre_exemplaires}
            onChange={e => handleXeroxChange('nombre_exemplaires', e.target.value)}
            className={`w-full px-4 py-2 border ${errors.nombre_exemplaires ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'} rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
            placeholder="Ex: 100"
            min="1"
            required
          />
          {errors.nombre_exemplaires && (
            <p className="text-red-500 text-sm mt-1">{errors.nombre_exemplaires}</p>
          )}
        </div>
      </div>

      {/* Grammage */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Grammage / Papier
        </label>
        <select
          value={xeroxData.grammage}
          onChange={e => handleXeroxChange('grammage', e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">-- Sélectionner --</option>
          {xeroxGrammages.map(gram => (
            <option key={gram} value={gram}>
              {gram}
            </option>
          ))}
        </select>
      </div>

      {/* Si Autre grammage */}
      {xeroxData.grammage === 'Autre' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Précisez le grammage
          </label>
          <input
            type="text"
            value={xeroxData.grammage_autre}
            onChange={e => handleXeroxChange('grammage_autre', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Ex: 400g"
          />
        </div>
      )}

      {/* Finitions (checkboxes) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Finitions
        </label>
        <div className="grid md:grid-cols-2 gap-2">
          {xeroxFinitions.map(finition => (
            <label key={finition} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={xeroxData.finition.includes(finition)}
                onChange={e => handleXeroxCheckbox('finition', finition, e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{finition}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Façonnages (checkboxes) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Façonnages
        </label>
        <div className="grid md:grid-cols-3 gap-2">
          {xeroxFaconnages.map(fac => (
            <label key={fac} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={xeroxData.faconnage.includes(fac)}
                onChange={e => handleXeroxCheckbox('faconnage', fac, e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{fac}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Si Autre façonnage */}
      {xeroxData.faconnage.includes('Autre') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Précisez le façonnage
          </label>
          <input
            type="text"
            value={xeroxData.faconnage_autre}
            onChange={e => handleXeroxChange('faconnage_autre', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Ex: Agrafage..."
          />
        </div>
      )}

      {/* Conditionnement */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Conditionnement
        </label>
        <div className="grid md:grid-cols-2 gap-2">
          {xeroxConditionnements.map(cond => (
            <label key={cond} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={xeroxData.conditionnement.includes(cond)}
                onChange={e => handleXeroxCheckbox('conditionnement', cond, e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{cond}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Estimation en temps réel - VISIBLE EN HAUT */}
      <div>
        {estimationLoading && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
            <div className="animate-spin">
              <SparklesIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-200">
              Calcul de l'estimation en cours...
            </p>
          </div>
        )}
        
        {estimationError && !estimationLoading && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-200">
              ❌ Erreur lors du calcul: {estimationError}
            </p>
          </div>
        )}
        
        {estimationRealtime && !estimationLoading && (
          <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  💰 Prix Estimé
                </p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                  {estimationRealtime.prix_estime?.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                <p>⚡ {estimationRealtime.from_cache ? 'Cache' : 'Calcul direct'}</p>
                <p>{estimationRealtime.calculation_time_ms}ms</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2Machine()}
      {step === 3 && creationMode === 'ai' && (
        <DevisCreationAI
          user={user}
          onBack={() => {
            setStep(1);
            setCreationMode(null);
          }}
          onSuccess={(devis) => {
            setCreatedDevis(devis);
            setShowPrint(true);
          }}
        />
      )}
      {step === 3 && creationMode !== 'ai' && renderStep2()}
      {showPrint && createdDevis && (
        <DevisPrintTemplate devis={createdDevis} user={user} />
      )}
    </div>
  );
};

export default DevisCreation;
