import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

/**
 * Hook personnalisé pour calculer l'estimation de prix en temps réel
 * @param {string} machineType - Type de machine (roland/xerox)
 * @param {object} formData - Données du formulaire
 * @returns {object} - Estimation avec détails et total
 */
const usePriceEstimation = (machineType, formData) => {
  const [tarifs, setTarifs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger les tarifs au montage
  useEffect(() => {
    const fetchTarifs = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        const response = await axios.get(`${API_URL}/tarifs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Organiser les tarifs par type et clé pour accès rapide
        const tarifsMap = {};
        (response.data.tarifs || []).forEach(t => {
          const key = `${t.type_machine}_${t.categorie}_${t.cle}`;
          tarifsMap[key] = t.valeur;
        });
        
        setTarifs(tarifsMap);
        setError(null);
      } catch (err) {
        setError('Erreur chargement tarifs');
        console.error('Erreur tarifs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTarifs();
  }, []);

  // Calcul estimation basé sur les données du formulaire
  const estimation = useMemo(() => {
    if (!tarifs || !machineType || loading) {
      return { items: [], subtotal: 0, total: 0, tva: 0 };
    }

    const items = [];
    let subtotal = 0;

    try {
      if (machineType === 'roland') {
        // Calcul pour Roland (grand format)
        const { type_support, largeur, hauteur, unite, nombre_exemplaires, finition_oeillets, finition_position } = formData;
        
        if (largeur && hauteur) {
          // Calcul surface en m²
          let w = parseFloat(largeur) || 0;
          let h = parseFloat(hauteur) || 0;
          
          if (unite === 'mm') {
            w = w / 1000;
            h = h / 1000;
          } else if (unite === 'cm') {
            w = w / 100;
            h = h / 100;
          }
          
          const surface = w * h;
          const qty = parseInt(nombre_exemplaires) || 1;
          
          // Tarif base selon type support
          let prixM2 = 7000; // Prix par défaut
          
          if (type_support) {
            const tarifSupport = tarifs[`roland_supports_${type_support.toLowerCase().replace(/[^a-z0-9]/g, '_')}`];
            if (tarifSupport) prixM2 = tarifSupport;
          }
          
          const prixBase = surface * prixM2 * qty;
          
          items.push({
            label: `${type_support || 'Support'} - ${(surface * qty).toFixed(2)} m² (${qty} ex)`,
            unit_price: prixM2,
            quantity: surface * qty,
            total: prixBase
          });
          
          subtotal += prixBase;
          
          // Finitions
          if (finition_oeillets) {
            let prixFinition = 0;
            
            if (finition_oeillets === 'Oeillet') {
              const tarifOeillet = tarifs['roland_finitions_oeillet'] || 2000;
              prixFinition = tarifOeillet * surface * qty;
              
              if (finition_position === 'Tous les côtés') {
                prixFinition *= 1.5; // Majoration tous côtés
              }
            } else if (finition_oeillets === 'Collage') {
              const tarifCollage = tarifs['roland_finitions_collage'] || 1500;
              prixFinition = tarifCollage * surface * qty;
            } else if (finition_oeillets === 'Découpé') {
              const tarifDecoupe = tarifs['roland_finitions_decoupe'] || 1000;
              prixFinition = tarifDecoupe * surface * qty;
            }
            
            if (prixFinition > 0) {
              items.push({
                label: `Finition: ${finition_oeillets}${finition_position ? ' - ' + finition_position : ''}`,
                unit_price: prixFinition / (surface * qty),
                quantity: surface * qty,
                total: prixFinition
              });
              subtotal += prixFinition;
            }
          }
        }
      } else if (machineType === 'xerox') {
        // Calcul pour Xerox (impression numérique)
        const { 
          type_document, 
          format, 
          nombre_exemplaires, 
          couleur_impression, 
          mode_impression,
          grammage,
          finition = [],
          faconnage = [],
          conditionnement = []
        } = formData;
        
        const qty = parseInt(nombre_exemplaires) || 0;
        
        if (qty > 0 && format) {
          // Tarif base impression
          let prixUnitaire = 50; // Prix par défaut par exemplaire
          
          // Ajustement selon couleur
          if (couleur_impression === 'couleur') {
            prixUnitaire = tarifs['xerox_impression_couleur'] || 100;
          } else {
            prixUnitaire = tarifs['xerox_impression_nb'] || 50;
          }
          
          // Ajustement recto-verso
          if (mode_impression === 'recto_verso') {
            prixUnitaire *= 1.8; // +80% pour recto-verso
          }
          
          // Ajustement selon format
          if (format.includes('A3')) {
            prixUnitaire *= 1.5;
          } else if (format.includes('A5')) {
            prixUnitaire *= 0.7;
          } else if (format.includes('Carte de visite')) {
            prixUnitaire *= 0.5;
          }
          
          const prixImpression = prixUnitaire * qty;
          
          items.push({
            label: `Impression ${couleur_impression} ${mode_impression} - ${format}`,
            unit_price: prixUnitaire,
            quantity: qty,
            total: prixImpression
          });
          
          subtotal += prixImpression;
          
          // Grammage spécial
          if (grammage && grammage !== '135g') {
            const tarifGrammage = tarifs[`xerox_grammage_${grammage.toLowerCase().replace(/[^a-z0-9]/g, '_')}`] || 0;
            if (tarifGrammage > 0) {
              const prixGrammage = tarifGrammage * qty;
              items.push({
                label: `Papier ${grammage}`,
                unit_price: tarifGrammage,
                quantity: qty,
                total: prixGrammage
              });
              subtotal += prixGrammage;
            }
          }
          
          // Finitions
          finition.forEach(f => {
            const tarifFinition = tarifs[`xerox_finitions_${f.toLowerCase().replace(/[^a-z0-9]/g, '_')}`] || 500;
            const prixFinition = tarifFinition * qty;
            items.push({
              label: f,
              unit_price: tarifFinition,
              quantity: qty,
              total: prixFinition
            });
            subtotal += prixFinition;
          });
          
          // Façonnages
          faconnage.forEach(fac => {
            const tarifFac = tarifs[`xerox_faconnage_${fac.toLowerCase().replace(/[^a-z0-9]/g, '_')}`] || 300;
            const prixFac = tarifFac * qty;
            items.push({
              label: `Façonnage: ${fac}`,
              unit_price: tarifFac,
              quantity: qty,
              total: prixFac
            });
            subtotal += prixFac;
          });
          
          // Conditionnement
          conditionnement.forEach(cond => {
            const tarifCond = tarifs['xerox_conditionnement'] || 200;
            const prixCond = tarifCond;
            items.push({
              label: `Conditionnement: ${cond}`,
              unit_price: tarifCond,
              quantity: 1,
              total: prixCond
            });
            subtotal += prixCond;
          });
        }
      }
    } catch (err) {
      console.error('Erreur calcul estimation:', err);
    }

    // TVA 18% (ajustez selon votre pays)
    const tva = subtotal * 0.18;
    const total = subtotal + tva;

    return {
      items,
      subtotal: Math.round(subtotal),
      tva: Math.round(tva),
      total: Math.round(total),
      hasData: items.length > 0
    };
  }, [machineType, formData, tarifs, loading]);

  return {
    estimation,
    loading,
    error
  };
};

export default usePriceEstimation;
