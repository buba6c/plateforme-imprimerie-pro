// Signaux « temps réel » de la démonstration : les mêmes événements que Socket.IO côté serveur
// (dossier, paiement, notification), envoyés à l'utilisateur connecté s'il est concerné.

import { machineOfRole, STATUTS_LIVREUR, type Machine, type Statut } from '@evocom/shared';
import { connecte } from './etat';

type Ecouteur = (evenement: string, donnees: unknown) => void;
const ecouteurs = new Set<Ecouteur>();

export function ecouter(fn: Ecouteur): () => void {
  ecouteurs.add(fn);
  return () => {
    ecouteurs.delete(fn);
  };
}

function emettre(evenement: string, donnees: unknown) {
  // Après la réponse en cours, comme un message reçu du serveur.
  setTimeout(() => ecouteurs.forEach((f) => f(evenement, donnees)), 0);
}

export function signalDossier(
  d: { id: number; numero: string; statut: Statut; machine: Machine; preparateur_id: number | null },
  ancien: Statut | null | undefined,
  type: 'created' | 'updated' | 'deleted' = 'updated',
) {
  const u = connecte();
  if (!u) return;
  const livreur = (s: Statut | null | undefined) => !!s && (STATUTS_LIVREUR as readonly string[]).includes(s);
  const concerne =
    u.role === 'admin' ||
    u.role === 'preparateur' ||
    machineOfRole(u.role) === d.machine ||
    (u.role === 'livreur' && (livreur(d.statut) || livreur(ancien))) ||
    d.preparateur_id === u.id;
  if (concerne) emettre('dossier', { type, id: d.id, numero: d.numero, statut: d.statut, machine: d.machine });
}

export function signalPaiement(dossierId: number) {
  const u = connecte();
  if (u && ['admin', 'preparateur', 'livreur'].includes(u.role)) emettre('paiement', { dossier_id: dossierId });
}

export function signalNotification(userId: number, n: { id: number; type: string; titre: string; message: string | null; dossier_id: number | null; created_at: string }) {
  if (connecte()?.id === userId) emettre('notification', n);
}
