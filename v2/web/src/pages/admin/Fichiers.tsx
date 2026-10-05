import { useSearchParams } from 'react-router-dom';
import { useUser } from '../../auth/AuthContext';
import { PageHeader, Tabs } from '../../ui';
import { useCorbeilleFichiers } from '../../features/fichiers-admin/hooks';
import { OngletControle } from '../../features/fichiers-admin/OngletControle';
import { OngletCorbeille } from '../../features/fichiers-admin/OngletCorbeille';
import { OngletFichiers } from '../../features/fichiers-admin/OngletFichiers';
import '../../features/fichiers-admin/fichiers-admin.css';

type Onglet = 'fichiers' | 'corbeille' | 'controle';

export default function Fichiers() {
  const user = useUser();
  const admin = user.role === 'admin';
  const [params, setParams] = useSearchParams();
  const demande = params.get('onglet');
  const onglet: Onglet = admin && (demande === 'corbeille' || demande === 'controle') ? demande : 'fichiers';
  // Nombre affiché sur l'onglet (même requête que la première page de la corbeille).
  const corbeille = useCorbeilleFichiers({ page: 1, limit: 50 }, admin);

  const changer = (o: Onglet) => setParams(o === 'fichiers' ? new URLSearchParams() : new URLSearchParams({ onglet: o }), { replace: true });

  return (
    <>
      <PageHeader
        title="Fichiers"
        subtitle={
          admin
            ? 'Tous les fichiers d’impression des dossiers, la corbeille des fichiers et le contrôle du stockage.'
            : 'Tous les fichiers d’impression des dossiers que vous pouvez consulter.'
        }
      />
      {admin && (
        <Tabs<Onglet>
          label="Parties du gestionnaire de fichiers"
          value={onglet}
          onChange={changer}
          tabs={[
            { value: 'fichiers', label: 'Fichiers' },
            {
              value: 'corbeille',
              label: 'Corbeille',
              count: corbeille.data?.total,
            },
            { value: 'controle', label: 'Contrôle' },
          ]}
        />
      )}
      {onglet === 'fichiers' && <OngletFichiers />}
      {onglet === 'corbeille' && <OngletCorbeille />}
      {onglet === 'controle' && <OngletControle />}
    </>
  );
}
