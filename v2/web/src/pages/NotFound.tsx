import { Link } from 'react-router-dom';
import { Card, EmptyState, PageHeader } from '../ui';

export default function NotFound() {
  return (
    <>
      <PageHeader title="Page introuvable" />
      <Card>
        <EmptyState title="Cette adresse ne correspond à aucune page" action={<Link className="ev-btn" to="/">Revenir à l'accueil</Link>}>
          Vérifiez le lien ou utilisez le menu.
        </EmptyState>
      </Card>
    </>
  );
}
