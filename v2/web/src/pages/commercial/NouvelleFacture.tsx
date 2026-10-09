// Facture directe, sans dossier : client de l'annuaire (autocomplétion) ou saisi, lignes libres
// (désignation, quantité, unité, prix unitaire), remise, date d'émission, échéance, remarques et
// conditions de paiement. La TVA suit Paramètres > Prix ; le serveur recalcule tout et attribue
// le numéro FAC définitif. Le PDF est le même que pour les factures de dossier.
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Save, Trash2 } from 'lucide-react';
import { formatDecimal, formatFCFA, parseMontant } from '@evocom/shared';
import { messageErreur } from '../../lib/api';
import { champsErreur } from '../../features/admin/hooks';
import { ClientAutocomplete, type ClientTrouve } from '../../features/dossiers-ui/ClientAutocomplete';
import { Alert, Button, Card, IconButton, PageHeader, SelectField, TextareaField, TextField, useToast } from '../../ui';
import { Totaux, type LigneTotal } from '../../features/commercial/Document';
import { aujourdhui } from '../../features/commercial/format';
import { useCreerFactureDirecte, useParametres } from '../../features/commercial/hooks';
import type { FactureDirecteInput } from '../../features/commercial/types';
import '../../features/commercial/commercial.css';

const UNITES = [
  { value: 'exemplaire', label: 'exemplaire' },
  { value: 'unite', label: 'unité' },
  { value: 'm2', label: 'm²' },
  { value: 'ml', label: 'mètre linéaire' },
  { value: 'page', label: 'face imprimée' },
  { value: 'feuille', label: 'feuille' },
  { value: 'forfait', label: 'forfait' },
  { value: 'heure', label: 'heure' },
  { value: 'jour', label: 'jour' },
  { value: 'lot', label: 'lot' },
];

interface LigneSaisie {
  cle: number;
  designation: string;
  detail: string;
  quantite: string;
  unite: string;
  prix_unitaire: string;
}

let prochaineCle = 1;
const ligneVide = (): LigneSaisie => ({ cle: prochaineCle++, designation: '', detail: '', quantite: '1', unite: 'exemplaire', prix_unitaire: '' });

