import { Card, Checkbox } from '../../../ui';
import { SectionForm, useBrouillon, useSignalerModifie, type SectionProps } from '../form';

/** Types émis par le serveur, avec leurs destinataires. */
const TYPES: { type: string; titre: string; qui: string }[] = [
  { type: 'nouveau_travail', titre: 'Nouveau dossier à imprimer', qui: 'Imprimeurs de la machine, quand un dossier est validé.' },
  { type: 'revision', titre: 'Révision demandée', qui: 'Préparateur du dossier et administrateurs, quand l’imprimeur demande une correction.' },
  { type: 'urgent', titre: 'Dossier passé en urgent', qui: 'Imprimeurs de la machine, si le dossier est déjà prêt ou en impression.' },
  { type: 'affectation', titre: 'Dossier confié', qui: 'Imprimeur ou livreur à qui l’administrateur confie un dossier.' },
  { type: 'pret_livraison', titre: 'Dossier prêt à livrer', qui: 'Livreurs et préparateur du dossier, à la fin de l’impression.' },
  { type: 'livre', titre: 'Dossier livré', qui: 'Administrateurs et préparateur du dossier.' },
  { type: 'paiement_a_valider', titre: 'Paiement à valider', qui: 'Administrateurs, quand un livreur ou un préparateur encaisse.' },
  { type: 'paiement_valide', titre: 'Paiement validé', qui: 'Personne qui a encaissé.' },
  { type: 'paiement_refuse', titre: 'Paiement refusé', qui: 'Personne qui a encaissé, avec le motif du refus.' },
];

export function SectionNotifications({ p, onModifie }: SectionProps) {
  const { f, setF, modifie, annuler } = useBrouillon(() => ({ ...p.notifications }), [p.notifications]);
  useSignalerModifie(modifie, onModifie);
  // Un type ajouté côté serveur sans libellé ici reste réglable.
  const types = [...TYPES, ...Object.keys(f).filter((t) => !TYPES.some((x) => x.type === t)).map((t) => ({ type: t, titre: t, qui: '' }))];
  const actifs = types.filter((t) => f[t.type] !== false).length;

  return (
    <SectionForm
      titre="Notifications"
      modifie={modifie}
      verifier={() => ({ body: { notifications: f } })}
      annuler={annuler}
      onErreurs={() => {}}
    >
      <Card title={`Notifications envoyées (${actifs} sur ${types.length})`}>
        <div className="stack">
          <p className="adm-explain">
            Une notification désactivée n’est plus envoyée à personne : ni dans la cloche, ni en temps réel. Les listes et les fiches continuent de se mettre à
            jour.
          </p>
          <div className="stack">
            {types.map((t) => (
              <div key={t.type} className="stack-sm" style={{ gap: 2 }}>
                <Checkbox label={t.titre} checked={f[t.type] !== false} onChange={(v) => setF({ ...f, [t.type]: v })} />
                {t.qui && (
                  <span className="ev-help prm-aide-check">{t.qui}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </SectionForm>
  );
}
