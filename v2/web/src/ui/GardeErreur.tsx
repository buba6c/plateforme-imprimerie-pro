// Garde-fou contre la page blanche : une erreur dans une page n'efface plus toute l'application.
// Erreur due à une ancienne version (morceau introuvable après une mise à jour) : rechargement
// automatique une fois. Autre erreur : message clair, boutons « Recharger » et « Accueil ».
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { estErreurDeVersion, recharger } from '../lib/version';

interface Etat {
  erreur: Error | null;
}

export class GardeErreur extends Component<{ children: ReactNode; cle?: string; pleinePage?: boolean }, Etat> {
  override state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  override componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error('Erreur dans la page', erreur, info.componentStack);
    if (estErreurDeVersion(erreur)) recharger('morceau');
  }

  override componentDidUpdate(prev: { cle?: string }) {
    // Changer de page efface l'erreur précédente.
    if (prev.cle !== this.props.cle && this.state.erreur) this.setState({ erreur: null });
  }

  override render() {
    const e = this.state.erreur;
    if (!e) return this.props.children;
    const version = estErreurDeVersion(e);
    return (
      <div className="garde-erreur" data-pleine={this.props.pleinePage || undefined} role="alert">
        <div className="garde-erreur__carte">
          <strong className="garde-erreur__titre">{version ? 'Une mise à jour vient d’être installée' : 'Cette page a rencontré un problème'}</strong>
          <p>{version ? 'La page se recharge pour prendre la nouvelle version.' : 'Le reste de l’application fonctionne. Rechargez la page ; si le problème revient, prévenez l’administrateur avec le message ci-dessous.'}</p>
          {!version && <code className="garde-erreur__detail">{e.message.slice(0, 300)}</code>}
          <div className="garde-erreur__actions">
            <button type="button" className="ev-btn ev-btn--primary" onClick={() => (recharger('manuel') || window.location.reload())}>
              Recharger la page
            </button>
            <a className="ev-btn" href="/">
              Revenir à l’accueil
            </a>
          </div>
        </div>
      </div>
    );
  }
}
