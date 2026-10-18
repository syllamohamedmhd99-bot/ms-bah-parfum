import React from 'react';
import { Printer, Download, Sparkles, CheckCircle2, ExternalLink, FolderOpen, Loader2 } from 'lucide-react';
import { Modal } from './Modal.js';
import { Sale, SaleItem } from '../types.js';
import { formatGNF, formatDateTime, getPaymentModeBadge } from '../utils/formatters.js';
import { saveReceiptAsPdf, getReceiptHtml } from '../utils/receiptPdf.js';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  items: SaleItem[];
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
  items
}) => {
  const [isSavingPdf, setIsSavingPdf] = React.useState(false);
  const [pdfSuccess, setPdfSuccess] = React.useState<{ filePath?: string; fileName?: string } | null>(null);
  const [pdfError, setPdfError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPdfSuccess(null);
      setPdfError(null);
    }
  }, [isOpen, sale?.id]);

  if (!sale) return null;

  const handlePrint = async () => {
    if (window.electronAPI?.printReceipt) {
      const fullHtml = getReceiptHtml(sale, items);
      await window.electronAPI.printReceipt(fullHtml);
      return;
    }
    window.print();
  };

  const handleSavePdf = async () => {
    if (!sale) return;
    setIsSavingPdf(true);
    setPdfError(null);
    try {
      const res = await saveReceiptAsPdf(sale, items);
      if (res.success) {
        setPdfSuccess({ filePath: res.filePath, fileName: res.fileName });
      } else if (res.error) {
        setPdfError(res.error);
      }
    } catch (err: any) {
      setPdfError(err.message || 'Erreur lors de la création du fichier PDF');
    } finally {
      setIsSavingPdf(false);
    }
  };

  const paymentBadge = getPaymentModeBadge(sale.payment_mode);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ticket de Caisse & Reçu de Vente" maxWidth="md">
      <div className="flex flex-col gap-4">
        {/* Printable Ticket Area */}
        <div id="thermal-receipt" className="print-area bg-white p-6 rounded-xl border border-dashed border-[#E1E6E2] text-[#1F2937] font-mono text-sm shadow-inner">
          {/* Header */}
          <div className="text-center pb-4 border-b border-dashed border-[#E1E6E2]">
            <div className="flex items-center justify-center gap-1.5 text-[#176B52] font-sans font-black text-lg mb-0.5 tracking-wide">
              <span>MS BAH PARFUM</span>
            </div>
            <p className="text-xs font-semibold text-[#1F2937]">Parfumerie, Cosmétique & Articles Divers</p>
            <p className="text-xs text-[#64748B]">Marché Madina, Conakry, Guinée</p>
            <p className="text-xs font-bold text-[#176B52] mt-0.5">Tél : 626 96 39 82 / +224 626 96 39 82</p>
          </div>

          {/* Ticket Meta */}
          <div className="py-3 border-b border-dashed border-[#E1E6E2] text-xs flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-[#64748B]">Réf Ticket :</span>
              <span className="font-bold text-[#1F2937]">{sale.sale_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Date & Heure :</span>
              <span className="text-[#1F2937]">{formatDateTime(sale.date)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Caissier(ère) :</span>
              <span className="text-[#1F2937]">{sale.cashier_name || 'Vendeur'}</span>
            </div>
            {sale.client_name && (
              <div className="flex justify-between font-bold text-[#1F2937]">
                <span>Client(e) :</span>
                <span>{sale.client_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#64748B]">Paiement :</span>
              <span className="font-semibold">{paymentBadge.label}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-[#E1E6E2]">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#64748B] border-b border-[#E1E6E2] pb-1 text-left">
                  <th className="py-1">Article</th>
                  <th className="text-center py-1">Qté</th>
                  <th className="text-right py-1">P.U</th>
                  <th className="text-right py-1">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2]">
                {items.map((item, idx) => (
                  <tr key={idx} className="py-1.5">
                    <td className="py-1 pr-1 font-sans font-medium text-[#1F2937] leading-tight">
                      {item.product_name}
                    </td>
                    <td className="text-center py-1 text-[#1F2937]">{item.quantity}</td>
                    <td className="text-right py-1 text-[#64748B]">{formatGNF(item.unit_price).replace(' GNF', '')}</td>
                    <td className="text-right py-1 font-bold text-[#1F2937]">{formatGNF(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial summary */}
          <div className="pt-3 pb-2 text-xs flex flex-col gap-1.5">
            <div className="flex justify-between text-[#64748B]">
              <span>Sous-total :</span>
              <span>{formatGNF(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-[#D97732] font-medium">
                <span>Remise accordée :</span>
                <span>-{formatGNF(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-[#1F2937] pt-1 border-t border-[#E1E6E2]">
              <span>TOTAL NET :</span>
              <span className="font-black text-[#176B52]">{formatGNF(sale.total_amount)}</span>
            </div>

            {sale.payment_mode !== 'credit' && (
              <>
                <div className="flex justify-between text-[#64748B] pt-1">
                  <span>Espèces reçues :</span>
                  <span>{formatGNF(sale.amount_received)}</span>
                </div>
                <div className="flex justify-between text-[#1F2937] font-semibold">
                  <span>Monnaie rendue :</span>
                  <span>{formatGNF(sale.change_returned)}</span>
                </div>
              </>
            )}

            {sale.payment_mode === 'credit' && (
              <div className="bg-[#FDF3EB] border border-[#F6CEB4] text-[#D97732] p-2 rounded-xl text-center text-xs font-bold my-1">
                VENTE À CRÉDIT - SOLDE DU CLIENT MIS À JOUR
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center pt-3 border-t border-dashed border-[#E1E6E2] text-[11px] text-[#64748B]">
            <p className="font-bold text-[#176B52]">MS BAH PARFUM vous remercie pour votre achat !</p>
            <p>Les articles vendus ne sont ni repris ni échangés au-delà de 48h.</p>
            <p className="mt-1 font-mono text-[10px]">Contact : 626 96 39 82 • Conakry, Guinée</p>
          </div>
        </div>

        {/* Action buttons (hidden on print) */}
        <div className="flex flex-col gap-2.5 no-print">
          {pdfSuccess && (
            <div className="bg-[#EBF4F0] border border-[#176B52]/30 text-[#176B52] p-3 rounded-xl flex items-center justify-between gap-3 text-xs animate-fade-in-up">
              <div className="flex items-center gap-2 overflow-hidden">
                <CheckCircle2 className="w-4 h-4 text-[#176B52] shrink-0" />
                <div className="min-w-0">
                  <p className="font-bold">Ticket PDF enregistré avec succès !</p>
                  <p className="text-[#176B52]/80 truncate text-[11px]">{pdfSuccess.fileName || pdfSuccess.filePath}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {pdfSuccess.filePath && window.electronAPI?.openPath && (
                  <button
                    onClick={() => window.electronAPI?.openPath(pdfSuccess.filePath!)}
                    className="flex items-center gap-1 bg-white text-[#176B52] px-2.5 py-1.5 rounded-lg border border-[#176B52]/20 font-medium transition text-xs shadow-sm hover:bg-[#EBF4F0]"
                    title="Ouvrir le fichier PDF avec l'application par défaut"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ouvrir</span>
                  </button>
                )}
                {pdfSuccess.filePath && window.electronAPI?.showInFolder && (
                  <button
                    onClick={() => window.electronAPI?.showInFolder(pdfSuccess.filePath!)}
                    className="flex items-center gap-1 bg-white text-[#176B52] px-2.5 py-1.5 rounded-lg border border-[#176B52]/20 font-medium transition text-xs shadow-sm hover:bg-[#EBF4F0]"
                    title="Afficher dans l'Explorateur Windows"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Dossier</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {pdfError && (
            <div className="bg-[#FDF3EB] border border-[#F6CEB4] text-[#D97732] p-2.5 rounded-xl text-xs flex items-center gap-2 font-medium">
              <span>✕ {pdfError}</span>
            </div>
          )}

          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 bg-white hover:bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2] font-semibold py-2.5 px-3 rounded-xl transition shadow-sm text-xs sm:text-sm active:scale-95"
            >
              <Printer className="w-4 h-4 shrink-0 text-[#176B52]" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={handleSavePdf}
              disabled={isSavingPdf}
              className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 bg-[#176B52] hover:bg-[#125541] text-white font-bold py-2.5 px-3 rounded-xl transition shadow-sm disabled:opacity-50 text-xs sm:text-sm active:scale-95"
            >
              {isSavingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Enregistrer en PDF</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="bg-[#F4F6F3] hover:bg-[#E1E6E2] text-[#1F2937] font-medium py-2.5 px-4 rounded-xl transition text-xs sm:text-sm active:scale-95"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
