import React, { useState } from 'react';
import { useRealtimeEstimation } from '../hooks/useRealtimeEstimation';
import { RealtimePriceDisplay } from '../components/RealtimePriceDisplay';

/**
 * Exemple d'utilisation: Formulaire de devis avec estimation en temps réel
 * 
 * Ce composant montre comment intégrer l'estimation en temps réel
 * dans un formulaire de création de devis
 */
export function DevisFormWithRealtimeEstimation() {
  const [machineType, setMachineType] = useState('roland');
  
  // État du formulaire Roland
  const [rolandData, setRolandData] = useState({
    largeur: '',
    hauteur: '',
    unite: 'cm',
    support: '',
    quantite: 1,
    finitions: [],
    options: []
  });
  
  // État du formulaire Xerox
  const [xeroxData, setXeroxData] = useState({
    nombre_pages: '',
    exemplaires: 1,
    papier: '',
    couleur: 'noir_et_blanc',
    finitions: [],
    reliure: ''
  });
  
  // Hook d'estimation en temps réel
  const formData = machineType === 'roland' ? rolandData : xeroxData;
  const { estimation, loading, error } = useRealtimeEstimation(formData, machineType);
  
  /**
   * Gestion des changements Roland
   */
  const handleRolandChange = (field, value) => {
    setRolandData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  /**
   * Gestion des changements Xerox
   */
  const handleXeroxChange = (field, value) => {
    setXeroxData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  /**
   * Gestion des finitions (multi-sélection)
   */
  const toggleFinition = (finition) => {
    const data = machineType === 'roland' ? rolandData : xeroxData;
    const setData = machineType === 'roland' ? setRolandData : setXeroxData;
    
    const currentFinitions = data.finitions || [];
    const newFinitions = currentFinitions.includes(finition)
      ? currentFinitions.filter(f => f !== finition)
      : [...currentFinitions, finition];
    
    setData(prev => ({
      ...prev,
      finitions: newFinitions
    }));
  };
  
  return (
    <div className="devis-form-container">
      <div className="form-and-price">
        
        {/* Formulaire à gauche */}
        <div className="devis-form">
          <h2>Créer un Devis</h2>
          
          {/* Sélecteur de machine */}
          <div className="form-group">
            <label>Type de machine:</label>
            <select 
              value={machineType} 
              onChange={(e) => setMachineType(e.target.value)}
              className="form-control"
            >
              <option value="roland">Roland (Grand Format)</option>
              <option value="xerox">Xerox (Numérique)</option>
            </select>
          </div>
          
          {/* Formulaire Roland */}
          {machineType === 'roland' && (
            <div className="machine-form">
              <h3>📐 Dimensions</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Largeur:</label>
                  <input
                    type="number"
                    value={rolandData.largeur}
                    onChange={(e) => handleRolandChange('largeur', e.target.value)}
                    className="form-control"
                    placeholder="Ex: 200"
                  />
                </div>
                
                <div className="form-group">
                  <label>Hauteur:</label>
                  <input
                    type="number"
                    value={rolandData.hauteur}
                    onChange={(e) => handleRolandChange('hauteur', e.target.value)}
                    className="form-control"
                    placeholder="Ex: 150"
                  />
                </div>
                
                <div className="form-group">
                  <label>Unité:</label>
                  <select
                    value={rolandData.unite}
                    onChange={(e) => handleRolandChange('unite', e.target.value)}
                    className="form-control"
                  >
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="mm">mm</option>
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Support:</label>
                <select
                  value={rolandData.support}
                  onChange={(e) => handleRolandChange('support', e.target.value)}
                  className="form-control"
                >
                  <option value="">Sélectionner...</option>
                  <option value="bache">Bâche</option>
                  <option value="vinyle">Vinyle</option>
                  <option value="adhesif">Adhésif</option>
                  <option value="papier">Papier</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Quantité:</label>
                <input
                  type="number"
                  value={rolandData.quantite}
                  onChange={(e) => handleRolandChange('quantite', e.target.value)}
                  className="form-control"
                  min="1"
                />
              </div>
              
              <div className="form-group">
                <label>Finitions:</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={rolandData.finitions.includes('pelliculage')}
                      onChange={() => toggleFinition('pelliculage')}
                    />
                    Pelliculage
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={rolandData.finitions.includes('decoupe')}
                      onChange={() => toggleFinition('decoupe')}
                    />
                    Découpe
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={rolandData.finitions.includes('pose')}
                      onChange={() => toggleFinition('pose')}
                    />
                    Pose
                  </label>
                </div>
              </div>
            </div>
          )}
          
          {/* Formulaire Xerox */}
          {machineType === 'xerox' && (
            <div className="machine-form">
              <h3>📄 Document</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre de pages:</label>
                  <input
                    type="number"
                    value={xeroxData.nombre_pages}
                    onChange={(e) => handleXeroxChange('nombre_pages', e.target.value)}
                    className="form-control"
                    placeholder="Ex: 20"
                    min="1"
                  />
                </div>
                
                <div className="form-group">
                  <label>Exemplaires:</label>
                  <input
                    type="number"
                    value={xeroxData.exemplaires}
                    onChange={(e) => handleXeroxChange('exemplaires', e.target.value)}
                    className="form-control"
                    min="1"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Type de papier:</label>
                <select
                  value={xeroxData.papier}
                  onChange={(e) => handleXeroxChange('papier', e.target.value)}
                  className="form-control"
                >
                  <option value="">Sélectionner...</option>
                  <option value="a4_80g">A4 80g</option>
                  <option value="a4_120g">A4 120g</option>
                  <option value="a3_80g">A3 80g</option>
                  <option value="a3_120g">A3 120g</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Impression:</label>
                <select
                  value={xeroxData.couleur}
                  onChange={(e) => handleXeroxChange('couleur', e.target.value)}
                  className="form-control"
                >
                  <option value="noir_et_blanc">Noir et blanc</option>
                  <option value="couleur">Couleur</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Reliure:</label>
                <select
                  value={xeroxData.reliure}
                  onChange={(e) => handleXeroxChange('reliure', e.target.value)}
                  className="form-control"
                >
                  <option value="">Aucune</option>
                  <option value="spirale">Spirale</option>
                  <option value="dos_carre_colle">Dos carré collé</option>
                  <option value="agrafage">Agrafage</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Finitions:</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={xeroxData.finitions.includes('perforation')}
                      onChange={() => toggleFinition('perforation')}
                    />
                    Perforation
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={xeroxData.finitions.includes('pliage')}
                      onChange={() => toggleFinition('pliage')}
                    />
                    Pliage
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Estimation en temps réel à droite */}
        <div className="price-sidebar">
          <RealtimePriceDisplay 
            estimation={estimation}
            loading={loading}
            error={error}
          />
          
          {/* Informations additionnelles */}
          <div className="info-box">
            <h4>ℹ️ Informations</h4>
            <ul>
              <li>Le prix est calculé automatiquement pendant la saisie</li>
              <li>Délai de recalcul: 300ms après modification</li>
              <li>Les calculs sont mis en cache pour plus de rapidité</li>
              <li>Le prix final peut être ajusté par l'administrateur</li>
            </ul>
          </div>
        </div>
        
      </div>
    </div>
  );
}

export default DevisFormWithRealtimeEstimation;
