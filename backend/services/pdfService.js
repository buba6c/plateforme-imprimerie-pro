const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function generateQuotePDF(devisData) {
  return new Promise((resolve, reject) => {
    try {
      const pdfPath = path.join(__dirname, '../uploads/devis', `${devisData.numero}.pdf`);
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);
      
      doc.fontSize(24).fillColor('#2563eb').text('DEVIS', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('#000000');
      doc.text('EvocomPrint', 50, 80);
      doc.text('Plateforme d\'Impression Numérique');
      doc.fontSize(12).fillColor('#2563eb');
      doc.text(`N° ${devisData.numero}`, 400, 80);
      doc.fontSize(10).fillColor('#000000');
      doc.text(`Date: ${new Date(devisData.created_at).toLocaleDateString('fr-FR')}`, 400, 100);
      doc.moveDown(2);
      
      doc.fontSize(12).fillColor('#2563eb').text('CLIENT');
      doc.fontSize(10).fillColor('#000000');
      doc.text(devisData.client_nom || 'Client');
      if (devisData.client_contact) doc.text(devisData.client_contact);
      doc.moveDown(2);
      
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();
      
      const details = JSON.parse(devisData.details_prix || '{}');
      let y = doc.y + 20;
      
      doc.fontSize(10).fillColor('#000000');
      doc.text(`Impression ${devisData.machine_type.toUpperCase()}`, 50, y);
      doc.text(`${details.base || 0} FCFA`, 480, y, { align: 'right' });
      y += 20;
      
      if (details.finitions && details.finitions > 0) {
        doc.text('Finitions', 50, y);
        doc.text(`${details.finitions} FCFA`, 480, y, { align: 'right' });
        y += 20;
      }
      
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 10;
      
      doc.fontSize(14).fillColor('#2563eb');
      doc.text('TOTAL', 50, y);
      doc.text(`${devisData.prix_final || devisData.prix_estime} FCFA`, 480, y, { align: 'right' });
      
      doc.fontSize(8).fillColor('#666666');
      doc.text('Document généré par EvocomPrint', 50, 750, { align: 'center', width: 500 });
      
      doc.end();
      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

async function generateInvoicePDF(factureData) {
  return new Promise((resolve, reject) => {
    try {
      const pdfPath = path.join(__dirname, '../uploads/factures', `${factureData.numero}.pdf`);
      fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
      
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(pdfPath);
      doc.pipe(stream);
      
      doc.fontSize(28).fillColor('#dc2626').text('FACTURE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('#000000');
      doc.text('EvocomPrint', 50, 100);
      doc.fontSize(12).fillColor('#dc2626');
      doc.text(`N° ${factureData.numero}`, 400, 100);
      doc.fontSize(10).fillColor('#000000');
      doc.text(`Date: ${new Date(factureData.created_at).toLocaleDateString('fr-FR')}`, 400, 120);
      
      doc.fontSize(12).fillColor('#dc2626').text('FACTURER À', 50, 180);
      doc.fontSize(10).fillColor('#000000');
      doc.text(factureData.client_nom);
      
      let y = 260;
      doc.text('Prestation d\'impression', 50, y);
      doc.text(`${factureData.montant_ht || 0} FCFA`, 400, y);
      y += 25;
      doc.text('TVA', 50, y);
      doc.text(`${factureData.montant_tva || 0} FCFA`, 400, y);
      y += 35;
      
      doc.fontSize(16).fillColor('#dc2626');
      doc.text('TOTAL TTC', 50, y);
      doc.text(`${factureData.montant_ttc} FCFA`, 400, y);
      
      doc.fontSize(8).fillColor('#666666');
      doc.text('Document généré par EvocomPrint', 50, 750, { align: 'center', width: 500 });
      
      doc.end();
      stream.on('finish', () => resolve(pdfPath));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateQuotePDF, generateInvoicePDF };
