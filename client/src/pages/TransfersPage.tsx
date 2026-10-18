import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  RotateCcw,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Wallet,
  Coins,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { api } from '../services/api.js';
import { MoneyTransfer, CashRegister } from '../types.js';
import { formatGNF, formatDateTime } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Modal } from '../components/Modal.js';

export const TransfersPage: React.FC = () => {
  const [transfers, setTransfers] = useState<MoneyTransfer[]>([]);
  const [wallets, setWallets] = useState<CashRegister[]>([]);
  const [todaySummary, setTodaySummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Filter
  const [typeFilter, setTypeFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');

  // Create Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'deposit', // 'deposit' or 'withdrawal'
    client_name: '',
    client_phone: '',
    amount: '',
    service: 'orange_money', // 'orange_money', 'mtn_momo'
    client_fee: '0',
    boutique_commission: '0',
    transaction_ref: '',
    notes: '',
    status: 'validated'
  });

  // Cancel Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [transferToCancel, setTransferToCancel] = useState<MoneyTransfer | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const toast = useToast();
  const { user, hasRole } = useAuth();

  const loadData = async () => {
    try {
      setLoading(true);
      const [list, sum] = await Promise.all([
        api.getTransfers({
          type: typeFilter || undefined,
          service: serviceFilter || undefined,
          limit: 100
        }),
        api.getTransfersSummary()
      ]);
      setTransfers(list);
      setTodaySummary(sum.todaySummary);
      setWallets(sum.wallets);
    } catch (err: any) {
      toast.error('Erreur chargement des transferts Mobile Money.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [typeFilter, serviceFilter]);

  // Compute recommended commission/fee automatically based on standard Guinean tiers
  const handleAmountChange = (amtStr: string, service: string, type: string) => {
    const amt = Number(amtStr) || 0;
    let fee = 0;
    let comm = 0;

    if (amt > 0) {
      // Standard approximation: fee is ~1% of transaction, boutique earns ~50% of the fee
      fee = Math.round(Math.max(1000, amt * 0.01));
      comm = Math.round(fee * 0.5);
    }

    setFormData((prev) => ({
      ...prev,
      amount: amtStr,
      client_fee: String(fee),
      boutique_commission: String(comm),
      transaction_ref: prev.transaction_ref || `${service === 'orange_money' ? 'OM' : 'MOMO'}-GN-${Date.now().toString().slice(-6)}`
    }));
  };

  const openCreateModal = (defaultType = 'deposit') => {
    const defaultService = 'orange_money';
    setFormData({
      type: defaultType,
      client_name: '',
      client_phone: '',
      amount: '',
      service: defaultService,
      client_fee: '0',
      boutique_commission: '0',
      transaction_ref: `${defaultService === 'orange_money' ? 'OM' : 'MOMO'}-GN-${Date.now().toString().slice(-6)}`,
      notes: '',
      status: 'validated'
    });
    setIsModalOpen(true);
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_name || !formData.amount || Number(formData.amount) <= 0) {
      toast.error('Veuillez renseigner le nom du client et un montant valide.');
      return;
    }

    try {
      await api.createTransfer({
        ...formData,
        amount: Number(formData.amount),
        client_fee: Number(formData.client_fee) || 0,
        boutique_commission: Number(formData.boutique_commission) || 0
      });

      toast.success(`${formData.type === 'deposit' ? 'Dépôt' : 'Retrait'} Mobile Money validé avec succès.`);
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la validation du transfert.');
    }
  };

  const handleConfirmCancel = async () => {
    if (!transferToCancel || !cancelReason.trim()) {
      toast.error('Le motif d\'annulation est obligatoire.');
      return;
    }

    try {
      await api.cancelTransfer(transferToCancel.id, cancelReason);
      toast.success(`Opération ${transferToCancel.transfer_number} annulée et soldes contrepassés.`);
      setCancelModalOpen(false);
      setTransferToCancel(null);
      setCancelReason('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur annulation.');
    }
  };

  const handleDeleteTransfer = async (id: number, transferNumber: string) => {
    if (!window.confirm(`Êtes-vous certain de vouloir supprimer l'opération "${transferNumber}" de l'historique ?`)) {
      return;
    }
    try {
      await api.deleteTransfer(id);
      toast.success(`Opération ${transferNumber} supprimée de l'historique.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression.');
    }
  };

  const handleClearTransfers = async () => {
    if (!window.confirm("Êtes-vous certain de vouloir vider TOUT l'historique des transferts Mobile Money ? Cette action est irréversible.")) {
      return;
    }
    try {
      await api.clearTransfers();
      toast.success("Historique des transferts Mobile Money vidé avec succès.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du vidage des transferts.');
    }
  };

  const omWallet = wallets.find((w) => w.type === 'orange_money');
  const momoWallet = wallets.find((w) => w.type === 'mtn_momo');
  const cashDesk = wallets.find((w) => w.type === 'cash');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#176B52]" />
            <span>Services Dépôts & Retraits Mobile Money</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Comptabilité autonome Orange Money & MTN MoMo • Seules les commissions constituent le revenu boutique.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openCreateModal('deposit')}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#176B52] hover:bg-[#125541] rounded-xl shadow-sm transition active:scale-95"
          >
            <ArrowDownRight className="w-4 h-4" />
            <span>Nouveau Dépôt</span>
          </button>

          <button
            onClick={() => openCreateModal('withdrawal')}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#1F2937] bg-white hover:bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl transition active:scale-95 shadow-sm"
          >
            <ArrowUpRight className="w-4 h-4 text-[#D97732]" />
            <span>Nouveau Retrait</span>
          </button>
        </div>
      </div>

      {/* Live Balances Grid (3 cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Orange Money Card */}
        <div className="bg-[#176B52] text-white p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-white/80">
              Portefeuille Orange Money
            </div>
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div className="text-2xl font-bold tracking-tight mt-3 text-white">
            {formatGNF(omWallet?.balance)}
          </div>
          <div className="text-[11px] text-white/80 mt-1 flex items-center justify-between">
            <span>{omWallet?.phone_number || 'Compte Marchand OM'}</span>
            <span className="font-semibold text-white">Disponible dépôts</span>
          </div>
        </div>

        {/* MTN MoMo Card */}
        <div className="bg-white text-[#1F2937] p-5 rounded-2xl shadow-sm border border-[#E1E6E2]">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Portefeuille MTN MoMo
            </div>
            <Smartphone className="w-5 h-5 text-[#176B52]" />
          </div>
          <div className="text-2xl font-bold tracking-tight mt-3 text-[#1F2937]">
            {formatGNF(momoWallet?.balance)}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1 flex items-center justify-between">
            <span>{momoWallet?.phone_number || 'Compte Marchand MoMo'}</span>
            <span className="font-semibold text-[#176B52]">Disponible dépôts</span>
          </div>
        </div>

        {/* Cash Desk Liquidity Card */}
        <div className="bg-white border border-[#E1E6E2] text-[#1F2937] p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Espèces en Caisse Physique
            </div>
            <Wallet className="w-5 h-5 text-[#176B52]" />
          </div>
          <div className="text-2xl font-bold tracking-tight mt-3 text-[#1F2937]">
            {formatGNF(cashDesk?.balance)}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1 flex items-center justify-between">
            <span>Comptoir Physique</span>
            <span className="font-semibold text-[#176B52]">Disponible retraits</span>
          </div>
        </div>
      </div>

      {/* Today Activity Metrics Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <span className="text-[#64748B] block">Dépôts Clients (Aujourd'hui) :</span>
          <span className="text-sm font-bold text-[#1F2937] mt-0.5 block">
            {formatGNF(todaySummary?.total_deposits)}
          </span>
        </div>

        <div>
          <span className="text-[#64748B] block">Retraits Clients (Aujourd'hui) :</span>
          <span className="text-sm font-bold text-[#1F2937] mt-0.5 block">
            {formatGNF(todaySummary?.total_withdrawals)}
          </span>
        </div>

        <div>
          <span className="text-[#64748B] block">Commissions Nettes Acquises :</span>
          <span className="text-sm font-bold text-[#176B52] mt-0.5 block">
            +{formatGNF(todaySummary?.total_commissions)}
          </span>
        </div>

        <div>
          <span className="text-[#64748B] block">Nombre d'opérations :</span>
          <span className="text-sm font-bold text-[#1F2937] mt-0.5 block">
            {todaySummary?.total_operations || 0} transaction(s)
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#1F2937]">Type :</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
          >
            <option value="">Tous (Dépôts & Retraits)</option>
            <option value="deposit">Dépôts uniquement</option>
            <option value="withdrawal">Retraits uniquement</option>
          </select>

          <span className="font-bold text-[#1F2937] ml-2">Réseau :</span>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
          >
            <option value="">Tous les réseaux</option>
            <option value="orange_money">Orange Money</option>
            <option value="mtn_momo">MTN Mobile Money</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[#64748B]">
            {transfers.length} opération(s) enregistrée(s)
          </span>
          {hasRole(['admin']) && transfers.length > 0 && (
            <button
              onClick={handleClearTransfers}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#D97732] bg-[#FDF3EB] hover:bg-[#FCEADE] border border-[#F6CEB4] rounded-xl transition shadow-sm active:scale-95"
              title="Vider tout l'historique des transferts Mobile Money"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#D97732]" />
              <span>Vider l'historique</span>
            </button>
          )}
        </div>
      </div>

      {/* Transfers Journal Table */}
      <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider border-b border-[#E1E6E2]">
              <tr>
                <th className="p-3.5">Réf Transaction</th>
                <th className="p-3.5">Date & Heure</th>
                <th className="p-3.5">Type & Réseau</th>
                <th className="p-3.5">Client & Contact</th>
                <th className="p-3.5 text-right">Montant</th>
                <th className="p-3.5 text-right">Frais Client</th>
                <th className="p-3.5 text-right">Commission Boutique</th>
                <th className="p-3.5 text-center">Statut</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6E2]">
              {transfers.map((t) => {
                const isDeposit = t.type === 'deposit';
                return (
                  <tr key={t.id} className="hover:bg-[#F4F6F3]/70 transition">
                    <td className="p-3.5">
                      <div className="font-mono font-bold text-[#1F2937]">{t.transfer_number}</div>
                      {t.transaction_ref && <div className="text-[10px] text-[#64748B]">Réf Op: {t.transaction_ref}</div>}
                    </td>
                    <td className="p-3.5 text-[#64748B]">{formatDateTime(t.created_at)}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            isDeposit
                              ? 'bg-[#EBF4F0] text-[#176B52] border border-[#176B52]/20'
                              : 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4]'
                          }`}
                        >
                          {isDeposit ? 'Dépôt' : 'Retrait'}
                        </span>
                        <span className="font-semibold text-[#1F2937]">
                          {t.service === 'orange_money' ? 'Orange Money' : 'MTN MoMo'}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-[#1F2937]">{t.client_name}</div>
                      <div className="text-[10px] text-[#64748B]">{t.client_phone || 'Sans tel'}</div>
                    </td>
                    <td className="p-3.5 text-right font-bold text-[#1F2937]">
                      {formatGNF(t.amount)}
                    </td>
                    <td className="p-3.5 text-right text-[#64748B]">
                      {formatGNF(t.client_fee)}
                    </td>
                    <td className="p-3.5 text-right font-bold text-[#176B52]">
                      +{formatGNF(t.boutique_commission)}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.status === 'validated'
                            ? 'bg-[#EBF4F0] text-[#176B52]'
                            : t.status === 'cancelled'
                            ? 'bg-[#FDF3EB] text-[#D97732] line-through'
                            : 'bg-[#F4F6F3] text-[#64748B]'
                        }`}
                      >
                        {t.status === 'validated' ? 'Validé' : t.status === 'cancelled' ? 'Annulé' : 'En attente'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1">
                      {t.status === 'validated' && hasRole(['admin', 'manager']) && (
                        <button
                          onClick={() => {
                            setTransferToCancel(t);
                            setCancelReason('');
                            setCancelModalOpen(true);
                          }}
                          className="p-1.5 text-[#D97732] hover:bg-[#FDF3EB] rounded-lg transition"
                          title="Annuler (avec contrepassation des soldes)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {hasRole(['admin', 'manager']) && (
                        <button
                          onClick={() => handleDeleteTransfer(t.id, t.transfer_number)}
                          className="p-1.5 text-[#64748B] hover:text-[#D97732] hover:bg-[#FDF3EB] rounded-lg transition"
                          title="Supprimer définitivement de l'historique"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {transfers.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#64748B] text-xs">
                    Aucune transaction Mobile Money enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Transfer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formData.type === 'deposit' ? 'Effectuer un Dépôt Client' : 'Effectuer un Retrait Client'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveTransfer} className="space-y-4 text-xs">
          {/* Radio type selection */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setFormData({ ...formData, type: 'deposit' });
                handleAmountChange(formData.amount, formData.service, 'deposit');
              }}
              className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition active:scale-95 ${
                formData.type === 'deposit'
                  ? 'bg-[#176B52] text-white border-[#176B52] shadow-sm'
                  : 'bg-[#F4F6F3] text-[#1F2937] border-[#E1E6E2]'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Dépôt (Le client verse des espèces)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFormData({ ...formData, type: 'withdrawal' });
                handleAmountChange(formData.amount, formData.service, 'withdrawal');
              }}
              className={`p-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition active:scale-95 ${
                formData.type === 'withdrawal'
                  ? 'bg-[#176B52] text-white border-[#176B52] shadow-sm'
                  : 'bg-[#F4F6F3] text-[#1F2937] border-[#E1E6E2]'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Retrait (La boutique remet des espèces)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Réseau / Opérateur *</label>
              <select
                value={formData.service}
                onChange={(e) => {
                  const s = e.target.value;
                  setFormData({ ...formData, service: s });
                  handleAmountChange(formData.amount, s, formData.type);
                }}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-bold focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
              >
                <option value="orange_money">Orange Money Guinée</option>
                <option value="mtn_momo">MTN Mobile Money Guinée</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Montant Transaction (GNF) *</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => handleAmountChange(e.target.value, formData.service, formData.type)}
                placeholder="Ex: 500000"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-[#1F2937] font-bold text-base focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Nom du Client *</label>
              <input
                type="text"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Ex: Mariama Kaba"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Numéro de Téléphone Client</label>
              <input
                type="text"
                value={formData.client_phone}
                onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                placeholder="+224 6..."
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Frais Client Facturés (GNF)</label>
              <input
                type="number"
                value={formData.client_fee}
                onChange={(e) => setFormData({ ...formData, client_fee: e.target.value })}
                placeholder="0 GNF"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Commission Nette Boutique (GNF) *</label>
              <input
                type="number"
                value={formData.boutique_commission}
                onChange={(e) => setFormData({ ...formData, boutique_commission: e.target.value })}
                placeholder="0 GNF"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#176B52] font-bold focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-[#1F2937] mb-1">Référence Transaction Opérateur</label>
              <input
                type="text"
                value={formData.transaction_ref}
                onChange={(e) => setFormData({ ...formData, transaction_ref: e.target.value })}
                placeholder="Ex: OM-GN-982134"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-mono focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
              />
            </div>
          </div>

          {/* Validation Notice & Verification */}
          <div className="p-3 bg-[#EBF4F0] border border-[#176B52]/20 rounded-xl flex items-start gap-2.5 text-[#176B52]">
            <ShieldCheck className="w-5 h-5 text-[#176B52] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#1F2937]">Contrôle de disponibilité des fonds :</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                {formData.type === 'deposit'
                  ? `Vérification : le portefeuille électronique ${(formData.service === 'orange_money' ? omWallet : momoWallet)?.name} dispose de ${formatGNF((formData.service === 'orange_money' ? omWallet : momoWallet)?.balance)}.`
                  : `Vérification : la caisse physique dispose de ${formatGNF(cashDesk?.balance)} en espèces pour le retrait.`}
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold shadow-sm transition active:scale-95"
            >
              Valider l'Opération
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Annuler l'Opération Mobile Money (Contrepassation)"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-[#FDF3EB] border border-[#F6CEB4] text-[#D97732] p-3 rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#D97732]" />
            <div>
              <p className="font-bold">Contrepassation financière automatique</p>
              <p className="mt-0.5 text-[#1F2937]">
                L'annulation rétablira automatiquement les soldes du portefeuille Mobile Money et de la caisse physique. L'opération sera archivée avec mention d'annulation.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Motif d'annulation obligatoire :</label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: Erreur de saisie opérateur, transaction non confirmée..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-2.5 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setCancelModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium"
            >
              Fermer
            </button>
            <button
              onClick={handleConfirmCancel}
              className="px-4 py-2 rounded-xl bg-[#D97732] hover:bg-[#BF6425] text-white font-bold transition active:scale-95 shadow-sm"
            >
              Confirmer l'annulation
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
