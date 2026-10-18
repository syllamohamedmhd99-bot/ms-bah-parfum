import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  CreditCard,
  ShoppingBag,
  History,
  Coins,
  CheckCircle,
  FileText,
  Trash2
} from 'lucide-react';
import { api } from '../services/api.js';
import { Client, CashRegister } from '../types.js';
import { formatGNF, formatDateTime } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { Modal } from '../components/Modal.js';

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Add Client Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    phone: '',
    address: '',
    credit_limit: '500000',
    notes: ''
  });

  // Pay Debt Modal
  const [isPayDebtOpen, setIsPayDebtOpen] = useState(false);
  const [selectedClientForPay, setSelectedClientForPay] = useState<Client | null>(null);
  const [debtPayAmount, setDebtPayAmount] = useState('');
  const [debtPayRegister, setDebtPayRegister] = useState('1');
  const [debtPayNotes, setDebtPayNotes] = useState('');

  // Client History Modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [clientHistoryData, setClientHistoryData] = useState<any>(null);

  const toast = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [cls, regs] = await Promise.all([
        api.getClients({ search: search || undefined }),
        api.getCashRegisters()
      ]);
      setClients(cls);
      setRegisters(regs);
    } catch (err: any) {
      toast.error('Erreur chargement des clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name.trim()) {
      toast.error('Le nom du client est requis.');
    }

    try {
      await api.createClient(clientForm);
      toast.success(`Client "${clientForm.name}" créé avec succès.`);
      setIsAddModalOpen(false);
      setClientForm({ name: '', phone: '', address: '', credit_limit: '500000', notes: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur création client.');
    }
  };

  const handleDeleteClient = async (c: Client) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer le client "${c.name}" ?`)) {
      return;
    }
    try {
      const res = await api.deleteClient(c.id);
      toast.success(res.message || `Client(e) "${c.name}" supprimé(e).`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression du client.');
    }
  };

  const handlePayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientForPay || !debtPayAmount || Number(debtPayAmount) <= 0) {
      toast.error('Montant valide requis.');
      return;
    }

    try {
      await api.payClientDebt(selectedClientForPay.id, {
        amount: Number(debtPayAmount),
        cash_register_id: Number(debtPayRegister),
        notes: debtPayNotes
      });
      toast.success(`Remboursement de dette enregistré pour ${selectedClientForPay.name}.`);
      setIsPayDebtOpen(false);
      setSelectedClientForPay(null);
      setDebtPayAmount('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur règlement dette client.');
    }
  };

  const openHistory = async (c: Client) => {
    try {
      const res = await api.getClientHistory(c.id);
      setClientHistoryData(res);
      setIsHistoryOpen(true);
    } catch (err: any) {
      toast.error('Erreur chargement historique client.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#176B52]" />
            <span>Gestion des Clients, Crédits & Règlements</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Suivi des encours de crédit, historique des achats et encaissement des remboursements.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#176B52] hover:bg-[#125541] rounded-xl shadow-sm transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Client</span>
        </button>
      </div>

      {/* Search and Summary Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone..."
            className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl pl-10 pr-4 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
          />
        </div>

        <div className="text-xs text-[#64748B] flex items-center gap-4">
          <span>Total clients: <strong className="text-[#1F2937]">{clients.length}</strong></span>
          <span>
            Total dettes en cours :{' '}
            <strong className="text-[#D97732] font-extrabold">
              {formatGNF(clients.reduce((acc, c) => acc + (c.current_debt || 0), 0))}
            </strong>
          </span>
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((c) => {
          const hasDebt = c.current_debt > 0;
          return (
            <div
              key={c.id}
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
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-[#1F2937]">{c.name}</h3>
                      <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-[#64748B]" />
                        <span>{c.phone || 'Sans numéro'}</span>
                      </p>
                    </div>
                  </div>

                  {hasDebt && (
                    <span className="text-[10px] font-bold bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4] px-2 py-0.5 rounded-full">
                      Endetté
                    </span>
                  )}
                </div>

                {c.address && (
                  <p className="text-[11px] text-[#64748B] flex items-center gap-1 mt-2.5 pl-1">
                    <MapPin className="w-3 h-3 text-[#64748B] shrink-0" />
                    <span className="truncate">{c.address}</span>
                  </p>
                )}

                {/* Financial figures */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#E1E6E2] text-xs">
                  <div className="bg-[#F4F6F3] p-2.5 rounded-xl border border-[#E1E6E2]">
                    <span className="text-[10px] text-[#64748B] block font-medium">Achats Cumulés :</span>
                    <span className="font-bold text-[#1F2937]">{formatGNF(c.total_purchased)}</span>
                  </div>

                  <div className={`p-2.5 rounded-xl ${hasDebt ? 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4]' : 'bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2]'}`}>
                    <span className="text-[10px] block font-medium opacity-70">Solde Restant Dû :</span>
                    <span className="font-extrabold text-sm">{formatGNF(c.current_debt)}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#E1E6E2]">
                <button
                  onClick={() => openHistory(c)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-white hover:bg-[#F4F6F3] border border-[#E1E6E2] text-[#1F2937] text-xs font-semibold transition"
                >
                  <History className="w-3.5 h-3.5 text-[#176B52]" />
                  <span>Historique</span>
                </button>

                {hasDebt && (
                  <button
                    onClick={() => {
                      setSelectedClientForPay(c);
                      setDebtPayAmount(String(c.current_debt));
                      setDebtPayNotes('');
                      setIsPayDebtOpen(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white text-xs font-bold transition shadow-sm active:scale-95"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Régler Dette</span>
                  </button>
                )}

                <button
                  onClick={() => handleDeleteClient(c)}
                  className="p-1.5 rounded-xl bg-[#F4F6F3] hover:bg-[#FDF3EB] text-[#64748B] hover:text-[#D97732] transition shrink-0 border border-[#E1E6E2]"
                  title="Supprimer le client"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {clients.length === 0 && (
          <div className="col-span-full py-12 text-center text-[#64748B] text-xs">
            Aucun client trouvé.
          </div>
        )}
      </div>

      {/* Add Client Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Nouveau Client"
        maxWidth="md"
      >
        <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Nom complet du client *</label>
            <input
              type="text"
              value={clientForm.name}
              onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
              placeholder="Ex: Hadja Fatou Diallo"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Numéro de Téléphone</label>
            <input
              type="text"
              value={clientForm.phone}
              onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
              placeholder="+224 6..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Adresse / Quartier</label>
            <input
              type="text"
              value={clientForm.address}
              onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
              placeholder="Ex: Kipé, Matam, Madina..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Plafond de Crédit Autorisé (GNF)</label>
            <input
              type="number"
              value={clientForm.credit_limit}
              onChange={(e) => setClientForm({ ...clientForm, credit_limit: e.target.value })}
              placeholder="500000"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Notes / Activité</label>
            <textarea
              rows={2}
              value={clientForm.notes}
              onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
              placeholder="Ex: Salon de coiffure, cliente régulière..."
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
              Enregistrer le client
            </button>
          </div>
        </form>
      </Modal>

      {/* Pay Debt Modal */}
      <Modal
        isOpen={isPayDebtOpen}
        onClose={() => setIsPayDebtOpen(false)}
        title={`Règlement de Dette: ${selectedClientForPay?.name || ''}`}
        maxWidth="md"
      >
        <form onSubmit={handlePayDebt} className="space-y-4 text-xs">
          <div className="p-3 bg-[#FDF3EB] border border-[#F6CEB4] rounded-xl flex items-center justify-between text-[#D97732] font-bold">
            <span>Dette en cours :</span>
            <span className="text-base text-[#D97732] font-black">{formatGNF(selectedClientForPay?.current_debt)}</span>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Montant Remboursé (GNF) *</label>
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
            <label className="block font-bold text-[#1F2937] mb-1">Caisse d'Encaissement (Crédit) *</label>
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
            <label className="block font-bold text-[#1F2937] mb-1">Notes / Référence du Reçu</label>
            <input
              type="text"
              value={debtPayNotes}
              onChange={(e) => setDebtPayNotes(e.target.value)}
              placeholder="Ex: Paiement en espèces reçu au comptoir..."
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
              Enregistrer l'Encaissement
            </button>
          </div>
        </form>
      </Modal>

      {/* History Modal */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title={`Historique Client: ${clientHistoryData?.client?.name || ''}`}
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2 p-3 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]">
            <div>Téléphone: <strong className="text-[#1F2937]">{clientHistoryData?.client?.phone || 'N/A'}</strong></div>
            <div>Dette restante: <strong className="text-[#D97732] font-black">{formatGNF(clientHistoryData?.client?.current_debt)}</strong></div>
          </div>

          <h4 className="font-bold text-[#1F2937]">Achats & Ventes</h4>
          <div className="max-h-48 overflow-y-auto divide-y divide-[#E1E6E2]">
            {clientHistoryData?.sales?.map((s: any) => (
              <div key={s.id} className="py-2 flex justify-between items-center text-[11px]">
                <div>
                  <span className="font-mono font-bold text-[#176B52]">{s.sale_number}</span>
                  <span className="text-[#64748B] ml-2">{formatDateTime(s.date)}</span>
                </div>
                <div className="font-bold text-[#1F2937]">{formatGNF(s.total_amount)} ({s.payment_mode})</div>
              </div>
            ))}
            {(!clientHistoryData?.sales || clientHistoryData.sales.length === 0) && (
              <p className="text-[#64748B] py-2">Aucun achat enregistré.</p>
            )}
          </div>

          <h4 className="font-bold text-[#1F2937] pt-2 border-t border-[#E1E6E2]">Règlements de Dettes</h4>
          <div className="max-h-40 overflow-y-auto divide-y divide-[#E1E6E2]">
            {clientHistoryData?.debtPayments?.map((p: any) => (
              <div key={p.id} className="py-2 flex justify-between items-center text-[11px]">
                <div>
                  <span className="font-mono font-bold text-[#176B52]">{p.movement_number}</span>
                  <span className="text-[#64748B] ml-2">{formatDateTime(p.date)}</span>
                </div>
                <div className="font-bold text-[#176B52]">+{formatGNF(p.amount)}</div>
              </div>
            ))}
            {(!clientHistoryData?.debtPayments || clientHistoryData.debtPayments.length === 0) && (
              <p className="text-[#64748B] py-2">Aucun remboursement enregistré.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
