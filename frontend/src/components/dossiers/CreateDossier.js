import React, { useState, useEffect, useMemo } from 'react';
import {
  PlusIcon,
  PrinterIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  DocumentIcon,
  CloudArrowUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { dossiersService } from '../../services/apiAdapter';
import SectionsManager from './SectionsManager';
import SupportsManager from './SupportsManager';
import filesService from '../../services/filesService';
import dossierHistoryService from '../../services/dossierHistoryService';
import notificationService from '../../services/notificationService';

const CreateDossier = ({ isOpen, onClose, onSuccess }) => {
  const [selectedType, setSelectedType] = useState('roland');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [files, setFiles] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState('');

  // Mode édition
  const [editMode, setEditMode] = useState(false);
  const [dossierToEdit, setDossierToEdit] = useState(null);

  // Nouveaux champs communs
  const [description, setDescription] = useState('');
  const [telephoneClient, setTelephoneClient] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  // État du formulaire Roland
  const [rolandData, setRolandData] = useState({
    client: '',
    type_support: '',
    type_support_autre: '',
    largeur: '',
    hauteur: '',
    unite: 'cm',
    nombre_exemplaires: '',
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
    nombre_exemplaires: '',
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

  
  // ✅ NOUVEAU: États pour sections multiples et amount (vides par défaut, optionnels)
  const [sections, setSections] = useState([]);
  const [supports, setSupports] = useState([]);
  const [amount, setAmount] = useState(null);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    setCurrentUser(userData);
  }, []);

  // Écouter l'événement pour ouvrir en mode édition
  useEffect(() => {
    const handleEditDossier = (event) => {
      const dossier = event.detail;
      if (!dossier) {
        console.error('❌ Aucun dossier fourni pour édition');
        return;
      }

      console.log('📝 Mode édition activé pour le dossier:', dossier);

      setEditMode(true);
      setDossierToEdit(dossier);

      // Pré-remplir les champs communs
      setDescription(dossier.description_travail || dossier.description || '');
      setTelephoneClient(dossier.telephone_client || '');
      setIsUrgent(dossier.urgence || dossier.urgent || false);
      setAmount(dossier.montant_cfa || dossier.amount || null);

      // Pré-remplir sections/supports si présents
      setSections(dossier.sections || []);
      setSupports(dossier.supports || []);

      // Déterminer le type et pré-remplir les données
      const formData = dossier.form_data || dossier.data_formulaire || {};
      const dossierType = (dossier.type_formulaire || dossier.type || dossier.machine || '').toLowerCase();
      
      console.log('📋 Type de dossier détecté:', dossierType);
      console.log('📋 Données formulaire:', formData);
      
      // Détection du type: Roland ou Xerox
      if (dossierType.includes('roland') || formData.type_support) {
        console.log('✅ Mode ROLAND détecté');
        setSelectedType('roland');
        setRolandData({
          client: dossier.nom_client || dossier.client_nom || dossier.client || '',
          type_support: formData.type_support || '',
          type_support_autre: formData.type_support_autre || '',
          largeur: formData.largeur || '',
          hauteur: formData.hauteur || '',
          unite: formData.unite || 'cm',
          nombre_exemplaires: formData.nombre_exemplaires || formData.exemplaires || '',
          finition_oeillets: formData.finition_oeillets || '',
          finition_position: formData.finition_position || '',
        });
      } else {
        console.log('✅ Mode XEROX détecté');
        setSelectedType('xerox');
        setXeroxData({
          client: dossier.nom_client || dossier.client_nom || dossier.client || '',
          type_document: formData.type_document || '',
          type_document_autre: formData.type_document_autre || '',
          format: formData.format || '',
          format_personnalise: formData.format_personnalise || '',
          mode_impression: formData.mode_impression || 'recto_simple',
          nombre_exemplaires: formData.nombre_exemplaires || formData.nombre_copies || '',
          couleur_impression: formData.couleur_impression || 'couleur',
          grammage: formData.grammage || '',
          grammage_autre: formData.grammage_autre || '',
          finition: Array.isArray(formData.finition) ? formData.finition : [],
          faconnage: Array.isArray(formData.faconnage) ? formData.faconnage : [],
          faconnage_autre: formData.faconnage_autre || '',
          numerotation: formData.numerotation || false,
          debut_numerotation: formData.debut_numerotation || '',
          nombre_chiffres: formData.nombre_chiffres || '',
          conditionnement: Array.isArray(formData.conditionnement) ? formData.conditionnement : [],
        });
      }

      console.log('✅ Pré-remplissage terminé, prêt pour édition');
    };

    window.addEventListener('editDossier', handleEditDossier);
    return () => window.removeEventListener('editDossier', handleEditDossier);
  }, []);

  // Presets rapides
  const presets = {
    carte_visite: {
      type: 'xerox',
      label: '📇 Carte de visite',
      data: {
        type_document: 'Carte de visite',
        format: 'Carte de visite (85x55mm)',
        mode_impression: 'recto_verso',
        nombre_exemplaires: '100',
        couleur_impression: 'couleur',
        grammage: '350g',
        finition: ['Pelliculage Mat Recto', 'Pelliculage Mat Verso'],
      },
    },
    flyer_a5: {
      type: 'xerox',
      label: '📄 Flyer A5',
      data: {
        type_document: 'Flyer',
        format: 'A5',
        mode_impression: 'recto_simple',
        nombre_exemplaires: '1000',
        couleur_impression: 'couleur',
        grammage: '170g',
        finition: [],
      },
    },
    brochure_a4: {
      type: 'xerox',
      label: '📖 Brochure A4 piquée',
      data: {
        type_document: 'Brochure',
        format: 'A4',
        mode_impression: 'recto_verso',
        nombre_exemplaires: '200',
        couleur_impression: 'couleur',
        grammage: '170g',
        faconnage: ['Piquée'],
      },
    },
    bache_3x1: {
      type: 'roland',
      label: '🏭️ Bâche extérieure 3x1m',
      data: {
        type_support: 'Bâche',
        largeur: '300',
        hauteur: '100',
        unite: 'cm',
        finition_oeillets: 'Découpé',
        finition_position: 'Tous les côtés',
      },
    },
    vinyle_vitrine: {
      type: 'roland',
      label: '🪟 Vinyle vitrine',
      data: {
        type_support: 'Vinyle',
        largeur: '200',
        hauteur: '80',
        unite: 'cm',
        finition_oeillets: 'Collage',
      },
    },
  };

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

  const xeroxConditionnements = ['En liasse de 50', 'En liasse de 100', 'Filmé', 'Étiqueté'];

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
    setRolandData(prev => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handlers pour Xerox
  const handleXeroxChange = (name, value) => {
    setXeroxData(prev => ({
      ...prev,
      [name]: value,
    }));

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

  // Handler pour les fichiers
  const handleFileUpload = e => {
    const uploadedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...uploadedFiles]);
  };

  const removeFile = index => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Appliquer un preset
  const applyPreset = presetKey => {
    const preset = presets[presetKey];
    if (!preset) return;

    setSelectedType(preset.type);
    
    if (preset.type === 'roland') {
      setRolandData(prev => ({ ...prev, ...preset.data }));
    } else {
      setXeroxData(prev => ({ ...prev, ...preset.data }));
    }
    
    setSelectedPreset(presetKey);
  };

  const validateForm = () => {
    const newErrors = {};

    // Description maintenant facultative - pas de validation

    if (selectedType === 'roland') {
      if (!rolandData.client.trim()) {
        newErrors.client = 'Nom du client requis';
      }
      if (!rolandData.type_support) {
        newErrors.type_support = 'Type de support requis';
      }
      if (rolandData.type_support === 'Autre' && !rolandData.type_support_autre.trim()) {
        newErrors.type_support_autre = 'Précisez le type de support';
      }
      if (!rolandData.largeur || parseFloat(rolandData.largeur) <= 0) {
        newErrors.largeur = 'Largeur valide requise';
      }
      if (!rolandData.hauteur || parseFloat(rolandData.hauteur) <= 0) {
        newErrors.hauteur = 'Hauteur valide requise';
      }
      if (!rolandData.nombre_exemplaires || parseInt(rolandData.nombre_exemplaires) <= 0) {
        newErrors.nombre_exemplaires = "Nombre d'exemplaires valide requis";
      }
    } else {
      if (!xeroxData.client.trim()) {
        newErrors.client = 'Nom du client requis';
      }
      if (!xeroxData.type_document) {
        newErrors.type_document = 'Type de document requis';
      }
      if (xeroxData.type_document === 'Autre' && !xeroxData.type_document_autre.trim()) {
        newErrors.type_document_autre = 'Précisez le type de document';
      }
      if (!xeroxData.format) {
        newErrors.format = 'Format requis';
      }
      if (xeroxData.format === 'Personnalisé' && !xeroxData.format_personnalise.trim()) {
        newErrors.format_personnalise = 'Précisez les dimensions';
      }
      if (!xeroxData.mode_impression) {
        newErrors.mode_impression = "Mode d'impression requis";
      }
      if (!xeroxData.nombre_exemplaires || parseInt(xeroxData.nombre_exemplaires) <= 0) {
        newErrors.nombre_exemplaires = "Nombre d'exemplaires valide requis";
      }
      if (!xeroxData.grammage) {
        newErrors.grammage = 'Grammage requis';
      }
      if (xeroxData.grammage === 'Autre' && !xeroxData.grammage_autre.trim()) {
        newErrors.grammage_autre = 'Précisez le grammage';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateNumero = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `${selectedType.toUpperCase()}-${year}${month}${day}-${random}`;
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Préparer les données JSON attendues par l'API
      const dataToSend = selectedType === 'roland'
        ? { ...rolandData, surface_m2: calculatedSurface }
        : { ...xeroxData };

      const payload = {
        client: selectedType === 'roland' ? rolandData.client : xeroxData.client,
        type_formulaire: selectedType,
        data_formulaire: dataToSend,
        description: description.trim(),
        telephone_client: telephoneClient.trim() || null,
        urgent: isUrgent,
        // ✅ Toujours envoyer sections/supports si présents (plus de condition toggle)
        ...(selectedType === 'xerox' && sections.length > 0 && { sections }),
        ...(selectedType === 'roland' && supports.length > 0 && { supports }),
        ...(amount !== null && amount > 0 && { amount: parseFloat(amount) || null }),
      };

      let finalDossier;

      if (editMode && dossierToEdit) {
        // MODE ÉDITION - Mise à jour du dossier existant
        console.log('📝 CreateDossier - Mise à jour dossier:', dossierToEdit.id);
        
        // Récupérer l'utilisateur actuel
        const currentUserData = JSON.parse(localStorage.getItem('user_data') || '{}');
        
        // Pour la mise à jour, créer un payload complet avec tous les champs modifiables
        const updatePayload = {
          client: payload.client,
          telephone_client: payload.telephone_client,
          description: payload.description,
          urgent: payload.urgent,
          data_formulaire: payload.data_formulaire,
        };
        
        // Ajouter le montant seulement s'il est défini
        if (payload.amount !== null && payload.amount !== undefined) {
          updatePayload.amount = payload.amount;
        }
        
        console.log('🔍 Payload de mise à jour:', JSON.stringify(updatePayload, null, 2));
        
        // Enregistrer les modifications AVANT la mise à jour
        const oldData = {
          client: dossierToEdit.nom_client || dossierToEdit.client_nom || dossierToEdit.client,
          telephone_client: dossierToEdit.telephone_client,
          description: dossierToEdit.description_travail || dossierToEdit.description,
          urgent: dossierToEdit.urgence || dossierToEdit.urgent,
          amount: dossierToEdit.montant_cfa || dossierToEdit.amount,
          form_data: dossierToEdit.form_data || dossierToEdit.data_formulaire || {},
        };

        const newData = {
          client: updatePayload.client,
          telephone_client: updatePayload.telephone_client,
          description: updatePayload.description,
          urgent: updatePayload.urgent,
          amount: updatePayload.amount,
          data_formulaire: updatePayload.data_formulaire,
        };
        
        // Comparer les modifications pour générer un commentaire
        const changes = dossierHistoryService.compareObjects(oldData, newData);
        
        // Mettre à jour le dossier
        const updateRes = await dossiersService.updateDossier(dossierToEdit.id, updatePayload);
        finalDossier = updateRes?.dossier || updateRes;
        
        // Enregistrer les modifications dans l'historique
        if (changes.length > 0) {
          const changeComment = dossierHistoryService.generateChangeComment(changes, currentUserData);
          console.log('📝 Modifications effectuées:', changeComment);
          
          // Enregistrer dans l'historique
          await dossierHistoryService.recordChanges(
            dossierToEdit.id,
            oldData,
            newData,
            currentUserData
          );
        }
        
        notificationService.success('Dossier mis à jour avec succès');
        console.log('✅ CreateDossier - Dossier mis à jour avec succès');
        
        // Notifier les autres composants que le dossier a été mis à jour
        console.log('📡 CreateDossier - Dispatch événement dossierUpdated pour ID:', dossierToEdit.id);
        window.dispatchEvent(new CustomEvent('dossierUpdated', { 
          detail: { dossierId: dossierToEdit.id, dossier: finalDossier } 
        }));
        console.log('✅ CreateDossier - Événement dossierUpdated dispatché');
      } else {
        // MODE CRÉATION - Créer un nouveau dossier
        console.log('🆕 CreateDossier - Création nouveau dossier');
        
        const createRes = await dossiersService.createDossier(payload);
        finalDossier = createRes?.dossier || createRes;
        notificationService.success('Dossier créé avec succès');
        console.log('✅ CreateDossier - Nouveau dossier créé');
      }

      // 2) Si des fichiers ont été sélectionnés, les uploader via l'endpoint dédié (création uniquement)
      if (files.length > 0 && !editMode) {
        try {
          await filesService.uploadFiles(finalDossier, files);
          // eslint-disable-next-line no-console
          console.log('CreateDossier - Upload fichiers terminé');
        } catch (uploadErr) {
          // Ne pas bloquer la création si l'upload échoue, mais informer l'utilisateur
          // eslint-disable-next-line no-console
          console.error('Erreur lors de l\'upload des fichiers:', uploadErr);
          setErrors(prev => ({
            ...prev,
            general:
              prev.general ||
              (uploadErr?.error || "Création OK, mais l'upload des fichiers a échoué. Vous pouvez réessayer depuis les détails du dossier."),
          }));
        }
      }

      // 3) Succès global
      // En mode édition, on ne ferme pas et on ne notifie pas DossierManagement
      // car DossierDetails va se recharger automatiquement via l'événement
      if (!editMode) {
        onSuccess(finalDossier);
      }
      onClose();

      // Reset edit mode
      setEditMode(false);
      setDossierToEdit(null);

      // Reset forms
      setRolandData({
        client: '',
        type_support: '',
        type_support_autre: '',
        largeur: '',
        hauteur: '',
        unite: 'cm',
        nombre_exemplaires: '',
        finition_oeillets: '',
        finition_position: '',
      });

      setXeroxData({
        client: '',
        type_document: '',
        type_document_autre: '',
        format: '',
        format_personnalise: '',
        mode_impression: 'recto_simple',
        nombre_exemplaires: '',
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

      setFiles([]);
      setErrors({});
      setSelectedPreset('');
      setDescription('');
      setTelephoneClient('');
      setIsUrgent(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Erreur création dossier:', err);
      setErrors({ general: err.error || 'Erreur lors de la création du dossier' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentDate = new Date().toLocaleDateString('fr-FR');
  const generatedNumero = generateNumero();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-500 bg-opacity-75">
      <div 
        className="fixed inset-0" 
        onClick={onClose}
      ></div>

      <div className="relative bg-white dark:bg-neutral-800 rounded-lg shadow-xl dark:shadow-secondary-900/30 w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`flex-shrink-0 px-6 py-4 rounded-t-lg ${
          selectedType === 'roland'
            ? 'bg-gradient-to-r from-red-600 to-red-700'
            : 'bg-gradient-to-r from-blue-600 to-blue-700'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                {editMode ? (
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                ) : (
                  <PlusIcon className="h-6 w-6 text-white" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {editMode ? '✏️ Modifier le dossier' : `Formulaire ${selectedType === 'roland' ? 'Roland' : 'Xerox'} Standard`}
                </h3>
                <p className="text-blue-100 text-sm">
                  {editMode ? `Dossier #${dossierToEdit?.id || dossierToEdit?.folder_id}` : 'Nouveau dossier d\'impression'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-white hover:text-blue-200 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Sélecteur de type */}
          <div className="mt-4 flex space-x-4">
            <button
              type="button"
              onClick={() => setSelectedType('roland')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedType === 'roland'
                  ? 'bg-white text-error-700 shadow-lg dark:shadow-secondary-900/25'
                  : 'bg-error-600 text-white hover:bg-error-700'
              }`}
            >
              🖨️ Roland (Grand Format)
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('xerox')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedType === 'xerox'
                  ? 'bg-white text-blue-700 shadow-lg dark:shadow-secondary-900/25'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              📄 Xerox (Numérique)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Erreur générale */}
            {errors.general && (
              <div className="mb-6 bg-danger-50 border border-danger-200 rounded-lg p-4">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-danger-400" />
                  <div className="ml-3">
                    <p className="text-sm text-danger-800">{errors.general}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Presets rapides */}
            <div className="mb-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Presets rapides
                </h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {Object.entries(presets).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPreset(key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedPreset === key
                        ? 'bg-purple-600 text-white shadow-lg dark:shadow-secondary-900/25'
                        : 'bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-purple-100 dark:hover:bg-purple-800 border border-purple-200 dark:border-purple-600'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Informations auto-générées - MASQUÉ PAR L'UTILISATEUR */}
            {/* <div className="bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-lg mb-6 border border-neutral-200 dark:border-neutral-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">N°:</span>
                  <span className="ml-2 text-neutral-900 dark:text-neutral-100">{generatedNumero}</span>
                </div>
                <div>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Date de réception:
                  </span>
                  <span className="ml-2 text-neutral-900 dark:text-neutral-100">{currentDate}</span>
                </div>
                <div>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Préparateur:
                  </span>
                  <span className="ml-2 text-neutral-900 dark:text-neutral-100">
                    {currentUser?.nom || 'Utilisateur'}
                  </span>
                </div>
              </div>
            </div> */}

            {/* Client et Téléphone côte à côte */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="client-input" className="form-label">
                  Client * <span className="text-xs text-neutral-500">(Nom ou entreprise)</span>
                </label>
                <input
                  id="client-input"
                  type="text"
                  value={selectedType === 'roland' ? rolandData.client : xeroxData.client}
                  onChange={e =>
                    selectedType === 'roland'
                      ? handleRolandChange('client', e.target.value)
                      : handleXeroxChange('client', e.target.value)
                  }
                  className={`form-input ${errors.client ? 'border-danger-300 focus:border-danger-500' : ''}`}
                  placeholder="Nom du client ou de l'entreprise"
                />
                {errors.client && <p className="form-error">{errors.client}</p>}
              </div>

              {/* Téléphone Client (conditionnel selon le rôle) */}
              {(currentUser?.role === 'admin' || currentUser?.role === 'preparateur' || currentUser?.role === 'livreur') && (
                <div>
                  <label htmlFor="telephone-input" className="form-label">
                    Téléphone du client <span className="text-xs text-neutral-500">(Optionnel)</span>
                  </label>
                  <input
                    id="telephone-input"
                    type="tel"
                    value={telephoneClient}
                    onChange={e => setTelephoneClient(e.target.value)}
                    className="form-input"
                    placeholder="Ex: +33 6 12 34 56 78"
                  />
                </div>
              )}
            </div>

            {/* ✅ MONTANT (intégré directement, visible selon rôle) */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'preparateur' || currentUser?.role === 'livreur') && (
              <div className="mb-6">
                <label htmlFor="amount-input" className="form-label">
                  💰 Montant (FCFA) <span className="text-xs text-neutral-500">(Facultatif - sera prérempli pour le livreur)</span>
                </label>
                <input
                  id="amount-input"
                  type="number"
                  min="0"
                  step="100"
                  value={amount || ''}
                  onChange={e => setAmount(e.target.value ? parseFloat(e.target.value) : null)}
                  className="form-input"
                  placeholder="Entrez le montant en FCFA"
                />
                {amount && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    ✓ Montant: {amount.toLocaleString('fr-FR')} FCFA
                  </p>
                )}
              </div>
            )}

            {/* Formulaire Roland */}
            {selectedType === 'roland' && (
              <div className="space-y-8">
                {/* Section IMPRESSION ROLAND */}
                <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center border-b border-neutral-200 dark:border-neutral-700 pb-3">
                    <PrinterIcon className="h-6 w-6 text-blue-600 mr-2" />
                    IMPRESSION ROLAND
                  </h4>

                  {/* Type de support */}
                  <div className="mb-6">
                    <label htmlFor="type-support-select" className="form-label">Type de support / impression *</label>
                    <select
                      id="type-support-select"
                      value={rolandData.type_support}
                      onChange={e => handleRolandChange('type_support', e.target.value)}
                      className={`form-input ${errors.type_support ? 'border-danger-300' : ''}`}
                    >
                      <option value="">Sélectionnez un type</option>
                      {rolandTypesSupport.map(type => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {rolandData.type_support === 'Autre' && (
                      <input
                        type="text"
                        value={rolandData.type_support_autre}
                        onChange={e => handleRolandChange('type_support_autre', e.target.value)}
                        className={`form-input mt-2 ${errors.type_support_autre ? 'border-danger-300' : ''}`}
                        placeholder="Préciser le type d'impression"
                      />
                    )}
                    {errors.type_support && <p className="form-error">{errors.type_support}</p>}
                    {errors.type_support_autre && (
                      <p className="form-error">{errors.type_support_autre}</p>
                    )}
                  </div>

                  {/* DIMENSION */}
                  <div className="mb-6">
                    <h5 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                      DIMENSION
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="largeur-input" className="form-label">Largeur *</label>
                        <input
                          id="largeur-input"
                          type="number"
                          step="0.01"
                          value={rolandData.largeur}
                          onChange={e => handleRolandChange('largeur', e.target.value)}
                          className={`form-input ${errors.largeur ? 'border-danger-300' : ''}`}
                          placeholder="Ex: 200"
                        />
                        {errors.largeur && <p className="form-error">{errors.largeur}</p>}
                      </div>

                      <div>
                        <label htmlFor="hauteur-input" className="form-label">Hauteur *</label>
                        <input
                          id="hauteur-input"
                          type="number"
                          step="0.01"
                          value={rolandData.hauteur}
                          onChange={e => handleRolandChange('hauteur', e.target.value)}
                          className={`form-input ${errors.hauteur ? 'border-danger-300' : ''}`}
                          placeholder="Ex: 100"
                        />
                        {errors.hauteur && <p className="form-error">{errors.hauteur}</p>}
                      </div>

                      <div>
                        <label htmlFor="unite-select" className="form-label">Unité</label>
                        <select
                          id="unite-select"
                          value={rolandData.unite}
                          onChange={e => handleRolandChange('unite', e.target.value)}
                          className="form-input"
                        >
                          <option value="mm">Millimètres (mm)</option>
                          <option value="cm">Centimètres (cm)</option>
                          <option value="m">Mètres (m)</option>
                        </select>
                      </div>
                    </div>

                    {/* Surface calculée */}
                    {calculatedSurface > 0 && (
                      <div className="mt-3 p-3 bg-success-50 dark:bg-green-900/20 border border-green-200 dark:border-success-700 rounded-lg">
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">
                          ✓ Surface totale calculée automatiquement :{' '}
                          <span className="text-lg font-bold">{calculatedSurface} m²</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Nombre d'exemplaires */}
                  <div className="mb-6">
                    <label htmlFor="nombre-exemplaires-roland" className="form-label">Nombre d'exemplaires *</label>
                    <input
                      id="nombre-exemplaires-roland"
                      type="number"
                      min="1"
                      value={rolandData.nombre_exemplaires}
                      onChange={e => handleRolandChange('nombre_exemplaires', e.target.value)}
                      className={`form-input ${errors.nombre_exemplaires ? 'border-danger-300' : ''}`}
                      placeholder="Ex: 1"
                    />
                    {errors.nombre_exemplaires && (
                      <p className="form-error">{errors.nombre_exemplaires}</p>
                    )}
                  </div>
                </div>

                {/* Section FINITION */}
                <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 border-b border-neutral-200 dark:border-neutral-700 pb-3">
                    FINITION
                  </h4>

                  {/* Oeillets */}
                  <div className="mb-6">
                    <fieldset>
                      <legend className="form-label">Oeillets</legend>
                      <div className="grid grid-cols-3 gap-3">
                        {rolandFinitionsOeillets.map(finition => (
                          <label
                            key={finition}
                            className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              rolandData.finition_oeillets === finition
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-neutral-200 dark:border-neutral-600 hover:border-blue-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="finition_oeillets"
                              value={finition}
                              checked={rolandData.finition_oeillets === finition}
                              onChange={e => handleRolandChange('finition_oeillets', e.target.value)}
                              className="sr-only"
                            />
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {finition}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>

                  {/* Position des oeillets */}
                  {rolandData.finition_oeillets &&
                    rolandData.finition_oeillets !== 'Collage' && (
                      <div className="mb-6">
                        <fieldset>
                          <legend className="form-label">Position</legend>
                          <div className="grid grid-cols-2 gap-3">
                            {rolandPositions.map(position => (
                              <label
                                key={position}
                                className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                  rolandData.finition_position === position
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-neutral-200 dark:border-neutral-600 hover:border-blue-300'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="finition_position"
                                  value={position}
                                  checked={rolandData.finition_position === position}
                                  onChange={e =>
                                    handleRolandChange('finition_position', e.target.value)
                                  }
                                  className="sr-only"
                                />
                                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                  {position}
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      </div>
                    )}

                  {/* ✅ NOUVEAU: Supports additionnels (optionnel - bâche + vinyle) */}
                  <div className="mt-6 pt-6 border-t-2 border-green-200 dark:border-green-700">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h5 className="font-semibold text-neutral-900 dark:text-neutral-100">
                            🖨️ Supports additionnels (optionnel)
                          </h5>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            Ajoutez plusieurs types de supports pour le même client (ex: bâche + vinyle)
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newSupport = {
                              type_support: 'Bâche',
                              largeur: '',
                              hauteur: '',
                              unite: 'm',
                              exemplaires: 1,
                              finitions: []
                            };
                            setSupports([...supports, newSupport]);
                          }}
                          className="btn btn-sm bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                        >
                          <span>➕</span>
                          <span>Ajouter un support</span>
                        </button>
                      </div>
                    </div>

                    {/* Affichage des supports uniquement s'ils existent */}
                    {supports.length > 0 && (
                      <SupportsManager 
                        supports={supports} 
                        onChange={setSupports}
                      />
                    )}
                  </div>

                  {/* Description du travail */}
                  <div className={rolandData.finition_oeillets && rolandData.finition_oeillets !== 'Collage' ? '' : 'mt-6'}>
                    <label htmlFor="description-input-roland" className="form-label">
                      Description du travail <span className="text-xs text-neutral-500">(Optionnel - Détails du projet)</span>
                    </label>
                    <textarea
                      id="description-input-roland"
                      rows="3"
                      value={description}
                      onChange={e => {
                        setDescription(e.target.value);
                        if (errors.description) {
                          setErrors(prev => ({ ...prev, description: null }));
                        }
                      }}
                      className={`form-input ${errors.description ? 'border-danger-300 focus:border-danger-500' : ''}`}
                      placeholder="Décrivez le travail d'impression à réaliser..."
                    />
                    {errors.description && <p className="form-error">{errors.description}</p>}
                  </div>

                  {/* Marquer comme urgent */}
                  <div className="mt-4">
                    <label className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl cursor-pointer hover:shadow-md transition-all">
                      <input
                        type="checkbox"
                        checked={isUrgent}
                        onChange={e => setIsUrgent(e.target.checked)}
                        className="w-5 h-5 text-red-600 border-red-300 rounded focus:ring-red-500 focus:ring-2"
                      />
                      <div className="flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                        <span className="font-semibold text-red-800 dark:text-red-300">Marquer comme URGENT</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Formulaire Xerox */}
            {selectedType === 'xerox' && (
              <div className="space-y-8">
                {/* Section TYPE DE DOCUMENT */}
                <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center border-b border-neutral-200 dark:border-neutral-700 pb-3">
                    <DocumentIcon className="h-6 w-6 text-blue-600 mr-2" />
                    TYPE DE DOCUMENT
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Type de document */}
                    <div>
                      <label htmlFor="type-document-select" className="form-label">Type de document *</label>
                      <select
                        id="type-document-select"
                        value={xeroxData.type_document}
                        onChange={e => handleXeroxChange('type_document', e.target.value)}
                        className={`form-input ${errors.type_document ? 'border-danger-300' : ''}`}
                      >
                        <option value="">Sélectionnez un type</option>
                        {xeroxTypesDocument.map(type => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      {xeroxData.type_document === 'Autre' && (
                        <input
                          type="text"
                          value={xeroxData.type_document_autre}
                          onChange={e => handleXeroxChange('type_document_autre', e.target.value)}
                          className={`form-input mt-2 ${errors.type_document_autre ? 'border-danger-300' : ''}`}
                          placeholder="Préciser le type de document"
                        />
                      )}
                      {errors.type_document && <p className="form-error">{errors.type_document}</p>}
                      {errors.type_document_autre && (
                        <p className="form-error">{errors.type_document_autre}</p>
                      )}
                    </div>

                    {/* Format */}
                    <div>
                      <label htmlFor="format-select" className="form-label">Format *</label>
                      <select
                        id="format-select"
                        value={xeroxData.format}
                        onChange={e => handleXeroxChange('format', e.target.value)}
                        className={`form-input ${errors.format ? 'border-danger-300' : ''}`}
                      >
                        <option value="">Sélectionnez un format</option>
                        {xeroxFormats.map(format => (
                          <option key={format} value={format}>
                            {format}
                          </option>
                        ))}
                      </select>
                      {xeroxData.format === 'Personnalisé' && (
                        <input
                          type="text"
                          value={xeroxData.format_personnalise}
                          onChange={e => handleXeroxChange('format_personnalise', e.target.value)}
                          className={`form-input mt-2 ${errors.format_personnalise ? 'border-danger-300' : ''}`}
                          placeholder="Préciser les dimensions (L x H mm)"
                        />
                      )}
                      {errors.format && <p className="form-error">{errors.format}</p>}
                      {errors.format_personnalise && (
                        <p className="form-error">{errors.format_personnalise}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section IMPRESSION */}
                <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center border-b border-neutral-200 dark:border-neutral-700 pb-3">
                    <PrinterIcon className="h-6 w-6 text-blue-600 mr-2" />
                    IMPRESSION
                  </h4>

                  {/* Mode d'impression (radio) */}
                  <div className="mb-6">
                    <fieldset>
                      <legend className="form-label">Mode d'impression *</legend>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label
                          className={`flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            xeroxData.mode_impression === 'recto_simple'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-neutral-200 dark:border-neutral-600 hover:border-blue-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="mode_impression"
                            value="recto_simple"
                            checked={xeroxData.mode_impression === 'recto_simple'}
                            onChange={e => handleXeroxChange('mode_impression', e.target.value)}
                            className="sr-only"
                          />
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            Recto simple
                          </span>
                        </label>

                        <label
                          className={`flex items-center justify-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            xeroxData.mode_impression === 'recto_verso'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-neutral-200 dark:border-neutral-600 hover:border-blue-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="mode_impression"
                            value="recto_verso"
                            checked={xeroxData.mode_impression === 'recto_verso'}
                            onChange={e => handleXeroxChange('mode_impression', e.target.value)}
                            className="sr-only"
                          />
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            Recto verso
                          </span>
                        </label>
                      </div>
                      {errors.mode_impression && (
                        <p className="form-error">{errors.mode_impression}</p>
                      )}
                    </fieldset>
                  </div>

                  {/* Couleur d'impression */}
                  <div className="mb-6">
                    <fieldset>
                      <legend className="form-label">Couleur d'impression *</legend>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label
                          className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            xeroxData.couleur_impression === 'couleur'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-neutral-200 dark:border-neutral-600 hover:border-blue-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="couleur_impression"
                            value="couleur"
                            checked={xeroxData.couleur_impression === 'couleur'}
                            onChange={e => handleXeroxChange('couleur_impression', e.target.value)}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Couleur
                          </span>
                        </label>

                        <label
                          className={`flex items-center justify-center p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            xeroxData.couleur_impression === 'noir_et_blanc'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-neutral-200 dark:border-neutral-600 hover:border-blue-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="couleur_impression"
                            value="noir_et_blanc"
                            checked={xeroxData.couleur_impression === 'noir_et_blanc'}
                            onChange={e => handleXeroxChange('couleur_impression', e.target.value)}
                            className="sr-only"
                          />
                          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            Noir & Blanc
                          </span>
                        </label>
                      </div>
                    </fieldset>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Nombre d'exemplaires */}
                    <div>
                      <label htmlFor="nombre-exemplaires-xerox" className="form-label">Nombre d'exemplaires *</label>
                      <input
                        id="nombre-exemplaires-xerox"
                        type="number"
                        min="1"
                        value={xeroxData.nombre_exemplaires}
                        onChange={e => handleXeroxChange('nombre_exemplaires', e.target.value)}
                        className={`form-input ${errors.nombre_exemplaires ? 'border-danger-300' : ''}`}
                        placeholder="Ex: 100"
                      />
                      {errors.nombre_exemplaires && (
                        <p className="form-error">{errors.nombre_exemplaires}</p>
                      )}
                    </div>

                    {/* Grammage */}
                    <div>
                      <label htmlFor="grammage-select" className="form-label">Grammage / Type de papier *</label>
                      <select
                        id="grammage-select"
                        value={xeroxData.grammage}
                        onChange={e => handleXeroxChange('grammage', e.target.value)}
                        className={`form-input ${errors.grammage ? 'border-danger-300' : ''}`}
                      >
                        <option value="">Sélectionnez</option>
                        {xeroxGrammages.map(grammage => (
                          <option key={grammage} value={grammage}>
                            {grammage}
                          </option>
                        ))}
                      </select>
                      {xeroxData.grammage === 'Autre' && (
                        <input
                          type="text"
                          value={xeroxData.grammage_autre}
                          onChange={e => handleXeroxChange('grammage_autre', e.target.value)}
                          className={`form-input mt-2 ${errors.grammage_autre ? 'border-danger-300' : ''}`}
                          placeholder="Préciser le type de papier"
                        />
                      )}
                      {errors.grammage && <p className="form-error">{errors.grammage}</p>}
                      {errors.grammage_autre && (
                        <p className="form-error">{errors.grammage_autre}</p>
                      )}
                    </div>
                  </div>

                  {/* ✅ NOUVEAU: Sections multiples (optionnel - couverture + intérieur) */}
                  <div className="mt-6 pt-6 border-t-2 border-blue-200 dark:border-blue-700">
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h5 className="font-semibold text-neutral-900 dark:text-neutral-100">
                            📑 Sections additionnelles (optionnel)
                          </h5>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            Pour les brochures : ajoutez la couverture et les pages intérieures avec leurs propres spécifications
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newSection = {
                              type: 'Intérieur',
                              mode_impression: 'recto_verso',
                              copies: 1,
                              paper_types: [{
                                format: 'A4',
                                couleur: 'nb',
                                grammage: '80',
                                pages: 1
                              }],
                              finitions: [],
                              faconnage: []
                            };
                            setSections([...sections, newSection]);
                          }}
                          className="btn btn-sm bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
                        >
                          <span>➕</span>
                          <span>Ajouter une section</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Affichage des sections uniquement si elles existent */}
                    {sections.length > 0 && (
                      <SectionsManager 
                        sections={sections} 
                        onChange={setSections}
                      />
                    )}
                  </div>
                </div>

                {/* Section FINITION */}
                <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 border-b border-neutral-200 dark:border-neutral-700 pb-3">
                    FINITION
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    {xeroxFinitions.map(finition => (
                      <label
                        key={finition}
                        className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={xeroxData.finition.includes(finition)}
                          onChange={e =>
                            handleXeroxCheckbox('finition', finition, e.target.checked)
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-neutral-600 rounded"
                        />
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                          {finition}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* FAÇONNAGE */}
                  <h5 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3 mt-6">
                    Façonnage
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {xeroxFaconnages.map(faconnage => (
                      <label
                        key={faconnage}
                        className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={xeroxData.faconnage.includes(faconnage)}
                          onChange={e =>
                            handleXeroxCheckbox('faconnage', faconnage, e.target.checked)
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-neutral-600 rounded"
                        />
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                          {faconnage}
                        </span>
                      </label>
                    ))}
                  </div>

                  {xeroxData.faconnage.includes('Autre') && (
                    <div className="mt-4">
                      <input
                        type="text"
                        value={xeroxData.faconnage_autre}
                        onChange={e => handleXeroxChange('faconnage_autre', e.target.value)}
                        className="form-input"
                        placeholder="Préciser le type de façonnage"
                      />
                    </div>
                  )}
                </div>

                {/* Section OPTIONS AVANCÉES */}
                <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 border-b border-neutral-200 dark:border-neutral-700 pb-3">
                    OPTIONS AVANCÉES
                  </h4>

                  {/* Numérotation */}
                  <div className="mb-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={xeroxData.numerotation}
                        onChange={e => handleXeroxChange('numerotation', e.target.checked)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-neutral-600 rounded"
                      />
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">
                        Numérotation
                      </span>
                    </label>

                    {xeroxData.numerotation && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 ml-7">
                        <div>
                          <label htmlFor="debut-numerotation" className="form-label">Début de la numérotation</label>
                          <input
                            id="debut-numerotation"
                            type="number"
                            min="1"
                            value={xeroxData.debut_numerotation}
                            onChange={e =>
                              handleXeroxChange('debut_numerotation', e.target.value)
                            }
                            className="form-input"
                            placeholder="Ex: 1"
                          />
                        </div>
                        <div>
                          <label htmlFor="nombre-chiffres" className="form-label">Nombre de chiffres</label>
                          <input
                            id="nombre-chiffres"
                            type="number"
                            min="1"
                            max="10"
                            value={xeroxData.nombre_chiffres}
                            onChange={e => handleXeroxChange('nombre_chiffres', e.target.value)}
                            className="form-input"
                            placeholder="Ex: 4"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Conditionnement */}
                  <div className="mb-6">
                    <fieldset>
                      <legend className="form-label">Conditionnement</legend>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {xeroxConditionnements.map(conditionnement => (
                          <label
                            key={conditionnement}
                            className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={xeroxData.conditionnement.includes(conditionnement)}
                              onChange={e =>
                                handleXeroxCheckbox(
                                  'conditionnement',
                                  conditionnement,
                                  e.target.checked
                                )
                              }
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-neutral-600 rounded"
                            />
                            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                              {conditionnement}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>

                  {/* Description du travail */}
                  <div>
                    <label htmlFor="description-input-xerox" className="form-label">
                      Description du travail <span className="text-xs text-neutral-500">(Optionnel - Détails du projet)</span>
                    </label>
                    <textarea
                      id="description-input-xerox"
                      rows="3"
                      value={description}
                      onChange={e => {
                        setDescription(e.target.value);
                        if (errors.description) {
                          setErrors(prev => ({ ...prev, description: null }));
                        }
                      }}
                      className={`form-input ${errors.description ? 'border-danger-300 focus:border-danger-500' : ''}`}
                      placeholder="Décrivez le travail d'impression à réaliser..."
                    />
                    {errors.description && <p className="form-error">{errors.description}</p>}
                  </div>

                  {/* Marquer comme urgent */}
                  <div className="mt-4">
                    <label className="flex items-center gap-3 p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl cursor-pointer hover:shadow-md transition-all">
                      <input
                        type="checkbox"
                        checked={isUrgent}
                        onChange={e => setIsUrgent(e.target.checked)}
                        className="w-5 h-5 text-red-600 border-red-300 rounded focus:ring-red-500 focus:ring-2"
                      />
                      <div className="flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                        <span className="font-semibold text-red-800 dark:text-red-300">Marquer comme URGENT</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Section FICHIERS (commune) */}
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
              <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center border-b border-neutral-200 dark:border-neutral-700 pb-3">
                <DocumentIcon className="h-6 w-6 text-blue-600 mr-2" />
                FICHIER D'IMPRESSION
              </h4>

              <div className="space-y-4">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Upload PDF, images ou fichiers graphiques (optionnel)
                </p>

                {/* Zone de drop */}
                <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-6 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                  <div className="text-center">
                    <CloudArrowUpIcon className="mx-auto h-12 w-12 text-neutral-400" />
                    <div className="mt-4">
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="mt-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          Cliquez pour uploader ou glissez-déposez
                        </span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.gif,.ai,.psd,.tiff,.eps,.svg"
                          className="sr-only"
                          onChange={handleFileUpload}
                        />
                      </label>
                      <p className="mt-2 text-xs text-neutral-500">
                        PDF, JPG, PNG, AI, PSD, TIFF, EPS, SVG jusqu'à 500 Mo par fichier
                      </p>
                    </div>
                  </div>
                </div>

                {/* Liste des fichiers uploadés avec aperçu */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                      Fichiers sélectionnés ({files.length}):
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {files.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-700 p-3 rounded-lg border border-neutral-200 dark:border-neutral-600"
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <div className="flex-shrink-0">
                              {file.type.startsWith('image/') ? (
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={file.name}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded flex items-center justify-center">
                                  <DocumentIcon className="h-6 w-6 text-blue-600" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {(file.size / 1024 / 1024).toFixed(2)} Mo
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="ml-2 text-danger-500 hover:text-danger-700"
                          >
                            <XMarkIcon className="h-5 w-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer avec boutons */}
          <div className="flex-shrink-0 bg-neutral-50 dark:bg-neutral-900 px-6 py-4 flex justify-end space-x-3 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Annuler
            </button>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{editMode ? 'Mise à jour...' : 'Création...'}</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  {editMode ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <CheckCircleIcon className="h-5 w-5" />
                  )}
                  <span>{editMode ? '✅ Enregistrer les modifications' : `Créer le dossier ${selectedType === 'roland' ? 'Roland' : 'Xerox'}`}</span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDossier;