// Poste d'imposition (administrateur, préparateurs). Trois zones, comme un logiciel d'imposition :
//  - à gauche, les pièces du travail : fichiers d'un dossier ou fichiers déposés sans dossier (PDF, images),
//    chacune avec son rôle (recto, verso, pages qui se suivent), analysées (format, fonds perdus, résolution) ;
//  - au centre, la feuille en grand avec le vrai visuel dans chaque pose, zoom, recto/verso, feuilles ;
//  - à droite, les réglages illustrés : opération, feuille et orientation, fonds perdus, coupe, poses,
//    livret, numérotation ; modèles enregistrés ; proposition de l'assistant IA.
// Le résultat est ajouté au dossier (ou proposé au téléchargement sans dossier), dans une fenêtre.

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bookmark, Check, LoaderCircle, ChevronLeft, ChevronRight, Download, FileCheck2, FolderOpen, LayoutGrid, Minus, Plus, RotateCcw, Sparkles, Trash2, Upload, Wand2, X } from 'lucide-react';
import { formatTaille } from '@evocom/shared';
import { useUser } from '../../auth/AuthContext';
import { useDossier } from '../../features/dossiers/hooks';
import { DialogueDossier, genreDe } from '../../features/imposition/DialogueDossier';
import { extension } from '../../features/fichiers/ListeFichiers';
import { useStatutIA } from '../../features/ia/hooks';
import { useAnalyse, useCatalogueImposition, useGenerer, useModelesImposition, useModelesMutations, usePlan, useProposerIA, useRattacher, useTeleverserLibre } from '../../features/imposition/hooks';
import { useDossiers } from '../../features/dossiers/hooks';
import { OptionCartes } from '../../features/imposition/OptionCartes';
import { PictoAjustement, PictoCalage, PictoCoupe, PictoFondsPerdus, PictoMode, PictoOperation, PictoOrientation, PictoPlanches, PictoPliage, PictoRetournement, PictoRotationPoses, PictoSystemeCoupe, PictoTeteBeche, PictoTraitsStyle } from '../../features/imposition/Pictos';
import { SchemaFeuille, type AffichageSchema } from '../../features/imposition/SchemaFeuille';
import { ListeFeuilles, PagesDocument } from '../../features/imposition/VuePages';
import { libelleCoupe, operationParDefaut, reglagesPour, resumeAuto, rolesAuto, texteAdaptation } from '../../features/imposition/auto';
import { useApercuPage } from '../../features/imposition/rendu';
import { AJUSTEMENT_LABELS, BLANCHES_LABELS, CALAGE_LABELS, COUPE_LABELS, FOURNISSEUR_LABELS_IA, METHODE_LABELS, MODE_LABELS, OPERATION_LABELS, PLANCHES_LABELS, PLIAGE_LABELS, RELIURE_LABELS, RETOURNEMENT_LABELS, ROGNAGE_LABELS, ROTATION_POSES_LABELS, SYSTEME_COUPE_LABELS, SYSTEME_LABELS, TETE_BECHE_LABELS, TRAITS_LABELS, type Calage, type Coupe, type Dimension, type Feuille, type ModeAjustement, type ModeBlanches, type ModeleImposition, type ModePlanches, type Operation, type ParamsImposition, type Piece, type PieceAnalysee, type Plan, type Pliage, type PropositionImposition, type ReponseAnalyse, type ResultatGeneration, type Retournement, type RolePiece, type RotationPoses, type StyleTraits, type TeteBeche } from '../../features/imposition/types';
import '../../features/imposition/imposition.css';
import { apercuUrl, fichierUrl, messageErreur } from '../../lib/api';
import { Alert, Button, Checkbox, ConfirmDialog, Dialog, MachineChip, PageHeader, Ref, SelectField, Skeleton, TextField, TextareaField, useToast } from '../../ui';
import { fondsAuto } from '../../features/imposition/auto';

const FEUILLE_LABELS: Record<Feuille, string> = { sra3: 'SRA3 · 320 × 450 mm', a3: 'A3 · 297 × 420 mm', a3_plus: 'A3+ · 329 × 483 mm', sra4: 'SRA4 · 225 × 320 mm', a4: 'A4 · 210 × 297 mm', a5: 'A5 · 148 × 210 mm', banniere_330: 'Bannière 330 × 660 mm', personnalisee: 'Personnalisée…' };

