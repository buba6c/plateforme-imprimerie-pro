// « Imposer » depuis la fiche d'un dossier : un clic sur un PDF ou une image, l'imposition est calculée
// toute seule (format reconnu, fonds perdus, feuille, poses ou brochure), affichée en prévisualisation
// avec le vrai visuel, et « Valider » ajoute le PDF imposé au dossier. Pour aller plus loin : l'écran
// Imposition complet, ouvert sur le même fichier.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileCheck2, Settings2 } from 'lucide-react';
import { messageErreur } from '../../lib/api';
import type { Fichier } from '../../lib/types';
import { Alert, Button, Dialog, Skeleton, useToast } from '../../ui';
import { reglagesPour, resumeAuto } from './auto';
import { useAnalyse, useGenerer, usePlan } from './hooks';
import { SchemaFeuille } from './SchemaFeuille';
import { OPERATION_LABELS, type Operation, type ParamsImposition, type Piece } from './types';
import './imposition.css';

const genreDe = (f: Pick<Fichier, 'nom_original' | 'mime'>): 'pdf' | 'image' | null => {
  const m = (f.mime ?? '').toLowerCase();
  if (m === 'application/pdf' || /\.(pdf|ai)$/i.test(f.nom_original)) return 'pdf';
  if (m.startsWith('image/') || /\.(png|jpe?g|webp|tiff?)$/i.test(f.nom_original)) return 'image';
  return null;
};
export const imposable = (f: Pick<Fichier, 'nom_original' | 'mime'>) => genreDe(f) !== null && !/_(IMPOSITION-\d+POSES|LIVRET|FONDS-PERDUS|ASSEMBLE)\.pdf$/i.test(f.nom_original);

export function ImpositionRapide({ dossierId, fichier, onClose }: { dossierId: number; fichier: Fichier; onClose: () => void }) {
  const toast = useToast();
  const pieces = useMemo<Piece[]>(() => [{ cle: `${fichier.id}:rapide`, fichier_id: fichier.id, role: 'pages', nom: fichier.nom_original, taille: fichier.taille, mime: fichier.mime, genre: genreDe(fichier)! }], [fichier]);
  const analyse = useAnalyse(pieces);
  const [params, setParams] = useState<ParamsImposition | null>(null);
  const [face, setFace] = useState<'recto' | 'verso'>('recto');
  useEffect(() => {
    const d = analyse.data;
    if (!d || params) return;
    const fam = d.analyse.format?.famille;
    const op: Operation = (fam === 'page' || !fam) && d.analyse.nb_pages > 2 ? 'livret' : 'poses';
    setParams(reglagesPour(op, d, d.params_defaut));
  }, [analyse.data, params]);
  const plan = usePlan(pieces, params);
  const generer = useGenerer();
  const p = plan.data?.plan;
  const feuille = p?.feuilles[0];
  const faceVue = feuille ? (face === 'verso' && feuille.verso ? feuille.verso : feuille.recto) : null;
  const a = analyse.data?.analyse;

  return (
    <Dialog
      open
      onClose={generer.isPending ? () => {} : onClose}
      title={`Imposer « ${fichier.nom_original} »`}
      width={820}
      footer={
        <>
          <Link className="ev-btn" to={`/imposition?dossier=${dossierId}&fichier=${fichier.id}`}>
            <Settings2 aria-hidden="true" /> Réglages complets
          </Link>
          <Button onClick={onClose} disabled={generer.isPending}>Annuler</Button>
          <Button
            variant="primary"
            icon={generer.isSuccess ? <Check /> : <FileCheck2 />}
            busy={generer.isPending}
            disabled={!p || !params || plan.isError || generer.isSuccess}
            onClick={() =>
              params &&
              generer.mutate(
                { pieces, params },
                {
                  onSuccess: (r) => {
                    toast.success('PDF imposé ajouté au dossier', r.fichier?.nom);
                    onClose();
                  },
                  onError: (e) => toast.error('Imposition impossible', messageErreur(e)),
                },
              )
            }
          >
            Valider et ajouter au dossier
          </Button>
        </>
      }
    >
      {analyse.isError ? (
        <Alert tone="error">{messageErreur(analyse.error)}</Alert>
      ) : !a || !params ? (
        <div className="stack">
          <span className="ev-muted">Analyse du fichier : format, pages, fonds perdus…</span>
          <Skeleton h={320} />
        </div>
      ) : (
        <div className="rapide">
          <div className="rapide__apercu">
            {plan.isError ? (
              <Alert tone="warning">{messageErreur(plan.error)}</Alert>
            ) : !p || !faceVue ? (
              <Skeleton h={360} />
            ) : (
              <>
                {feuille?.verso && (
                  <div className="ws__faces" role="group" aria-label="Face">
                    <button type="button" aria-pressed={face === 'recto'} onClick={() => setFace('recto')}>Recto</button>
                    <button type="button" aria-pressed={face === 'verso'} onClick={() => setFace('verso')}>Verso</button>
                  </div>
                )}
                <div className="ws__scene" style={{ maxHeight: 460 }}>
                  <div className="ws__scene-int">
                    <SchemaFeuille plan={p} face={faceVue} pages={analyse.data?.pages} methode={params.methode_fonds_perdus} sourceAvecFonds={a.fonds_perdus !== 'absents'} unisDe={(n) => a.pages[n - 1]?.bords_unis ?? null} largeur={p.feuille.largeur > p.feuille.hauteur ? 460 : 320} />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="rapide__infos">
            <div className="rapide__choix" role="radiogroup" aria-label="Type d’imposition">
              {(['poses', 'livret', 'fonds_perdus'] as Operation[]).map((op) => (
                <button key={op} type="button" role="radio" aria-checked={params.operation === op} onClick={() => analyse.data && setParams(reglagesPour(op, analyse.data, params))}>
                  {OPERATION_LABELS[op].titre}
                </button>
              ))}
            </div>
            <p className="auto-resume">{resumeAuto(params)}</p>
            <ul className="rapport__lignes">
              <li data-ton={a.format ? 'ok' : 'attention'}><span className="rapport__puce" aria-hidden="true" />{a.format ? a.format.libelle : `Format non reconnu (${a.largeur} × ${a.hauteur} mm)`}, {a.nb_pages} page{a.nb_pages > 1 ? 's' : ''}</li>
              {p && p.operation === 'poses' && <li data-ton="auto"><span className="rapport__puce" aria-hidden="true" />{p.poses_par_face} poses par face sur {p.feuille.largeur} × {p.feuille.hauteur} mm</li>}
              {p && p.operation === 'livret' && <li data-ton="auto"><span className="rapport__puce" aria-hidden="true" />{p.nb_feuilles} feuille{p.nb_feuilles > 1 ? 's' : ''}{p.pages_blanches ? `, ${p.pages_blanches} page(s) blanche(s)` : ''}</li>}
              {p?.avertissements.map((m, i) => <li key={i} data-ton="attention"><span className="rapport__puce" aria-hidden="true" />{m}</li>)}
            </ul>
            <span className="ev-help">Le fichier d’origine n’est pas modifié : le PDF imposé est ajouté à côté.</span>
          </div>
        </div>
      )}
    </Dialog>
  );
}
