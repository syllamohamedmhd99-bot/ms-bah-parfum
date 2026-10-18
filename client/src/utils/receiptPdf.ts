import { jsPDF } from 'jspdf';
import { Sale, SaleItem } from '../types.js';
import { formatGNF, formatDateTime, getPaymentModeBadge } from './formatters.js';

/**
 * Génère le code HTML complet et autonome du ticket de caisse pour impression ou rendu PDF
 */
export function getReceiptHtml(sale: Sale, items: SaleItem[]): string {
  const paymentBadge = getPaymentModeBadge(sale.payment_mode);

  const itemsRows = items.map((item) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 4px 2px; text-align: left; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px;">
        ${escapeHtml(item.product_name)}
      </td>
      <td style="padding: 4px 2px; text-align: center; font-size: 11px;">${item.quantity}</td>
      <td style="padding: 4px 2px; text-align: right; color: #475569; font-size: 11px;">${formatGNF(item.unit_price).replace(' GNF', '')}</td>
      <td style="padding: 4px 2px; text-align: right; font-weight: 600; font-size: 11px;">${formatGNF(item.total_price)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Ticket de Caisse - ${escapeHtml(sale.sale_number)}</title>
  <style>
    @page {
      margin: 3mm;
      size: 80mm auto;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #0f172a;
      background: #ffffff;
      padding: 6px;
      width: 100%;
      max-width: 78mm;
      margin: 0 auto;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .border-b-dashed { border-bottom: 1px dashed #64748b; padding-bottom: 6px; margin-bottom: 6px; }
    .border-t-dashed { border-top: 1px dashed #64748b; padding-top: 6px; margin-top: 6px; }
    .brand-title {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 800;
      color: #000000;
      letter-spacing: 0.5px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
      font-size: 10.5px;
    }
    .meta-label { color: #64748b; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }
    th {
      font-size: 10px;
      color: #64748b;
      border-bottom: 1px solid #cbd5e1;
      padding: 3px 2px;
      text-transform: uppercase;
    }
    .total-box {
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1.5px solid #0f172a;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 800;
      color: #000000;
    }
    .footer-note {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 3px;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Header -->
    <div class="text-center border-b-dashed">
      <div class="brand-title">MS BAH PARFUM</div>
      <div style="font-size: 10px; font-weight: 600; color: #1e293b; margin-top: 1px;">Parfumerie, Cosmétique & Articles Divers</div>
      <div style="font-size: 9.5px; color: #64748b;">Marché Madina, Conakry, Guinée</div>
      <div style="font-size: 10px; font-weight: bold; color: #176B52; margin-top: 1px;">Tél : 626 96 39 82 / +224 626 96 39 82</div>
    </div>

    <!-- Metas -->
    <div class="border-b-dashed">
      <div class="meta-row">
        <span class="meta-label">Réf Ticket :</span>
        <span class="font-bold">${escapeHtml(sale.sale_number)}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Date :</span>
        <span>${formatDateTime(sale.date)}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Caissier(ère) :</span>
        <span>${escapeHtml(sale.cashier_name || 'Vendeur')}</span>
      </div>
      ${sale.client_name ? `
      <div class="meta-row" style="color: #176B52; font-weight: 600;">
        <span>Client(e) :</span>
        <span>${escapeHtml(sale.client_name)}</span>
      </div>` : ''}
      <div class="meta-row">
        <span class="meta-label">Mode Règlement :</span>
        <span class="font-bold">${escapeHtml(paymentBadge.label)}</span>
      </div>
    </div>

    <!-- Items -->
    <div class="border-b-dashed">
      <table>
        <thead>
          <tr>
            <th class="text-left">Article</th>
            <th class="text-center" style="width: 28px;">Qté</th>
            <th class="text-right" style="width: 45px;">P.U</th>
            <th class="text-right" style="width: 55px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    </div>

    <!-- Totaux -->
    <div style="margin-bottom: 6px;">
      <div class="meta-row">
        <span class="meta-label">Sous-total :</span>
        <span>${formatGNF(sale.subtotal)}</span>
      </div>
      ${sale.discount > 0 ? `
      <div class="meta-row" style="color: #D97732; font-weight: 600;">
        <span>Remise déduite :</span>
        <span>-${formatGNF(sale.discount)}</span>
      </div>` : ''}
      <div class="total-box">
        <span>TOTAL NET :</span>
        <span>${formatGNF(sale.total_amount)}</span>
      </div>
      ${sale.payment_mode !== 'credit' ? `
      <div class="meta-row" style="margin-top: 4px; color: #475569;">
        <span>Espèces reçues :</span>
        <span>${formatGNF(sale.amount_received)}</span>
      </div>
      <div class="meta-row" style="color: #176B52; font-weight: 700;">
        <span>Monnaie rendue :</span>
        <span>${formatGNF(sale.change_returned)}</span>
      </div>` : `
      <div style="background: #FDF3EB; border: 1px solid #F6CEB4; color: #D97732; padding: 4px; text-align: center; border-radius: 4px; font-weight: bold; font-size: 10px; margin-top: 4px;">
        VENTE À CRÉDIT - CRÉANCE CLIENT
      </div>`}
    </div>

    <!-- Footer -->
    <div class="text-center border-t-dashed footer-note">
      <div class="font-bold" style="color: #176B52;">MS BAH PARFUM vous remercie pour votre achat !</div>
      <div>Les articles vendus ne sont ni repris ni échangés au-delà de 48h.</div>
      <div style="margin-top: 3px; font-size: 8.5px; color: #64748b;">Contact : 626 96 39 82 • Conakry, Guinée</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Génère et télécharge un PDF vectoriel natif de ticket de caisse (format 80mm) via jsPDF
 */
export function generateReceiptPdfBlob(sale: Sale, items: SaleItem[]): jsPDF {
  // Calcul dynamique de la hauteur selon le nombre de lignes d'articles
  const calculatedHeight = Math.max(150, 115 + items.length * 8.5);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, calculatedHeight]
  });

  const paymentBadge = getPaymentModeBadge(sale.payment_mode);
  let y = 8;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(23, 107, 82); // #176B52 Vert foncé
  doc.text('MS BAH PARFUM', 40, y, { align: 'center' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Parfumerie, Cosmétique & Articles Divers', 40, y, { align: 'center' });
  y += 3.5;
  doc.setTextColor(71, 85, 105);
  doc.text('Marché Madina, Conakry, Guinée', 40, y, { align: 'center' });
  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(23, 107, 82);
  doc.text('Tél : 626 96 39 82 / +224 626 96 39 82', 40, y, { align: 'center' });
  y += 4.5;

  // Ligne de séparation pointillée
  drawDashedLine(doc, 5, y, 75, y);
  y += 4;

  // Ticket Meta
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Réf Ticket :', 5, y);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(sale.sale_number, 75, y, { align: 'right' });
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Date :', 5, y);
  doc.setTextColor(15, 23, 42);
  doc.text(formatDateTime(sale.date), 75, y, { align: 'right' });
  y += 4;

  doc.setTextColor(100, 116, 139);
  doc.text('Caissier :', 5, y);
  doc.setTextColor(15, 23, 42);
  doc.text(sale.cashier_name || 'Vendeur', 75, y, { align: 'right' });
  y += 4;

  if (sale.client_name) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Client :', 5, y);
    doc.text(sale.client_name, 75, y, { align: 'right' });
    y += 4;
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Paiement :', 5, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(paymentBadge.label, 75, y, { align: 'right' });
  y += 4.5;

  // Séparation
  drawDashedLine(doc, 5, y, 75, y);
  y += 4;

  // Entête tableau
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ARTICLE', 5, y);
  doc.text('QTÉ', 42, y, { align: 'center' });
  doc.text('P.U', 57, y, { align: 'right' });
  doc.text('TOTAL', 75, y, { align: 'right' });
  y += 2.5;

  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([], 0);
  doc.line(5, y, 75, y);
  y += 4;

  // Lignes articles
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  items.forEach((item) => {
    doc.setTextColor(15, 23, 42);
    // Tronquer le nom si trop long pour 34mm
    const truncatedName = doc.splitTextToSize(item.product_name, 34)[0] || item.product_name;
    doc.text(truncatedName, 5, y);

    doc.setTextColor(71, 85, 105);
    doc.text(item.quantity.toString(), 42, y, { align: 'center' });
    doc.text(formatGNF(item.unit_price).replace(' GNF', ''), 57, y, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatGNF(item.total_price), 75, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 5;
  });

  y += 1;
  drawDashedLine(doc, 5, y, 75, y);
  y += 4;

  // Totaux
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Sous-total :', 5, y);
  doc.setTextColor(15, 23, 42);
  doc.text(formatGNF(sale.subtotal), 75, y, { align: 'right' });
  y += 4;

  if (sale.discount > 0) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Remise :', 5, y);
    doc.text(`-${formatGNF(sale.discount)}`, 75, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 4;
  }

  // TOTAL NET
  y += 1;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.setLineDashPattern([], 0);
  doc.line(5, y, 75, y);
  y += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text('TOTAL NET :', 5, y);
  doc.text(formatGNF(sale.total_amount), 75, y, { align: 'right' });
  y += 4.5;

  // Espèces reçues / monnaie
  if (sale.payment_mode !== 'credit') {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Espèces reçues :', 5, y);
    doc.setTextColor(15, 23, 42);
    doc.text(formatGNF(sale.amount_received), 75, y, { align: 'right' });
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Monnaie rendue :', 5, y);
    doc.text(formatGNF(sale.change_returned), 75, y, { align: 'right' });
    y += 5;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42); // Noir Ardoise (slate-900)
    doc.text('VENTE À CRÉDIT - SOLDE MIS À JOUR', 40, y, { align: 'center' });
    y += 5;
  }

  // Footer
  drawDashedLine(doc, 5, y, 75, y);
  y += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(23, 107, 82);
  doc.text('MS BAH PARFUM vous remercie pour votre achat !', 40, y, { align: 'center' });
  y += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Les articles vendus ne sont ni repris ni échangés au-delà de 48h.', 40, y, { align: 'center' });
  y += 3.5;
  doc.text('Contact : 626 96 39 82 • Conakry, Guinée', 40, y, { align: 'center' });

  return doc;
}

/**
 * Enregistre le ticket au format PDF.
 * Privilégie l'API native d'Electron (boîte de dialogue Windows Save As + moteur Chromium),
 * avec repli automatique sur jsPDF pour le navigateur web.
 */
export async function saveReceiptAsPdf(
  sale: Sale,
  items: SaleItem[]
): Promise<{ success: boolean; canceled?: boolean; filePath?: string; fileName?: string; error?: string }> {
  const fileName = `Ticket_${sale.sale_number.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

  // 1. Mode Bureau Windows (Electron)
  if (window.electronAPI?.saveReceiptPDF) {
    const htmlContent = getReceiptHtml(sale, items);
    return await window.electronAPI.saveReceiptPDF(htmlContent, fileName);
  }

  // 2. Mode Navigateur Web (Repli jsPDF)
  try {
    const doc = generateReceiptPdfBlob(sale, items);
    doc.save(fileName);
    return { success: true, fileName };
  } catch (err: any) {
    console.error('Erreur génération jsPDF:', err);
    return { success: false, error: err.message || 'Échec de génération du ticket PDF' };
  }
}

function drawDashedLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number) {
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(x1, y1, x2, y2);
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
