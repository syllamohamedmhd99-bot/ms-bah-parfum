import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  MapPin,
  Package,
  History,
  Coins,
  Receipt,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { api } from '../services/api.js';
import { Supplier, CashRegister } from '../types.js';
import { formatGNF, formatDateTime, formatDate } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Modal } from '../components/Modal.js';

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Add Supplier Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  // Pay Debt Modal
  const [isPayDebtOpen, setIsPayDebtOpen] = useState(false);
  const [selectedSupplierForPay, setSelectedSupplierForPay] = useState<Supplier | null>(null);
  const [debtPayAmount, setDebtPayAmount] = useState('');
  const [debtPayRegister, setDebtPayRegister] = useState('1');
  const [debtPayNotes, setDebtPayNotes] = useState('');

  // History Modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [supplierHistoryData, setSupplierHistoryData] = useState<any>(null);

  const toast = useToast();
  const { hasRole } = useAuth();

  const loadData = async () => {
    try {
      setLoading(true);
      const [sups, regs] = await Promise.all([
        api.getSuppliers({ search: search || undefined }),
        api.getCashRegisters()
      ]);
      setSuppliers(sups);
      setRegisters(regs);
    } catch (err: any) {
      toast.error('Erreur chargement des fournisseurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.company_name.trim()) {
      toast.error('Le nom de l\'entreprise est obligatoire.');
      return;
    }

    try {
      await api.createSupplier(supplierForm);
      toast.success(`Fournisseur "${supplierForm.company_name}" créé avec succès.`);
      setIsAddModalOpen(false);
      setSupplierForm({ name: '', company_name: '', phone: '', email: '', address: '', notes: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur création fournisseur.');
    }
  };

  const handleDeleteSupplier = async (s: Supplier) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le fournisseur "${s.company_name}" ?`)) {
      return;
    }
    try {
      const res = await api.deleteSupplier(s.id);
      toast.success(res.message || `Fournisseur "${s.company_name}" supprimé.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression du fournisseur.');
    }
  };

  const handlePaySupplierDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForPay || !debtPayAmount || Number(debtPayAmount) <= 0) {
      toast.error('Montant valide requis.');
      return;
    }

    try {
      await api.paySupplierDebt(selectedSupplierForPay.id, {
        amount: Number(debtPayAmount),
        cash_register_id: Number(debtPayRegister),
        notes: debtPayNotes
      });
      toast.success(`Règlement de facture fournisseur effectué.`);
      setIsPayDebtOpen(false);
      setSelectedSupplierForPay(null);
      setDebtPayAmount('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur règlement fournisseur.');
    }
  };

  const openHistory = async (s: Supplier) => {
    try {
      const res = await api.getSupplierHistory(s.id);
      setSupplierHistoryData(res);
      setIsHistoryOpen(true);
    } catch (err: any) {
      toast.error('Erreur chargement historique fournisseur.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#176B52]" />
            <span>Gestion des Fournisseurs & Factures d'Achat</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Suivi des approvisionnements cosmétiques, factures d'achat et règlements fournisseurs.
          </p>
        </div>

        {hasRole(['admin', 'manager', 'stock_manager']) && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#176B52] hover:bg-[#125541] rounded-xl shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Fournisseur</span>
          </button>
        )}
      </div>

      {/* Search and Summary */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par entreprise, contact ou téléphone..."
            className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl pl-10 pr-4 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
          />
        </div>

        <div className="text-xs text-[#64748B] flex items-center gap-4">
          <span>Fournisseurs: <strong className="text-[#1F2937]">{suppliers.length}</strong></span>
          <span>
            Dettes fournisseurs :{' '}
            <strong className="text-[#D97732] font-extrabold">
              {formatGNF(suppliers.reduce((acc, s) => acc + (s.total_unpaid_debt || 0), 0))}
            </strong>
          </span>
        </div>
      </div>

      {/* Suppliers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((s) => {
          const hasDebt = (s.total_unpaid_debt || 0) > 0;
          return (
            <div
              key={s.id}
              className={`bg-white rounded-2xl p-5 border shadow-sm flex flex-col justify-between transition ${
                hasDebt
                  ? 'border-[#F6CEB4] hover:border-[#D97732]'
                  : 'border-[#E1E6E2] hover:border-[#176B52]/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#EBF4F0] text-[#176B52] border border-[#C2DDD3] flex items-center justify-center font-bold text-sm">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-[#1F2937]">{s.company_name}</h3>
                      <p className="text-[11px] text-[#64748B]">Contact: {s.name}</p>
                    </div>
                  </div>

                  {hasDebt && (
                    <span className="text-[10px] font-bold bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4] px-2 py-0.5 rounded-full">
                      Facture en attente
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-[11px] text-[#64748B] pl-1">
                  {s.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-[#64748B]" />
                      <span>{s.phone}</span>
                    </p>
                  )}
                  {s.address && (
                    <p className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-[#64748B]" />
                      <span className="truncate">{s.address}</span>
                    </p>
                  )}
                </div>

                {/* Numbers */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#E1E6E2] text-xs">
                  <div className="bg-[#F4F6F3] p-2.5 rounded-xl border border-[#E1E6E2]">
                    <span className="text-[10px] text-[#64748B] block font-medium">Achats Cumulés :</span>
                    <span className="font-bold text-[#1F2937]">{formatGNF(s.total_purchased)}</span>
                  </div>

                  <div className={`p-2.5 rounded-xl ${hasDebt ? 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4]' : 'bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2]'}`}>
                    <span className="text-[10px] block font-medium opacity-70">Reste Dû Fournisseur :</span>
                    <span className="font-extrabold text-sm">{formatGNF(s.total_unpaid_debt)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#E1E6E2]">
                <button
                  onClick={() => openHistory(s)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-white hover:bg-[#F4F6F3] border border-[#E1E6E2] text-[#1F2937] text-xs font-semibold transition"
                >
                  <History className="w-3.5 h-3.5 text-[#176B52]" />
                  <span>Historique</span>
                </button>

                {hasDebt && hasRole(['admin', 'manager']) && (
                  <button
                    onClick={() => {
                      setSelectedSupplierForPay(s);
                      setDebtPayAmount(String(s.total_unpaid_debt));
                      setDebtPayNotes('');
                      setIsPayDebtOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white text-xs font-bold transition shadow-sm active:scale-95"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Régler Facture</span>
                  </button>
                )}

                {hasRole(['admin', 'manager']) && (
                  <button
                    onClick={() => handleDeleteSupplier(s)}
                    className="p-1.5 rounded-xl bg-[#F4F6F3] hover:bg-[#FDF3EB] text-[#64748B] hover:text-[#D97732] transition shrink-0 border border-[#E1E6E2]"
                    title="Supprimer le fournisseur"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {suppliers.length === 0 && (
          <div className="col-span-full py-12 text-center text-[#64748B] text-xs">
            Aucun fournisseur enregistré.
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Nouveau Fournisseur"
        maxWidth="md"
      >
        <form onSubmit={handleSaveSupplier} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Nom de l'Entreprise / Société *</label>
            <input
              type="text"
              value={supplierForm.company_name}
              onChange={(e) => setSupplierForm({ ...supplierForm, company_name: e.target.value })}
              placeholder="Ex: Import-Export Beauté Guinée SARL"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-bold focus:outline-none focus:border-[#176B52]"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Nom de la Personne Contact</label>
            <input
              type="text"
              value={supplierForm.name}
              onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
              placeholder="Ex: M. Ousmane Cherif"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Numéro de Téléphone</label>
            <input
              type="text"
              value={supplierForm.phone}
              onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
              placeholder="+224 6..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Adresse / Entrepôt</label>
            <input
              type="text"
              value={supplierForm.address}
              onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
              placeholder="Ex: Marché Madina, Kaloum..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Notes / Produits Fournis</label>
            <textarea
              rows={2}
              value={supplierForm.notes}
              onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
              placeholder="Ex: Crèmes Mixa, savons noirs, parfums..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium border border-transparent hover:border-[#E1E6E2] transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold shadow-sm transition active:scale-95"
            >
              Enregistrer le fournisseur
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay Supplier Debt Modal */}
      <Modal
        isOpen={isPayDebtOpen}
        onClose={() => setIsPayDebtOpen(false)}
        title={`Règlement Facture Fournisseur: ${selectedSupplierForPay?.company_name || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handlePaySupplierDebt} className="space-y-4 text-xs">
          <div className="p-3 bg-[#FDF3EB] border border-[#F6CEB4] rounded-xl flex items-center justify-between text-[#D97732] font-bold">
            <span>Dette Fournisseur Restante :</span>
            <span className="text-base text-[#D97732] font-black">{formatGNF(selectedSupplierForPay?.total_unpaid_debt)}</span>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Montant à Régler (GNF) *</label>
            <input
              type="number"
              value={debtPayAmount}
              onChange={(e) => setDebtPayAmount(e.target.value)}
              placeholder="0 GNF"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-sm text-[#1F2937] font-bold focus:outline-none focus:border-[#176B52]"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Caisse de Décaissement *</label>
            <select
              value={debtPayRegister}
              onChange={(e) => setDebtPayRegister(e.target.value)}
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            >
              {registers.map((r) => (
                <option key={r.id} value={r.id}>{r.name} (Solde: {formatGNF(r.balance)})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Notes / Numéro de Quittance</label>
            <input
              type="text"
              value={debtPayNotes}
              onChange={(e) => setDebtPayNotes(e.target.value)}
              placeholder="Ex: Chèque remis, virement ou espèces..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsPayDebtOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium border border-transparent hover:border-[#E1E6E2] transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold shadow-sm transition active:scale-95"
            >
              Valider le Paiement Fournisseur
            </button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title={`Historique Fournisseur: ${supplierHistoryData?.supplier?.company_name || ''}`}
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2 p-3 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]">
            <div>Contact: <strong className="text-[#1F2937]">{supplierHistoryData?.supplier?.name || 'N/A'}</strong></div>
            <div>Dette restante: <strong className="text-[#D97732] font-extrabold">{formatGNF(supplierHistoryData?.supplier?.total_unpaid_debt)}</strong></div>
          </div>

          <h4 className="font-bold text-[#1F2937]">Commandes & Factures</h4>
          <div className="max-h-48 overflow-y-auto divide-y divide-[#E1E6E2]">
            {supplierHistoryData?.purchases?.map((p: any) => (
              <div key={p.id} className="py-2 flex justify-between items-center text-[11px]">
                <div>
                  <span className="font-mono font-bold text-[#176B52]">{p.purchase_number}</span>
                  <span className="text-[#64748B] ml-2">{formatDate(p.date)}</span>
                  {p.invoice_number && <span className="text-[#64748B] ml-1">({p.invoice_number})</span>}
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#1F2937]">{formatGNF(p.total_amount)}</div>
                  {p.remaining_amount > 0 && (
                    <div className="text-[10px] text-[#D97732] font-bold">Reste: {formatGNF(p.remaining_amount)}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <h4 className="font-bold text-[#1F2937] pt-2 border-t border-[#E1E6E2]">Articles Fournis Référencés</h4>
          <div className="max-h-36 overflow-y-auto divide-y divide-[#E1E6E2]">
            {supplierHistoryData?.products?.map((prod: any) => (
              <div key={prod.id} className="py-1.5 flex justify-between items-center text-[11px]">
                <span className="font-semibold text-[#1F2937]">{prod.name} ({prod.code})</span>
                <span className="text-[#64748B]">Stock: {prod.stock_quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};
