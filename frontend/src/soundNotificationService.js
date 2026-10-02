/**
 * Service de notifications sonores
 * Gère les sons de notification pour les événements temps réel
 */

class SoundNotificationService {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.volume = 0.5; // Volume par défaut (0.0 à 1.0)
    
    // Initialiser l'AudioContext au premier clic utilisateur (requis par navigateurs)
    this.initAudioContext();
  }

  initAudioContext() {
    if (typeof window !== 'undefined') {
      // L'AudioContext nécessite une interaction utilisateur
      const initOnClick = () => {
        if (!this.audioContext) {
          this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
          console.log('🔊 AudioContext initialisé');
        }
        document.removeEventListener('click', initOnClick);
      };
      document.addEventListener('click', initOnClick, { once: true });
    }
  }

  /**
   * Active ou désactive les notifications sonores
   * @param {boolean} enabled 
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('sound_notifications_enabled', enabled ? 'true' : 'false');
    console.log(`🔊 Notifications sonores ${enabled ? 'activées' : 'désactivées'}`);
  }

  /**
   * Vérifie si les notifications sonores sont activées
   */
  isEnabled() {
    const stored = localStorage.getItem('sound_notifications_enabled');
    return stored === null ? true : stored === 'true';
  }

  /**
   * Définit le volume des notifications
   * @param {number} volume - Volume entre 0.0 et 1.0
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    localStorage.setItem('sound_notifications_volume', this.volume.toString());
  }

  /**
   * Joue un son de notification pour un nouveau travail
   */
  playNewWork() {
    if (!this.isEnabled()) return;
    this.playBeep(880, 200); // Note A5, 200ms
    setTimeout(() => this.playBeep(1047, 200), 250); // Note C6, 200ms
  }

  /**
   * Joue un son de notification pour attention requise
   */
  playNeedsAttention() {
    if (!this.isEnabled()) return;
    this.playBeep(659, 150); // Note E5
    setTimeout(() => this.playBeep(523, 150), 200); // Note C5
    setTimeout(() => this.playBeep(659, 150), 400); // Note E5 à nouveau
  }

  /**
   * Joue un son générique de notification
   */
  playGeneric() {
    if (!this.isEnabled()) return;
    this.playBeep(698, 200); // Note F5
  }

  /**
   * Génère et joue un beep à une fréquence donnée
   * @param {number} frequency - Fréquence en Hz
   * @param {number} duration - Durée en millisecondes
   */
  playBeep(frequency = 800, duration = 200) {
    if (!this.audioContext || !this.isEnabled()) {
      console.warn('⚠️ AudioContext non disponible ou notifications désactivées');
      return;
    }

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + duration / 1000
      );

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.error('❌ Erreur lecture son:', error);
    }
  }

  /**
   * Joue un son basé sur le type de notification
   * @param {string} soundType - Type de son: 'new_work', 'needs_attention', 'generic'
   */
  play(soundType = 'generic') {
    switch (soundType) {
      case 'new_work':
        this.playNewWork();
        break;
      case 'needs_attention':
        this.playNeedsAttention();
        break;
      default:
        this.playGeneric();
    }
  }
}

// Instance singleton
const soundNotificationService = new SoundNotificationService();

export default soundNotificationService;
