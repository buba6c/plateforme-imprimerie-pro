import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Banknote,
  ClipboardList,
  FileText,
  FolderOpen,
  History,
  LayoutDashboard,
  Printer,
  ReceiptText,
  ScrollText,
  Settings2,
  Tags,
  Trash2,
  Truck,
  UserRound,
  Users,
  HardDrive,
  PackageCheck,
} from 'lucide-react';
import type { Role } from '@evocom/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Apparaît aussi dans la barre d'onglets en bas de l'écran sur téléphone. */
  mobile?: boolean;
  countKey?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export function navigationPour(role: Role): NavSection[] {
  switch (role) {
    case 'admin':
      return [
        { items: [
          { to: '/tableau-de-bord', label: "Vue d'ensemble", icon: LayoutDashboard, mobile: true },
          { to: '/dossiers', label: 'Dossiers', icon: FolderOpen, mobile: true },
          { to: '/paiements', label: 'Paiements', icon: Banknote, mobile: true, countKey: 'paiements_a_valider' },
        ] },
        { title: 'Commercial', items: [
          { to: '/devis', label: 'Devis', icon: FileText },
          { to: '/factures', label: 'Factures', icon: ReceiptText },
          { to: '/clients', label: 'Clients', icon: UserRound, mobile: true },
        ] },
        { title: 'Pilotage', items: [{ to: '/statistiques', label: 'Statistiques', icon: BarChart3 }] },
        { title: 'Administration', items: [
          { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
          { to: '/admin/tarifs', label: 'Tarifs', icon: Tags },
          { to: '/admin/parametres', label: 'Paramètres', icon: Settings2 },
          { to: '/admin/journal', label: 'Journal', icon: ScrollText },
          { to: '/admin/corbeille', label: 'Corbeille', icon: Trash2 },
          { to: '/admin/sante', label: 'Sauvegardes et état', icon: HardDrive },
        ] },
      ];
    case 'preparateur':
      return [
        { items: [
          { to: '/dossiers', label: 'Dossiers', icon: FolderOpen, mobile: true },
          { to: '/devis', label: 'Devis', icon: FileText, mobile: true },
          { to: '/factures', label: 'Factures', icon: ReceiptText },
          { to: '/clients', label: 'Clients', icon: UserRound, mobile: true },
          { to: '/encaissements', label: 'Mes encaissements', icon: Banknote },
        ] },
      ];
    case 'imprimeur_roland':
    case 'imprimeur_xerox':
      return [
        { items: [
          { to: '/atelier', label: "File d'impression", icon: Printer, mobile: true },
          { to: '/dossiers', label: 'Historique', icon: History, mobile: true },
        ] },
      ];
    case 'livreur':
      return [
        { items: [
          { to: '/livraisons', label: 'À livrer', icon: Truck, mobile: true },
          { to: '/livraisons/livrees', label: 'Livrées', icon: PackageCheck, mobile: true },
          { to: '/encaissements', label: 'Encaissements', icon: Banknote, mobile: true },
        ] },
      ];
  }
}

export const ICONE_DOSSIER = ClipboardList;
