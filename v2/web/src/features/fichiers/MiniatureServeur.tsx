// Miniature d'un fichier : d'abord l'image fabriquée par le serveur (n'importe quel PDF, même énorme,
// et toutes les images, TIFF compris) ; si le serveur ne peut pas, un petit PDF est dessiné par le
// navigateur (PDF.js) ; sinon la tuile du type de fichier. Chargée seulement quand elle devient visible.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { apercuUrl } from '../../lib/api';
import { VIGNETTE_PDF_MAX, VignettePdf } from '../fichiers-admin/VignettePdf';

const echecsServeur = new Set<number>();

export function MiniatureServeur({ id, taille, nom, mime, repli, largeur = 480, className }: { id: number; taille: number; nom: string; mime: string | null; repli: ReactNode; largeur?: number; className?: string }) {
  const boite = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [serveurKo, setServeurKo] = useState(() => echecsServeur.has(id));
  const url = apercuUrl(id, largeur);
  const estPdf = mime === 'application/pdf' || /\.pdf$/i.test(nom);

  useEffect(() => {
    if (visible || !boite.current) return;
    const obs = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: '400px' });
    obs.observe(boite.current);
    return () => obs.disconnect();
  }, [visible]);

  if (!url || serveurKo) {
    if (estPdf && taille <= VIGNETTE_PDF_MAX) return <VignettePdf id={id} taille={taille} nom={nom} repli={repli} />;
    return <>{repli}</>;
  }
  return (
    <div ref={boite} className={className} style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
      {visible ? (
        <img
          src={url}
          alt={`Aperçu de ${nom}`}
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
          onError={() => {
            echecsServeur.add(id);
            setServeurKo(true);
          }}
        />
      ) : (
        repli
      )}
    </div>
  );
}