/** Nombre saisi à la française (espaces, virgule décimale) ; null si vide ou illisible. */
function nombre(v: string): number | null {
  const s = v.replace(/[\s  ]/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default function NouvelleFacture() {
  const navigate = useNavigate();
  const toast = useToast();
  const parametres = useParametres();
  const prix = parametres.data?.prix;
  const creer = useCreerFactureDirecte();

  const [clientId, setClientId] = useState<number | null>(null);
  const [clientNom, setClientNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [dateEmission, setDateEmission] = useState(aujourdhui());
  const [dateEcheance, setDateEcheance] = useState('');
  const [lignes, setLignes] = useState<LigneSaisie[]>([ligneVide()]);
  const [remise, setRemise] = useState('');
  const [notes, setNotes] = useState('');
  const [conditions, setConditions] = useState('');
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);

  const choisirClient = (c: ClientTrouve | null) => {
    setClientId(c?.id ?? null);
    if (c) {
      setClientNom(c.nom);
      if (!telephone && c.telephone) setTelephone(c.telephone);
      if (!email && c.email) setEmail(c.email);
    }
  };

  const majLigne = (cle: number, patch: Partial<LigneSaisie>) => setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));
  const supprimerLigne = (cle: number) => setLignes((ls) => (ls.length > 1 ? ls.filter((l) => l.cle !== cle) : ls));

  // Aperçu des totaux, avec la même règle que le serveur (prix saisis TTC, sauf TVA avec prix hors taxes).
  const totalLigne = (l: LigneSaisie): number | null => {
    const q = nombre(l.quantite);
    const pu = parseMontant(l.prix_unitaire);
    if (q === null || pu === null || q <= 0 || pu < 0) return null;
    return Math.round(q * pu);
  };
  const sousTotal = lignes.reduce((s, l) => s + (totalLigne(l) ?? 0), 0);
  const remiseN = parseMontant(remise) ?? 0;
  const net = Math.max(0, sousTotal - remiseN);
  const tva = !!prix?.tva_applicable && prix.tva_taux > 0;
  const saisieHt = tva && !!prix?.prix_saisis_ht;
  let totalHt = net;
  let montantTva = 0;
  let totalTtc = net;
  if (tva && prix) {
    if (saisieHt) {
      montantTva = Math.round(net * (prix.tva_taux / 100));
      totalTtc = net + montantTva;
    } else {
      totalHt = Math.round(net / (1 + prix.tva_taux / 100));
      montantTva = net - totalHt;
    }
  }
  const totaux: LigneTotal[] = [];
  if (remiseN > 0) {
    totaux.push({ label: 'Sous-total', valeur: formatFCFA(sousTotal) });
    totaux.push({ label: 'Remise', valeur: `- ${formatFCFA(remiseN)}` });
  }
  if (tva && prix) {
    totaux.push({ label: 'Total HT', valeur: formatFCFA(totalHt) });
    totaux.push({ label: `TVA (${formatDecimal(prix.tva_taux)} %)`, valeur: formatFCFA(montantTva) });
    totaux.push({ label: 'Total TTC', valeur: formatFCFA(totalTtc), fort: true });
  } else {
    totaux.push({ label: 'Total', valeur: formatFCFA(totalTtc), fort: true });
  }

  const verifier = (): { erreurs: Record<string, string> } | { body: FactureDirecteInput } => {
    const e: Record<string, string> = {};
    if (!clientNom.trim()) e.client_nom = 'Indiquez le nom du client.';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.client_email = 'Adresse e-mail invalide.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateEmission)) e.date_emission = 'Indiquez la date d’émission.';
    if (dateEcheance && dateEcheance < dateEmission) e.date_echeance = 'L’échéance ne peut pas précéder la date d’émission.';
    const corps: FactureDirecteInput['lignes'] = [];
    lignes.forEach((l, i) => {
      const q = nombre(l.quantite);
      const pu = parseMontant(l.prix_unitaire);
      if (!l.designation.trim()) e[`lignes.${i}.designation`] = 'Désignation obligatoire.';
      if (q === null || q <= 0) e[`lignes.${i}.quantite`] = 'Quantité : nombre supérieur à 0.';
      else if (Math.round(q * 100) !== q * 100) e[`lignes.${i}.quantite`] = 'Deux décimales au maximum.';
      if (pu === null || pu < 0 || !Number.isInteger(pu)) e[`lignes.${i}.prix_unitaire`] = 'Prix unitaire : nombre entier de FCFA.';
      if (!l.unite.trim()) e[`lignes.${i}.unite`] = 'Unité obligatoire.';
      corps.push({ designation: l.designation.trim(), detail: l.detail.trim() || null, quantite: q ?? 0, unite: l.unite.trim(), prix_unitaire: pu ?? 0 });
    });
    const r = remise.trim() ? parseMontant(remise) : 0;
    if (r === null || r < 0 || !Number.isInteger(r)) e.remise = 'Remise : nombre entier de FCFA.';
    else if (r > sousTotal) e.remise = 'La remise dépasse le total des lignes.';
    if (!Object.keys(e).length && totalTtc <= 0) e.lignes = 'Le total doit être supérieur à 0 FCFA.';
    if (Object.keys(e).length) return { erreurs: e };
    return {
      body: {
        client_id: clientId,
        client_nom: clientNom.trim(),
        client_telephone: telephone.trim() || null,
        client_email: email.trim() || null,
        client_adresse: adresse.trim() || null,
        date_emission: dateEmission,
        date_echeance: dateEcheance || null,
        lignes: corps,
        remise: r ?? 0,
        notes: notes.trim() || null,
        conditions_paiement: conditions.trim() || null,
      },
    };
  };

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const v = verifier();
    if ('erreurs' in v) {
      setErreurs(v.erreurs);
      setErreur('Certains champs sont à corriger avant d’émettre la facture.');
      return;
    }
    setErreurs({});
    setErreur(null);
    creer.mutate(v.body, {
      onSuccess: (f) => {
        toast.success(`Facture ${f.numero} émise`, f.vosfactures?.id ? `Envoyée à VosFactures (${f.vosfactures.numero ?? f.vosfactures.id}).` : `${formatFCFA(f.total_ttc)} pour ${f.client_nom}.`);
        navigate(`/factures/${f.id}`);
      },
      onError: (err) => {
        const c = champsErreur(err);
        setErreurs(c);
        setErreur(Object.keys(c).length ? `La facture n’a pas été émise : ${Object.values(c).join(' ; ')}` : `La facture n’a pas été émise : ${messageErreur(err)}`);
      },
    });
  };

  return (
    <form className="stack-lg" onSubmit={submit} noValidate>
      <PageHeader
        crumbs={
          <>
            <Link to="/factures">Factures</Link>
            <span aria-hidden="true">/</span>
            <span>Nouvelle facture</span>
          </>
        }
        title="Nouvelle facture"
        subtitle="Facture directe, sans dossier de production. Le numéro FAC définitif est attribué à l’émission ; la facture ne se modifie plus ensuite (elle peut seulement être annulée)."
        actions={
          <div className="ev-btn-group">
            <Link className="ev-btn" to="/factures">
              Abandonner
            </Link>
            <Button type="submit" variant="primary" icon={<Save />} busy={creer.isPending}>
              Émettre la facture
            </Button>
          </div>
        }
      />
      {erreur && <Alert tone="error">{erreur}</Alert>}

      <div className="grid-main">
        <div className="stack">
          <Card title="Client">
            <div className="stack">
              <ClientAutocomplete nom={clientNom} clientId={clientId} onNom={setClientNom} onSelect={choisirClient} erreur={erreurs.client_nom ?? erreurs.client_id} autoFocus />
              <div className="ev-form-grid">
                <TextField label="Téléphone" inputMode="tel" mono value={telephone} onChange={(e) => setTelephone(e.target.value)} error={erreurs.client_telephone} />
                <TextField label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={erreurs.client_email} help="Utile pour VosFactures (envoi au client)." />
              </div>
              <TextField label="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} error={erreurs.client_adresse} help="Imprimée sous le nom du client." />
            </div>
          </Card>

          <Card
            title="Lignes de la facture"
            actions={
              <Button size="sm" icon={<Plus />} onClick={() => setLignes((ls) => [...ls, ligneVide()])}>
                Ajouter une ligne
              </Button>
            }
          >
            <div className="stack">
              {prix && (
                <p className="ev-help" style={{ margin: 0 }}>
                  {tva
                    ? saisieHt
                      ? `Prix saisis hors taxes : la TVA de ${formatDecimal(prix.tva_taux)} % s’ajoute au total (Paramètres > Prix).`
                      : `Prix saisis TTC : la TVA de ${formatDecimal(prix.tva_taux)} % est comprise et détaillée sur la facture (Paramètres > Prix).`
                    : 'TVA non applicable (Paramètres > Prix) : les prix saisis sont les prix facturés.'}
                </p>
              )}
              {erreurs.lignes && <Alert tone="error">{erreurs.lignes}</Alert>}
              <div className="cm-lignes-edit">
                {lignes.map((l, i) => {
                  const total = totalLigne(l);
                  return (
                    <div key={l.cle} className="cm-ligne-edit" role="group" aria-label={`Ligne ${i + 1}`}>
                      <TextField
                        label="Désignation"
                        required
                        value={l.designation}
                        onChange={(e) => majLigne(l.cle, { designation: e.target.value })}
                        error={erreurs[`lignes.${i}.designation`]}
                        placeholder="Exemple : Flyers A5 couleur"
                        maxLength={200}
                      />
                      <div className="cm-ligne-edit__suppr">
                        <IconButton label={`Supprimer la ligne ${i + 1}`} onClick={() => supprimerLigne(l.cle)} disabled={lignes.length === 1}>
                          <Trash2 />
                        </IconButton>
                      </div>
                      <div className="cm-ligne-edit__chiffres">
                        <TextField
                          label="Quantité"
                          required
                          inputMode="decimal"
                          mono
                          value={l.quantite}
                          onChange={(e) => majLigne(l.cle, { quantite: e.target.value })}
                          error={erreurs[`lignes.${i}.quantite`]}
                        />
                        <SelectField label="Unité" required options={UNITES} value={l.unite} onChange={(e) => majLigne(l.cle, { unite: e.target.value })} error={erreurs[`lignes.${i}.unite`]} />
                        <TextField
                          label="Prix unitaire"
                          required
                          inputMode="numeric"
                          mono
                          addon="FCFA"
                          value={l.prix_unitaire}
                          onChange={(e) => majLigne(l.cle, { prix_unitaire: e.target.value })}
                          error={erreurs[`lignes.${i}.prix_unitaire`]}
                        />
                        <div className="cm-ligne-edit__total">
                          <span className="ev-label">Total</span>
                          <span className="ev-num">{total === null ? '—' : formatFCFA(total)}</span>
                        </div>
                      </div>
                      <TextField
                        className="ev-field--detail"
                        label="Précision (facultatif)"
                        value={l.detail}
                        onChange={(e) => majLigne(l.cle, { detail: e.target.value })}
                        error={erreurs[`lignes.${i}.detail`]}
                        placeholder="Exemple : 135 g, recto-verso, pelliculage mat"
                        maxLength={300}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="ev-form-grid">
                <TextField label="Remise" inputMode="numeric" mono addon="FCFA" value={remise} onChange={(e) => setRemise(e.target.value)} error={erreurs.remise} help="Montant retiré du total des lignes. Vide = aucune remise." />
              </div>
            </div>
          </Card>

          <Card title="Dates et mentions">
            <div className="stack">
              <div className="ev-form-grid">
                <TextField label="Date d’émission" type="date" required value={dateEmission} onChange={(e) => setDateEmission(e.target.value)} error={erreurs.date_emission} />
                <TextField
                  label="À régler avant le"
                  type="date"
                  min={dateEmission || undefined}
                  value={dateEcheance}
                  onChange={(e) => setDateEcheance(e.target.value)}
                  error={erreurs.date_echeance}
                  help="Facultatif. Transmis à VosFactures comme date limite de paiement (30 jours sinon)."
                />
              </div>
              <TextareaField label="Remarques" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} error={erreurs.notes} maxLength={1000} help="Imprimées sur la facture, sous les totaux." />
              <TextareaField
                label="Conditions de paiement"
                rows={2}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                error={erreurs.conditions_paiement}
                maxLength={1000}
                help="Vide = celles de Paramètres > Documents, s’il y en a."
              />
            </div>
          </Card>
        </div>

        <aside className="stack">
          <Card title="Totaux" className="cm-resume-totaux">
            <div className="stack">
              <Totaux lignes={totaux} label="Totaux de la facture" />
              <p className="ev-help" style={{ margin: 0 }}>
                {lignes.length} ligne{lignes.length > 1 ? 's' : ''}. Le serveur recalcule ces totaux à l’émission.
              </p>
              <Button type="submit" variant="primary" block icon={<Save />} busy={creer.isPending}>
                Émettre la facture
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </form>
  );
}
