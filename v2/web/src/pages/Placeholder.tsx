import { Construction } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '../ui';

/** Écran en cours de construction (remplacé au fil du développement). */
export default function Placeholder({ titre }: { titre: string }) {
  return (
    <>
      <PageHeader title={titre} />
      <Card>
        <EmptyState title="Écran en préparation" icon={<Construction aria-hidden="true" />}>
          Cette partie de la nouvelle version est en cours de construction.
        </EmptyState>
      </Card>
    </>
  );
}
