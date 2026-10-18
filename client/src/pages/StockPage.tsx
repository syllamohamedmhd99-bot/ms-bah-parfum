import React, { useState, useEffect } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Plus,
  Minus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { api } from '../services/api.js';
import { Product, Supplier, CashRegister, StockMovement } from '../types.js';
import { formatGNF, formatDateTime, getMovementTypeLabel } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Modal } from '../components/Modal.js';

export const StockPage: React.FC = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(false);
  const [movementFilter, setMovementFilter] = useState('');

  // Modals State
  const [isReceptionModalOpen, setIsReceptionModalOpen] = useState(false);
  const [isOutflowModalOpen, setIsOutflowModalOpen] = useState(false);

  // Inflow Form State
  const [inflowForm, setInflowForm] = useState({
    product_id: '',
    quantity: '',
    supplier_id: '',
    unit_cost: '',
    date: new Date().toISOString().slice(0, 10),
    invoice_number: '',
    paid_amount: '',
    payment_mode: 'cash',
    cash_register_id: '1',
    reception_type: 'reception',
    reason: '',
    batch_number: '',
    expiry_date: ''
  });

  // Outflow Form State
  const [outflowForm, setOutflowForm] = useState({
    product_id: '',
    quantity: '',
    movement_type: 'damaged',
    reason: '',
    force_negative_stock: false
  });

  const toast = useToast();
  const { user, hasRole } = useAuth();

  const loadData = async () => {
    try {
      setLoading(true);
      const [mvts, prods, sups, regs] = await Promise.all([
        api.getStockMovements({ movement_type: movementFilter || undefined, limit: 100 }),
        api.getProducts({ is_archived: 'false' }),
        api.getSuppliers(),
        api.getCashRegisters()
      ]);
      setMovements(mvts);
      setProducts(prods);
      setSuppliers(sups);
      setRegisters(regs);
    } catch (err: any) {
      toast.error('Erreur chargement des mouvements de stock.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [movementFilter]);

  // Selected product helper for inflows
  const selectedInflowProduct = products.find((p) => String(p.id) === inflowForm.product_id);
  const inflowQty = Number(inflowForm.quantity) || 0;
  const inflowUnitCost = inflowForm.unit_cost !== '' ? Number(inflowForm.unit_cost) : (selectedInflowProduct?.purchase_price || 0);
  const inflowTotalAmount = inflowQty * inflowUnitCost;
  const inflowPaid = Number(inflowForm.paid_amount) || 0;
  const inflowRemaining = Math.max(0, inflowTotalAmount - inflowPaid);

  // Selected product helper for outflows
  const selectedOutflowProduct = products.find((p) => String(p.id) === outflowForm.product_id);
  const outflowQty = Number(outflowForm.quantity) || 0;

  const handleInflowProductChange = (productId: string) => {
    const prod = products.find((p) => String(p.id) === productId);
    setInflowForm((prev) => ({
      ...prev,
      product_id: productId,
      supplier_id: prod?.supplier_id ? String(prod.supplier_id) : prev.supplier_id,
      unit_cost: prod ? String(prod.purchase_price) : '',
      batch_number: prod?.batch_number || '',
      expiry_date: prod?.expiry_date || ''
    }));
  };

  const handleSaveReception = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inflowForm.product_id || inflowQty <= 0) {
      toast.error('Sélectionnez un article et une quantité positive.');
      return;
    }

    try {
      await api.recordReception({
        ...inflowForm,
        product_id: Number(inflowForm.product_id),
        quantity: inflowQty,
        supplier_id: inflowForm.supplier_id ? Number(inflowForm.supplier_id) : null,
        unit_cost: inflowUnitCost,
        paid_amount: inflowPaid,
        cash_register_id: inflowPaid > 0 ? Number(inflowForm.cash_register_id) : null
      });

      toast.success(`Entrée de stock validée : +${inflowQty} unités ajoutées au stock.`);
      setIsReceptionModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'enregistrement de la réception.');
    }
  };

  const handleSaveOutflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outflowForm.product_id || outflowQty <= 0) {
      toast.error('Sélectionnez un article et une quantité positive.');
      return;
    }

    if (!outflowForm.reason.trim()) {
      toast.error('La justification détaillée est obligatoire.');
      return;
    }

    try {
      await api.recordOutflow({
        ...outflowForm,
        product_id: Number(outflowForm.product_id),
        quantity: outflowQty
      });

      toast.success(`Sortie de stock enregistrée : -${outflowQty} unités.`);
      setIsOutflowModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sortie de stock.');
    }
  };

  const handleDeleteMovement = async (id: number) => {
    if (!window.confirm("Voulez-vous supprimer définitivement ce mouvement de stock de l'historique ?")) {
      return;
    }
    try {
      await api.deleteStockMovement(id);
      toast.success("Mouvement supprimé de l'historique.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression.");
    }
  };

  const handleClearMovements = async () => {
    if (!window.confirm("Voulez-vous vider TOUT l'historique des mouvements de stock ? Cette action est irréversible.")) {
      return;
    }
    try {
      await api.clearStockMovements();
      toast.success("Historique des mouvements de stock vidé avec succès.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du vidage des mouvements.");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-[#176B52]" />
            <span>Mouvements de Stock (Entrées & Sorties)</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Réceptions fournisseurs, retours, pertes, avaries, expirations et ajustements traçables.
          </p>
        </div>

        {hasRole(['admin', 'manager', 'stock_manager']) && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setInflowForm({
                  product_id: products.length > 0 ? String(products[0].id) : '',
                  quantity: '',
                  supplier_id: suppliers.length > 0 ? String(suppliers[0].id) : '',
                  unit_cost: products.length > 0 ? String(products[0].purchase_price) : '',
                  date: new Date().toISOString().slice(0, 10),
                  invoice_number: `FAC-${Date.now().toString().slice(-5)}`,
                  paid_amount: '',
                  payment_mode: 'cash',
                  cash_register_id: '1',
                  reception_type: 'reception',
                  reason: 'Réception approvisionnement marchandise',
                  batch_number: '',
                  expiry_date: ''
                });
                setIsReceptionModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#176B52] hover:bg-[#125541] rounded-xl shadow-sm transition active:scale-95"
            >
              <ArrowDownCircle className="w-4 h-4" />
              <span>+ Entrée de Stock (Achat)</span>
            </button>

            <button
              onClick={() => {
                setOutflowForm({
                  product_id: products.length > 0 ? String(products[0].id) : '',
                  quantity: '',
                  movement_type: 'damaged',
                  reason: '',
                  force_negative_stock: false
                });
                setIsOutflowModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#1F2937] bg-white hover:bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl transition active:scale-95 shadow-sm"
            >
              <ArrowUpCircle className="w-4 h-4 text-[#D97732]" />
              <span>- Sortie de Stock (Avarie / Perte)</span>
            </button>
          </div>
        )}
      </div>

      {/* Movement Type Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-[#1F2937]">Filtrer par type :</span>
          <select
            value={movementFilter}
            onChange={(e) => setMovementFilter(e.target.value)}
            className="bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
          >
            <option value="">Tous les mouvements ({movements.length})</option>
            <option value="reception">Réceptions (Achats)</option>
            <option value="sale">Ventes comptoir</option>
            <option value="damaged">Produits endommagés</option>
            <option value="expired">Produits expirés</option>
            <option value="loss_theft">Pertes ou vols</option>
            <option value="internal_use">Utilisation interne</option>
            <option value="return_supplier">Retours fournisseur</option>
            <option value="return_client">Retours client</option>
            <option value="inventory_adjustment">Ajustements inventaire</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#64748B]">
            {movements.length} mouvement(s) affiché(s)
          </span>
          {hasRole(['admin']) && movements.length > 0 && (
            <button
              onClick={handleClearMovements}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#D97732] bg-[#FDF3EB] hover:bg-[#FBE8DA] border border-[#F6CEB4] rounded-xl transition shadow-sm"
              title="Vider tout l'historique des mouvements de stock"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vider l'historique</span>
            </button>
          )}
        </div>
      </div>

      {/* Movements Journal Table */}
      <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider border-b border-[#E1E6E2]">
              <tr>
                <th className="p-3.5">Date & Heure</th>
                <th className="p-3.5">Article</th>
                <th className="p-3.5">Type Mouvement</th>
                <th className="p-3.5 text-center">Variation</th>
                <th className="p-3.5 text-center">Avant</th>
                <th className="p-3.5 text-center">Après</th>
                <th className="p-3.5">Motif / Justification</th>
                <th className="p-3.5">Responsable</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6E2]">
              {movements.map((m) => {
                const isInflow = m.quantity > 0;
                return (
                  <tr key={m.id} className="hover:bg-[#F4F6F3]/60 transition">
                    <td className="p-3.5 text-[#64748B]">{formatDateTime(m.created_at)}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-[#1F2937]">{m.product_name}</div>
                      <div className="text-[10px] text-[#64748B] font-mono">{m.product_code}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="inline-block bg-[#F4F6F3] text-[#1F2937] px-2 py-0.5 rounded text-[11px] font-medium border border-[#E1E6E2]">
                        {getMovementTypeLabel(m.movement_type)}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                          isInflow
                            ? 'bg-[#EBF4F0] text-[#176B52] border border-[#C2DDD3]'
                            : 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4]'
                        }`}
                      >
                        {isInflow ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className="p-3.5 text-center text-[#64748B]">{m.previous_quantity}</td>
                    <td className="p-3.5 text-center font-bold text-[#1F2937]">{m.new_quantity}</td>
                    <td className="p-3.5 text-[#64748B] max-w-sm truncate">{m.reason}</td>
                    <td className="p-3.5 text-[#64748B]">{m.user_name || 'Système'}</td>
                    <td className="p-3.5 text-right">
                      {hasRole(['admin', 'manager']) && (
                        <button
                          onClick={() => handleDeleteMovement(m.id)}
                          className="p-1.5 text-[#64748B] hover:text-[#D97732] hover:bg-[#FDF3EB] rounded-lg transition"
                          title="Supprimer ce mouvement de l'historique"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {movements.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#64748B] text-xs">
                    Aucun mouvement de stock enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Reception / Inflow Modal */}
      <Modal
        isOpen={isReceptionModalOpen}
        onClose={() => setIsReceptionModalOpen(false)}
        title="Enregistrer une Entrée de Stock (Achat / Réception Marchandise)"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveReception} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block font-bold text-[#1F2937] mb-1">Article Reçu *</label>
              <select
                value={inflowForm.product_id}
                onChange={(e) => handleInflowProductChange(e.target.value)}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-medium focus:outline-none focus:border-[#176B52]"
                required
              >
                <option value="">Sélectionner le produit...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stock actuel: {p.stock_quantity}) • Code: {p.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Quantité Reçue *</label>
              <input
                type="number"
                value={inflowForm.quantity}
                onChange={(e) => setInflowForm({ ...inflowForm, quantity: e.target.value })}
                placeholder="Ex: 50"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-bold focus:outline-none focus:border-[#176B52]"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Prix d'Achat Unitaire (GNF) *</label>
              <input
                type="number"
                value={inflowForm.unit_cost}
                onChange={(e) => setInflowForm({ ...inflowForm, unit_cost: e.target.value })}
                placeholder="0 GNF"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Fournisseur</label>
              <select
                value={inflowForm.supplier_id}
                onChange={(e) => setInflowForm({ ...inflowForm, supplier_id: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              >
                <option value="">Sélectionner le fournisseur...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Numéro de Facture Fournisseur</label>
              <input
                type="text"
                value={inflowForm.invoice_number}
                onChange={(e) => setInflowForm({ ...inflowForm, invoice_number: e.target.value })}
                placeholder="Ex: FAC-2026-081"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Type d'entrée</label>
              <select
                value={inflowForm.reception_type}
                onChange={(e) => setInflowForm({ ...inflowForm, reception_type: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              >
                <option value="reception">Achat marchandise standard</option>
                <option value="return_client">Retour client</option>
                <option value="transfer_in">Transfert entrant (autre boutique)</option>
                <option value="inventory_adjustment">Correction autorisée</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Date de réception</label>
              <input
                type="date"
                value={inflowForm.date}
                onChange={(e) => setInflowForm({ ...inflowForm, date: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Date d'Expiration</label>
              <input
                type="date"
                value={inflowForm.expiry_date}
                onChange={(e) => setInflowForm({ ...inflowForm, expiry_date: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Numéro de Lot</label>
              <input
                type="text"
                value={inflowForm.batch_number}
                onChange={(e) => setInflowForm({ ...inflowForm, batch_number: e.target.value })}
                placeholder="Ex: LOT-MX-2025"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              />
            </div>
          </div>

          {/* Financial details box */}
          <div className="bg-[#F4F6F3] p-4 rounded-xl border border-[#E1E6E2] space-y-3">
            <div className="flex justify-between items-center text-[#1F2937] font-medium">
              <span>Montant Total de la Facture :</span>
              <span className="text-base font-extrabold text-[#176B52]">{formatGNF(inflowTotalAmount)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#E1E6E2]">
              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Montant Payé Immédiatement</label>
                <input
                  type="number"
                  value={inflowForm.paid_amount}
                  onChange={(e) => setInflowForm({ ...inflowForm, paid_amount: e.target.value })}
                  placeholder="0 GNF"
                  className="w-full bg-white border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] font-bold focus:outline-none focus:border-[#176B52]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Mode de Paiement</label>
                <select
                  value={inflowForm.payment_mode}
                  onChange={(e) => setInflowForm({ ...inflowForm, payment_mode: e.target.value })}
                  className="w-full bg-white border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                >
                  <option value="cash">Espèces</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_momo">MTN MoMo</option>
                  <option value="bank">Banque</option>
                  <option value="credit">À Crédit (0 payé)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Décaissé depuis la caisse</label>
                <select
                  value={inflowForm.cash_register_id}
                  onChange={(e) => setInflowForm({ ...inflowForm, cash_register_id: e.target.value })}
                  className="w-full bg-white border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                >
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({formatGNF(r.balance)})</option>
                  ))}
                </select>
              </div>
            </div>

            {inflowRemaining > 0 && (
              <div className="flex justify-between items-center text-xs text-[#D97732] font-extrabold pt-1">
                <span>Reste à payer (Dette Fournisseur) :</span>
                <span>{formatGNF(inflowRemaining)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsReceptionModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium border border-transparent hover:border-[#E1E6E2] transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold shadow-sm transition active:scale-95"
            >
              Valider la Réception & Augmenter le Stock
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Outflow Modal */}
      <Modal
        isOpen={isOutflowModalOpen}
        onClose={() => setIsOutflowModalOpen(false)}
        title="Enregistrer une Sortie de Stock (Perte / Avarie / Expiration)"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveOutflow} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Article Concerné *</label>
            <select
              value={outflowForm.product_id}
              onChange={(e) => setOutflowForm({ ...outflowForm, product_id: e.target.value })}
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-medium focus:outline-none focus:border-[#176B52]"
              required
            >
              <option value="">Sélectionner le produit...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock disponible: {p.stock_quantity}) • Code: {p.code}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Quantité à Sortir *</label>
              <input
                type="number"
                value={outflowForm.quantity}
                onChange={(e) => setOutflowForm({ ...outflowForm, quantity: e.target.value })}
                placeholder="Ex: 2"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-bold focus:outline-none focus:border-[#176B52]"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Motif de Sortie *</label>
              <select
                value={outflowForm.movement_type}
                onChange={(e) => setOutflowForm({ ...outflowForm, movement_type: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-medium focus:outline-none focus:border-[#176B52]"
                required
              >
                <option value="damaged">Produit endommagé / Cassé</option>
                <option value="expired">Produit expiré / Périmé</option>
                <option value="loss_theft">Perte constatée ou vol</option>
                <option value="internal_use">Utilisation interne boutique</option>
                <option value="return_supplier">Retour au fournisseur</option>
                <option value="inventory_adjustment">Ajustement inventaire</option>
                <option value="transfer_out">Transfert vers autre boutique</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Justification Obligatoire *</label>
            <textarea
              rows={3}
              value={outflowForm.reason}
              onChange={(e) => setOutflowForm({ ...outflowForm, reason: e.target.value })}
              placeholder="Expliquez précisément les circonstances de la sortie..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              required
            />
          </div>

          {selectedOutflowProduct && outflowQty > selectedOutflowProduct.stock_quantity && (
            <div className="bg-[#FDF3EB] border border-[#F6CEB4] p-3 rounded-xl text-[#D97732] space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-[#D97732]" />
                <span>Quantité supérieure au stock disponible ({selectedOutflowProduct.stock_quantity})</span>
              </div>
              {hasRole(['admin']) ? (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#1F2937]">
                  <input
                    type="checkbox"
                    checked={outflowForm.force_negative_stock}
                    onChange={(e) => setOutflowForm({ ...outflowForm, force_negative_stock: e.target.checked })}
                    className="rounded text-[#176B52] focus:ring-[#176B52]"
                  />
                  <span>Autoriser exceptionnellement en tant qu'administrateur</span>
                </label>
              ) : (
                <p className="text-[11px] text-[#64748B]">
                  Seul un administrateur est habilité à forcer une correction dépassant le stock disponible.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsOutflowModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium border border-transparent hover:border-[#E1E6E2] transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#D97732] hover:bg-[#BF6425] text-white font-bold shadow-sm transition active:scale-95"
            >
              Valider la Sortie de Stock
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
