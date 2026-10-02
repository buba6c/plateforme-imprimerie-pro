/**
 * Service de notification pour les livraisons programmées
 * Vérifie les livraisons du jour et notifie le livreur
 */

import notificationService from './notificationService';

class LivraisonNotificationService {
  constructor() {
    this.checkInterval = null;
    this.notifiedDossiers = new Set(); // Pour éviter les notifications en double
    this.audio = null;
  }

  /**
   * Vérifie si une date de livraison est aujourd'hui
   */
  isToday(dateString) {
    if (!dateString) return false;
    
    const livraisonDate = new Date(dateString);
    const today = new Date();
    
    return livraisonDate.getDate() === today.getDate() &&
           livraisonDate.getMonth() === today.getMonth() &&
           livraisonDate.getFullYear() === today.getFullYear();
  }

  /**
   * Vérifie si l'heure de livraison est proche (dans les 30 prochaines minutes)
   */
  isTimeSoon(dateString) {
    if (!dateString) return false;
    
    const livraisonDate = new Date(dateString);
    const now = new Date();
    const diffMinutes = (livraisonDate - now) / (1000 * 60);
    
    // Dans les 30 prochaines minutes et pas encore passé
    return diffMinutes > 0 && diffMinutes <= 30;
  }

  /**
   * Joue un son de notification
   */
  playNotificationSound() {
    try {
      // Créer un contexte audio si nécessaire
      if (!this.audio) {
        // Utiliser l'API Web Audio pour générer un son
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800; // Fréquence en Hz
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        // Deuxième bip
        setTimeout(() => {
          const osc2 = audioContext.createOscillator();
          const gain2 = audioContext.createGain();
          osc2.connect(gain2);
          gain2.connect(audioContext.destination);
          osc2.frequency.value = 1000;
          osc2.type = 'sine';
          gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          osc2.start(audioContext.currentTime);
          osc2.stop(audioContext.currentTime + 0.5);
        }, 200);
      }
    } catch (error) {
      console.error('Erreur lors de la lecture du son:', error);
    }
  }

  /**
   * Vérifie les livraisons à effectuer aujourd'hui
   */
  checkLivraisonsAujourdhui(dossiers) {
    if (!Array.isArray(dossiers)) return [];

    const livraisonsAujourdhui = dossiers.filter(d => {
      // Doit avoir une date programmée
      if (!d.date_livraison_prevue) return false;
      
      // Doit être aujourd'hui
      if (!this.isToday(d.date_livraison_prevue)) return false;
      
      // Doit être à livrer (pas encore livré)
      const statut = (d.statut || d.status || '').toLowerCase();
      return statut === 'pret_livraison' || statut === 'en_livraison';
    });

    return livraisonsAujourdhui;
  }

  /**
   * Notifie le livreur des livraisons à effectuer
   */
  notifyLivreur(dossiers) {
    const livraisonsAujourdhui = this.checkLivraisonsAujourdhui(dossiers);
    
    livraisonsAujourdhui.forEach(dossier => {
      const dossierId = dossier.id;
      
      // Éviter les notifications en double
      if (this.notifiedDossiers.has(dossierId)) return;
      
      this.notifiedDossiers.add(dossierId);
      
      const livraisonDate = new Date(dossier.date_livraison_prevue);
      const heureFormatted = livraisonDate.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Notification visuelle
      const message = `📦 Livraison programmée aujourd'hui à ${heureFormatted}\nClient: ${dossier.nom_client || dossier.client || 'N/A'}\nDossier: ${dossier.numero || dossier.numero_dossier || '#' + dossierId}`;
      
      notificationService.showNotification({
        title: '🔔 Livraison à effectuer',
        message: message,
        type: 'warning',
        duration: 10000, // 10 secondes
        action: {
          label: 'Voir le dossier',
          callback: () => {
            // Émettre un événement personnalisé pour ouvrir le dossier
            window.dispatchEvent(new CustomEvent('openDossierFromNotification', { 
              detail: { dossierId } 
            }));
          }
        }
      });
      
      // Son de notification
      this.playNotificationSound();
      
      // Si l'heure est très proche (< 30 min), notification plus insistante
      if (this.isTimeSoon(dossier.date_livraison_prevue)) {
        setTimeout(() => {
          this.playNotificationSound();
          notificationService.showNotification({
            title: '⚠️ LIVRAISON IMMINENTE',
            message: `La livraison pour ${dossier.nom_client || dossier.client} est prévue dans moins de 30 minutes !`,
            type: 'error',
            duration: 15000
          });
        }, 2000);
      }
    });
    
    return livraisonsAujourdhui;
  }

  /**
   * Démarre la vérification périodique
   */
  startChecking(getDossiersCallback, intervalMinutes = 5) {
    // Vérification immédiate
    this.performCheck(getDossiersCallback);
    
    // Puis vérification périodique
    this.checkInterval = setInterval(() => {
      this.performCheck(getDossiersCallback);
    }, intervalMinutes * 60 * 1000);
    
    console.log(`✅ Vérification des livraisons programmées démarrée (toutes les ${intervalMinutes} minutes)`);
  }

  /**
   * Effectue une vérification
   */
  async performCheck(getDossiersCallback) {
    try {
      const dossiers = await getDossiersCallback();
      this.notifyLivreur(dossiers);
    } catch (error) {
      console.error('Erreur lors de la vérification des livraisons:', error);
    }
  }

  /**
   * Arrête la vérification périodique
   */
  stopChecking() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏹️ Vérification des livraisons programmées arrêtée');
    }
  }

  /**
   * Réinitialise les notifications (pour forcer une nouvelle notification)
   */
  resetNotifications() {
    this.notifiedDossiers.clear();
  }

  /**
   * Marque un dossier comme notifié
   */
  markAsNotified(dossierId) {
    this.notifiedDossiers.add(dossierId);
  }
}

// Instance singleton
const livraisonNotificationService = new LivraisonNotificationService();

export default livraisonNotificationService;
