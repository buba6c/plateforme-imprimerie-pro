import DevisSimple from '../components/documents/templates/DevisSimple';
import FactureSimple from '../components/documents/templates/FactureSimple';

export const devisTemplates = {
  simple: DevisSimple,
};

export const factureTemplates = {
  simple: FactureSimple,
};

export const defaultDocumentsSettings = {
  devis_template: 'simple',
  facture_template: 'simple',
};