function Nombre({ label, value, onChange, min = 0, max = 2000, step = 0.5, addon = 'mm', help }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; addon?: string; help?: string }) {
  const [texte, setTexte] = useState(String(value));
  useEffect(() => setTexte(String(value)), [value]);
  return (
    <TextField label={label} type="number" inputMode="decimal" min={min} max={max} step={step} addon={addon} value={texte} help={help}
      onChange={(e) => {
        setTexte(e.target.value);
        const v = Number(e.target.value.replace(',', '.'));
        if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Panneau des pièces

function MiniPiece({ p }: { p: Piece; analyse?: PieceAnalysee }) {
  const rendu = useApercuPage({ fichier_id: p.libre ? undefined : p.fichier_id, libre: p.libre, page: 1, genre: p.genre }, 200);
  return (
    <span className="pc__mini" data-etat={rendu.etat}>
      {rendu.etat === 'pret' && rendu.url ? <img src={rendu.url} alt="" /> : rendu.etat === 'chargement' ? <LoaderCircle className="pc__tourne" aria-label="Chargement de l’aperçu" /> : <span className="ev-file__type">{extension(p.nom)}</span>}
    </span>
  );
}

function ChipsPiece({ a }: { a: PieceAnalysee }) {
  const f = a.format;
  return (
    <span className="pc__chips">
      <span className="pc__chip">{a.pages} p.</span>
      {a.largeur && a.hauteur && <span className="pc__chip">{Math.round(a.largeur)} × {Math.round(a.hauteur)} mm</span>}
      {f ? <span className="pc__chip" data-tone="ok">{f.libelle.replace(/\s*\(.*\)$/, '').replace(/ \d+ × \d+ mm$/, '')}</span> : <span className="pc__chip" data-tone="attention">format libre</span>}
      {a.fonds_perdus === 'declares' && <span className="pc__chip" data-tone="ok">fonds perdus</span>}
      {a.fonds_perdus === 'incertains' && <span className="pc__chip" data-tone="attention">fonds perdus probables</span>}
      {a.fonds_perdus === 'absents' && <span className="pc__chip" data-tone="alerte">sans fonds perdus</span>}
      {a.genre === 'image' && <span className="pc__chip">image</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Réglages

const memeDim = (a: Dimension, b: Dimension) => Math.abs(a.largeur - b.largeur) < 0.05 && Math.abs(a.hauteur - b.hauteur) < 0.05;
/** Format standard orienté comme le visuel reçu (une carte livrée en portrait reste en portrait). */
function orienterComme(f: Dimension, source: Dimension | undefined): Dimension {
  const paysageSource = !!source && source.largeur > source.hauteur;
  const [petit, grand] = [Math.min(f.largeur, f.hauteur), Math.max(f.largeur, f.hauteur)];
  return paysageSource ? { largeur: grand, hauteur: petit } : { largeur: petit, hauteur: grand };
}

/** Choix du format fini : taille du fichier, format standard le plus proche, catalogue, ou valeurs libres. */
function ChoixFormat({ p, maj, analyse }: { p: ParamsImposition; maj: (patch: Partial<ParamsImposition>) => void; analyse?: ReponseAnalyse }) {
  const catalogue = useCatalogueImposition();
  const formats = catalogue.data?.formats ?? [];
  const fichier = analyse?.analyse.fini;
  const proche = analyse?.format_proche ?? null;
  const code = fichier && memeDim(p.fini, fichier) ? 'fichier' : (formats.find((f) => memeDim(p.fini, f) || memeDim(p.fini, { largeur: f.hauteur, hauteur: f.largeur }))?.code ?? 'personnalise');
  const legende = p.operation === 'depliant' ? (p.pliage === 'italienne' || p.pliage === 'chevalet' ? 'Format fini = format fermé (une face)' : 'Format fini = format développé (pièce ouverte)') : null;
  const options = [
    ...(fichier ? [{ value: 'fichier', label: `Taille du fichier · ${fichier.largeur} × ${fichier.hauteur} mm${analyse?.analyse.format ? ` (${analyse.analyse.format.libelle.replace(/ \d+ × \d+ mm.*$/, '')})` : ''}` }] : []),
    ...formats.map((f) => ({ value: f.code, label: `${f.libelle}${proche && proche.code === f.code ? ' · le plus proche du fichier' : ''}` })),
    { value: 'personnalise', label: 'Personnalisé (saisir ci-dessous)' },
  ];
  return (
    <div className="ws__section">
      <p className="ws__section-titre">Format fini</p>
      {legende && <p className="ev-help" style={{ margin: 0 }}>{legende}</p>}
      <SelectField label="Format" value={code} options={options}
        onChange={(e) => {
          const v = e.target.value;
          if (v === 'fichier' && fichier) maj({ fini: { largeur: fichier.largeur, hauteur: fichier.hauteur } });
          else {
            const f = formats.find((x) => x.code === v);
            if (f) maj({ fini: orienterComme(f, fichier) });
          }
        }}
        help={proche && code === 'fichier' ? `Format non standard : « ${proche.libelle} » est le plus proche. Choisissez-le pour mettre le fichier au format.` : undefined}
      />
      <div className="imp-ligne">
        <Nombre label="Largeur" value={p.fini.largeur} onChange={(v) => maj({ fini: { ...p.fini, largeur: v } })} min={10} />
        <Nombre label="Hauteur" value={p.fini.hauteur} onChange={(v) => maj({ fini: { ...p.fini, hauteur: v } })} min={10} />
      </div>
    </div>
  );
}

function Reglages({ p, onChange, nbPages, analyse, plan }: { p: ParamsImposition; onChange: (p: ParamsImposition) => void; nbPages: number; analyse?: ReponseAnalyse; plan?: Plan }) {
  // Visuels différents dans le fichier : une paire recto/verso par visuel, sinon une page (ou deux en recto-verso).
  const nbVisuels = analyse?.paires ? analyse.paires.length : p.recto_verso ? Math.ceil(nbPages / 2) : nbPages;
  const maj = (patch: Partial<ParamsImposition>) => onChange({ ...p, ...patch });
  const adaptation = plan?.adaptation ?? null;
  const planches = analyse?.planches;
  // « Sans fonds perdus » : choix délibéré (système de coupe) ou zéro millimètre demandé.
  const sans = (p.coupe !== undefined && p.coupe !== 'auto' && p.coupe !== 'fonds_perdus') || ((p.coupe ?? 'auto') === 'auto' && p.fonds_perdus_mm === 0);
  const num = p.numerotation ?? null;
  const majNum = (patch: Partial<NonNullable<ParamsImposition['numerotation']>>) => maj({ numerotation: { ...(num ?? { debut: 1, chiffres: 4, prefixe: '', position: 'bas_droite', taille_pt: 12, verso: false }), ...patch } });
  return (
    <div className="stack">
      <OptionCartes<Operation>
        name="imp-operation" label="Opération" tone="accent"
        value={p.operation}
        onChange={(operation) => (analyse ? onChange(reglagesPour(operation, analyse, p)) : maj({ operation, ...(operation === 'livret' ? { recto_verso: true, mode: 'sequence' as const } : {}) }))}
        options={(Object.keys(OPERATION_LABELS) as Operation[]).map((o) => ({ value: o, label: OPERATION_LABELS[o].titre, aide: OPERATION_LABELS[o].aide, picto: <PictoOperation op={o} /> }))}
      />

      <p className="auto-resume"><Sparkles aria-hidden="true" /> Réglé automatiquement : {resumeAuto(p, plan)} Tout reste modifiable ci-dessous.</p>
      {p.operation === 'assembler' && (
        <p className="ev-help" style={{ margin: 0 }}>Les pièces sont réunies dans l’ordre de l’étape 1 (recto 1, verso 1, recto 2…), sans modification des pages. Utile pour envoyer un seul PDF à l’imprimeur.</p>
      )}
      {planches && (planches.detection || planches.separees > 0) && (
        <OptionCartes<ModePlanches> name="imp-planches" label="Pages doubles (planches)" tone="violet" compact value={p.planches ?? 'non'} onChange={(planches) => maj({ planches })}
          options={(Object.keys(PLANCHES_LABELS) as ModePlanches[]).map((m) => ({ value: m, label: PLANCHES_LABELS[m].label, aide: PLANCHES_LABELS[m].aide, picto: <PictoPlanches mode={m} /> }))}
        />
      )}
      {p.operation !== 'assembler' && <ChoixFormat p={p} maj={maj} analyse={analyse} />}
      {p.operation !== 'assembler' && adaptation && (
        <div className="ws__section">
          <OptionCartes<ModeAjustement> name="imp-ajustement" label="Le fichier n’a pas cette taille : mise au format" tone="orange" compact value={p.ajustement ?? 'auto'} onChange={(ajustement) => maj({ ajustement })}
            options={(Object.keys(AJUSTEMENT_LABELS) as ModeAjustement[]).map((m) => ({ value: m, label: AJUSTEMENT_LABELS[m].label, aide: AJUSTEMENT_LABELS[m].aide, picto: <PictoAjustement mode={m} /> }))}
          />
          <p className="ev-help" style={{ margin: 0 }}>{texteAdaptation(adaptation, p.fini)}</p>
        </div>
      )}

      {p.operation !== 'fonds_perdus' && p.operation !== 'assembler' && (
        <div className="ws__section">
          <p className="ws__section-titre">Papier</p>
          <SelectField label="Feuille d’impression" value={p.feuille} onChange={(e) => maj({ feuille: e.target.value as Feuille })} options={(Object.keys(FEUILLE_LABELS) as Feuille[]).map((f) => ({ value: f, label: FEUILLE_LABELS[f] }))} />
          {p.feuille === 'personnalisee' && (
            <div className="imp-ligne">
              <Nombre label="Largeur feuille" value={p.feuille_personnalisee?.largeur ?? 320} onChange={(v) => maj({ feuille_personnalisee: { largeur: v, hauteur: p.feuille_personnalisee?.hauteur ?? 450 } })} min={50} />
              <Nombre label="Hauteur feuille" value={p.feuille_personnalisee?.hauteur ?? 450} onChange={(v) => maj({ feuille_personnalisee: { largeur: p.feuille_personnalisee?.largeur ?? 320, hauteur: v } })} min={50} />
            </div>
          )}
          <OptionCartes name="imp-orientation" label="Sens du papier" tone="teal" compact value={p.orientation} onChange={(orientation) => maj({ orientation })}
            options={[
              { value: 'auto' as const, label: 'Auto', aide: 'Le sens qui loge le plus de poses', picto: <PictoOrientation sens="auto" /> },
              { value: 'portrait' as const, label: 'Portrait', picto: <PictoOrientation sens="portrait" /> },
              { value: 'paysage' as const, label: 'Paysage', picto: <PictoOrientation sens="paysage" /> },
            ]}
          />
        </div>
      )}

      {p.operation !== 'assembler' && (
      <div className="ws__section">
        <p className="ws__section-titre">Fonds perdus et coupe</p>
        <OptionCartes<'avec' | 'sans'> name="imp-coupe" label="Coupe" tone="rose" value={sans ? 'sans' : 'avec'}
          onChange={(v) => (v === 'sans' ? maj({ coupe: 'sans_auto', fonds_perdus_mm: 0, methode_fonds_perdus: 'blanc', calepinage: 'auto' }) : maj({ coupe: 'auto', ...(analyse ? fondsAuto(analyse.analyse) : { fonds_perdus_mm: 3, methode_fonds_perdus: 'intelligent' as const }), calepinage: 'auto' }))}
          options={(['avec', 'sans'] as const).map((m) => ({ value: m, label: COUPE_LABELS[m].label, aide: COUPE_LABELS[m].aide, picto: <PictoCoupe mode={m} /> }))}
        />
        {plan?.coupe && <p className="ev-help" style={{ margin: 0 }}>{plan.coupe.raison}</p>}
        {!sans && (
          <>
            <div className="imp-ligne">
              <Nombre label="Fonds perdus" value={p.fonds_perdus_mm} onChange={(v) => maj({ fonds_perdus_mm: v, calepinage: 'manuel', coupe: v > 0 ? 'fonds_perdus' : 'sans_auto' })} max={20} help={p.calepinage === 'manuel' ? '3 mm en général, 5 mm en grand format.' : 'Demandés : le calepinage automatique peut les réduire pour loger une pose de plus (voir le rapport).'} />
              {p.operation !== 'fonds_perdus' && <Nombre label="Gouttière" value={p.gouttiere_mm} onChange={(v) => maj({ gouttiere_mm: v, calepinage: 'manuel' })} max={50} help="Entre deux poses, en plus des fonds perdus." />}
              {p.operation === 'poses' && <Nombre label="Marge feuille" value={p.marge_mm} onChange={(v) => maj({ marge_mm: v })} max={100} help="Jamais moins que le bord non imprimable de la machine (Paramètres > Imposition)." />}
            </div>
            <OptionCartes name="imp-methode" label="D’où viennent les fonds perdus" tone="rose" compact value={p.methode_fonds_perdus === 'blanc' ? 'intelligent' : p.methode_fonds_perdus} onChange={(methode_fonds_perdus) => maj({ methode_fonds_perdus, coupe: 'fonds_perdus' })}
              options={(Object.keys(METHODE_LABELS) as ParamsImposition['methode_fonds_perdus'][]).filter((m) => m !== 'blanc').map((m) => ({ value: m, label: METHODE_LABELS[m].label, aide: METHODE_LABELS[m].aide, picto: <PictoFondsPerdus methode={m} /> }))}
            />
            {p.operation === 'poses' && p.mode === 'repetition' && (
              <Checkbox label="Fonds perdus partagés entre les poses (bords unis) : poses jointives, un seul trait par ligne de coupe" checked={p.fonds_partages === true} onChange={(on) => maj({ fonds_partages: on ? true : 'auto' })} />
            )}
          </>
        )}
        {sans && (
          <>
            <OptionCartes<Exclude<Coupe, 'auto' | 'fonds_perdus'>> name="imp-systeme" label="Système de coupe" tone="rose" compact value={(p.coupe === 'auto' || p.coupe === 'fonds_perdus' || !p.coupe ? 'sans_auto' : p.coupe) as Exclude<Coupe, 'auto' | 'fonds_perdus'>}
              onChange={(coupe) => maj({ coupe, fonds_perdus_mm: 0, methode_fonds_perdus: 'blanc', ...(coupe === 'cadre' && !(p.cadre_blanc_mm && p.cadre_blanc_mm > 0) ? { cadre_blanc_mm: 3 } : {}) })}
              options={(Object.keys(SYSTEME_COUPE_LABELS) as Exclude<Coupe, 'auto' | 'fonds_perdus'>[]).filter((m) => (p.operation === 'poses' ? true : m === 'sans_auto' || m === 'franche' || m === 'aucune')).map((m) => ({ value: m, label: SYSTEME_COUPE_LABELS[m].label, aide: SYSTEME_COUPE_LABELS[m].aide, picto: <PictoSystemeCoupe systeme={m} /> }))}
            />
            {p.operation === 'poses' && p.coupe !== 'aucune' && (
              <div className="imp-ligne">
                <Nombre label="Gouttière" value={p.gouttiere_mm} onChange={(v) => maj({ gouttiere_mm: v })} max={50} help={p.coupe === 'double' || p.coupe === 'sans_auto' ? 'Chute entre les poses : 3, 4 ou 6 mm.' : '0 pour des poses jointives.'} />
                <Nombre label="Marge feuille" value={p.marge_mm} onChange={(v) => maj({ marge_mm: v })} max={100} help="Jamais moins que le bord non imprimable de la machine." />
                {p.coupe === 'cadre' && <Nombre label="Cadre blanc" value={p.cadre_blanc_mm ?? 3} onChange={(v) => maj({ cadre_blanc_mm: v })} max={10} help="3 mm en général, 5 mm en grand format." />}
              </div>
            )}
            {p.coupe === 'cadre' && (
              <OptionCartes<'reduire' | 'rogner'> name="imp-cadre" label="Comment obtenir le cadre" tone="orange" compact value={p.cadre_methode ?? 'reduire'} onChange={(cadre_methode) => maj({ cadre_methode })}
                options={[
                  { value: 'reduire', label: 'Réduire le visuel', aide: 'Rien n’est perdu ; textes et logos rapetissent un peu.', picto: <PictoAjustement mode="adapter" /> },
                  { value: 'rogner', label: 'Rogner les bords', aide: 'Échelle gardée ; ce qui est au bord du visuel disparaît.', picto: <PictoAjustement mode="remplir" /> },
                ]}
              />
            )}
          </>
        )}
        {p.coupe !== 'aucune' && (
          <OptionCartes<StyleTraits> name="imp-traits" label="Traits de coupe" tone="orange" compact value={p.traits_de_coupe === false ? 'aucun' : (p.traits_style ?? 'auto')} onChange={(traits_style) => maj({ traits_style, traits_de_coupe: traits_style !== 'aucun' })}
            options={(Object.keys(TRAITS_LABELS) as StyleTraits[]).map((m) => ({ value: m, label: TRAITS_LABELS[m].label, aide: TRAITS_LABELS[m].aide, picto: <PictoTraitsStyle style={m} /> }))}
          />
        )}
      </div>
      )}

      {p.operation === 'poses' && (
        <div className="ws__section">
          <p className="ws__section-titre">Poses</p>
          <OptionCartes name="imp-mode" label="Répartition des pages" tone="violet" value={p.mode} onChange={(mode) => maj({ mode, numerotation: mode === 'coupe_empile' ? p.numerotation : null })}
            options={(Object.keys(MODE_LABELS) as ParamsImposition['mode'][]).map((m) => ({ value: m, label: MODE_LABELS[m].label, aide: MODE_LABELS[m].aide, picto: <PictoMode mode={m} /> }))}
          />
          {p.mode === 'repetition' && nbVisuels > 1 && (
            <OptionCartes<'chacun' | 'premier'> name="imp-repetition-visuels" label={`${nbVisuels} visuels dans le fichier`} tone="violet" compact value={p.repetition_visuels ?? 'chacun'} onChange={(repetition_visuels) => maj({ repetition_visuels })}
              options={[
                { value: 'chacun', label: `Chaque visuel sur sa feuille (${nbVisuels} feuilles)`, aide: 'Chaque visuel est répété sur toutes les poses de sa propre feuille : aucune pose vide, une pile par visuel après la coupe.', picto: <PictoMode mode="repetition" /> },
                { value: 'premier', label: 'Seulement le premier visuel', aide: 'Les autres pages du fichier sont ignorées.', picto: <PictoMode mode="sequence" /> },
              ]}
            />
          )}
          <Checkbox label={`Recto-verso${nbPages >= 2 ? '' : ' (une seule page : verso vide)'}`} checked={p.recto_verso} onChange={(recto_verso) => maj({ recto_verso })} />
          {p.recto_verso && (
            <OptionCartes<Retournement> name="imp-retournement" label="Retournement de la feuille" tone="teal" compact value={p.retournement ?? 'auto'} onChange={(retournement) => maj({ retournement })}
              options={(Object.keys(RETOURNEMENT_LABELS) as Retournement[]).map((m) => ({ value: m, label: RETOURNEMENT_LABELS[m].label, aide: RETOURNEMENT_LABELS[m].aide, picto: <PictoRetournement mode={m} /> }))}
            />
          )}
          {p.recto_verso && plan && <p className="ev-help" style={{ margin: 0 }}>{plan.consignes.join(' ')}</p>}
          <details className="imp-plus">
            <summary>Plus d’options : rotation des poses, tête-bêche, calage, sens du verso</summary>
            <div className="stack">
              <OptionCartes<RotationPoses> name="imp-rotation" label="Rotation des poses" tone="violet" compact value={p.rotation_poses ?? 'aucune'} onChange={(rotation_poses) => maj({ rotation_poses })}
                options={(Object.keys(ROTATION_POSES_LABELS) as RotationPoses[]).map((m) => ({ value: m, label: ROTATION_POSES_LABELS[m].label, aide: ROTATION_POSES_LABELS[m].aide, picto: <PictoRotationPoses mode={m} /> }))}
              />
              <OptionCartes<TeteBeche> name="imp-tete-beche" label="Tête-bêche" tone="violet" compact value={p.tete_beche ?? 'aucune'} onChange={(tete_beche) => maj({ tete_beche })}
                options={(Object.keys(TETE_BECHE_LABELS) as TeteBeche[]).map((m) => ({ value: m, label: TETE_BECHE_LABELS[m].label, aide: TETE_BECHE_LABELS[m].aide, picto: <PictoTeteBeche mode={m} /> }))}
              />
              <OptionCartes<Calage> name="imp-calage" label="Calage de la grille" tone="teal" compact value={p.calage ?? 'centre'} onChange={(calage) => maj({ calage })}
                options={(Object.keys(CALAGE_LABELS) as Calage[]).map((m) => ({ value: m, label: CALAGE_LABELS[m].label, aide: CALAGE_LABELS[m].aide, picto: <PictoCalage mode={m} /> }))}
              />
              {p.calage === 'coin' && <Nombre label="Marge de pince" value={p.marge_pince_mm ?? p.marge_mm} onChange={(v) => maj({ marge_pince_mm: v })} max={50} help="Depuis le coin bas-gauche de la feuille." />}
              {p.recto_verso && (
                <SelectField label="Contenu du verso" value={p.rotation_verso ?? 'auto'} onChange={(e) => maj({ rotation_verso: e.target.value as ParamsImposition['rotation_verso'] })} options={[{ value: 'auto', label: 'Pièce retournée comme une page (cartes, flyers)' }, { value: 'aucune', label: 'Pièce retournée comme un calendrier (contenu gardé droit)' }, { value: '180', label: 'Verso toujours tourné d’un demi-tour' }]} help="N’agit que si le bord de retournement impose un demi-tour." />
              )}
              {plan?.cotes && (
                <p className="ev-help" style={{ margin: 0 }}>Cotes de coupe (mm depuis le coin bas-gauche) · X : {plan.cotes.x.join(' · ')} · Y : {plan.cotes.y.join(' · ')}</p>
              )}
            </div>
          </details>
          <Nombre label={p.mode === 'coupe_empile' ? 'Nombre d’exemplaires' : p.mode === 'repetition' && nbVisuels > 1 && p.repetition_visuels !== 'premier' ? 'Quantité de chaque visuel' : 'Quantité à produire'} value={p.quantite ?? 0} onChange={(v) => maj({ quantite: v > 0 ? Math.round(v) : undefined })} min={0} max={100000} step={1} addon="ex." help={p.mode === 'coupe_empile' ? 'Tickets ou exemplaires à sortir.' : p.mode === 'repetition' && nbVisuels > 1 && p.repetition_visuels !== 'premier' ? 'Par visuel : les feuilles à imprimer de chaque feuille s’additionnent.' : 'Pour compter les feuilles à imprimer.'} />
          {p.mode === 'coupe_empile' && (
            <div className="stack-sm">
              <Checkbox label="Numéroter les exemplaires (tickets, bons, billets)" checked={!!num} onChange={(on) => maj({ numerotation: on ? { debut: 1, chiffres: 4, prefixe: '', position: 'bas_droite', taille_pt: 12, verso: false } : null })} />
              {num && (
                <div className="imp-ligne">
                  <TextField label="Préfixe" value={num.prefixe} onChange={(e) => majNum({ prefixe: e.target.value.slice(0, 12) })} placeholder="N° " />
                  <Nombre label="Premier numéro" value={num.debut} onChange={(v) => majNum({ debut: Math.round(v) })} min={0} max={9999999} step={1} addon="" />
                  <Nombre label="Chiffres" value={num.chiffres} onChange={(v) => majNum({ chiffres: Math.round(v) })} min={1} max={8} step={1} addon="" help="0001, 0002…" />
                  <SelectField label="Position" value={num.position} onChange={(e) => majNum({ position: e.target.value as NonNullable<ParamsImposition['numerotation']>['position'] })} options={[{ value: 'bas_droite', label: 'Bas droite' }, { value: 'bas_gauche', label: 'Bas gauche' }, { value: 'bas_centre', label: 'Bas centre' }, { value: 'haut_droite', label: 'Haut droite' }, { value: 'haut_gauche', label: 'Haut gauche' }]} />
                  <Nombre label="Taille" value={num.taille_pt} onChange={(v) => majNum({ taille_pt: v })} min={6} max={72} step={1} addon="pt" />
                  {p.recto_verso && <Checkbox label="Numéro aussi au verso" checked={num.verso} onChange={(verso) => majNum({ verso })} />}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {p.operation === 'depliant' && (
        <div className="ws__section">
          <p className="ws__section-titre">Dépliant</p>
          <OptionCartes<Pliage> name="imp-pliage" label="Type de pli" tone="violet" compact value={p.pliage ?? 'roule_3'} onChange={(pliage) => maj({ pliage, recto_verso: pliage !== 'chevalet' })}
            options={(Object.keys(PLIAGE_LABELS) as Pliage[]).map((m) => ({ value: m, label: PLIAGE_LABELS[m].label, aide: PLIAGE_LABELS[m].aide, picto: <PictoPliage pliage={m} /> }))}
          />
          <p className="ev-help" style={{ margin: 0 }}>{PLIAGE_LABELS[p.pliage ?? 'roule_3'].aide}{plan?.depliant ? ` Pages attendues : ${plan.depliant.pages_attendues}.` : ''}</p>
          <OptionCartes<'developpe' | 'volets'> name="imp-entree" label="Fichier reçu" tone="teal" compact value={p.entree ?? 'developpe'} onChange={(entree) => maj({ entree })}
            options={[
              { value: 'developpe', label: 'Développé', aide: 'Une page par face, déjà à la taille de la pièce ouverte (extérieur, intérieur).', picto: <PictoOrientation sens="paysage" /> },
              { value: 'volets', label: 'Un volet par page', aide: 'Les pages du fichier sont les volets, dans l’ordre de lecture (P1 = couverture).', picto: <PictoMode mode="sequence" /> },
            ]}
          />
          <div className="imp-ligne">
            {(p.pliage === 'roule_3' || p.pliage === 'roule_4') && <Nombre label="Rabat rentrant réduit de" value={p.reduction_volet_mm ?? 2} onChange={(v) => maj({ reduction_volet_mm: v })} max={5} step={0.5} help="2 mm (3 mm pour un papier épais)." />}
            {p.pliage === 'fenetre' && <Nombre label="Jeu central" value={p.jeu_central_mm ?? 3} onChange={(v) => maj({ jeu_central_mm: v })} max={8} step={0.5} help="Espace entre les deux volets rabattus." />}
            {p.pliage === 'chevalet' && <Nombre label="Base du chevalet" value={p.base_mm ?? 25} onChange={(v) => maj({ base_mm: v })} min={10} max={80} step={1} help="Hauteur de la bande qui se glisse sous la face avant." />}
          </div>
          <Checkbox label="Rainage (papier épais) : plis marqués comme rainages" checked={!!p.rainage || p.pliage === 'chevalet'} onChange={(rainage) => maj({ rainage })} />
          {plan?.depliant && plan.depliant.volets.recto.length > 0 && (
            <p className="ev-help" style={{ margin: 0 }}>
              Volets extérieur : {plan.depliant.volets.recto.map((v) => `${v.largeur} mm${v.page ? ` (p.${v.page})` : ''}`).join(' | ')} · intérieur : {plan.depliant.volets.verso.map((v) => `${v.largeur} mm${v.page ? ` (p.${v.page})` : ''}`).join(' | ')} · plis à {plan.depliant.plis.recto.join(' et ')} mm.
            </p>
          )}
        </div>
      )}
      {p.operation === 'livret' && (
        <div className="ws__section">
          <p className="ws__section-titre">Brochure</p>
          <OptionCartes<'piqure' | 'dos_carre' | 'feuilles_volantes'> name="imp-reliure" label="Reliure" tone="violet" compact value={p.reliure ?? 'piqure'} onChange={(reliure) => maj({ reliure, chasse_mm: reliure === 'dos_carre' ? 0 : p.chasse_mm })}
            options={[
              { value: 'piqure' as const, label: RELIURE_LABELS.piqure.label, aide: RELIURE_LABELS.piqure.aide, picto: <PictoOperation op="livret" /> },
              { value: 'dos_carre' as const, label: RELIURE_LABELS.dos_carre.label, aide: RELIURE_LABELS.dos_carre.aide, picto: <svg viewBox="0 0 48 36" width="48" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="8" y="5" width="32" height="26" rx="1" fill="currentColor" fillOpacity="0.15" /><path d="M8 5v26M11 5v26M14 5v26" /><rect x="5" y="5" width="3" height="26" fill="currentColor" fillOpacity="0.5" /></svg> },
              { value: 'feuilles_volantes' as const, label: RELIURE_LABELS.feuilles_volantes.label, aide: RELIURE_LABELS.feuilles_volantes.aide, picto: <svg viewBox="0 0 48 36" width="48" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="10" y="4" width="26" height="28" rx="1" fill="currentColor" fillOpacity="0.15" /><path d="M10 9h26M10 14h26M10 19h26M10 24h26M10 29h26" strokeWidth="0.8" /><rect x="7" y="4" width="3" height="28" fill="currentColor" fillOpacity="0.5" /></svg> },
            ]}
          />
          {p.reliure === 'dos_carre' && (
            <Nombre label="Feuilles par cahier" value={p.cahier_feuilles ?? 4} onChange={(v) => maj({ cahier_feuilles: Math.round(v) })} min={1} max={16} step={1} addon="" help={`${(p.cahier_feuilles ?? 4) * 4} pages par cahier. 4 feuilles (16 pages) est le plus courant.`} />
          )}
          {p.reliure !== 'feuilles_volantes' && (
            <OptionCartes<'1' | '2' | '4'> name="imp-planches" label="Planches par feuille" tone="violet" compact value={String(p.poses_livret ?? 1) as '1' | '2' | '4'} onChange={(v) => maj({ poses_livret: Number(v) as 1 | 2 | 4 })}
              options={[
                { value: '1', label: '1 planche', aide: 'Une double page par feuille.', picto: <svg viewBox="0 0 48 36" width="48" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="6" y="6" width="36" height="24" rx="1" fill="currentColor" fillOpacity="0.2" /><path d="M24 6v24" strokeDasharray="3 2" /></svg> },
                { value: '2', label: '2 planches', aide: 'Deux doubles pages par feuille (A5 sur SRA3) : moitié moins de feuilles.', picto: <svg viewBox="0 0 48 36" width="48" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="6" y="3" width="36" height="14" rx="1" fill="currentColor" fillOpacity="0.2" /><rect x="6" y="19" width="36" height="14" rx="1" fill="currentColor" fillOpacity="0.2" /><path d="M24 3v14M24 19v14" strokeDasharray="3 2" /></svg> },
                { value: '4', label: '4 planches', aide: 'Quatre doubles pages par feuille (A6 sur SRA3).', picto: <svg viewBox="0 0 48 36" width="48" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{[0, 1].flatMap((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={5 + c * 20} y={3 + r * 16} width="18" height="14" rx="1" fill="currentColor" fillOpacity="0.2" />))}<path d="M14 3v14M34 3v14M14 19v14M34 19v14" strokeDasharray="2 2" /></svg> },
              ]}
            />
          )}
          {(p.poses_livret ?? 1) > 1 && (
            <OptionCartes<'empile' | 'repetition'> name="imp-mode-planches" label="Plusieurs planches par feuille" tone="violet" compact value={p.mode_planches ?? 'empile'} onChange={(mode_planches) => maj({ mode_planches })}
              options={[
                { value: 'empile', label: 'Empiler', aide: 'Les planches se suivent d’une position à l’autre : une pile par position, empilées = un livret.', picto: <PictoMode mode="coupe_empile" /> },
                { value: 'repetition', label: 'Répéter', aide: 'La même planche partout : chaque jeu de feuilles donne plusieurs livrets.', picto: <PictoMode mode="repetition" /> },
              ]}
            />
          )}
          {p.reliure !== 'feuilles_volantes' && (
            <OptionCartes<'gauche' | 'haut'> name="imp-bord" label="Reliure sur le bord" tone="teal" compact value={p.reliure_bord ?? 'gauche'} onChange={(reliure_bord) => maj({ reliure_bord })}
              options={[
                { value: 'gauche', label: 'Gauche', aide: 'Livre, brochure : pli vertical.', picto: <PictoOperation op="livret" /> },
                { value: 'haut', label: 'Haut', aide: 'Calendrier, bloc : pli horizontal, on feuillette par le haut.', picto: <svg viewBox="0 0 48 36" width="48" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="10" y="3" width="28" height="30" rx="1" fill="currentColor" fillOpacity="0.15" /><path d="M10 18h28" strokeDasharray="3 2" /><path d="M15 9h18M15 25h18" strokeWidth="1" /></svg> },
              ]}
            />
          )}
          {p.reliure === 'dos_carre' && p.couverture_separee && (
            <div className="imp-ligne">
              <Nombre label="Épaisseur d’une feuille" value={p.epaisseur_feuille_mm ?? 0.1} onChange={(v) => maj({ epaisseur_feuille_mm: v })} min={0.05} max={0.5} step={0.01} help="80 g : 0,10 · 135 g : 0,12 · 170 g : 0,16 · 250 g : 0,25 · 300 g : 0,30." />
              <Nombre label={`Dos${plan?.livret?.dos_mm != null && (p.dos_mm == null) ? ` (calculé : ${plan.livret.dos_mm} mm)` : ''}`} value={p.dos_mm ?? plan?.livret?.dos_mm ?? 0} onChange={(v) => maj({ dos_mm: v > 0 ? v : null })} max={60} step={0.5} help="0 pour reprendre le dos calculé d’après l’épaisseur." />
            </div>
          )}
          {p.reliure === 'dos_carre' && p.couverture_separee && <Checkbox label="Rainages de mors (7 mm de part et d’autre du dos)" checked={!!p.mors} onChange={(mors) => maj({ mors })} />}
          <OptionCartes name="imp-lecture" label="Sens de lecture" tone="teal" compact value={p.lecture ?? 'gauche_droite'} onChange={(lecture) => maj({ lecture })}
            options={[
              { value: 'gauche_droite' as const, label: 'Gauche → droite', aide: 'Français, anglais', picto: <svg viewBox="0 0 48 36" width="48" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M10 18h26" /><path d="M31 13l5 5-5 5" /></svg> },
              { value: 'droite_gauche' as const, label: 'Droite → gauche', aide: 'Arabe : la couverture est à droite', picto: <svg viewBox="0 0 48 36" width="48" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M38 18H12" /><path d="M17 13l-5 5 5 5" /></svg> },
            ]}
          />
          <Checkbox label="Couverture à part (pages 1, 2, avant-dernière et dernière sur une feuille séparée, papier plus épais)" checked={!!p.couverture_separee} onChange={(couverture_separee) => maj({ couverture_separee })} />
          {p.reliure === 'piqure' || !p.reliure ? (
            <Nombre label={`Chasse (décalage des feuilles intérieures)${plan?.livret && !(p.chasse_mm && p.chasse_mm > 0) ? ` · calculée : ${plan.livret.chasse_mm} mm` : ''}`} value={p.chasse_mm ?? 0} onChange={(v) => maj({ chasse_mm: v, chasse_auto: v > 0 ? false : p.chasse_auto })} max={10} step={0.1} help="0 = calculée d’après l’épaisseur des feuilles (environ 0,1 mm par feuille)." />
          ) : null}
          {plan?.livret?.rognage && (
            <OptionCartes<'auto' | 'aucun' | 'face' | 'trois_cotes'> name="imp-rognage" label="Rognage (livret sans fonds perdus)" tone="orange" compact value={p.rognage ?? 'auto'} onChange={(rognage) => maj({ rognage })}
              options={(Object.keys(ROGNAGE_LABELS) as ('auto' | 'aucun' | 'face' | 'trois_cotes')[]).map((m) => ({ value: m, label: ROGNAGE_LABELS[m].label, aide: ROGNAGE_LABELS[m].aide, picto: <PictoTraitsStyle style={m === 'aucun' ? 'aucun' : m === 'face' ? 'bord_feuille' : 'bloc'} /> }))}
            />
          )}
          <Checkbox label="Numéroter les pages (folios en bas, à l’extérieur ; couverture sans numéro)" checked={!!p.folios?.actif} onChange={(on) => maj({ folios: on ? { actif: true, debut: 1, position: 'bas_exterieur', taille_pt: 9, exclure_couverture: true } : null })} />
          <Checkbox label="Pages de garde : une feuille blanche pliée en plus" checked={p.gardes === 4} onChange={(on) => maj({ gardes: on ? 4 : 0 })} />
          <SelectField label={`Pages blanches${plan?.pages_blanches ? ` (${plan.pages_blanches} ajoutée${plan.pages_blanches > 1 ? 's' : ''} pour un multiple de 4)` : ''}`} value={p.blanches} onChange={(e) => maj({ blanches: e.target.value as ModeBlanches })} options={(Object.keys(BLANCHES_LABELS) as ModeBlanches[]).map((m) => ({ value: m, label: BLANCHES_LABELS[m].label }))} help={BLANCHES_LABELS[p.blanches]?.aide} />
          {p.blanches === 'positions' && (p.blanches_apres?.length ?? 0) > 0 && (
            <p className="ev-help" style={{ margin: 0 }}>{p.blanches_apres!.length} blanche{p.blanches_apres!.length > 1 ? 's' : ''} placée{p.blanches_apres!.length > 1 ? 's' : ''} à la main (vue « Pages »). <button type="button" className="ev-btn ev-btn--ghost ev-btn--sm" onClick={() => maj({ blanches: 'avant_derniere', blanches_apres: [] })}>Tout retirer</button></p>
          )}
          <Nombre label="Exemplaires" value={p.quantite ?? 0} onChange={(v) => maj({ quantite: v > 0 ? Math.round(v) : undefined })} min={0} max={100000} step={1} addon="ex." help="Pour compter les feuilles à imprimer." />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modèles (admin) et assistant IA

function Modeles({ params, onAppliquer }: { params: ParamsImposition | null; onAppliquer: (m: ModeleImposition) => void }) {
  const user = useUser();
  const toast = useToast();
  const q = useModelesImposition();
  const { creer, supprimer } = useModelesMutations();
  const [enregistrer, setEnregistrer] = useState(false);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [finiImpose, setFiniImpose] = useState(false);
  const [aSupprimer, setASupprimer] = useState<ModeleImposition | null>(null);
  const items = q.data?.items ?? [];
  const admin = user.role === 'admin';
  return (
    <div className="ws__section">
      <div className="row-between">
        <p className="ws__section-titre">Modèles</p>
        {admin && params && (
          <Button size="sm" variant="ghost" icon={<Bookmark />} onClick={() => setEnregistrer(true)}>Enregistrer ces réglages</Button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="ev-muted" style={{ margin: 0, fontSize: 12 }}>{admin ? 'Aucun modèle : réglez une imposition puis enregistrez-la.' : 'Aucun modèle enregistré par l’administrateur.'}</p>
      ) : (
        <div className="imp-modeles">
          {items.map((m) => (
            <span key={m.id} className="imp-modele" title={m.description ?? undefined}>
              <button type="button" className="imp-modele" style={{ padding: 0, border: 0 }} onClick={() => onAppliquer(m)}>
                <LayoutGrid aria-hidden="true" width={14} height={14} /> {m.nom}
              </button>
              {admin && (
                <button type="button" className="imp-modele__x" aria-label={`Supprimer le modèle ${m.nom}`} onClick={() => setASupprimer(m)}>
                  <Trash2 width={12} height={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {enregistrer && params && (
        <Dialog open onClose={() => setEnregistrer(false)} title="Enregistrer un modèle d’imposition" description="Les réglages actuels seront proposés d’un clic aux préparateurs. Sauf demande ci-dessous, le format fini du fichier est conservé à l’application."
          footer={
            <>
              <Button onClick={() => setEnregistrer(false)}>Annuler</Button>
              <Button variant="primary" busy={creer.isPending} disabled={!nom.trim()} onClick={() => creer.mutate({ nom: nom.trim(), description: description.trim() || null, params: { ...params, fini_impose: finiImpose } }, { onSuccess: () => (setEnregistrer(false), setNom(''), setDescription(''), toast.success('Modèle enregistré', nom.trim())), onError: (e) => toast.error('Modèle non enregistré', messageErreur(e)) })}>
                Enregistrer
              </Button>
            </>
          }
        >
          <TextField label="Nom" required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Cartes de visite SRA3, 21 poses" data-autofocus />
          <TextareaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Quand l’utiliser, ce qu’il faut vérifier…" />
          <Checkbox label={`Imposer aussi le format fini ${params.fini.largeur} × ${params.fini.hauteur} mm : un fichier d’une autre taille sera mis à ce format (adapté, rempli ou étiré selon le réglage).`} checked={finiImpose} onChange={setFiniImpose} />
        </Dialog>
      )}
      <ConfirmDialog open={!!aSupprimer} onClose={() => setASupprimer(null)} title={`Supprimer le modèle « ${aSupprimer?.nom} » ?`} description="Les impositions déjà générées ne sont pas concernées." confirmLabel="Supprimer" danger busy={supprimer.isPending}
        onConfirm={() => aSupprimer && supprimer.mutate(aSupprimer.id, { onSuccess: () => setASupprimer(null), onError: (e) => toast.error('Suppression impossible', messageErreur(e)) })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rapport d'analyse, en haut de l'écran d'imposition : ce qui a été trouvé, ce qui a été réglé tout seul,
// ce qu'il faut vérifier, et l'avis de l'assistant IA.

type Ligne = { ton: 'ok' | 'auto' | 'attention' | 'alerte' | 'info'; texte: string; choix?: { label: string; patch: Partial<ParamsImposition> }[] };

function lignesRapport(r: ReponseAnalyse, p: ParamsImposition, plan: Plan | undefined): Ligne[] {
  const a = r.analyse;
  const l: Ligne[] = [];
  const f = a.format;
  const proche = r.format_proche;
  const finiEstFichier = Math.abs(p.fini.largeur - a.fini.largeur) < 0.05 && Math.abs(p.fini.hauteur - a.fini.hauteur) < 0.05;
  l.push(f
    ? { ton: 'ok', texte: `${a.nb_pages} page${a.nb_pages > 1 ? 's' : ''} reconnue${a.nb_pages > 1 ? 's' : ''} : ${f.libelle.replace(/\s*\(.*\)$/, '')}${f.paysage ? ', en paysage' : ''}.` }
    : {
        ton: 'attention',
        texte: `${a.nb_pages} page${a.nb_pages > 1 ? 's' : ''} de ${a.largeur} × ${a.hauteur} mm : format non reconnu, format fini pris à ${p.fini.largeur} × ${p.fini.hauteur} mm.${proche && finiEstFichier ? ` Le plus proche : ${proche.libelle}.` : ' Vérifiez-le.'}`,
        choix: proche && finiEstFichier && p.operation !== 'assembler' ? [{ label: `Mettre au format ${proche.largeur} × ${proche.hauteur} mm`, patch: { fini: orienterComme(proche, a.fini) } }] : undefined,
      });
  if (r.planches?.separees) l.push({ ton: 'auto', texte: `Planches séparées : ${r.planches.separees} page${r.planches.separees > 1 ? 's' : ''} double${r.planches.separees > 1 ? 's' : ''} coupée${r.planches.separees > 1 ? 's' : ''} en deux (${a.nb_pages} pages)${p.planches === 'couverture' ? ', couverture à plat (la 4e de couverture passe à la fin)' : ''}.`, choix: [...(p.planches !== 'couverture' ? [{ label: 'Couverture à plat (4e | 1re)', patch: { planches: 'couverture' as const } }] : [{ label: 'Planches simples', patch: { planches: 'simple' as const } }]), { label: 'Ne pas séparer', patch: { planches: 'non' as const } }] });
  else if (r.planches?.detection) {
    const d = r.planches.detection;
    l.push({
      ton: d.confiance === 'forte' ? 'attention' : 'info',
      texte: d.confiance === 'forte'
        ? `${d.pages_doubles} page${d.pages_doubles > 1 ? 's' : ''} double${d.pages_doubles > 1 ? 's' : ''} (deux pages côte à côte${d.format_page ? `, ${d.format_page.replace(/ \d+ × \d+ mm.*$/, '')} chacune` : ''})${d.couverture_seule ? ', couverture seule en tête : export en planches' : ''}. À séparer avant d’imposer.`
        : `Pages en paysage : si ce sont des planches (deux pages côte à côte), séparez-les avant d’imposer.`,
      choix: [{ label: 'Séparer en pages', patch: { planches: 'simple' } }, { label: 'Couverture à plat (4e | 1re)', patch: { planches: 'couverture' } }],
    });
  }
  if (plan?.adaptation && p.operation !== 'assembler') {
    const ad = plan.adaptation;
    const perte = ad.marges.x > 1 || ad.marges.y > 1 || ad.rognage.x > 1 || ad.rognage.y > 1;
    const autres = (['adapter', 'remplir', 'etirer', 'centrer'] as const).filter((m) => m !== ad.mode).map((m) => ({ label: AJUSTEMENT_LABELS[m].label, patch: { ajustement: m } as Partial<ParamsImposition> }));
    l.push({ ton: ad.pivote ? 'auto' : perte ? 'attention' : 'auto', texte: `${texteAdaptation(ad, p.fini)}${ad.auto && !ad.pivote ? ` (mise au format « ${AJUSTEMENT_LABELS[ad.mode].label.toLowerCase()} » choisie automatiquement)` : ''}`, choix: ad.pivote ? undefined : [...autres, ...(!finiEstFichier ? [{ label: `Garder ${a.fini.largeur} × ${a.fini.hauteur} mm`, patch: { fini: { largeur: a.fini.largeur, hauteur: a.fini.hauteur } } as Partial<ParamsImposition> }] : [])] });
  }
  if (r.paires?.some((x) => x.verso !== null)) l.push({ ton: 'ok', texte: `Recto et verso séparés appariés : ${r.paires.filter((x) => x.verso !== null).length} paire${r.paires.filter((x) => x.verso !== null).length > 1 ? 's' : ''}.` });
  if (r.paires?.some((x) => x.verso === null) && r.paires.some((x) => x.verso !== null)) l.push({ ton: 'attention', texte: 'Il y a plus de rectos que de versos : certains versos seront vides.' });
  if (!a.uniforme) l.push({ ton: 'attention', texte: 'Les pages n’ont pas toutes la même taille : elles sont adaptées à la première.' });
  if (p.operation !== 'assembler' && plan?.coupe) {
    // Décision de coupe prise par le serveur, avec sa raison chiffrée et les autres systèmes possibles.
    const c = plan.coupe;
    const patchPour = (sys: typeof c.alternatives[number]): Partial<ParamsImposition> => (sys === 'fonds_perdus' ? { coupe: 'fonds_perdus', fonds_perdus_mm: p.fonds_perdus_mm > 0 ? p.fonds_perdus_mm : 3, methode_fonds_perdus: p.methode_fonds_perdus === 'blanc' ? 'intelligent' : p.methode_fonds_perdus } : { coupe: sys, fonds_perdus_mm: 0, methode_fonds_perdus: 'blanc', ...(sys === 'cadre' && !(p.cadre_blanc_mm && p.cadre_blanc_mm > 0) ? { cadre_blanc_mm: 3 } : {}) });
    let detail = '';
    if (c.systeme === 'fonds_perdus' && c.methode === 'intelligent') {
      const u = a.pages.find((pg) => pg.bords_unis)?.bords_unis;
      detail = u ? ` Bord par bord : ${(['haut', 'bas', 'gauche', 'droite'] as const).map((b) => `${b} ${u[b] ? 'prolongé' : 'en miroir'}`).join(', ')}.` : '';
    }
    const ton: Ligne['ton'] = c.systeme === 'fonds_perdus' && a.fonds_perdus !== 'absents' ? 'ok' : c.auto ? 'auto' : 'info';
    l.push({ ton, texte: `${libelleCoupe(c, plan.fonds_perdus_mm)} : ${c.raison}${detail}`, choix: (p.operation === 'poses' ? c.alternatives : c.alternatives.filter((x) => x === 'franche' || x === 'fonds_perdus')).map((sys) => ({ label: SYSTEME_LABELS[sys], patch: patchPour(sys) })) });
  }
  if (plan?.calepinage) {
    const k = plan.calepinage;
    const mm = (v: number) => (Math.round(v * 10) / 10).toLocaleString('fr-FR');
    const choix = k.alternatives.map((alt) => ({ label: `${alt.partages ? 'Partagés ' : ''}${mm(alt.fonds_perdus_mm)} mm${alt.rotation === 'mixte' ? ', bande tournée' : alt.rotation === '90' ? ', tournées' : ''} → ${alt.poses} poses${alt.reperes_ok ? '' : ' (sans repères)'}`, patch: { fonds_perdus_mm: alt.fonds_perdus_mm, fonds_partages: alt.partages ? true : false, rotation_poses: alt.rotation === 'mixte' ? 'mixte' : alt.rotation === '90' ? '90' : 'aucune', calepinage: 'manuel' } as Partial<ParamsImposition> }));
    if (!k.auto) choix.unshift({ label: 'Remettre le calepinage automatique', patch: { calepinage: 'auto', fonds_partages: 'auto', rotation_poses: 'auto' } });
    l.push({ ton: k.auto ? 'auto' : 'info', texte: `Calepinage : ${k.raison}`, choix: choix.slice(0, 5) });
  }
  if (plan?.depliant) {
    const d = plan.depliant;
    const manque = a.nb_pages < d.pages_attendues;
    l.push({ ton: manque ? 'attention' : 'auto', texte: `${PLIAGE_LABELS[d.pliage].label} : ${d.entree === 'developpe' ? `fichier développé ${d.developpe.largeur} × ${d.developpe.hauteur} mm` : `${d.pages_attendues} volets attendus, ${a.nb_pages} page${a.nb_pages > 1 ? 's' : ''} reçue${a.nb_pages > 1 ? 's' : ''}`}${d.volets.recto.length ? ` · volets extérieur ${d.volets.recto.map((v) => v.largeur).join(' | ')} mm, intérieur ${d.volets.verso.map((v) => v.largeur).join(' | ')} mm` : ''} · format fermé ${d.ferme.largeur} × ${d.ferme.hauteur} mm · ${d.pieces_par_feuille} pièce${d.pieces_par_feuille > 1 ? 's' : ''} par feuille.` });
  }
  for (const c of plan?.consignes ?? []) l.push({ ton: 'info', texte: c });
  for (const piece of r.pieces) for (const m of piece.avertissements) if (/résolution|dpi|flou|trait de coupe/i.test(m)) l.push({ ton: 'attention', texte: `${piece.nom} : ${m}` });
  if (plan) {
    if (plan.operation === 'poses') l.push({ ton: 'auto', texte: `${plan.poses_par_face} poses par face sur ${plan.feuille.largeur} × ${plan.feuille.hauteur} mm (${plan.paysage ? 'paysage' : 'portrait'})${plan.feuilles_a_imprimer ? `, ${plan.feuilles_a_imprimer} feuilles à imprimer` : ''}.` });
    if (plan.operation === 'poses' && a.nb_pages > 1 && (p.mode === 'sequence' || p.mode === 'repetition')) {
      const visuels = r.paires ? r.paires.length : p.recto_verso ? Math.ceil(a.nb_pages / 2) : a.nb_pages;
      const n = plan.poses_par_face;
      const q = p.quantite && p.quantite > 0 ? p.quantite : null;
      const faces = p.recto_verso ? ', recto-verso' : ', recto seul';
      // Feuilles pour q exemplaires de chaque visuel : séquence = q tirages de chaque feuille différente ;
      // répétition = un visuel par feuille, chacune tirée q / poses fois (jamais plus dès que q ≥ poses).
      const comparaison = q && visuels > 1 ? ` Pour ${q} ex. de chaque visuel : ${visuels * Math.ceil(q / n)} feuilles en répétition, ${Math.ceil(visuels / n) * q} en séquence.` : '';
      if (p.mode === 'sequence') {
        l.push({ ton: 'auto', texte: `${visuels} visuel${visuels > 1 ? 's' : ''} différent${visuels > 1 ? 's' : ''}, chacun sur sa pose (séquence)${faces} : chaque feuille imprimée donne un exemplaire de chaque visuel${plan.nb_feuilles > 1 ? ` (${plan.nb_feuilles} feuilles différentes)` : ''}.${comparaison}`, choix: visuels > 1 ? [{ label: `Un visuel par feuille (répétition, ${visuels} feuilles)`, patch: { mode: 'repetition', repetition_visuels: 'chacun' } }] : undefined });
      } else if (visuels > 1 && p.repetition_visuels === 'premier') {
        l.push({ ton: 'attention', texte: `${visuels} visuels dans le fichier : seul le premier est imposé.`, choix: [{ label: `Chaque visuel sur sa feuille (${visuels} feuilles)`, patch: { repetition_visuels: 'chacun' } }, { label: 'Tous à la suite sur une feuille (séquence)', patch: { mode: 'sequence' } }] });
      } else if (visuels > 1) {
        l.push({ ton: 'auto', texte: `${visuels} visuels différents, chacun répété sur toutes les poses de sa propre feuille (${visuels} feuilles de ${n} poses)${faces} : aucune pose vide, une pile par visuel après la coupe.${comparaison}`, choix: [{ label: 'Tous à la suite sur une feuille (séquence)', patch: { mode: 'sequence' } }, { label: 'Seulement le premier visuel', patch: { repetition_visuels: 'premier' } }] });
      }
    }
    if (plan.operation === 'livret') l.push({ ton: 'auto', texte: `Livret de ${plan.nb_feuilles * 4} pages sur ${plan.nb_feuilles} feuille${plan.nb_feuilles > 1 ? 's' : ''} ${plan.feuille.largeur} × ${plan.feuille.hauteur} mm${plan.pages_blanches ? `, ${plan.pages_blanches} page${plan.pages_blanches > 1 ? 's' : ''} blanche${plan.pages_blanches > 1 ? 's' : ''} ajoutée${plan.pages_blanches > 1 ? 's' : ''}` : ''}.` });
    for (const m of plan.avertissements) l.push({ ton: 'attention', texte: m });
  }
  if (!a.rendu) l.push({ ton: 'info', texte: 'Le bord des pages n’a pas pu être contrôlé sur ce serveur.' });
  return l;
}

function Rapport({ r, p, plan, ia, iaEnCours, iaErreur, onRedemander, onParams }: { r: ReponseAnalyse; p: ParamsImposition; plan?: Plan; ia: PropositionImposition | null; iaEnCours: boolean; iaErreur: string | null; onRedemander?: () => void; onParams?: (patch: Partial<ParamsImposition>) => void }) {
  const lignes = lignesRapport(r, p, plan);
  const alertes = lignes.filter((x) => x.ton === 'alerte' || x.ton === 'attention').length;
  return (
    <section className="rapport" data-etat={alertes ? 'attention' : 'ok'} aria-labelledby="titre-rapport">
      <header className="rapport__tete">
        <h2 id="titre-rapport">Rapport d’analyse</h2>
        <span className="rapport__badge">{alertes ? `${alertes} point${alertes > 1 ? 's' : ''} à vérifier` : 'Prêt à imposer'}</span>
      </header>
      <ul className="rapport__lignes">
        {lignes.map((x, i) => (
          <li key={i} data-ton={x.ton}>
            <span className="rapport__puce" aria-hidden="true" />
            {x.ton === 'auto' && <span className="rapport__auto">Auto</span>}
            <span className="rapport__texte">
              {x.texte}
              {x.choix && onParams && (
                <span className="rapport__choix">
                  {x.choix.map((c) => <button key={c.label} type="button" onClick={() => onParams(c.patch)}>{c.label}</button>)}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {!ia && !iaEnCours && !iaErreur && onRedemander && (
        <div className="rapport__ia">
          <span className="rapport__ia-tete">
            <Sparkles aria-hidden="true" /> Assistant IA non sollicité
            <Button size="sm" variant="ghost" onClick={onRedemander}>Demander son avis</Button>
          </span>
          <span className="ev-muted">L’analyse locale est sûre : aucun jeton consommé.</span>
        </div>
      )}
      {(ia || iaEnCours || iaErreur) && (
        <div className="rapport__ia">
          <span className="rapport__ia-tete">
            <Sparkles aria-hidden="true" /> Assistant IA
            {ia && <span className="imp-confiance" data-niveau={ia.confiance}>confiance {ia.confiance}</span>}
            {onRedemander && !iaEnCours && <Button size="sm" variant="ghost" onClick={onRedemander}>Redemander</Button>}
          </span>
          {iaEnCours ? (
            <span className="ev-muted">Lecture du fichier et des spécifications du dossier…</span>
          ) : iaErreur ? (
            <span className="ev-muted">L’assistant n’a pas répondu ({iaErreur}). Les réglages automatiques restent appliqués.</span>
          ) : ia ? (
            <>
              <span><strong>{ia.type_document}</strong> · {ia.explication}</span>
              {ia.points_de_vigilance.length > 0 && <ul>{ia.points_de_vigilance.map((x, i) => <li key={i}>{x}</li>)}</ul>}
              <span className="ev-help">{FOURNISSEUR_LABELS_IA[ia.fournisseur] ?? ia.fournisseur} · {ia.modele}{ia.secours ? ' · par le secours' : ''}{ia.depuis_cache ? ' · réponse déjà connue, aucun jeton consommé' : ia.jetons ? ` · ${ia.jetons} jetons` : ''}</span>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Génération : étapes affichées pendant le travail du serveur

const ETAPES_GENERATION = ['Lecture et assemblage des fichiers', 'Contrôle des formats et des fonds perdus', 'Placement des poses sur la feuille', 'Fonds perdus et traits de coupe', 'Écriture du PDF'];

function Generation({ actif }: { actif: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!actif) return setI(0);
    const t = setInterval(() => setI((v) => Math.min(ETAPES_GENERATION.length - 1, v + 1)), 900);
    return () => clearInterval(t);
  }, [actif]);
  if (!actif) return null;
  return (
    <div className="gen" role="status" aria-live="polite">
      <div className="gen__carte">
        <span className="gen__titre">Génération du PDF…</span>
        <ol className="gen__etapes">
          {ETAPES_GENERATION.map((e, k) => (
            <li key={e} data-etat={k < i ? 'fait' : k === i ? 'en_cours' : 'a_venir'}>
              <span className="gen__puce" aria-hidden="true">{k < i ? <Check width={12} height={12} /> : null}</span>
              {e}
            </li>
          ))}
        </ol>
        <span className="ev-help">Un gros livret peut prendre une minute.</span>
      </div>
    </div>
  );
}

/** Rattacher un résultat sans dossier à un dossier existant. */
function Rattacher({ jeton, onFait }: { jeton: string; onFait: (d: { id: number; numero: string; client_nom: string }) => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const liste = useDossiers({ q: q.trim() || undefined, limit: 5, tri: 'recent', machine: 'xerox', statut: ['en_cours', 'a_revoir'] });
  const rattacher = useRattacher();
  return (
    <div className="ratt">
      <strong>Ajouter ce PDF à un dossier</strong>
      <span className="ev-help">Dossiers en préparation : le PDF y sera rangé, prêt pour l’imprimeur.</span>
      <TextField label="Dossier" placeholder="Numéro, client…" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="imp-dossiers">
        {(liste.data?.items ?? []).map((d) => (
          <li key={d.id}>
            <button type="button" className="imp-dossier" disabled={rattacher.isPending} onClick={() => rattacher.mutate({ jeton, dossier_id: d.id }, { onSuccess: (r) => (onFait(r.dossier), toast.success('PDF ajouté au dossier', `${r.dossier.numero} · ${r.dossier.client_nom}`)), onError: (e) => toast.error('Ajout impossible', messageErreur(e)) })}>
              <Ref>{d.numero}</Ref>
              <span className="imp-dossier__client">{d.client_nom}</span>
              <Plus aria-hidden="true" width={14} height={14} />
            </button>
          </li>
        ))}
        {liste.data && liste.data.items.length === 0 && <li className="ev-muted" style={{ fontSize: 12 }}>Aucun dossier en préparation ne correspond.</li>}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page : trois écrans. 1. Fichiers  2. Prévisualisation et réglages  3. Résultat.

type Ecran = 1 | 2;
const ECRANS: { id: Ecran; titre: string; aide: string }[] = [
  { id: 1, titre: 'Fichiers', aide: 'Choisir dans un dossier ou déposer' },
  { id: 2, titre: 'Prévisualisation, réglages et génération', aide: 'Feuille, poses, fonds perdus, traits' },
];

function Etapes({ courant, max, onAller }: { courant: Ecran; max: Ecran; onAller: (e: Ecran) => void }) {
  return (
    <ol className="imp-stepper" aria-label="Étapes">
      {ECRANS.map((e) => {
        const etat = e.id < courant ? 'faite' : e.id === courant ? 'courante' : 'a_venir';
        return (
          <li key={e.id} data-etat={etat}>
            <button type="button" className="imp-stepper__btn" disabled={e.id > max} aria-current={etat === 'courante' ? 'step' : undefined} onClick={() => onAller(e.id)}>
              <span className="imp-etape" aria-hidden="true">{etat === 'faite' ? <Check width={14} height={14} /> : e.id}</span>
              <span className="imp-stepper__texte">
                <span>{e.titre}</span>
                <small>{e.aide}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Écran 1 : les pièces du travail. */
function EcranFichiers({ pieces, setPieces, analyses, dossierId, setDossierId, enAnalyse, onSuivant, onPret }: {
  pieces: Piece[];
  setPieces: (p: Piece[]) => void;
  analyses: PieceAnalysee[];
  dossierId: number | null;
  setDossierId: (id: number | null) => void;
  enAnalyse: boolean;
  onSuivant: () => void;
  /** Appelé après un dépôt ou après « Terminé » dans la fenêtre du dossier : on passe à l'imposition dès que l'analyse est prête. */
  onPret: () => void;
}) {
  const toast = useToast();
  const [dialogue, setDialogue] = useState(false);
  const [survol, setSurvol] = useState(false);
  const [envois, setEnvois] = useState<Record<string, number>>({});
  const deposer = useTeleverserLibre((nom, part) => setEnvois((e) => ({ ...e, [nom]: part })));
  const dossier = useDossier(dossierId ?? undefined);
  const input = useRef<HTMLInputElement>(null);
  const ajouter = (p: Omit<Piece, 'cle'>) => setPieces([...piecesRef.current, { ...p, cle: `${p.libre ?? p.fichier_id}:${p.role}:${Math.random().toString(36).slice(2, 7)}` }]);
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;
  const deplacer = (i: number, d: -1 | 1) => {
    const l = [...pieces];
    const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j]!, l[i]!];
    setPieces(l);
  };
  const envoyer = async (files: File[]) => {
    let ajoutes = 0;
    for (const f of files) {
      if (!genreDe(f.name, f.type)) {
        toast.error('Fichier non pris en charge', `${f.name} : déposez un PDF ou une image.`);
        continue;
      }
      setEnvois((e) => ({ ...e, [f.name]: 0 }));
      try {
        const r = await deposer.mutateAsync(f);
        ajouter({ libre: r.libre, role: 'pages', nom: r.nom, taille: r.taille, mime: r.mime, genre: r.genre });
        ajoutes++;
      } catch (err) {
        toast.error(`${f.name} non déposé`, messageErreur(err));
      } finally {
        setEnvois((e) => {
          const n = { ...e };
          delete n[f.name];
          return n;
        });
      }
    }
    if (ajoutes > 0) onPret();
  };
  const onChoix = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void envoyer(files);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setSurvol(false);
    void envoyer(Array.from(e.dataTransfer.files));
  };
  const analyseDe = (p: Piece) => analyses.find((a) => (p.libre ? a.libre === p.libre : a.fichier_id === p.fichier_id));
  const avecRV = pieces.some((p) => p.role !== 'pages');
  const rectos = pieces.filter((p) => p.role === 'recto').length;
  const versos = pieces.filter((p) => p.role === 'verso').length;

  return (
    <div className="ecran ecran--fichiers">
      <div className="ecran__sources">
        <button type="button" className="source" onClick={() => setDialogue(true)}>
          <span className="source__icone"><FolderOpen aria-hidden="true" /></span>
          <span className="source__titre">Depuis un dossier</span>
          <span className="source__aide">Les PDF et images déjà déposés dans un dossier client</span>
          {dossier.data && (
            <span className="source__actuel">
              <Ref>{dossier.data.numero}</Ref> {dossier.data.client_nom} <MachineChip machine={dossier.data.machine} />
            </span>
          )}
        </button>
        <label className="source source--depot" data-survol={survol || undefined} onDragOver={(e) => (e.preventDefault(), setSurvol(true))} onDragLeave={() => setSurvol(false)} onDrop={onDrop}>
          <input ref={input} type="file" accept=".pdf,.ai,image/*" multiple onChange={onChoix} />
          <span className="source__icone"><Upload aria-hidden="true" /></span>
          <span className="source__titre">{deposer.isPending ? 'Envoi en cours…' : 'Déposer ou choisir des fichiers'}</span>
          <span className="source__aide">Glissez des PDF ou des images ici, ou cliquez pour les choisir. Ils sont envoyés, analysés, puis l’imposition s’ouvre avec son rapport.</span>
          {Object.entries(envois).map(([nom, part]) => (
            <span key={nom} className="source__envoi">
              <span className="source__envoi-nom">{nom}</span>
              <span className="source__barre"><span style={{ width: `${Math.round(part * 100)}%` }} /></span>
              <span className="source__envoi-pc">{Math.round(part * 100)} %</span>
            </span>
          ))}
        </label>
      </div>

      <section className="ws__panneau ecran__liste" aria-labelledby="titre-pieces">
        <div className="ws__outils">
          <h2 className="ws__titre" id="titre-pieces">Fichiers du travail</h2>
          <span className="ev-muted" style={{ fontSize: 13 }}>{pieces.length ? `${pieces.length} fichier${pieces.length > 1 ? 's' : ''}${avecRV ? ` · ${rectos} recto${rectos > 1 ? 's' : ''}, ${versos} verso${versos > 1 ? 's' : ''}` : ''}` : ''}</span>
        </div>
        {pieces.length === 0 ? (
          <p className="pc__vide">Aucun fichier pour l’instant. Ajoutez un PDF (une ou plusieurs pages), ou deux fichiers séparés pour le recto et le verso, ou plusieurs images.</p>
        ) : (
          <ul className="pc">
            {pieces.map((p, i) => {
              const a = analyseDe(p);
              return (
                <li key={p.cle} className="pc__item pc__item--large" data-role={p.role}>
                  <span className="pc__ordre">
                    <button type="button" aria-label="Monter" disabled={i === 0} onClick={() => deplacer(i, -1)}><ArrowUp width={14} height={14} /></button>
                    <span className="pc__rang">{i + 1}</span>
                    <button type="button" aria-label="Descendre" disabled={i === pieces.length - 1} onClick={() => deplacer(i, 1)}><ArrowDown width={14} height={14} /></button>
                  </span>
                  <MiniPiece p={p} analyse={a} />
                  <span style={{ minWidth: 0 }}>
                    <span className="pc__nom" title={p.nom}>{p.nom}</span>
                    <span className="pc__meta">{p.libre ? 'déposé sans dossier · ' : ''}{formatTaille(p.taille)}{p.roleAuto ? ` · ${p.role === 'recto' ? 'recto' : 'verso'} détecté automatiquement` : ''}</span>
                    {a ? <ChipsPiece a={a} /> : enAnalyse ? <span className="pc__meta">Analyse…</span> : null}
                    {a?.avertissements.filter((m) => !/Poppler/.test(m)).slice(0, 1).map((m, k) => <span key={k} className="ev-help" style={{ display: 'block', margin: '3px 0 0' }}>{m}</span>)}
                  </span>
                  <span className="pc__roles" role="radiogroup" aria-label={`Rôle de ${p.nom}`}>
                    {(['pages', 'recto', 'verso'] as RolePiece[]).map((r) => (
                      <button key={r} type="button" role="radio" aria-checked={p.role === r} data-role={r} onClick={() => setPieces(pieces.map((x) => (x.cle === p.cle ? { ...x, role: r, roleAuto: false } : x)))}>
                        {r === 'pages' ? 'Pages' : r === 'recto' ? 'Recto' : 'Verso'}
                      </button>
                    ))}
                  </span>
                  <button type="button" className="ev-icon-btn ev-icon-btn--sm" aria-label={`Retirer ${p.nom}`} onClick={() => setPieces(pieces.filter((x) => x.cle !== p.cle))}><X /></button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="ecran__legende">
          <span><span className="pc__pastille" data-role="pages" /> <strong>Pages</strong> : les pages se suivent (brochure, flyers différents).</span>
          <span><span className="pc__pastille" data-role="recto" /> <strong>Recto</strong> et <span className="pc__pastille" data-role="verso" /> <strong>Verso</strong> : deux fichiers pour les deux faces, appariés dans l’ordre.</span>
        </div>
      </section>

      <div className="ecran__pied">
        <span className="ev-muted" style={{ fontSize: 13 }}>{enAnalyse && pieces.length ? 'Analyse des fichiers…' : pieces.length === 0 ? 'Ajoutez au moins un fichier pour continuer.' : rectos !== versos && avecRV && versos > 0 ? 'Attention : il n’y a pas autant de rectos que de versos.' : 'Le fichier d’origine n’est jamais modifié.'}</span>
        <Button variant="primary" size="lg" disabled={pieces.length === 0} onClick={onSuivant}>
          Suivant : prévisualiser et régler <ArrowRight aria-hidden="true" />
        </Button>
      </div>

      {dialogue && <DialogueDossier dossierId={dossierId} pieces={pieces} onDossier={setDossierId} onAjouter={ajouter} onClose={() => (setDialogue(false), piecesRef.current.length > 0 && onPret())} />}
    </div>
  );
}

export default function Imposition() {
  const [sp, setSp] = useSearchParams();
  const toast = useToast();
  const dossierParam = Number(sp.get('dossier')) || null;
  const fichierParam = Number(sp.get('fichier')) || null;
  const [ecran, setEcran] = useState<Ecran>(1);
  const [dossierId, setDossierIdState] = useState<number | null>(dossierParam);
  const setDossierId = (id: number | null) => {
    setDossierIdState(id);
    setSp(id ? { dossier: String(id) } : {}, { replace: true });
  };
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [params, setParams] = useState<ParamsImposition | null>(null);
  const [zoom, setZoom] = useState(1);
  // Zoom à la molette (Ctrl ou Cmd) : écouteur non passif, sinon le navigateur zoome toute la page.
  const scene = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scene.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom((z) => Math.min(4, Math.max(0.4, Math.round((z - Math.sign(e.deltaY) * 0.1) * 10) / 10)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });
  const [face, setFace] = useState<'recto' | 'verso'>('recto');
  const [feuilleVue, setFeuilleVue] = useState(0);
  // Vue du centre : une feuille (zoom), toutes les feuilles à la verticale, ou les pages du document.
  const [vue, setVue] = useState<'feuille' | 'feuilles' | 'pages'>('feuille');
  const allerFeuille = (index: number, cote: 'recto' | 'verso') => {
    setFeuilleVue(index);
    setFace(cote);
    setVue('feuille');
  };
  const [resultat, setResultat] = useState<ResultatGeneration | null>(null);
  const [rattache, setRattache] = useState<{ id: number; numero: string; client_nom: string } | null>(null);
  const dossier = useDossier(dossierId ?? undefined);

  // Fichier passé dans l'adresse (bouton « Imposer » de la fiche dossier) : première pièce.
  const initialise = useRef(false);
  useEffect(() => {
    if (initialise.current || !fichierParam || !dossier.data) return;
    const f = dossier.data.fichiers.find((x) => x.id === fichierParam);
    const genre = f ? genreDe(f.nom_original, f.mime) : null;
    if (f && genre) {
      initialise.current = true;
      setPieces([{ cle: `${f.id}:init`, fichier_id: f.id, role: 'pages', nom: f.nom_original, taille: f.taille, mime: f.mime, genre }]);
    }
  }, [fichierParam, dossier.data]);

  const analyse = useAnalyse(pieces, params?.fini, params?.fonds_perdus_mm, { planches: params?.planches, lecture: params?.lecture });
  // Deux fichiers d'une page de même format : recto et verso détectés (nom du fichier, sinon ordre).
  useEffect(() => {
    const an = analyse.data?.pieces;
    if (!an || analyse.isPlaceholderData) return;
    const r = rolesAuto(pieces, (p) => {
      const x = an.find((a) => (p.libre ? a.libre === p.libre : a.fichier_id === p.fichier_id));
      return x ? { pages: x.pages, largeur: x.largeur, hauteur: x.hauteur } : undefined;
    });
    if (r) setPieces(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyse.data, analyse.isPlaceholderData]);
  const clePieces = pieces.map((p) => `${p.libre ?? p.fichier_id}:${p.role}`).join('|');
  const derniereCle = useRef('');
  // Planches séparées : le document change (deux fois plus de pages, moitié moins larges) ; le format
  // fini est repris de la nouvelle analyse, le reste des réglages est gardé.
  const clePlanches = `${params?.planches ?? 'non'}`;
  const dernieresPlanches = useRef(clePlanches);
  useEffect(() => {
    if (!analyse.data || analyse.isPlaceholderData) return;
    const d = analyse.data;
    if (derniereCle.current !== clePieces) {
      derniereCle.current = clePieces;
      dernieresPlanches.current = clePlanches;
      const op = operationParDefaut(d);
      setParams((prev) => reglagesPour(prev?.operation ?? op, d, d.params_defaut));
      setFeuilleVue(0);
      setFace('recto');
    } else if (dernieresPlanches.current !== clePlanches && (d.planches?.separees ?? 0) >= 0) {
      dernieresPlanches.current = clePlanches;
      setParams((prev) => (prev ? reglagesPour(prev.operation, d, { ...prev, fini: { largeur: 0, hauteur: 0 } }) : prev));
      setFeuilleVue(0);
    }
  }, [analyse.data, analyse.isPlaceholderData, clePieces, clePlanches]);
  useEffect(() => {
    if (pieces.length === 0) {
      setParams(null);
      derniereCle.current = '';
      setEcran(1);
    }
  }, [pieces.length]);

  const plan = usePlan(ecran >= 2 ? pieces : [], params);
  // Avancer tout seul après un dépôt, dès que l'analyse est prête.
  const [avancer, setAvancer] = useState(false);
  useEffect(() => {
    if (avancer && params && analyse.data && !analyse.isPlaceholderData) {
      setAvancer(false);
      setEcran(2);
    }
  }, [avancer, params, analyse.data, analyse.isPlaceholderData]);
  // Assistant IA : appelé une fois par jeu de pièces à l'arrivée sur l'imposition (s'il est actif).
  const statutIA = useStatutIA();
  const proposerIA = useProposerIA();
  const [ia, setIa] = useState<PropositionImposition | null>(null);
  const [iaErreur, setIaErreur] = useState<string | null>(null);
  const iaPour = useRef('');
  const demanderIA = () => {
    iaPour.current = clePieces;
    setIaErreur(null);
    proposerIA.mutate({ pieces }, {
      onSuccess: (r) => {
        setIa(r);
        if (r.plan) setParams(r.params);
      },
      onError: (e) => setIaErreur(messageErreur(e)),
    });
  };
  // Économie de jetons : l'assistant n'est appelé tout seul que si l'analyse locale a un doute
  // (format inconnu, fonds perdus incertains, pages de tailles différentes, plusieurs fichiers sans
  // appariement clair). Sinon, un bouton permet de le solliciter ; ses réponses sont gardées 12 h.
  const doute = !!analyse.data && (!analyse.data.analyse.format || analyse.data.analyse.fonds_perdus === 'incertains' || !analyse.data.analyse.uniforme || (pieces.length > 1 && !analyse.data.paires && pieces.every((p) => p.role === 'pages')));
  useEffect(() => {
    if (ecran === 2 && statutIA.data?.actif && params && doute && iaPour.current !== clePieces && !proposerIA.isPending) {
      setIa(null);
      demanderIA();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran, statutIA.data?.actif, clePieces, params !== null, doute]);
  const generer = useGenerer();
  const planData = plan.data?.plan;
  const pages = analyse.data?.pages ?? [];
  const nbPages = analyse.data?.analyse.nb_pages ?? 0;
  const feuille = planData?.feuilles[Math.min(feuilleVue, Math.max(0, (planData?.feuilles.length ?? 1) - 1))];
  const faceVue = feuille ? (face === 'verso' && feuille.verso ? feuille.verso : feuille.recto) : null;
  const dimsDe = (n: number): Dimension | null => {
    const pg = analyse.data?.analyse.pages[n - 1];
    return pg ? { largeur: pg.largeur, hauteur: pg.hauteur } : null;
  };
  const patchParams = (patch: Partial<ParamsImposition>) => setParams((prev) => (prev ? { ...prev, ...patch } : prev));
  // Pages blanches placées à la main (vue « Pages ») : après la k-ième page du document.
  const insererBlanche = (k: number) => setParams((prev) => (prev ? { ...prev, blanches: 'positions', blanches_apres: [...(prev.blanches_apres ?? []), k] } : prev));
  const retirerBlanche = (k: number) =>
    setParams((prev) => {
      if (!prev) return prev;
      const liste = [...(prev.blanches_apres ?? [])];
      const i = liste.indexOf(k);
      if (i >= 0) liste.splice(i, 1);
      return { ...prev, blanches_apres: liste };
    });
  const stats = useMemo(() => {
    if (!planData) return [] as { t: string; fort?: boolean }[];
    const l: { t: string; fort?: boolean }[] = [];
    if (planData.operation === 'poses') l.push({ t: `${planData.poses_par_face} pose${planData.poses_par_face > 1 ? 's' : ''} par face`, fort: true }, { t: `${planData.colonnes} × ${planData.rangs}` });
    if (planData.operation === 'livret') l.push({ t: `${planData.nb_feuilles} feuille${planData.nb_feuilles > 1 ? 's' : ''} par livret`, fort: true }, { t: `${planData.pages_blanches} blanche${planData.pages_blanches > 1 ? 's' : ''}` });
    if (planData.operation === 'assembler') l.push({ t: `${planData.nb_pages_sortie} page${planData.nb_pages_sortie > 1 ? 's' : ''} réunies`, fort: true });
    else l.push({ t: `${planData.nb_pages_sortie} page${planData.nb_pages_sortie > 1 ? 's' : ''} PDF` });
    if (planData.feuilles_a_imprimer) l.push({ t: `${planData.feuilles_a_imprimer} feuille${planData.feuilles_a_imprimer > 1 ? 's' : ''} à imprimer` });
    l.push({ t: `${planData.feuille.largeur} × ${planData.feuille.hauteur} mm · ${planData.paysage ? 'paysage' : 'portrait'}` });
    if (planData.operation !== 'assembler' && planData.coupe) l.push({ t: libelleCoupe(planData.coupe, planData.fonds_perdus_mm) });
    return l;
  }, [planData]);
  const max: Ecran = pieces.length && params ? 2 : 1;
  const [affichage, setAffichage] = useState<AffichageSchema>({ fonds: true, traits: true, zone_finie: true, numeros: false, chute: true });
  const sourceAvecFonds = analyse.data ? analyse.data.analyse.fonds_perdus !== 'absents' : false;
  // Sans fonds perdus choisi alors que le visuel va au bord : rappel calme, avec retour en un clic.
  const sansSurVisuelAuBord = !!analyse.data && !!planData && params?.operation !== 'assembler' && planData.coupe.systeme !== 'fonds_perdus' && planData.coupe.systeme !== 'aucune' && analyse.data.analyse.pages.some((pg) => pg.jusqu_au_bord === true);
  const destination = analyse.data?.sans_dossier ? 'Sans dossier : le PDF sera proposé au téléchargement (gardé 6 h).' : analyse.data?.fichier.dossier_id ? `Le PDF sera ajouté au dossier de ${dossier.data && dossier.data.id === analyse.data.fichier.dossier_id ? `${dossier.data.numero} (${dossier.data.client_nom})` : 'la première pièce'}.` : '';
  const lancer = () =>
    params &&
    generer.mutate(
      { pieces, params },
      { onSuccess: (r) => (setRattache(null), setResultat(r), toast.success('PDF généré', r.fichier?.nom ?? r.libre?.nom)), onError: (e) => toast.error('Génération impossible', messageErreur(e)) },
    );

  return (
    <div className="imp">
      <PageHeader title="Imposition" subtitle="Préparer les fichiers d’impression : cartes, flyers, tickets, livrets, fonds perdus, assemblage recto-verso." />
      <Etapes courant={ecran} max={max} onAller={setEcran} />

      {ecran === 1 && avancer && pieces.length > 0 && (
        <div className="gen" role="status" aria-live="polite">
          <div className="gen__carte">
            <span className="gen__titre">Préparation de l’imposition…</span>
            <ol className="gen__etapes">
              <li data-etat="fait"><span className="gen__puce" aria-hidden="true"><Check width={12} height={12} /></span>Fichier{pieces.length > 1 ? 's' : ''} envoyé{pieces.length > 1 ? 's' : ''}</li>
              <li data-etat={analyse.data && !analyse.isPlaceholderData ? 'fait' : 'en_cours'}><span className="gen__puce" aria-hidden="true">{analyse.data && !analyse.isPlaceholderData ? <Check width={12} height={12} /> : null}</span>Analyse : format, pages, fonds perdus, bords</li>
              <li data-etat={params ? 'en_cours' : 'a_venir'}><span className="gen__puce" aria-hidden="true" />Réglages automatiques et ouverture</li>
            </ol>
            {analyse.isError && (
              <>
                <Alert tone="error">{messageErreur(analyse.error)}</Alert>
                <Button onClick={() => setAvancer(false)}>Revenir aux fichiers</Button>
              </>
            )}
          </div>
        </div>
      )}
      {ecran === 1 && (
        <EcranFichiers pieces={pieces} setPieces={setPieces} analyses={analyse.data?.pieces ?? []} dossierId={dossierId} setDossierId={setDossierId} enAnalyse={analyse.isFetching} onPret={() => setAvancer(true)}
          onSuivant={() => (params ? setEcran(2) : toast.info('Analyse en cours', 'Patientez un instant, puis continuez.'))}
        />
      )}

      {ecran === 2 && params && (
        <div className="ecran">
          <div className="ecran__barre">
            <Button variant="ghost" icon={<ArrowLeft />} onClick={() => setEcran(1)}>Fichiers</Button>
            <span className="ecran__barre-texte">
              {pieces.length} fichier{pieces.length > 1 ? 's' : ''} : {pieces.map((p) => p.nom).join(', ')}
            </span>
            <Button variant="primary" icon={<FileCheck2 />} busy={generer.isPending} disabled={!planData || plan.isError} onClick={lancer}>Générer le PDF</Button>
          </div>
          <div className="ws ws--2">
            <section className="ws__centre" aria-label="Prévisualisation">
              {analyse.data && <Rapport r={analyse.data} p={params} plan={planData} ia={ia} iaEnCours={proposerIA.isPending} iaErreur={iaErreur} onRedemander={statutIA.data?.actif ? demanderIA : undefined} onParams={patchParams} />}
              {sansSurVisuelAuBord ? (
                <div className="alerte-fonds">
                  <span>Sans fonds perdus alors que le visuel va jusqu’au bord : {planData ? libelleCoupe(planData.coupe, planData.fonds_perdus_mm).toLowerCase() : ''}. Si la coupe dérive d’un demi-millimètre, un filet blanc peut apparaître.</span>
                  <Button size="sm" variant="primary" icon={<Wand2 />} onClick={() => (setParams({ ...params, coupe: 'fonds_perdus', fonds_perdus_mm: 3, methode_fonds_perdus: params.methode_fonds_perdus === 'blanc' ? 'intelligent' : params.methode_fonds_perdus, calepinage: 'auto' }), setAffichage((a) => ({ ...a, fonds: true })), toast.success('Fonds perdus générés', 'Bord par bord : aplats prolongés, motifs en miroir. Visibles en rose sur la feuille.'))}>
                    Revenir aux fonds perdus
                  </Button>
                </div>
              ) : planData && params.operation !== 'assembler' && planData.coupe.systeme === 'fonds_perdus' ? (
                <div className="alerte-fonds" data-ok>
                  <span>Fonds perdus : {planData.fonds_perdus_mm} mm, {planData.coupe.methode === 'source' ? 'pris dans le fichier' : planData.coupe.methode === 'intelligent' ? 'générés bord par bord (aplats prolongés, motifs en miroir)' : planData.coupe.methode === 'prolonger' ? 'bords prolongés' : planData.coupe.methode === 'miroir' ? 'générés en miroir des bords' : 'par étirement du visuel'}{planData.calepinage?.partages ? ', partagés entre les poses' : ''}.</span>
                </div>
              ) : planData && params.operation !== 'assembler' ? (
                <div className="alerte-fonds" data-ok>
                  <span>{libelleCoupe(planData.coupe, planData.fonds_perdus_mm)} : {planData.coupe.raison}</span>
                </div>
              ) : null}
              <div className="ws__panneau">
                <div className="ws__barre">
                  <ul className="imp-stats">{stats.map((x) => <li key={x.t} data-fort={x.fort || undefined}>{x.t}</li>)}</ul>
                  <div className="ws__outils-droite">
                    {planData && (planData.feuilles.length > 1 || planData.operation === 'livret') && (
                      <div className="ws__vues" role="group" aria-label="Vue">
                        <button type="button" aria-pressed={vue === 'feuille'} onClick={() => setVue('feuille')}>Feuille</button>
                        <button type="button" aria-pressed={vue === 'feuilles'} onClick={() => setVue('feuilles')}>Toutes ({planData.feuilles.length})</button>
                        <button type="button" aria-pressed={vue === 'pages'} onClick={() => setVue('pages')}>Pages ({planData.ordre?.length ?? pages.length})</button>
                      </div>
                    )}
                    {vue === 'feuille' && feuille?.verso && (
                      <div className="ws__faces" role="group" aria-label="Face">
                        <button type="button" aria-pressed={face === 'recto'} onClick={() => setFace('recto')}>Recto</button>
                        <button type="button" aria-pressed={face === 'verso'} onClick={() => setFace('verso')}>Verso</button>
                      </div>
                    )}
                    {params.operation !== 'fonds_perdus' && params.operation !== 'assembler' && (
                      <div className="ws__faces" role="group" aria-label="Sens du papier">
                        {(['auto', 'portrait', 'paysage'] as const).map((o) => (
                          <button key={o} type="button" aria-pressed={params.orientation === o} onClick={() => setParams({ ...params, orientation: o })}>{o === 'auto' ? 'Auto' : o === 'portrait' ? 'Portrait' : 'Paysage'}</button>
                        ))}
                      </div>
                    )}
                    {vue === 'feuille' && planData && planData.feuilles.length > 1 && (
                      <div className="imp-nav">
                        <Button size="sm" variant="ghost" icon={<ChevronLeft />} disabled={feuilleVue === 0} onClick={() => setFeuilleVue((v) => v - 1)} aria-label="Feuille précédente" />
                        {feuille?.libelle ? `${feuille.libelle} · ` : ''}{feuilleVue + 1} / {planData.feuilles.length}
                        <Button size="sm" variant="ghost" icon={<ChevronRight />} disabled={feuilleVue >= planData.feuilles.length - 1} onClick={() => setFeuilleVue((v) => v + 1)} aria-label="Feuille suivante" />
                      </div>
                    )}
                    {vue !== 'pages' && (
                    <div className="ws__zoom" role="group" aria-label="Zoom">
                      <Button size="sm" variant="ghost" icon={<Minus />} aria-label="Zoom arrière" onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.2) * 10) / 10))} />
                      <span>{Math.round(zoom * 100)} %</span>
                      <Button size="sm" variant="ghost" icon={<Plus />} aria-label="Zoom avant" onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.2) * 10) / 10))} />
                      <Button size="sm" variant="ghost" icon={<RotateCcw />} aria-label="Taille d’origine" onClick={() => setZoom(1)} />
                    </div>
                    )}
                  </div>
                </div>
                {plan.isError ? (
                  <Alert tone="warning">{messageErreur(plan.error)}</Alert>
                ) : !planData || !faceVue ? (
                  <Skeleton h={420} />
                ) : (
                  <>
                    {planData.avertissements.map((m, i) => <Alert key={i} tone="warning">{m}</Alert>)}
                    <div className="affichage" role="group" aria-label="Affichage">
                      {([['fonds', 'Fonds perdus'], ['traits', 'Traits de coupe'], ['zone_finie', 'Format fini'], ['chute', 'Chute et marges'], ['numeros', 'Numéros de page']] as [keyof AffichageSchema, string][]).map(([cle, label]) => (
                        <label key={cle} data-actif={affichage[cle] || undefined}>
                          <input type="checkbox" checked={!!affichage[cle]} onChange={(e) => setAffichage({ ...affichage, [cle]: e.target.checked })} />
                          {label}
                        </label>
                      ))}
                    </div>
                    {vue === 'pages' ? (
                      <div className="ws__scene" style={{ padding: 16 }}>
                        <PagesDocument plan={planData} pages={pages} dimsDe={dimsDe} lecture={params.lecture} blanchesManuelles={planData.blanches_manuelles ?? []} onInsererBlanche={planData.operation === 'livret' ? insererBlanche : undefined} onRetirerBlanche={retirerBlanche} onAller={allerFeuille} />
                      </div>
                    ) : vue === 'feuilles' ? (
                      <div className="ws__scene" ref={scene}>
                        <ListeFeuilles plan={planData} pages={pages} methode={params.methode_fonds_perdus} sourceAvecFonds={sourceAvecFonds} unisDe={(n) => analyse.data?.analyse.pages[n - 1]?.bords_unis ?? null} dimsDe={dimsDe} affichage={affichage} largeur={Math.round((planData.feuille.largeur > planData.feuille.hauteur ? 420 : 300) * zoom)} onChoisir={allerFeuille} />
                      </div>
                    ) : (
                      <div className="ws__scene" ref={scene}>
                        <div className="ws__scene-int">
                          <SchemaFeuille plan={planData} face={faceVue} pages={pages} methode={params.methode_fonds_perdus} sourceAvecFonds={sourceAvecFonds} unisDe={(n) => analyse.data?.analyse.pages[n - 1]?.bords_unis ?? null} dimsDe={dimsDe} affichage={affichage} largeur={Math.round((planData.feuille.largeur > planData.feuille.hauteur ? 640 : 460) * zoom)} />
                        </div>
                      </div>
                    )}
                    <p className="ev-help" style={{ margin: 0 }}>{vue === 'pages' ? 'Chaque page du document avec la feuille où elle est imposée. Les pages blanches ajoutées sont hachurées.' : 'Ctrl + molette pour zoomer. Trait bleu : format fini. Pointillé rose : fonds perdus. Traits noirs : coupe.'}</p>
                  </>
                )}
              </div>
            </section>
            <aside className="ws__panneau ws__droite" aria-label="Réglages">
              <h2 className="ws__titre">Réglages</h2>
              <Modeles params={params} onAppliquer={(m) => (setParams({ ...m.params, fini: m.params.fini_impose ? m.params.fini : params.fini, recto_verso: m.params.operation === 'livret' ? true : params.recto_verso }), toast.success(`Modèle appliqué : ${m.nom}`, m.params.fini_impose ? `Format fini du modèle : ${m.params.fini.largeur} × ${m.params.fini.hauteur} mm, le fichier y est mis au format.` : 'Le format fini et le recto-verso du fichier sont conservés.'))} />
              <Reglages p={params} onChange={setParams} nbPages={nbPages} analyse={analyse.data} plan={planData} />
            </aside>
          </div>
          <div className="ecran__pied">
            <Button variant="ghost" icon={<ArrowLeft />} onClick={() => setEcran(1)}>Retour aux fichiers</Button>
            <span className="ev-muted" style={{ fontSize: 13 }}>{destination}</span>
            <Button variant="primary" size="lg" icon={<FileCheck2 />} busy={generer.isPending} disabled={!planData || plan.isError} onClick={lancer}>Générer le PDF</Button>
          </div>
        </div>
      )}

      <Generation actif={generer.isPending} />
      {resultat && (
        <Dialog open onClose={() => (setResultat(null), generer.reset())} title="PDF prêt" width={760}
          footer={
            <>
              <Button variant="ghost" onClick={() => (setResultat(null), generer.reset())}>Modifier les réglages</Button>
              <Button onClick={() => (generer.reset(), setResultat(null), setPieces([]), setEcran(1))}>Nouveau travail</Button>
              {resultat.fichier ? (
                <>
                  <Link className="ev-btn" to={`/dossiers/${resultat.fichier.dossier_id}`}><FolderOpen aria-hidden="true" /> Voir dans le dossier</Link>
                  <a className="ev-btn ev-btn--primary" href={fichierUrl(resultat.fichier.id, true)}><Download aria-hidden="true" /> Télécharger</a>
                </>
              ) : resultat.libre ? (
                <a className="ev-btn ev-btn--primary" href={resultat.libre.telechargement}><Download aria-hidden="true" /> Télécharger</a>
              ) : null}
            </>
          }
        >
          <div className="resultat">
            <div className="resultat__apercu">
              <img src={resultat.fichier ? (apercuUrl(resultat.fichier.id, 720) ?? undefined) : resultat.libre ? `/api/imposition/libre/${resultat.libre.jeton}/apercu?page=1&largeur=720` : undefined} alt="Première page du PDF généré" />
            </div>
            <div className="resultat__texte">
              <span className="resultat__ok"><Check aria-hidden="true" /> Généré</span>
              <h2 className="resultat__nom">{resultat.fichier?.nom ?? resultat.libre?.nom}</h2>
              <ul className="imp-stats">
                <li data-fort>{resultat.plan.nb_pages_sortie} page{resultat.plan.nb_pages_sortie > 1 ? 's' : ''}</li>
                <li>{formatTaille(resultat.fichier?.taille ?? resultat.libre?.taille ?? 0)}</li>
                <li>{resultat.plan.feuille.largeur} × {resultat.plan.feuille.hauteur} mm</li>
                {resultat.plan.operation === 'poses' && <li>{resultat.plan.poses_par_face} poses par face</li>}
                {resultat.plan.feuilles_a_imprimer && <li>{resultat.plan.feuilles_a_imprimer} feuilles à imprimer</li>}
              </ul>
              <p className="ev-muted" style={{ margin: 0 }}>{resultat.fichier ? 'Ajouté au dossier, à côté du fichier d’origine : l’imprimeur le voit dans la fiche.' : rattache ? `Ajouté au dossier ${rattache.numero} (${rattache.client_nom}).` : 'Gardé 6 heures sur le serveur : téléchargez-le, ou ajoutez-le à un dossier.'}</p>
              {resultat.libre && !rattache && <Rattacher jeton={resultat.libre.jeton} onFait={setRattache} />}
              {rattache && <Link className="ev-btn" to={`/dossiers/${rattache.id}`}><FolderOpen aria-hidden="true" /> Ouvrir le dossier {rattache.numero}</Link>}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
