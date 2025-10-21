import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon, 
  Save, 
  RefreshCw, 
  Shield, 
  Bell, 
  Upload, 
  GitBranch, 
  HardDrive, 
  Mail, 
  AlertTriangle, 
  User,
  Server,
  Monitor,
  Globe,
  Palette,
  FileText,
  Download,
  FileUp,
  RotateCcw,
  Check,
  X,
  Info,
  HelpCircle
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { systemConfigService } from '../../services/api';
import { devisTemplates, factureTemplates, defaultDocumentsSettings } from '../../utils/documentTemplates';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [params, setParams] = useState([]);
  const [editValues, setEditValues] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [importData, setImportData] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Paramètres par défaut étendus
  const defaults = {
    // Général
    app_name: 'EvocomPrint',
    app_version: '3.0.0',
    app_description: 'Plateforme d\'impression numérique avancée',
    company_name: 'Evolue Technologies',
    company_logo: '/assets/logo.png',
    
    // Sécurité
    session_timeout: 3600, // secondes
    max_login_attempts: 5,
    password_min_length: 8,
    require_2fa: false,
    ip_whitelist: [],
    security_logs: true,
    
    // Fichiers
    max_file_size: 50, // MB
    allowed_file_types: ['pdf', 'doc', 'docx', 'jpg', 'png', 'gif', 'tiff', 'zip'],
    max_files_per_upload: 10,
    auto_virus_scan: true,
    file_retention_days: 365,
    
    // Notifications
    notification_settings: {
      email_notifications: true,
      push_notifications: true,
      sms_notifications: false,
      slack_notifications: false,
      webhook_notifications: false,
    },
    
    // Email
    email_settings: {
      smtp_host: '',
      smtp_port: 587,
      smtp_user: '',
      smtp_password: '',
      smtp_secure: true,
      from_name: 'EvocomPrint',
      from_email: 'noreply@evolue.tech',
    },
    
    // Workflow
    workflow_settings: {
      auto_validation: false,
      require_comments: true,
      delivery_notification: true,
      auto_assignment: false,
      priority_escalation: true,
    },
    
    // Sauvegardes
    backup_settings: {
      auto_backup: true,
      backup_frequency: 'daily',
      retention_days: 30,
      backup_location: 'local',
      cloud_provider: 'none',
    },
    
    // Maintenance
    maintenance_mode: { enabled: false, message: 'Maintenance en cours...' },
    dark_mode: { enabled: false },
    
    // Performance
    performance_settings: {
      cache_enabled: true,
      cache_ttl: 3600,
      compression_enabled: true,
      cdn_enabled: false,
      log_level: 'info',
    },
    
    // API
    api_settings: {
      rate_limit: 1000, // requêtes par heure
      api_key_required: true,
      cors_origins: ['http://localhost:3001'],
      webhook_timeout: 30,
    },

    // Documents (Devis & Factures)
    documents_settings: { ...defaultDocumentsSettings },
  };

  const sections = [
    { id: 'general', name: 'Général', icon: SettingsIcon },
    { id: 'theme', name: 'Thème', icon: Palette },
    { id: 'customization', name: 'Personnalisation', icon: Palette },
    { id: 'documents', name: 'Documents', icon: FileText },
    { id: 'security', name: 'Sécurité', icon: Shield },
    { id: 'files', name: 'Fichiers', icon: Upload },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'email', name: 'Email', icon: Mail },
    { id: 'workflow', name: 'Workflow', icon: GitBranch },
    { id: 'backup', name: 'Sauvegardes', icon: HardDrive },
    { id: 'performance', name: 'Performance', icon: Monitor },
    { id: 'api', name: 'API', icon: Globe },
    { id: 'advanced', name: 'Avancé', icon: Server },
  ];

  const load = async () => {
    try {
      setLoading(true);
      const res = await systemConfigService.list();
      const list = res?.params || [];
      setParams(list);
      
      const initial = { ...defaults };
      list.forEach(p => {
        try {
          // Tenter de parser en JSON si c'est un objet
          initial[p.key] = typeof p.value === 'string' && p.value.startsWith('{') 
            ? JSON.parse(p.value) 
            : p.value;
        } catch {
          initial[p.key] = p.value;
        }
      });
      setEditValues(initial);
      setHasUnsavedChanges(false);
    } catch (e) {
      toast.error(e?.error || 'Erreur chargement paramètres');
    } finally {
      setLoading(false);
    }
  };

  const save = async (key, valueOverride) => {
    try {
      setSaving(true);
      const valueToSave = typeof valueOverride !== 'undefined' ? valueOverride : editValues[key];
      await systemConfigService.set(key, valueToSave);
      toast.success(`Paramètre ${key} enregistré avec succès`);
      await load();
      setHasUnsavedChanges(false);
    } catch (e) {
      toast.error(e?.error || 'Erreur sauvegarde paramètre');
    } finally {
      setSaving(false);
    }
  };

  const saveSection = async (sectionKeys) => {
    try {
      setSaving(true);
      const promises = sectionKeys.map(key => 
        systemConfigService.set(key, editValues[key] ?? defaults[key])
      );
      await Promise.all(promises);
      toast.success('Section sauvegardée avec succès');
      await load();
    } catch (e) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (key, value) => {
    // Validation en temps réel
    const errors = validateField(key, value);
    setValidationErrors(prev => ({ ...prev, [key]: errors }));
    
    setEditValues({ ...editValues, [key]: value });
    setHasUnsavedChanges(true);
  };

  // Validation des champs
  const validateField = (key, value) => {
    const errors = [];
    
    switch (key) {
      case 'session_timeout':
        if (value < 300 || value > 86400) errors.push('Entre 5 min et 24h');
        break;
      case 'max_file_size':
        if (value < 1 || value > 500) errors.push('Entre 1 et 500 MB');
        break;
      case 'password_min_length':
        if (value < 6 || value > 20) errors.push('Entre 6 et 20 caractères');
        break;
      case 'max_login_attempts':
        if (value < 3 || value > 10) errors.push('Entre 3 et 10 tentatives');
        break;
      case 'company_name':
      case 'app_name':
        if (!value || value.trim().length < 2) errors.push('Au moins 2 caractères');
        break;
      default:
        if (typeof value === 'object' && value?.smtp_host) {
          // Validation email settings
          if (value.smtp_host && !value.smtp_host.includes('.')) {
            errors.push('Serveur SMTP invalide');
          }
          if (value.from_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.from_email)) {
            errors.push('Email invalide');
          }
        }
    }
    
    return errors.length > 0 ? errors : null;
  };

  // Export configuration
  const exportConfig = async () => {
    try {
      const config = {
        exported_at: new Date().toISOString(),
        app_version: editValues.app_version || defaults.app_version,
        settings: editValues
      };
      
      const blob = new Blob([JSON.stringify(config, null, 2)], { 
        type: 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evocomprint-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Configuration exportée avec succès');
    } catch (error) {
      toast.error('Erreur lors de l\'export: ' + error.message);
    }
  };

  // Import configuration
  const importConfig = () => {
    try {
      const config = JSON.parse(importData);
      if (!config.settings) {
        throw new Error('Format invalide: propriété settings manquante');
      }
      
      // Validation des données importées
      const validatedSettings = {};
      Object.keys(defaults).forEach(key => {
        if (config.settings[key] !== undefined) {
          validatedSettings[key] = config.settings[key];
        }
      });
      
      setEditValues({ ...defaults, ...validatedSettings });
      setHasUnsavedChanges(true);
      setShowImportModal(false);
      setImportData('');
      
      toast.success(`Configuration importée (${Object.keys(validatedSettings).length} paramètres)`);
    } catch (error) {
      toast.error('Erreur d\'import: ' + error.message);
    }
  };

  // Reset section to defaults
  const resetSection = (sectionKeys) => {
    const resetValues = {};
    sectionKeys.forEach(key => {
      resetValues[key] = defaults[key];
    });
    setEditValues({ ...editValues, ...resetValues });
    setHasUnsavedChanges(true);
    setShowConfirmModal(false);
    toast.success('Section réinitialisée aux valeurs par défaut');
  };

  // Save all sections
  const saveAll = async () => {
    try {
      setSaving(true);
      const promises = Object.keys(editValues).map(key => 
        systemConfigService.set(key, editValues[key])
      );
      await Promise.all(promises);
      toast.success('Toute la configuration sauvegardée');
      await load();
    } catch (e) {
      toast.error('Erreur lors de la sauvegarde complète');
    } finally {
      setSaving(false);
    }
  };

  // Confirm sensitive actions
  const confirmSensitiveAction = (action, callback) => {
    setConfirmAction({ action, callback });
    setShowConfirmModal(true);
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ToggleSwitch = ({ checked, onChange, label, description, color = 'primary' }) => (
    <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-gray-800 rounded-lg">
      <div className="flex-1">
        <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{label}</h4>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          checked 
            ? (color === 'warning' ? 'bg-orange-600 focus:ring-orange-500' 
               : color === 'success' ? 'bg-success-600 focus:ring-success-500'
               : 'bg-blue-600 focus:ring-blue-500')
            : 'bg-neutral-300 focus:ring-neutral-500 dark:focus:ring-neutral-400'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-neutral-800 transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  ToggleSwitch.propTypes = {
    checked: PropTypes.bool.isRequired,
    onChange: PropTypes.func.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    color: PropTypes.string
  };

  const SectionCard = ({ title, children, actions, sectionKeys = [] }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
          <div className="flex items-center gap-2">
            {sectionKeys.length > 0 && (
              <button
                onClick={() => confirmSensitiveAction(
                  `Réinitialiser la section "${title}"`,
                  () => resetSection(sectionKeys)
                )}
                disabled={saving}
                className="btn-ghost flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-orange-600"
                title="Réinitialiser aux valeurs par défaut"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            )}
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  );

  SectionCard.propTypes = {
    title: PropTypes.string.isRequired,
    children: PropTypes.node.isRequired,
    actions: PropTypes.node,
    sectionKeys: PropTypes.array
  };

  // Composant d'erreur de validation
  const ErrorMessage = ({ errors }) => {
    if (!errors) return null;
    return (
      <div className="mt-1 text-xs text-red-600 dark:text-red-400">
        {errors.map((error, i) => (
          <div key={i}>• {error}</div>
        ))}
      </div>
    );
  };

  ErrorMessage.propTypes = {
    errors: PropTypes.array
  };

  // Composant d'input avec validation
  const ValidatedInput = ({ label, value, onChange, type = 'text', validationKey, ...props }) => (
    <div>
      <label className="form-label">{label}</label>
      <input
        className={`form-input ${
          validationErrors[validationKey] ? 'border-red-500 dark:border-red-400' : ''
        }`}
        type={type}
        value={value || ''}
        onChange={onChange}
        {...props}
      />
      <ErrorMessage errors={validationErrors[validationKey]} />
    </div>
  );

  ValidatedInput.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onChange: PropTypes.func.isRequired,
    type: PropTypes.string,
    validationKey: PropTypes.string
  };

  const renderGeneralSection = () => {
    const sectionKeys = ['app_name', 'app_version', 'app_description', 'company_name', 'company_logo'];
    return (
      <SectionCard 
        title="Paramètres généraux"
        sectionKeys={sectionKeys}
        actions={
          <button
            onClick={() => saveSection(sectionKeys)}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        }
      >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ValidatedInput
          label={<div className="flex items-center gap-2"><User size={16} />Nom de l'application</div>}
          value={editValues.app_name ?? defaults.app_name}
          onChange={e => handleInputChange('app_name', e.target.value)}
          validationKey="app_name"
          placeholder="EvocomPrint"
        />
        <ValidatedInput
          label="Version"
          value={editValues.app_version ?? defaults.app_version}
          onChange={e => handleInputChange('app_version', e.target.value)}
          placeholder="3.0.0"
        />
        <div className="md:col-span-2">
          <label className="form-label">Description</label>
          <textarea
            className={`form-input ${
              validationErrors.app_description ? 'border-red-500 dark:border-red-400' : ''
            }`}
            rows={3}
            value={editValues.app_description ?? defaults.app_description}
            onChange={e => handleInputChange('app_description', e.target.value)}
            placeholder="Plateforme d'impression numérique avancée"
          />
          <ErrorMessage errors={validationErrors.app_description} />
        </div>
        <ValidatedInput
          label="Nom de l'entreprise"
          value={editValues.company_name ?? defaults.company_name}
          onChange={e => handleInputChange('company_name', e.target.value)}
          validationKey="company_name"
          placeholder="Evolue Technologies"
        />
      </div>
      
                {/* Logo de l'entreprise */}
        <div>
          <label className="form-label">Logo de l&apos;entreprise</label>
          <input
            className="form-input"
            type="text"
            placeholder="/assets/logo.png"
            value={editValues.company_logo ?? defaults.company_logo}
            onChange={e => handleInputChange('company_logo', e.target.value)}
          />
        </div>
      
        {/* Modes rapides */}
        <div className="mt-8">
          <h4 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-4">Modes système</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleSwitch
            checked={editValues.maintenance_mode?.enabled ?? false}
            onChange={() => {
              const current = editValues.maintenance_mode ?? defaults.maintenance_mode;
              const newValue = { ...current, enabled: !current.enabled };
              
              if (newValue.enabled) {
                confirmSensitiveAction(
                  'Activer le mode maintenance (tous les utilisateurs seront déconnectés)',
                  () => {
                    handleInputChange('maintenance_mode', newValue);
                    save('maintenance_mode', newValue);
                  }
                );
              } else {
                handleInputChange('maintenance_mode', newValue);
                save('maintenance_mode', newValue);
              }
            }}
            label="Mode maintenance"
            description="Activer la page de maintenance"
            color="warning"
          />
          <ToggleSwitch
            checked={editValues.dark_mode?.enabled ?? false}
            onChange={() => {
              const current = editValues.dark_mode ?? defaults.dark_mode;
              const newValue = { ...current, enabled: !current.enabled };
              handleInputChange('dark_mode', newValue);
              save('dark_mode', newValue);
            }}
            label="Mode sombre par défaut"
            description="Activer le thème sombre"
            color="primary"
          />
        </div>
      </div>
      
      {/* Message de maintenance personnalisé */}
      {editValues.maintenance_mode?.enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
        >
          <label className="form-label">Message de maintenance</label>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Maintenance en cours..."
            value={editValues.maintenance_mode?.message ?? defaults.maintenance_mode.message}
            onChange={e => {
              const current = editValues.maintenance_mode ?? defaults.maintenance_mode;
              const newValue = { ...current, message: e.target.value };
              handleInputChange('maintenance_mode', newValue);
            }}
          />
        </motion.div>
      )}
    </SectionCard>
    );
  };

  const renderSecuritySection = () => {
    return (
      <SectionCard 
        title="Paramètres de sécurité"
        actions={
          <button
            onClick={() => saveSection(['session_timeout', 'max_login_attempts', 'password_min_length', 'require_2fa'])}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="form-label flex items-center gap-2">
              <Shield size={16} />
              Timeout de session (secondes)
            </label>
            <input
              className="form-input"
              type="number"
              min={300}
              value={editValues.session_timeout ?? defaults.session_timeout}
              onChange={e => handleInputChange('session_timeout', parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="form-label">Tentatives de connexion max</label>
            <input
              className="form-input"
              type="number"
              min={3}
              max={10}
              value={editValues.max_login_attempts ?? defaults.max_login_attempts}
              onChange={e => handleInputChange('max_login_attempts', parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="form-label">Longueur minimale du mot de passe</label>
            <input
              className="form-input"
              type="number"
              min={6}
              max={20}
              value={editValues.password_min_length ?? defaults.password_min_length}
              onChange={e => handleInputChange('password_min_length', parseInt(e.target.value))}
            />
          </div>
        </div>
        
        <div className="mt-6">
          <ToggleSwitch
            checked={editValues.require_2fa ?? defaults.require_2fa}
            onChange={() => handleInputChange('require_2fa', !editValues.require_2fa)}
            label="Authentification à deux facteurs obligatoire"
            description="Forcer l'activation de la 2FA pour tous les utilisateurs"
            color="success"
          />
        </div>
      </SectionCard>
    );
  };

  const renderFilesSection = () => (
    <SectionCard 
      title="Gestion des fichiers"
      actions={
        <button
          onClick={() => saveSection(['max_file_size', 'allowed_file_types', 'max_files_per_upload'])}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save size={16} />
          Enregistrer
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="form-label flex items-center gap-2">
            <Upload size={16} />
            Taille max par fichier (MB)
          </label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={500}
            value={editValues.max_file_size ?? defaults.max_file_size}
            onChange={e => handleInputChange('max_file_size', parseInt(e.target.value))}
          />
        </div>
        <div>
          <label className="form-label">Nombre max de fichiers par upload</label>
          <input
            className="form-input"
            type="number"
            min={1}
            max={50}
            value={editValues.max_files_per_upload ?? defaults.max_files_per_upload}
            onChange={e => handleInputChange('max_files_per_upload', parseInt(e.target.value))}
          />
        </div>
        <div>
          <label className="form-label">Rétention des fichiers (jours)</label>
          <input
            className="form-input"
            type="number"
            min={30}
            value={editValues.file_retention_days ?? defaults.file_retention_days}
            onChange={e => handleInputChange('file_retention_days', parseInt(e.target.value))}
          />
        </div>
      </div>
      
      <div className="mt-6">
        <label className="form-label">Types de fichiers autorisés</label>
        <input
          className="form-input"
          type="text"
          placeholder="pdf,doc,docx,jpg,png,gif"
          value={
            Array.isArray(editValues.allowed_file_types)
              ? editValues.allowed_file_types.join(',')
              : (editValues.allowed_file_types || defaults.allowed_file_types.join(','))
          }
          onChange={e => {
            const types = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            handleInputChange('allowed_file_types', types);
          }}
        />
      </div>
      
      <div className="mt-6">
        <ToggleSwitch
          checked={editValues.auto_virus_scan ?? defaults.auto_virus_scan}
          onChange={() => handleInputChange('auto_virus_scan', !editValues.auto_virus_scan)}
          label="Scan antivirus automatique"
          description="Scanner tous les fichiers uploadés"
          color="success"
        />
      </div>
    </SectionCard>
  );

  const renderNotificationsSection = () => {
    const ns = editValues.notification_settings ?? defaults.notification_settings;
    return (
      <SectionCard 
        title="Notifications"
        actions={
          <button
            onClick={() => save('notification_settings', ns)}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ToggleSwitch
            checked={ns.email_notifications}
            onChange={() => {
              const updated = { ...ns, email_notifications: !ns.email_notifications };
              handleInputChange('notification_settings', updated);
            }}
            label="Notifications Email"
            description="Envoyer des emails"
          />
          <ToggleSwitch
            checked={ns.push_notifications}
            onChange={() => {
              const updated = { ...ns, push_notifications: !ns.push_notifications };
              handleInputChange('notification_settings', updated);
            }}
            label="Notifications Push"
            description="Notifications dans le navigateur"
          />
          <ToggleSwitch
            checked={ns.sms_notifications}
            onChange={() => {
              const updated = { ...ns, sms_notifications: !ns.sms_notifications };
              handleInputChange('notification_settings', updated);
            }}
            label="Notifications SMS"
            description="Envoi de SMS"
          />
          <ToggleSwitch
            checked={ns.slack_notifications}
            onChange={() => {
              const updated = { ...ns, slack_notifications: !ns.slack_notifications };
              handleInputChange('notification_settings', updated);
            }}
            label="Notifications Slack"
            description="Intégration Slack"
          />
          <ToggleSwitch
            checked={ns.webhook_notifications}
            onChange={() => {
              const updated = { ...ns, webhook_notifications: !ns.webhook_notifications };
              handleInputChange('notification_settings', updated);
            }}
            label="Webhooks"
            description="Notifications via API"
          />
        </div>
      </SectionCard>
    );
  };

  const renderAdvancedSection = () => (
    <SectionCard title="Paramètres avancés">
      <div className="space-y-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Attention</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Ces paramètres peuvent affecter le fonctionnement de l&apos;application. 
                Modifiez-les uniquement si vous savez ce que vous faites.
              </p>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="animate-spin" size={24} />
            <span className="ml-2">Chargement...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left border border-neutral-200 dark:border-neutral-700">
              <thead className="bg-neutral-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">Clé</th>
                  <th className="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">Valeur</th>
                  <th className="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">Modifié le</th>
                  <th className="px-4 py-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {params
                  .filter(p => searchTerm ? p.key.toLowerCase().includes(searchTerm.toLowerCase()) : true)
                  .map(p => (
                  <tr key={p.key} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <td className="px-4 py-3 font-mono text-xs text-neutral-900 dark:text-neutral-100">{p.key}</td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        className="form-input w-full text-sm"
                        value={
                          typeof editValues[p.key] === 'object' && editValues[p.key] !== null
                            ? JSON.stringify(editValues[p.key], null, 2)
                            : (editValues[p.key] ?? '')
                        }
                        onChange={e => {
                          try {
                            const value = e.target.value.startsWith('{') || e.target.value.startsWith('[')
                              ? JSON.parse(e.target.value)
                              : e.target.value;
                            handleInputChange(p.key, value);
                          } catch {
                            handleInputChange(p.key, e.target.value);
                          }
                        }}
                        disabled={saving}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                      {p.updated_at ? new Date(p.updated_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="btn-primary btn-sm flex items-center gap-1"
                        onClick={() => save(p.key)}
                        disabled={saving}
                      >
                        <Save size={14} />
                        Sauver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SectionCard>
  );

  const renderEmailSection = () => {
    const es = editValues.email_settings ?? defaults.email_settings;
    return (
      <SectionCard 
        title="Configuration Email SMTP"
        actions={
          <button
            onClick={() => save('email_settings', es)}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="form-label flex items-center gap-2">
              <Mail size={16} />
              Serveur SMTP
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="smtp.gmail.com"
              value={es.smtp_host}
              onChange={e => {
                const updated = { ...es, smtp_host: e.target.value };
                handleInputChange('email_settings', updated);
              }}
            />
          </div>
          <div>
            <label className="form-label">Port SMTP</label>
            <input
              className="form-input"
              type="number"
              value={es.smtp_port}
              onChange={e => {
                const updated = { ...es, smtp_port: parseInt(e.target.value) };
                handleInputChange('email_settings', updated);
              }}
            />
          </div>
          <div>
            <label className="form-label">Utilisateur SMTP</label>
            <input
              className="form-input"
              type="text"
              value={es.smtp_user}
              onChange={e => {
                const updated = { ...es, smtp_user: e.target.value };
                handleInputChange('email_settings', updated);
              }}
            />
          </div>
          <div>
            <label className="form-label">Mot de passe SMTP</label>
            <input
              className="form-input"
              type="password"
              value={es.smtp_password}
              onChange={e => {
                const updated = { ...es, smtp_password: e.target.value };
                handleInputChange('email_settings', updated);
              }}
            />
          </div>
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Nom expéditeur</label>
              <input
                className="form-input"
                type="text"
                value={es.from_name}
                onChange={e => {
                  const updated = { ...es, from_name: e.target.value };
                  handleInputChange('email_settings', updated);
                }}
              />
            </div>
            <div>
              <label className="form-label">Email expéditeur</label>
              <input
                className="form-input"
                type="email"
                value={es.from_email}
                onChange={e => {
                  const updated = { ...es, from_email: e.target.value };
                  handleInputChange('email_settings', updated);
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <ToggleSwitch
            checked={es.smtp_secure}
            onChange={() => {
              const updated = { ...es, smtp_secure: !es.smtp_secure };
              handleInputChange('email_settings', updated);
            }}
            label="SMTP sécurisé (SSL/TLS)"
            description="Utiliser une connexion chiffrée"
            color="success"
          />
        </div>
      </SectionCard>
    );
  };

  const renderWorkflowSection = () => {
    const ws = editValues.workflow_settings ?? defaults.workflow_settings;
    return (
      <SectionCard 
        title="Paramètres Workflow"
        actions={
          <button
            onClick={() => save('workflow_settings', ws)}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ToggleSwitch
            checked={ws.auto_validation}
            onChange={() => {
              const updated = { ...ws, auto_validation: !ws.auto_validation };
              handleInputChange('workflow_settings', updated);
            }}
            label="Validation automatique"
            description="Valider automatiquement les étapes"
          />
          <ToggleSwitch
            checked={ws.require_comments}
            onChange={() => {
              const updated = { ...ws, require_comments: !ws.require_comments };
              handleInputChange('workflow_settings', updated);
            }}
            label="Commentaires obligatoires"
            description="Forcer les commentaires sur les actions"
          />
          <ToggleSwitch
            checked={ws.delivery_notification}
            onChange={() => {
              const updated = { ...ws, delivery_notification: !ws.delivery_notification };
              handleInputChange('workflow_settings', updated);
            }}
            label="Notification de livraison"
            description="Notifier lors des livraisons"
          />
          <ToggleSwitch
            checked={ws.auto_assignment}
            onChange={() => {
              const updated = { ...ws, auto_assignment: !ws.auto_assignment };
              handleInputChange('workflow_settings', updated);
            }}
            label="Attribution automatique"
            description="Assigner automatiquement les tâches"
          />
          <ToggleSwitch
            checked={ws.priority_escalation}
            onChange={() => {
              const updated = { ...ws, priority_escalation: !ws.priority_escalation };
              handleInputChange('workflow_settings', updated);
            }}
            label="Escalade prioritaire"
            description="Escalader les tâches urgentes"
            color="warning"
          />
        </div>
      </SectionCard>
    );
  };

  const renderBackupSection = () => {
    const bs = editValues.backup_settings ?? defaults.backup_settings;
    return (
      <SectionCard 
        title="Paramètres de sauvegarde"
        actions={
          <button
            onClick={() => save('backup_settings', bs)}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="form-label flex items-center gap-2">
              <HardDrive size={16} />
              Fréquence de sauvegarde
            </label>
            <select
              className="form-input"
              value={bs.backup_frequency}
              onChange={e => {
                const updated = { ...bs, backup_frequency: e.target.value };
                handleInputChange('backup_settings', updated);
              }}
            >
              <option value="hourly">Toutes les heures</option>
              <option value="daily">Quotidienne</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuelle</option>
            </select>
          </div>
          <div>
            <label className="form-label">Rétention (jours)</label>
            <input
              className="form-input"
              type="number"
              min={1}
              max={365}
              value={bs.retention_days}
              onChange={e => {
                const updated = { ...bs, retention_days: parseInt(e.target.value) };
                handleInputChange('backup_settings', updated);
              }}
            />
          </div>
          <div>
            <label className="form-label">Localisation</label>
            <select
              className="form-input"
              value={bs.backup_location}
              onChange={e => {
                const updated = { ...bs, backup_location: e.target.value };
                handleInputChange('backup_settings', updated);
              }}
            >
              <option value="local">Local</option>
              <option value="cloud">Cloud</option>
              <option value="both">Local + Cloud</option>
            </select>
          </div>
        </div>
        
        <div className="mt-6">
          <ToggleSwitch
            checked={bs.auto_backup}
            onChange={() => {
              const updated = { ...bs, auto_backup: !bs.auto_backup };
              handleInputChange('backup_settings', updated);
            }}
            label="Sauvegarde automatique"
            description="Effectuer des sauvegardes automatiques"
            color="success"
          />
        </div>
      </SectionCard>
    );
  };

  const renderPerformanceSection = () => {
    const ps = editValues.performance_settings ?? defaults.performance_settings;
    return (
      <SectionCard 
        title="Paramètres de performance"
        actions={
          <button
            onClick={() => save('performance_settings', ps)}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="form-label flex items-center gap-2">
              <Monitor size={16} />
              TTL Cache (secondes)
            </label>
            <input
              className="form-input"
              type="number"
              min={60}
              max={86400}
              value={ps.cache_ttl}
              onChange={e => {
                const updated = { ...ps, cache_ttl: parseInt(e.target.value) };
                handleInputChange('performance_settings', updated);
              }}
            />
          </div>
          <div>
            <label className="form-label">Niveau de logs</label>
            <select
              className="form-input"
              value={ps.log_level}
              onChange={e => {
                const updated = { ...ps, log_level: e.target.value };
                handleInputChange('performance_settings', updated);
              }}
            >
              <option value="error">Error</option>
              <option value="warn">Warning</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ToggleSwitch
            checked={ps.cache_enabled}
            onChange={() => {
              const updated = { ...ps, cache_enabled: !ps.cache_enabled };
              handleInputChange('performance_settings', updated);
            }}
            label="Cache activé"
            description="Utiliser le système de cache"
            color="success"
          />
          <ToggleSwitch
            checked={ps.compression_enabled}
            onChange={() => {
              const updated = { ...ps, compression_enabled: !ps.compression_enabled };
              handleInputChange('performance_settings', updated);
            }}
            label="Compression activée"
            description="Compresser les réponses"
          />
          <ToggleSwitch
            checked={ps.cdn_enabled}
            onChange={() => {
              const updated = { ...ps, cdn_enabled: !ps.cdn_enabled };
              handleInputChange('performance_settings', updated);
            }}
            label="CDN activé"
            description="Utiliser le réseau de distribution"
          />
        </div>
      </SectionCard>
    );
  };

  const renderApiSection = () => {
    const as = editValues.api_settings ?? defaults.api_settings;
    return (
      <SectionCard 
        title="Paramètres API"
        actions={
          <button
            onClick={() => save('api_settings', as)}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="form-label flex items-center gap-2">
              <Globe size={16} />
              Limite de taux (req/heure)
            </label>
            <input
              className="form-input"
              type="number"
              min={100}
              max={10000}
              value={as.rate_limit}
              onChange={e => {
                const updated = { ...as, rate_limit: parseInt(e.target.value) };
                handleInputChange('api_settings', updated);
              }}
            />
          </div>
          <div>
            <label className="form-label">Timeout webhook (secondes)</label>
            <input
              className="form-input"
              type="number"
              min={5}
              max={120}
              value={as.webhook_timeout}
              onChange={e => {
                const updated = { ...as, webhook_timeout: parseInt(e.target.value) };
                handleInputChange('api_settings', updated);
              }}
            />
          </div>
        </div>
        
        <div className="mt-6">
          <label className="form-label">Origines CORS autorisées</label>
          <input
            className="form-input"
            type="text"
            placeholder="http://localhost:3001,https://app.example.com"
            value={Array.isArray(as.cors_origins) ? as.cors_origins.join(',') : ''}
            onChange={e => {
              const origins = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
              const updated = { ...as, cors_origins: origins };
              handleInputChange('api_settings', updated);
            }}
          />
        </div>
        
        <div className="mt-6">
          <ToggleSwitch
            checked={as.api_key_required}
            onChange={() => {
              const updated = { ...as, api_key_required: !as.api_key_required };
              handleInputChange('api_settings', updated);
            }}
            label="Clé API obligatoire"
            description="Exiger une clé API pour tous les appels"
            color="warning"
          />
        </div>
      </SectionCard>
    );
  };

  const renderDocumentsSection = () => {
    const ds = editValues.documents_settings ?? defaults.documents_settings;
    const DevisTemplate = devisTemplates[ds.devis_template] || devisTemplates.simple;
    const FactureTemplate = factureTemplates[ds.facture_template] || factureTemplates.simple;

    const previewData = {
      company: {
        name: editValues.company_name || 'Votre Entreprise',
        logo: editValues.company_logo || '',
        address: 'Adresse entreprise\nVille, Pays',
        phone: '+33 1 23 45 67 89',
        email: 'contact@entreprise.com',
      },
      client: {
        name: 'Client Exemple',
        address: 'Rue Exemple\n75000 Paris',
        phone: '+33 6 12 34 56 78',
        email: 'client@example.com',
      },
      meta: {
        number: 'DEV-2025-001',
        date: new Date().toLocaleDateString('fr-FR'),
        dueDate: new Date(Date.now() + 14*24*3600*1000).toLocaleDateString('fr-FR'),
        validUntil: new Date(Date.now() + 30*24*3600*1000).toLocaleDateString('fr-FR'),
      },
      items: [
        { description: 'Impression Flyers A5', detail: 'Couleur, 170g, Recto/Verso', qty: 1000, unitPrice: 120, total: 120000 },
        { description: 'Bâche publicitaire 2x1m', detail: 'Œillets tous les côtés', qty: 2, unitPrice: 35000, total: 70000 },
      ],
      totals: { subtotal: 190000, tax: 0, total: 190000, currency: 'FCFA' },
      notes: 'Merci pour votre confiance. Devis valable 30 jours.',
    };

    return (
      <SectionCard 
        title="Modèles de documents (Devis & Factures)"
        actions={
          <button
            onClick={() => save('documents_settings', ds)}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="form-label">Modèle de devis</label>
            <select
              className="form-input"
              value={ds.devis_template}
              onChange={e => {
                const updated = { ...ds, devis_template: e.target.value };
                handleInputChange('documents_settings', updated);
              }}
            >
              {Object.keys(devisTemplates).map(key => (
                <option key={key} value={key}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Modèle de facture</label>
            <select
              className="form-input"
              value={ds.facture_template}
              onChange={e => {
                const updated = { ...ds, facture_template: e.target.value };
                handleInputChange('documents_settings', updated);
              }}
            >
              {Object.keys(factureTemplates).map(key => (
                <option key={key} value={key}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Previews */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-3">Aperçu Devis</h4>
            <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <DevisTemplate data={previewData} />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mb-3">Aperçu Facture</h4>
            <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
              <FactureTemplate data={{ ...previewData, meta: { ...previewData.meta, number: 'FAC-2025-001' } }} />
            </div>
          </div>
        </div>
      </SectionCard>
    );
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general': return renderGeneralSection();
      case 'customization': return (
        <div className="max-w-6xl space-y-8">
          <SectionCard title="🎨 Personnalisation du Design System">
            <div className="space-y-6">
              {/* Guide de personnalisation */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                  <Palette size={20} />
                  Personnaliser les couleurs
                </h3>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
                  Avec le nouveau système, vous pouvez personnaliser les couleurs directement dans le fichier CSS :
                </p>
                
                <div className="space-y-4">
                  <div className="p-4 bg-white/70 dark:bg-black/20 rounded-lg border border-purple-200/50 dark:border-purple-700/50">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">📁 Fichier à modifier :</h4>
                    <code className="text-sm font-mono bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded text-purple-800 dark:text-purple-200">
                      src/styles/design-system.css
                    </code>
                  </div>
                  
                  <div className="p-4 bg-white/70 dark:bg-black/20 rounded-lg border border-purple-200/50 dark:border-purple-700/50">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">🎯 Section à personnaliser :</h4>
                    <div className="text-xs font-mono bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                      <div className="text-green-400">/* COLOR PRIMITIVES - Palette de base */</div>
                      <div className="text-blue-300">:root {`{`}</div>
                      <div className="text-yellow-300 ml-2">--color-brand-500: #3b82f6; <span className="text-gray-400">/* ← Couleur principale */</span></div>
                      <div className="text-yellow-300 ml-2">--color-brand-600: #2563eb; <span className="text-gray-400">/* ← Couleur foncée */</span></div>
                      <div className="text-yellow-300 ml-2">--color-brand-700: #1d4ed8; <span className="text-gray-400">/* ← Couleur très foncée */</span></div>
                      <div className="text-blue-300">{`}`}</div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-white/70 dark:bg-black/20 rounded-lg border border-purple-200/50 dark:border-purple-700/50">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">🎨 Exemples de palettes :</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                      <div className="p-3 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600">
                        <div className="text-white text-xs font-medium mb-1">Bleu (défaut)</div>
                        <div className="text-white/80 text-xs">#3b82f6</div>
                      </div>
                      <div className="p-3 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600">
                        <div className="text-white text-xs font-medium mb-1">Violet</div>
                        <div className="text-white/80 text-xs">#8b5cf6</div>
                      </div>
                      <div className="p-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600">
                        <div className="text-white text-xs font-medium mb-1">Vert</div>
                        <div className="text-white/80 text-xs">#22c55e</div>
                      </div>
                      <div className="p-3 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600">
                        <div className="text-white text-xs font-medium mb-1">Orange</div>
                        <div className="text-white/80 text-xs">#f97316</div>
                      </div>
                      <div className="p-3 rounded-lg bg-gradient-to-r from-pink-500 to-pink-600">
                        <div className="text-white text-xs font-medium mb-1">Rose</div>
                        <div className="text-white/80 text-xs">#ec4899</div>
                      </div>
                      <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600">
                        <div className="text-white text-xs font-medium mb-1">Cyan</div>
                        <div className="text-white/80 text-xs">#06b6d4</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Guide étape par étape */}
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
                <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  📋 Comment personnaliser (étape par étape)
                </h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-blue-600 dark:text-blue-300">1</span>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Ouvrir le fichier design-system.css</p>
                      <code className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">code src/styles/design-system.css</code>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-blue-600 dark:text-blue-300">2</span>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Trouver la section COLOR PRIMITIVES (ligne ~20)</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">Modifiez les valeurs --color-brand-* avec vos couleurs préférées</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-blue-600 dark:text-blue-300">3</span>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Sauvegarder le fichier</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">Les changements s'appliquent automatiquement grâce au hot reload</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-green-600 dark:text-green-300">✓</span>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Profiter de votre nouveau thème !</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">Toute la plateforme utilise maintenant vos couleurs personnalisées</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Documentation */}
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
                <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  📚 Documentation complète
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">NOUVEAU_SYSTEME_THEME.md</h5>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Vue d'ensemble complète du nouveau système</p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <h5 className="font-semibold text-green-900 dark:text-green-100 mb-2">GUIDE_COULEURS.md</h5>
                    <p className="text-xs text-green-700 dark:text-green-300">Guide détaillé de personnalisation des couleurs</p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      );
      case 'theme': return (
        <div className="max-w-6xl space-y-8">
          {/* Section Nouveau Système de Thème */}
          <SectionCard title="🎨 Système de Thème Professionnel">
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                  <Palette size={20} />
                  Nouveau Design System
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                  Votre plateforme utilise maintenant un système de thème professionnel basé sur Material Design 3 avec :
                </p>
                <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Variables CSS sémantiques (nommées par usage, pas par couleur)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>2 modes : Clair & Sombre (plus simple et performant)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Détection automatique des préférences système</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Transitions fluides et accessibilité WCAG AA</span>
                  </li>
                </ul>
              </div>

              {/* Guide d'utilisation */}
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
                <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  Comment changer de thème ?
                </h4>
                <div className="space-y-3 text-sm text-neutral-700 dark:text-neutral-300">
                  <div className="flex items-start gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-blue-600 dark:text-blue-300">1</span>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Via le menu latéral</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        Le sélecteur de thème se trouve en bas du menu latéral (sidebar), juste au-dessus du bouton "Déconnexion"
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-blue-600 dark:text-blue-300">2</span>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Trois options disponibles</p>
                      <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1 mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-500">☀️</span>
                          <span><strong>Mode Clair</strong> - Fond clair, idéal pour la journée</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-500">🌙</span>
                          <span><strong>Mode Sombre</strong> - Fond sombre, réduit la fatigue oculaire</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">💻</span>
                          <span><strong>Mode Système</strong> - S'adapte automatiquement à vos préférences</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Variables CSS disponibles */}
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6">
                <h4 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
                  Variables CSS disponibles
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">SURFACES</p>
                    <code className="text-xs text-neutral-700 dark:text-neutral-300 block mb-1">--surface-base</code>
                    <code className="text-xs text-neutral-700 dark:text-neutral-300 block mb-1">--background-primary</code>
                    <code className="text-xs text-neutral-700 dark:text-neutral-300 block">--background-secondary</code>
                  </div>
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">TEXTE</p>
                    <code className="text-xs text-neutral-700 dark:text-neutral-300 block mb-1">--text-primary</code>
                    <code className="text-xs text-neutral-700 dark:text-neutral-300 block mb-1">--text-secondary</code>
                    <code className="text-xs text-neutral-700 dark:text-neutral-300 block">--text-tertiary</code>
                  </div>
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2">INTERACTIF</p>
                    <code className="text-xs text-neutral-700 dark:text-neutral-300 block mb-1">--interactive-default</code>
                    <code className="text-xs text-neutral-700 dark:text-neutral-300 block mb-1">--interactive-hover</code>
                    <code className="text-xs text-neutral-700 dark:text-neutral-300 block">--interactive-active</code>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-4">
                  📚 Consultez la documentation complète dans <code className="px-1 py-0.5 bg-neutral-200 dark:bg-neutral-700 rounded">NOUVEAU_SYSTEME_THEME.md</code>
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      );
      case 'security': return renderSecuritySection();
      case 'files': return renderFilesSection();
      case 'notifications': return renderNotificationsSection();
      case 'email': return renderEmailSection();
      case 'workflow': return renderWorkflowSection();
      case 'backup': return renderBackupSection();
      case 'performance': return renderPerformanceSection();
      case 'api': return renderApiSection();
      case 'advanced': return renderAdvancedSection();
      case 'documents': return renderDocumentsSection();
      default: return renderGeneralSection();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-neutral-600 dark:text-neutral-400">Chargement des paramètres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
              <SettingsIcon className="text-blue-600" size={32} />
              Paramètres système
              <div className="group relative">
                <HelpCircle className="text-neutral-400 hover:text-blue-600 cursor-help" size={20} />
                <div className="absolute left-0 top-8 bg-neutral-900 dark:bg-neutral-700 text-white text-xs px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 w-64">
                  Configuration centralisée de la plateforme. Les modifications sont sauvegardées individuellement ou en lot.
                </div>
              </div>
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400 mt-1">
              Configuration et administration de la plateforme
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Actions globales */}
            <div className="flex items-center gap-2">
              <div className="group relative">
                <button
                  onClick={exportConfig}
                  disabled={saving}
                  className="btn-secondary flex items-center gap-2 text-sm"
                  title="Exporter la configuration"
                >
                  <Download size={16} />
                  Exporter
                </button>
              </div>
              
              <div className="group relative">
                <button
                  onClick={() => setShowImportModal(true)}
                  disabled={saving}
                  className="btn-secondary flex items-center gap-2 text-sm"
                  title="Importer une configuration"
                >
                  <FileUp size={16} />
                  Importer
                </button>
              </div>
              
              {hasUnsavedChanges && (
                <button
                  onClick={saveAll}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 text-sm"
                  title="Sauvegarder tous les changements"
                >
                  <Save size={16} />
                  Enregistrer tout
                </button>
              )}
            </div>
            
            {hasUnsavedChanges && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg"
              >
                <AlertTriangle size={16} />
                <span className="text-sm">Modifications non sauvegardées</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-100px)]">
        {/* Sidebar Améliorée */}
        <div className="w-64 bg-white dark:bg-neutral-800 border-r border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div className="p-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-full px-4 py-2.5 pl-10 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <SettingsIcon className="absolute left-3 top-3 text-neutral-400" size={16} />
            </div>
          </div>
          
          <nav className="px-2 pb-4">
            {sections.map(section => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 mb-1 rounded-lg text-left transition-all duration-200 group ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium shadow-sm'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200'} />
                  <span className="text-sm">{section.name}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content Amélioré */}
        <div className="flex-1 p-8 overflow-y-auto bg-neutral-50 dark:bg-neutral-900">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderSectionContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      
      {/* Modal d'import de configuration */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowImportModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-neutral-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                    <FileUp size={20} />
                    Importer une configuration
                  </h3>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  Collez le contenu JSON d'une configuration exportée précédemment :
                </p>
                
                <textarea
                  className="w-full h-64 p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg font-mono text-sm bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white"
                  placeholder='{\n  "exported_at": "2024-01-01T00:00:00.000Z",\n  "settings": {\n    "app_name": "Mon App",\n    ...\n  }\n}'
                  value={importData}
                  onChange={e => setImportData(e.target.value)}
                />
              </div>
              
              <div className="p-6 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="btn-secondary"
                >
                  Annuler
                </button>
                <button
                  onClick={importConfig}
                  disabled={!importData.trim()}
                  className="btn-primary flex items-center gap-2"
                >
                  <FileUp size={16} />
                  Importer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Modal de confirmation */}
      <AnimatePresence>
        {showConfirmModal && confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-neutral-800 rounded-lg max-w-md w-full"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="text-orange-500 flex-shrink-0" size={24} />
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                    Confirmation requise
                  </h3>
                </div>
                
                <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                  {confirmAction.action}
                </p>
                
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="btn-secondary"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      confirmAction.callback();
                      setShowConfirmModal(false);
                    }}
                    className="btn-primary bg-orange-600 hover:bg-orange-700 flex items-center gap-2"
                  >
                    <Check size={16} />
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Settings;