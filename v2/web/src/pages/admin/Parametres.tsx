import { useCallback, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Bell, Building2, ChevronRight, FileText, FolderUp, Hash, Percent, ArrowLeftRight, ShieldCheck } from 'lucide-react';
import { messageErreur } from '../../lib/api';
import { Alert, Button, LoadingRows, PageHeader } from '../../ui';
import { useParametresAdmin } from '../../features/parametres/api';
import type { SectionProps } from '../../features/parametres/form';
import { SectionEntreprise } from '../../features/parametres/sections/Entreprise';
import { SectionPrix } from '../../features/parametres/sections/Prix';
import { SectionSecurite } from '../../features/parametres/sections/Securite';
import { SectionFichiers } from '../../features/parametres/sections/Fichiers';
import { SectionDocuments } from '../../features/parametres/sections/Documents';
import { SectionNotifications } from '../../features/parametres/sections/Notifications';
import { SectionNumerotation } from '../../features/parametres/sections/Numerotation';
import { SectionExportImport } from '../../features/parametres/sections/ExportImport';
import { SectionZoneDangereuse } from '../../features/parametres/sections/ZoneDangereuse';
import '../../features/admin/admin.css';
import '../../features/parametres/parametres.css';

type Id = 'entreprise' | 'prix' | 'securite' | 'fichiers' | 'documents' | 'notifications' | 'numerotation' | 'export' | 'danger';

interface Section {
  id: Id;
  titre: string;
  description: string;
  icone: ComponentType;
  /** Sections qui lisent les paramètres ; les autres chargent leurs propres données. */
  rendu: (props: SectionProps) => ReactNode;
  danger?: boolean;
}

const SECTIONS: Section[] = [
  { id: 'entreprise', titre: 'Entreprise', description: 'Coordonnées, fuseau horaire, livraison', icone: Building2, rendu: (p) => <SectionEntreprise {...p} /> },
  { id: 'prix', titre: 'Prix et TVA', description: 'Arrondi, TVA, surface minimale', icone: Percent, rendu: (p) => <SectionPrix {...p} /> },
  { id: 'securite', titre: 'Sécurité', description: 'Sessions, blocage, mots de passe', icone: ShieldCheck, rendu: (p) => <SectionSecurite {...p} /> },
  { id: 'fichiers', titre: 'Fichiers', description: 'Taille maximale, types acceptés', icone: FolderUp, rendu: (p) => <SectionFichiers {...p} /> },
  { id: 'documents', titre: 'Documents', description: 'Validité des devis, mentions, conditions', icone: FileText, rendu: (p) => <SectionDocuments {...p} /> },
  { id: 'notifications', titre: 'Notifications', description: 'Types de notification envoyés', icone: Bell, rendu: (p) => <SectionNotifications {...p} /> },
  { id: 'numerotation', titre: 'Numérotation', description: 'Prochains numéros CMD, DEV, FAC', icone: Hash, rendu: (p) => <SectionNumerotation onModifie={p.onModifie} /> },
  { id: 'export', titre: 'Export et import', description: 'Copier les réglages et la grille tarifaire', icone: ArrowLeftRight, rendu: () => <SectionExportImport /> },
  { id: 'danger', titre: 'Zone dangereuse', description: 'Réinitialiser la plateforme', icone: AlertTriangle, rendu: () => <SectionZoneDangereuse />, danger: true },
];

export default function Parametres() {
  const q = useParametresAdmin();
  const [params, setParams] = useSearchParams();
  const demandee = SECTIONS.find((s) => s.id === params.get('section'));
  const active = demandee ?? SECTIONS[0]!;
  const [modifiees, setModifiees] = useState<Partial<Record<Id, boolean>>>({});

  // Un rappel stable par section, pour que chaque section signale ses modifications non enregistrées.
  const signaler = useMemo(
    () => Object.fromEntries(SECTIONS.map((s) => [s.id, (m: boolean) => setModifiees((x) => (x[s.id] === m ? x : { ...x, [s.id]: m }))])) as Record<Id, (m: boolean) => void>,
    [],
  );
  const ouvrir = useCallback((id: Id) => setParams({ section: id }), [setParams]);

  if (q.isError) return <Alert tone="error">Les paramètres n’ont pas pu être chargés : {messageErreur(q.error)}</Alert>;

  return (
    <div className="stack-lg">
      <PageHeader title="Paramètres" subtitle="Coordonnées de l’entreprise, règles de calcul et réglages de l’application. Chaque section s’enregistre séparément." />
      <div className="prm-layout" data-vue={demandee ? 'section' : 'liste'}>
        <nav className="prm-nav" role="tablist" aria-orientation="vertical" aria-label="Sections des paramètres">
          {SECTIONS.map((s) => {
            const Icone = s.icone;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`prm-onglet-${s.id}`}
                aria-controls={`prm-section-${s.id}`}
                aria-selected={s.id === active.id}
                data-danger={s.danger || undefined}
                className="prm-nav__item"
                onClick={() => ouvrir(s.id)}
              >
                <Icone aria-hidden="true" />
                <span className="prm-nav__texte">
                  <span>{s.titre}</span>
                  <span className="prm-nav__desc">{s.description}</span>
                </span>
                {modifiees[s.id] && <span className="prm-marque" title="Modifications non enregistrées" aria-label="Modifications non enregistrées" />}
                <ChevronRight className="prm-nav__chevron" aria-hidden="true" />
              </button>
            );
          })}
        </nav>

        <div className="prm-contenu stack">
          <Button className="prm-retour" variant="ghost" size="sm" icon={<ArrowLeft />} onClick={() => setParams({})}>
            Toutes les sections
          </Button>
          {!q.data ? (
            <LoadingRows rows={8} />
          ) : (
            // Toutes les sections restent montées : une saisie non enregistrée survit au changement de section.
            SECTIONS.map((s) => (
              <section
                key={s.id}
                id={`prm-section-${s.id}`}
                role="tabpanel"
                aria-labelledby={`prm-onglet-${s.id}`}
                hidden={s.id !== active.id}
              >
                <div className="stack">
                  <h2 className="ev-h-title">{s.titre}</h2>
                  {s.rendu({ p: q.data, onModifie: signaler[s.id] })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
