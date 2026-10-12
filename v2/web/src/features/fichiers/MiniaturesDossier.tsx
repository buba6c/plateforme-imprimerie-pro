// Bande de miniatures des fichiers d'un dossier, sur les cartes (livreur, listes) : on voit d'un coup
// d'œil ce qu'on livre ou ce qu'on traite. Clic : aperçu du fichier.
import { useState } from 'react';
import { Files } from 'lucide-react';
import type { Fichier } from '../../lib/types';
import { ApercuFichier, extension } from './ListeFichiers';
import { MiniatureServeur } from './MiniatureServeur';
import './fichiers.css';

type Mini = { id: number; nom_original: string; mime: string | null; taille: number };

export function MiniaturesDossier({ dossierId, fichiers, total, resume, compacte }: { dossierId: number; fichiers: Mini[]; total: number; resume?: string; compacte?: boolean }) {
  const [ouvert, setOuvert] = useState<Mini | null>(null);
  void dossierId;
  if (!fichiers.length) {
    return compacte ? null : (
      <p className="fi-bande fi-bande--vide">
        <Files aria-hidden="true" />
        <span>Aucun fichier dans ce dossier{resume ? ` · ${resume}` : ''}</span>
      </p>
    );
  }
  const reste = Math.max(0, total - fichiers.length);
  return (
    <div className="fi-bande" data-compacte={compacte || undefined} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {fichiers.map((f) => (
        <button key={f.id} type="button" className="fi-bande__item" title={f.nom_original} aria-label={`Aperçu de ${f.nom_original}`} onClick={() => setOuvert(f)}>
          <MiniatureServeur id={f.id} taille={f.taille} nom={f.nom_original} mime={f.mime} largeur={160} className="fi-bande__mini" repli={<span className="ev-file__type">{extension(f.nom_original)}</span>} />
          {!compacte && <span className="fi-bande__nom">{f.nom_original}</span>}
        </button>
      ))}
      {reste > 0 && <span className="fi-bande__plus">+{reste}</span>}
      {ouvert && <ApercuFichier fichier={{ ...ouvert, a_reimprimer: false, created_at: '', uploaded_by_nom: null } as Fichier} onClose={() => setOuvert(null)} />}
    </div>
  );
}
