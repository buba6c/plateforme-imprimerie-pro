import React from 'react';

// DevisSimple: modèle de devis minimaliste, inspiré d'une facture simple
// Props attendues: { data: { company, client, meta, items, totals, notes } }
const DevisSimple = ({ data }) => {
  const d = data || {};
  const company = d.company || {};
  const client = d.client || {};
  const meta = d.meta || {};
  const items = Array.isArray(d.items) ? d.items : [];
  const totals = d.totals || {};
  const notes = d.notes || '';

  return (
    <div className="mx-auto bg-white text-gray-900 shadow-sm border border-gray-200 rounded-lg overflow-hidden max-w-3xl">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DEVIS</h1>
          {meta?.number && (
            <p className="text-sm text-gray-600 mt-1">N° {meta.number}</p>
          )}
          {meta?.date && (
            <p className="text-sm text-gray-600">Date: {meta.date}</p>
          )}
          {meta?.validUntil && (
            <p className="text-sm text-gray-600">Valable jusqu'au: {meta.validUntil}</p>
          )}
        </div>
        <div className="text-right">
          {company?.logo && (
            <img src={company.logo} alt={company.name || 'Logo'} className="h-12 object-contain ml-auto mb-2" />
          )}
          {company?.name && <p className="font-semibold">{company.name}</p>}
          {company?.address && <p className="text-xs text-gray-600 whitespace-pre-line">{company.address}</p>}
          {(company?.email || company?.phone) && (
            <p className="text-xs text-gray-600">
              {company.email ? company.email : ''}
              {company.email && company.phone ? ' • ' : ''}
              {company.phone ? company.phone : ''}
            </p>
          )}
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-6 p-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">ÉMIS PAR</h2>
          <div className="text-sm">
            <p className="font-medium">{company?.name}</p>
            {company?.address && <p className="text-gray-600 whitespace-pre-line">{company.address}</p>}
            {(company?.email || company?.phone) && (
              <p className="text-gray-600">
                {company.email}
                {company.email && company.phone ? ' • ' : ''}
                {company.phone}
              </p>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">DESTINATAIRE</h2>
          <div className="text-sm">
            <p className="font-medium">{client?.name || client?.nom || 'Client'}</p>
            {client?.address && <p className="text-gray-600 whitespace-pre-line">{client.address}</p>}
            {(client?.email || client?.phone) && (
              <p className="text-gray-600">
                {client.email}
                {client.email && client.phone ? ' • ' : ''}
                {client.phone}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="px-6 pb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200">
              <th className="py-2 pr-2 font-semibold text-gray-700">Désignation</th>
              <th className="py-2 px-2 font-semibold text-gray-700 text-right">Qté</th>
              <th className="py-2 px-2 font-semibold text-gray-700 text-right">PU</th>
              <th className="py-2 pl-2 font-semibold text-gray-700 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="py-3 text-gray-500" colSpan={4}>Aucun article</td>
              </tr>
            ) : (
              items.map((it, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="py-3 pr-2">
                    <div className="font-medium">{it.description}</div>
                    {it.detail && <div className="text-xs text-gray-500">{it.detail}</div>}
                  </td>
                  <td className="py-3 px-2 text-right">{it.qty}</td>
                  <td className="py-3 px-2 text-right">{it.unitPrice?.toLocaleString?.() || it.unitPrice} {totals.currency || 'FCFA'}</td>
                  <td className="py-3 pl-2 text-right font-medium">{it.total?.toLocaleString?.() || it.total} {totals.currency || 'FCFA'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-sm text-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Sous-total</span>
              <span className="font-medium">{totals.subtotal?.toLocaleString?.() || totals.subtotal} {totals.currency || 'FCFA'}</span>
            </div>
            {totals.tax != null && (
              <div className="flex justify-between py-1">
                <span className="text-gray-600">TVA</span>
                <span className="font-medium">{totals.tax?.toLocaleString?.() || totals.tax} {totals.currency || 'FCFA'}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t border-gray-200 mt-2">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-gray-900">{totals.total?.toLocaleString?.() || totals.total} {totals.currency || 'FCFA'}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div className="mt-6 text-xs text-gray-600">
            <div className="font-semibold mb-1">Notes</div>
            <p className="whitespace-pre-line">{notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevisSimple;
