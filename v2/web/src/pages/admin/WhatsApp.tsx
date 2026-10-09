import { useSearchParams } from 'react-router-dom';
import { PageHeader, Tabs } from '../../ui';
import { useStatutWhatsApp } from '../../features/whatsapp/api';
import { EtatConnexion } from '../../features/whatsapp/EtatConnexion';
import { Reglages } from '../../features/whatsapp/Reglages';
import { JournalMessages } from '../../features/whatsapp/JournalMessages';
import { Entrants, ListeStop } from '../../features/whatsapp/Listes';
import '../../features/admin/admin.css';
import '../../features/parametres/parametres.css';
import '../../features/whatsapp/whatsapp.css';

type Onglet = 'connexion' | 'reglages' | 'messages' | 'stop' | 'reponses';
const ONGLETS: Onglet[] = ['connexion', 'reglages', 'messages', 'stop', 'reponses'];

export default function WhatsApp() {
  const [params, setParams] = useSearchParams();
  const brut = params.get('onglet');
  const onglet: Onglet = ONGLETS.includes(brut as Onglet) ? (brut as Onglet) : 'connexion';
  const statut = useStatutWhatsApp();
  const file = statut.data?.file;

  return (
    <>
      <PageHeader
        title="WhatsApp client"
        subtitle="Un message automatique au client quand sa commande est prête, programmée ou livrée, depuis le numéro WhatsApp dédié de l’imprimerie."
      />
      <div className="stack-lg">
        <Tabs
          label="Sections WhatsApp"
          value={onglet}
          onChange={(v) => setParams(v === 'connexion' ? {} : { onglet: v }, { replace: true })}
          tabs={[
            { value: 'connexion', label: 'Connexion' },
            { value: 'reglages', label: 'Réglages' },
            { value: 'messages', label: 'Messages', count: file?.en_attente },
            { value: 'stop', label: 'Liste STOP' },
            { value: 'reponses', label: 'Réponses reçues' },
          ]}
        />
        {onglet === 'connexion' && <EtatConnexion />}
        {onglet === 'reglages' && <Reglages />}
        {onglet === 'messages' && <JournalMessages />}
        {onglet === 'stop' && <ListeStop />}
        {onglet === 'reponses' && <Entrants />}
      </div>
    </>
  );
}
