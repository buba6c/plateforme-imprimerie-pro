// Aperçu à l'écran d'un devis ou d'une facture, identique au PDF (modèle des documents de
// l'entreprise) : titre et dates à gauche, logo à droite, Vendeur / Acheteur, tableau à bande
// noire, TOTAL, montant à payer en chiffres et en lettres, signatures, pied de page.
import type { ReactNode } from 'react';
import { formatDecimal, formatEntier, nombreEnLettres } from '@evocom/shared';
import { formatQuantite, uniteCourte } from './format';
import type { Entreprise, LigneDocument } from './types';

export interface InfoApercu {
  label: string;
  valeur: ReactNode;
}

export interface TotalApercu {
  label: string;
  valeur: string;
  fort?: boolean;
}

function montant(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return Number.isInteger(v) ? formatEntier(v) : formatDecimal(v, 2);
}

function quantite(l: LigneDocument): string {
  if (l.quantite === null || l.quantite === undefined) return '';
  const unite = l.unite && l.unite !== 'forfait' ? ` ${uniteCourte(l.unite, l.quantite)}` : '';
  return `${formatQuantite(l.quantite)}${unite}`;
}

export function ApercuDocument({
  titre,
  infos,
  vendeur,
  acheteur,
  objet,
  lignes,
  vide,
  totaux,
  aPayer,
  reglement,
  paragraphes,
  bonPourAccord,
  banque,
  entreprise,
  filigrane,
}: {
  titre: string;
  infos: InfoApercu[];
  vendeur: ReactNode[];
  acheteur: ReactNode[];
  objet?: string | null;
  lignes: LigneDocument[];
  /** Message quand il n'y a aucune ligne. */
  vide?: string;
  totaux: TotalApercu[];
  aPayer: number;
  /** Déjà réglé / reste à payer (facture d'un dossier). */
  reglement?: TotalApercu[];
  /** Remarques, conditions, mentions : titre en gras puis texte. */
  paragraphes?: { titre: string; texte: string }[];
  /** Devis : mention « Bon pour accord » à droite de « Nom du vendeur ». */
  bonPourAccord?: boolean;
  /** Facture : coordonnées bancaires en grands caractères. */
  banque?: string | null;
  entreprise?: Entreprise | null;
  filigrane?: string | null;
}) {
  const pied = entreprise
    ? [
        entreprise.adresse,
        [entreprise.rccm && `R.C. ${entreprise.rccm}`, entreprise.ninea && `NINEA ${entreprise.ninea}`].filter(Boolean).join(' '),
        [entreprise.telephone && `Tél : ${entreprise.telephone}`, entreprise.email && `email : ${entreprise.email}`].filter(Boolean).join(' - '),
      ].filter((l) => l && l.trim())
    : [];
  return (
    <div className="cm-apercu" data-filigrane={filigrane || undefined}>
      {filigrane && (
        <span className="cm-apercu__filigrane" aria-hidden="true">
          {filigrane}
        </span>
      )}
      <header className="cm-apercu__tete">
        <div>
          <h2 className="cm-apercu__titre">{titre}</h2>
          <dl className="cm-apercu__infos">
            {infos.map((i) => (
              <div key={i.label}>
                <dt>{i.label}:</dt>
                <dd>{i.valeur}</dd>
              </div>
            ))}
          </dl>
        </div>
        <img className="cm-apercu__logo" src="/marque/evocom-logo-documents.png" alt="" width={207} height={135} />
      </header>

      <div className="cm-apercu__parties">
        <div>
          <h3>Vendeur</h3>
          {vendeur.filter(Boolean).length ? vendeur.filter(Boolean).map((l, i) => <div key={i}>{l}</div>) : <div>-</div>}
        </div>
        <div>
          <h3>Acheteur</h3>
          {acheteur.filter(Boolean).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>

      {objet && (
        <p className="cm-apercu__objet">
          <strong>Objet : </strong>
          {objet}
        </p>
      )}

      {lignes.length ? (
        <table className="cm-apercu__table">
          <thead>
            <tr>
              <th scope="col">N°</th>
              <th scope="col">Désignation</th>
              <th scope="col" className="cm-apercu__num">Qté</th>
              <th scope="col" className="cm-apercu__num">PU</th>
              <th scope="col" className="cm-apercu__num">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <strong>{l.designation}</strong>
                  {(l.detail ?? '')
                    .split('\n')
                    .map((d) => d.trim())
                    .filter(Boolean)
                    .map((d, j) => (
                      <span key={j} className="cm-apercu__detail">
                        {d}
                      </span>
                    ))}
                </td>
                <td className="cm-apercu__num">{quantite(l)}</td>
                <td className="cm-apercu__num">{montant(l.prix_unitaire)}</td>
                <td className="cm-apercu__num">{montant(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="ev-muted" style={{ margin: 0 }}>
          {vide ?? 'Aucune ligne.'}
        </p>
      )}

      <dl className="cm-apercu__totaux">
        {totaux.map((t) => (
          <div key={t.label} data-fort={t.fort || undefined}>
            <dt>{t.label}</dt>
            <dd>{t.valeur}</dd>
          </div>
        ))}
      </dl>

      <p className="cm-apercu__payer">
        <strong>À payer: </strong>
        {formatEntier(aPayer)} Franc CFA
      </p>
      <p className="cm-apercu__payer">
        <strong>En lettres: </strong>
        {nombreEnLettres(aPayer)} Franc CFA
      </p>

      {reglement && reglement.length > 0 && (
        <dl className="cm-apercu__totaux">
          {reglement.map((t) => (
            <div key={t.label} data-fort={t.fort || undefined}>
              <dt>{t.label}</dt>
              <dd>{t.valeur}</dd>
            </div>
          ))}
        </dl>
      )}

      {paragraphes?.map((p) => (
        <div key={p.titre} className="cm-apercu__paragraphe">
          <strong>{p.titre}</strong>
          <p>{p.texte}</p>
        </div>
      ))}

      <div className="cm-apercu__signatures">
        <div>Nom du vendeur</div>
        {bonPourAccord && (
          <div>
            Date et signature du client précédée de la mention
            <br />
            ‘Bon pour accord’
          </div>
        )}
      </div>

      {banque && <p className="cm-apercu__banque">{banque}</p>}

      {pied.length > 0 && (
        <footer className="cm-apercu__pied">
          <span>Page 1 / 1</span>
          <span className="cm-apercu__pied-centre">
            {pied.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </span>
          <span>{entreprise?.pied_facture ?? ''}</span>
        </footer>
      )}
    </div>
  );
}
