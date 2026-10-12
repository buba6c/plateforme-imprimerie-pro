// Fenêtre « Ajouter depuis un dossier » : chercher le dossier, voir ses fichiers imposables (PDF, images)
// avec leur miniature, les ajouter au travail avec un rôle (pages qui se suivent, recto, verso).
import { useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { formatDate, formatTaille, MACHINE_LABELS } from '@evocom/shared';
import { useDossier, useDossiers } from '../dossiers/hooks';
import { extension } from '../fichiers/ListeFichiers';
import { apercuUrl } from '../../lib/api';
import type { DossierResume, Fichier } from '../../lib/types';
import { Button, Dialog, MachineChip, Ref, Skeleton, StatusBadge, TextField } from '../../ui';
import type { Piece, RolePiece } from './types';

export const genreDe = (nom: string, mime: string | null): 'pdf' | 'image' | null => {
  const m = (mime ?? '').toLowerCase();
  if (m === 'application/pdf' || m === 'application/illustrator' || /\.(pdf|ai)$/i.test(nom)) return 'pdf';
  if (m.startsWith('image/') || /\.(png|jpe?g|webp|tiff?|gif|heic|heif)$/i.test(nom)) return 'image';
  return null;
};
export const estGenere = (f: Pick<Fichier, 'nom_original'>) => /_(IMPOSITION-\d+POSES|LIVRET|FONDS-PERDUS|ASSEMBLE)\.pdf$/i.test(f.nom_original);

function Mini({ id, nom }: { id: number; nom: string }) {
  const [ko, setKo] = useState(false);
  const src = apercuUrl(id, 160);
  return <span className="dd__mini">{src && !ko ? <img src={src} alt="" onError={() => setKo(true)} /> : <span className="ev-file__type">{extension(nom)}</span>}</span>;
}

export function DialogueDossier({ dossierId, pieces, onDossier, onAjouter, onClose }: { dossierId: number | null; pieces: Piece[]; onDossier: (id: number) => void; onAjouter: (p: Omit<Piece, 'cle'>) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  // Imposition : dossiers Xerox seulement (le grand format Roland ne s'impose pas).
  const liste = useDossiers({ q: q.trim() || undefined, limit: 8, tri: 'recent', machine: 'xerox', statut: ['en_cours', 'a_revoir', 'pret_impression', 'en_impression', 'pret_livraison'] });
  const dossier = useDossier(dossierId ?? undefined);
  const d = dossier.data;
  const fichiers = (d?.fichiers ?? []).filter((f) => genreDe(f.nom_original, f.mime));
  const dejaAjoute = (f: Fichier, role: RolePiece) => pieces.some((p) => p.fichier_id === f.id && p.role === role);
  const ajouter = (f: Fichier, role: RolePiece) => onAjouter({ fichier_id: f.id, role, nom: f.nom_original, taille: f.taille, mime: f.mime, genre: genreDe(f.nom_original, f.mime)! });
  return (
    <Dialog open onClose={onClose} title="Ajouter des fichiers depuis un dossier" width={760}
      footer={
        <>
          {d && fichiers.length > 1 && (
            <Button icon={<Plus />} onClick={() => fichiers.filter((f) => !estGenere(f) && !dejaAjoute(f, 'pages')).forEach((f) => ajouter(f, 'pages'))}>
              Tout ajouter (pages qui se suivent)
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>Terminé</Button>
        </>
      }
    >
      <div className="dd">
        <div className="dd__gauche">
          <TextField label="Dossier" placeholder="Numéro, client…" value={q} onChange={(e) => setQ(e.target.value)} addon={<Search aria-hidden="true" />} data-autofocus />
          {liste.isLoading ? (
            <Skeleton h={120} />
          ) : (
            <ul className="imp-dossiers">
              {(liste.data?.items ?? []).map((x: DossierResume) => (
                <li key={x.id}>
                  <button type="button" className="imp-dossier" aria-pressed={x.id === dossierId} onClick={() => onDossier(x.id)}>
                    <Ref>{x.numero}</Ref>
                    <span className="imp-dossier__client">{x.client_nom}</span>
                    <StatusBadge statut={x.statut} />
                  </button>
                </li>
              ))}
              {liste.data && liste.data.items.length === 0 && <li className="ev-muted" style={{ fontSize: 13 }}>Aucun dossier ne correspond.</li>}
            </ul>
          )}
        </div>
        <div className="dd__droite">
          {!dossierId ? (
            <p className="pc__vide">Choisissez un dossier à gauche : ses fichiers apparaîtront ici.</p>
          ) : !d ? (
            <Skeleton h={120} />
          ) : (
            <>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <Ref>{d.numero}</Ref>
                <strong>{d.client_nom}</strong>
                <MachineChip machine={d.machine} />
                <span className="ev-muted" style={{ fontSize: 12 }}>{MACHINE_LABELS[d.machine]} · {d.fichiers.length} fichier{d.fichiers.length > 1 ? 's' : ''}</span>
              </div>
              {fichiers.length === 0 ? (
                <p className="pc__vide">Aucun PDF ni image dans ce dossier. Déposez le fichier depuis la fiche du dossier, ou utilisez « Déposer des fichiers » sans dossier.</p>
              ) : (
                <ul className="dd__fichiers">
                  {fichiers.map((f) => (
                    <li key={f.id} className="dd__fichier" data-genere={estGenere(f) || undefined}>
                      <Mini id={f.id} nom={f.nom_original} />
                      <span className="dd__texte">
                        <span className="dd__nom" title={f.nom_original}>{f.nom_original}</span>
                        <span className="dd__meta">{formatTaille(f.taille)} · {formatDate(f.created_at)}{estGenere(f) ? ' · déjà imposé' : ''}</span>
                      </span>
                      <span className="dd__roles" role="group" aria-label={`Ajouter ${f.nom_original}`}>
                        {(['pages', 'recto', 'verso'] as RolePiece[]).map((r) => {
                          const deja = dejaAjoute(f, r);
                          return (
                            <button key={r} type="button" data-role={r} data-deja={deja || undefined} onClick={() => !deja && ajouter(f, r)} title={deja ? 'Déjà ajouté' : undefined}>
                              {deja ? <Check width={12} height={12} aria-hidden="true" /> : <Plus width={12} height={12} aria-hidden="true" />} {r === 'pages' ? 'Pages' : r === 'recto' ? 'Recto' : 'Verso'}
                            </button>
                          );
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
