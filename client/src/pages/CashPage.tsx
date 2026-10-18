import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Plus,
  Receipt,
  FileText,
  AlertTriangle,
  CheckCircle,
  Printer,
  History,
  Lock,
  Unlock,
  Coins,
  Trash2
} from 'lucide-react';
import { api } from '../services/api.js';
import { CashRegister, CashSession, FinancialMovement } from '../types.js';
import { formatGNF, formatDateTime } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Modal } from '../components/Modal.js';

export const CashPage: React.FC = () => {
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [sessionsHistory, setSessionsHistory] = useState<CashSession[]>([]);
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewTab, setViewTab] = useState<'sessions' | 'journal'>('sessions');

  // Open Session Modal
  const [openSessionModal, setOpenSessionModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('500000');
  const [openingNotes, setOpeningNotes] = useState('');

  // Close Session Modal
  const [closeSessionModal, setCloseSessionModal] = useState(false);
  const [actualBalance, setActualBalance] = useState('');
  const [closeJustification, setCloseJustification] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closureReport, setClosureReport] = useState<any>(null);

  // Expense Modal
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category: 'Frais de fonctionnement',
    amount: '',
    cash_register_id: '1',
    description: '',
    date: new Date().toISOString().slice(0, 10)
  });

  // Transfer Between Registers Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    source_register_id: '1',
    target_register_id: '2',
    amount: '',
    description: ''
  });

  // Add Register Modal
  const [addRegisterModalOpen, setAddRegisterModalOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    name: '',
    type: 'cash',
    initial_balance: '0',
    phone_number: '',
    notes: ''
  });

  const toast = useToast();
  const { user, hasRole } = useAuth();

  const loadData = async () => {
    try {
      setLoading(true);
      const [regs, curr, sess, mvts] = await Promise.all([
        api.getCashRegisters(),
        api.getCurrentSession(),
        api.getCashSessions({ limit: 30 }),
        api.getFinancialMovements({ limit: 50 })
      ]);
      setRegisters(regs);
      setCurrentSession(curr);
      setSessionsHistory(sess);
      setMovements(mvts);
    } catch (err: any) {
      toast.error('Erreur chargement des caisses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Open Session
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.openCashSession({
        cash_register_id: 1, // Main cash drawer
        opening_float: Number(openingFloat) || 0,
        notes: openingNotes
      });
      toast.success('Session de caisse ouverte avec succès.');
      setOpenSessionModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur ouverture de caisse.');
    }
  };

  // Handle Close Session
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession) return;

    try {
      const res = await api.closeCashSession(currentSession.id, {
        actual_balance: Number(actualBalance),
        justification: closeJustification,
        notes: closeNotes
      });

      toast.success('Session de caisse clôturée.');
      setClosureReport(res.report);
      setCloseSessionModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur clôture de caisse.');
    }
  };

  // Handle Expense Recording
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || Number(expenseForm.amount) <= 0 || !expenseForm.description) {
      toast.error('Montant et description requis.');
      return;
    }

    try {
      await api.recordExpense({
        ...expenseForm,
        amount: Number(expenseForm.amount),
        cash_register_id: Number(expenseForm.cash_register_id)
      });
      toast.success('Dépense enregistrée avec succès.');
      setExpenseModalOpen(false);
      setExpenseForm({
        category: 'Frais de fonctionnement',
        amount: '',
        cash_register_id: '1',
        description: '',
        date: new Date().toISOString().slice(0, 10)
      });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur enregistrement dépense.');
    }
  };

  // Handle Inter-Register Transfer
  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.amount || Number(transferForm.amount) <= 0) {
      toast.error('Montant valide requis.');
      return;
    }

    try {
      await api.transferBetweenRegisters({
        ...transferForm,
        source_register_id: Number(transferForm.source_register_id),
        target_register_id: Number(transferForm.target_register_id),
        amount: Number(transferForm.amount)
      });
      toast.success('Transfert inter-caisses effectué sans impact sur les revenus.');
      setTransferModalOpen(false);
      setTransferForm({
        source_register_id: '1',
        target_register_id: '2',
        amount: '',
        description: ''
      });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur transfert inter-caisses.');
    }
  };

  // Handle Create Cash Register
  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.name.trim()) {
      toast.error('Le nom du compte ou de la caisse est obligatoire.');
      return;
    }
    try {
      await api.createCashRegister({
        ...registerForm,
        initial_balance: Number(registerForm.initial_balance) || 0
      });
      toast.success(`Compte / Caisse "${registerForm.name.trim()}" créé avec succès.`);
      setAddRegisterModalOpen(false);
      setRegisterForm({
        name: '',
        type: 'cash',
        initial_balance: '0',
        phone_number: '',
        notes: ''
      });
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur création caisse.');
    }
  };

  const handleDeleteSession = async (id: number) => {
    if (!window.confirm(`Êtes-vous certain de vouloir supprimer la session de caisse #${id} de l'historique ?`)) {
      return;
    }
    try {
      await api.deleteCashSession(id);
      toast.success(`Session de caisse #${id} supprimée de l'historique.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression de la session.');
    }
  };

  const handleClearSessions = async () => {
    if (!window.confirm("Êtes-vous certain de vouloir vider TOUT l'historique des sessions de caisse ? Cette action est irréversible.")) {
      return;
    }
    try {
      await api.clearCashSessions();
      toast.success("Historique des sessions de caisse vidé avec succès.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du vidage des sessions.');
    }
  };

  const handleDeleteMovement = async (id: number, movementNumber: string) => {
    if (!window.confirm(`Êtes-vous certain de vouloir supprimer le mouvement "${movementNumber}" du journal financier ?`)) {
      return;
    }
    try {
      await api.deleteFinancialMovement(id);
      toast.success(`Mouvement financier ${movementNumber} supprimé.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression du mouvement.');
    }
  };

  const handleClearMovements = async () => {
    if (!window.confirm("Êtes-vous certain de vouloir vider TOUT le journal financier ? Cette action est irréversible.")) {
      return;
    }
    try {
      await api.clearFinancialMovements();
      toast.success("Journal financier vidé avec succès.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du vidage du journal.');
    }
  };

  const countedActual = Number(actualBalance) || 0;
  const currentDiscrepancy = currentSession ? countedActual - currentSession.theoretical_balance : 0;

  return (
    <div className="space-y-5">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#176B52]" />
            <span>Gestion des Caisses, Clôtures & Flux Financiers</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Sessions de caisse, calcul automatique des écarts, gestion des dépenses et transferts inter-comptes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasRole(['admin']) && (
            <button
              onClick={() => setAddRegisterModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1F2937] bg-white hover:bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl transition active:scale-95 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-[#176B52]" />
              <span>+ Nouveau Compte / Caisse</span>
            </button>
          )}

          {currentSession ? (
            <button
              onClick={() => {
                setActualBalance(String(currentSession.theoretical_balance));
                setCloseJustification('');
                setCloseNotes('');
                setCloseSessionModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#176B52] hover:bg-[#125541] rounded-xl shadow-sm transition active:scale-95"
            >
              <Lock className="w-4 h-4" />
              <span>Clôturer Service (Comptage Réel)</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setOpeningFloat('500000');
                setOpeningNotes('');
                setOpenSessionModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#176B52] hover:bg-[#125541] rounded-xl shadow-sm transition active:scale-95"
            >
              <Unlock className="w-4 h-4" />
              <span>Ouvrir Service (Fond de Caisse)</span>
            </button>
          )}

          {hasRole(['admin', 'manager']) && (
            <>
              <button
                onClick={() => setExpenseModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1F2937] bg-white hover:bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl transition active:scale-95 shadow-sm"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-[#D97732]" />
                <span>+ Dépense</span>
              </button>

              <button
                onClick={() => setTransferModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1F2937] bg-white hover:bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl transition active:scale-95 shadow-sm"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-[#176B52]" />
                <span>Transfert Inter-Caisses</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Current Active Session Banner (if open) */}
      {currentSession && (
        <div className="bg-[#176B52] text-white p-5 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                    Session de Caisse en cours
                  </span>
                  <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold border border-white/30">
                    Ouverte
                  </span>
                </div>
                <p className="text-xs text-white/80 mt-0.5">
                  Ouverte le {formatDateTime(currentSession.opening_time)} par <strong className="text-white">{currentSession.user_name}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-right">
              <div>
                <span className="text-[10px] text-white/70 block uppercase">Fond initial :</span>
                <span className="text-sm font-bold text-white">{formatGNF(currentSession.opening_float)}</span>
              </div>
              <div>
                <span className="text-[10px] text-white/70 block uppercase">Ventes encaissées :</span>
                <span className="text-sm font-bold text-white">+{formatGNF(currentSession.total_cash_in)}</span>
              </div>
              <div className="pl-4 border-l border-white/20">
                <span className="text-[10px] text-white/70 block uppercase font-bold">Solde Théorique :</span>
                <span className="text-xl font-bold text-white">{formatGNF(currentSession.theoretical_balance)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Registers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {registers.map((r) => (
          <div key={r.id} className="bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-bold text-[#64748B] uppercase text-[10px]">{r.type}</span>
                {r.is_currently_open === 1 && (
                  <span className="text-[10px] font-bold text-[#176B52] bg-[#EBF4F0] px-2 py-0.5 rounded-full border border-[#176B52]/20">
                    Ouvert
                  </span>
                )}
              </div>
              <h3 className="font-bold text-[#1F2937] text-sm">{r.name}</h3>
              {r.phone_number && <p className="text-[11px] text-[#64748B]">{r.phone_number}</p>}
            </div>

            <div className="mt-4 pt-3 border-t border-[#E1E6E2] flex items-center justify-between">
              <span className="text-xs text-[#64748B]">Solde actuel:</span>
              <span className="text-base font-bold text-[#176B52]">{formatGNF(r.balance)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs navigation: Sessions History vs Financial Journal */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E1E6E2] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewTab('sessions')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                viewTab === 'sessions'
                  ? 'bg-[#176B52] text-white shadow-sm'
                  : 'text-[#1F2937] hover:bg-[#F4F6F3]'
              }`}
            >
              Historique des Clôtures & Écarts de Caisse
            </button>

            <button
              onClick={() => setViewTab('journal')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                viewTab === 'journal'
                  ? 'bg-[#176B52] text-white shadow-sm'
                  : 'text-[#1F2937] hover:bg-[#F4F6F3]'
              }`}
            >
              Journal Financier (Dépenses & Recettes)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B]">
              {viewTab === 'sessions' ? `${sessionsHistory.length} session(s)` : `${movements.length} mouvement(s)`}
            </span>
            {hasRole(['admin']) && (
              viewTab === 'sessions' ? (
                sessionsHistory.length > 0 && (
                  <button
                    onClick={handleClearSessions}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#D97732] bg-[#FDF3EB] hover:bg-[#FCEADE] border border-[#F6CEB4] rounded-xl transition shadow-sm active:scale-95"
                    title="Vider tout l'historique des sessions de caisse"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#D97732]" />
                    <span>Vider les sessions</span>
                  </button>
                )
              ) : (
                movements.length > 0 && (
                  <button
                    onClick={handleClearMovements}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#D97732] bg-[#FDF3EB] hover:bg-[#FCEADE] border border-[#F6CEB4] rounded-xl transition shadow-sm active:scale-95"
                    title="Vider tout le journal financier"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#D97732]" />
                    <span>Vider le journal</span>
                  </button>
                )
              )
            )}
          </div>
        </div>

        {viewTab === 'sessions' ? (
          /* SESSIONS TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider border-b border-[#E1E6E2]">
                <tr>
                  <th className="p-3">Session #</th>
                  <th className="p-3">Caissier</th>
                  <th className="p-3">Ouverture</th>
                  <th className="p-3">Clôture</th>
                  <th className="p-3 text-right">Fond Initial</th>
                  <th className="p-3 text-right">Solde Théorique</th>
                  <th className="p-3 text-right">Comptage Réel</th>
                  <th className="p-3 text-right">Écart</th>
                  <th className="p-3">Justification</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2]">
                {sessionsHistory.map((s) => {
                  const hasDisc = s.discrepancy !== null && s.discrepancy !== undefined && s.discrepancy !== 0;
                  return (
                     <tr key={s.id} className="hover:bg-[#F4F6F3]/70 transition">
                      <td className="p-3 font-mono font-bold text-[#1F2937]">SES-#{s.id}</td>
                      <td className="p-3 text-[#1F2937] font-medium">{s.user_name}</td>
                      <td className="p-3 text-[#64748B]">{formatDateTime(s.opening_time)}</td>
                      <td className="p-3 text-[#64748B]">{s.closing_time ? formatDateTime(s.closing_time) : <span className="text-[#176B52] font-bold">En cours</span>}</td>
                      <td className="p-3 text-right text-[#64748B]">{formatGNF(s.opening_float)}</td>
                      <td className="p-3 text-right font-bold text-[#1F2937]">{formatGNF(s.theoretical_balance)}</td>
                      <td className="p-3 text-right font-bold text-[#1F2937]">
                        {s.actual_balance !== null ? formatGNF(s.actual_balance) : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {hasDisc ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4]">
                            {s.discrepancy! > 0 ? `+${formatGNF(s.discrepancy)}` : formatGNF(s.discrepancy)}
                          </span>
                        ) : s.status === 'closed' ? (
                          <span className="text-[#176B52] font-mono font-semibold">0 GNF (Exact)</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 text-[#64748B] max-w-xs truncate">{s.justification || '-'}</td>
                      <td className="p-3 text-right">
                        {hasRole(['admin', 'manager']) && (
                          <button
                            onClick={() => handleDeleteSession(s.id)}
                            className="p-1.5 text-[#64748B] hover:text-[#D97732] hover:bg-[#FDF3EB] rounded-lg transition"
                            title="Supprimer cette session de l'historique"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* FINANCIAL MOVEMENTS TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider border-b border-[#E1E6E2]">
                <tr>
                  <th className="p-3">Réf</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Caisse</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3">Responsable</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2]">
                {movements.map((m) => {
                  const isInflow = m.is_inflow === 1;
                  const isTransfer = m.is_inflow === 2;
                  return (
                    <tr key={m.id} className="hover:bg-[#F4F6F3]/70 transition">
                      <td className="p-3 font-mono font-bold text-[#1F2937]">{m.movement_number}</td>
                      <td className="p-3 text-[#64748B]">{formatDateTime(m.date)}</td>
                      <td className="p-3 font-medium text-[#1F2937]">
                        {m.register_name}
                        {m.target_register_name && ` ➔ ${m.target_register_name}`}
                      </td>
                      <td className="p-3">
                        <span className="inline-block bg-[#F4F6F3] text-[#1F2937] px-2 py-0.5 rounded text-[11px] font-semibold border border-[#E1E6E2]">
                          {m.category}
                        </span>
                      </td>
                      <td className="p-3 text-[#64748B] max-w-xs truncate">{m.description}</td>
                      <td className={`p-3 text-right font-bold ${
                        isTransfer ? 'text-[#64748B]' : isInflow ? 'text-[#176B52]' : 'text-[#D97732]'
                      }`}>
                        {isTransfer ? formatGNF(m.amount) : isInflow ? `+${formatGNF(m.amount)}` : `-${formatGNF(m.amount)}`}
                      </td>
                      <td className="p-3 text-[#64748B]">{m.user_name || '-'}</td>
                      <td className="p-3 text-right">
                        {hasRole(['admin', 'manager']) && (
                          <button
                            onClick={() => handleDeleteMovement(m.id, m.movement_number)}
                            className="p-1.5 text-[#64748B] hover:text-[#D97732] hover:bg-[#FDF3EB] rounded-lg transition"
                            title="Supprimer ce mouvement financier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Session Modal */}
      <Modal
        isOpen={openSessionModal}
        onClose={() => setOpenSessionModal(false)}
        title="Ouvrir un Service de Caisse (Fond Initial)"
        maxWidth="md"
      >
        <form onSubmit={handleOpenSession} className="space-y-4 text-xs">
          <div className="p-3 bg-[#EBF4F0] border border-[#176B52]/20 rounded-xl text-[#176B52]">
            <p className="font-bold">Ouverture de caisse comptoir</p>
            <p className="mt-0.5 text-[11px] text-[#176B52]/90">
              Indiquez le montant d'espèces présent dans le tiroir au démarrage du service.
            </p>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Fond de Caisse Initial (GNF) *</label>
            <input
              type="number"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              placeholder="Ex: 500000"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-sm text-[#1F2937] font-bold focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Notes ou observations</label>
            <textarea
              rows={2}
              value={openingNotes}
              onChange={(e) => setOpeningNotes(e.target.value)}
              placeholder="Ex: Service matin 08h-16h..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-2.5 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setOpenSessionModal(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold transition active:scale-95 shadow-sm"
            >
              Démarrer le service
            </button>
          </div>
        </form>
      </Modal>

      {/* Close Session Modal */}
      <Modal
        isOpen={closeSessionModal}
        onClose={() => setCloseSessionModal(false)}
        title="Clôturer le Service de Caisse (Comptage Réel & Billetage)"
        maxWidth="lg"
      >
        <form onSubmit={handleCloseSession} className="space-y-4 text-xs">
          <div className="p-3.5 bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl space-y-2">
            <div className="flex justify-between">
              <span className="text-[#64748B]">Fond initial :</span>
              <span className="font-bold text-[#1F2937]">{formatGNF(currentSession?.opening_float)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Ventes encaissées :</span>
              <span className="font-bold text-[#176B52]">+{formatGNF(currentSession?.total_cash_in)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[#1F2937] pt-1 border-t border-[#E1E6E2]">
              <span>SOLDE THÉORIQUE ATTENDU :</span>
              <span className="font-mono text-[#176B52]">{formatGNF(currentSession?.theoretical_balance)}</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">
              Montant Réel Compté (Espèces physiquement dans le tiroir) *
            </label>
            <input
              type="number"
              value={actualBalance}
              onChange={(e) => setActualBalance(e.target.value)}
              placeholder="0 GNF"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-sm text-[#1F2937] font-bold focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              required
            />
          </div>

          {currentDiscrepancy !== 0 && (
            <div className="p-3 rounded-xl border bg-[#FDF3EB] border-[#F6CEB4] text-[#D97732]">
              <div className="font-bold flex items-center justify-between">
                <span>Écart de caisse détecté :</span>
                <span className="text-sm font-extrabold">
                  {currentDiscrepancy > 0 ? `+${formatGNF(currentDiscrepancy)} (Excédent)` : `${formatGNF(currentDiscrepancy)} (Déficit)`}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#D97732]">
                Une justification explicative est obligatoire pour clôturer ce service.
              </p>
            </div>
          )}

          {currentDiscrepancy !== 0 && (
            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Justification Obligatoire de l'Écart *</label>
              <textarea
                rows={2}
                value={closeJustification}
                onChange={(e) => setCloseJustification(e.target.value)}
                placeholder="Explication précise de la cause de l'écart..."
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
                required
              />
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setCloseSessionModal(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold transition active:scale-95 shadow-sm"
            >
              Valider la Clôture & Rapport
            </button>
          </div>
        </form>
      </Modal>

      {/* Expense Modal */}
      <Modal
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title="Enregistrer une Dépense d'Exploitation"
        maxWidth="md"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Catégorie de Dépense *</label>
            <select
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            >
              <option value="Loyer">Loyer Boutique</option>
              <option value="Électricité">Électricité (Compteur EDG)</option>
              <option value="Transport">Transport / Fret marchandises</option>
              <option value="Salaires">Salaires et primes personnel</option>
              <option value="Frais de fonctionnement">Frais de fonctionnement (Sachets, ménage...)</option>
              <option value="Retraits propriétaire">Retrait du propriétaire</option>
              <option value="Autre dépense">Autre dépense</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Montant (GNF) *</label>
            <input
              type="number"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              placeholder="0 GNF"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-bold focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Caisse à Débiter *</label>
            <select
              value={expenseForm.cash_register_id}
              onChange={(e) => setExpenseForm({ ...expenseForm, cash_register_id: e.target.value })}
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            >
              {registers.map((r) => (
                <option key={r.id} value={r.id}>{r.name} (Solde: {formatGNF(r.balance)})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Description / Motif Détaillé *</label>
            <textarea
              rows={2}
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              placeholder="Ex: Achat recharge EDG 150 000 GNF pour le mois..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-2.5 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setExpenseModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold transition active:scale-95 shadow-sm"
            >
              Enregistrer la dépense
            </button>
          </div>
        </form>
      </Modal>

      {/* Inter-Register Transfer Modal */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfert de Fonds Inter-Caisses"
        maxWidth="md"
      >
        <form onSubmit={handleSaveTransfer} className="space-y-4 text-xs">
          <div className="p-3 bg-[#EBF4F0] border border-[#176B52]/20 rounded-xl text-[#176B52] text-[11px]">
            Ce transfert déplace des liquidités d'un compte à un autre sans créer de revenu ou de dépense supplémentaire dans le résultat net.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Caisse Source (Débit)</label>
              <select
                value={transferForm.source_register_id}
                onChange={(e) => setTransferForm({ ...transferForm, source_register_id: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              >
                {registers.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({formatGNF(r.balance)})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Caisse Destination (Crédit)</label>
              <select
                value={transferForm.target_register_id}
                onChange={(e) => setTransferForm({ ...transferForm, target_register_id: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              >
                {registers.map((r) => (
                  <option key={r.id} value={r.id}>{r.name} ({formatGNF(r.balance)})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Montant à Transférer (GNF) *</label>
            <input
              type="number"
              value={transferForm.amount}
              onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
              placeholder="0 GNF"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-bold focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Description / Motif</label>
            <input
              type="text"
              value={transferForm.description}
              onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
              placeholder="Ex: Alimentation Orange Money depuis la caisse espèces..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setTransferModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold transition active:scale-95 shadow-sm"
            >
              Effectuer le Transfert
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Cash Register Modal */}
      <Modal
        isOpen={addRegisterModalOpen}
        onClose={() => setAddRegisterModalOpen(false)}
        title="Créer une Nouvelle Caisse ou Portefeuille"
        maxWidth="md"
      >
        <form onSubmit={handleCreateRegister} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Nom du compte / caisse *</label>
            <input
              type="text"
              value={registerForm.name}
              onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              placeholder="Ex: Orange Money SIM 2, Caisse Vendeuse 2, Banque BICIGUI..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Type de Compte *</label>
            <select
              value={registerForm.type}
              onChange={(e) => setRegisterForm({ ...registerForm, type: e.target.value })}
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            >
              <option value="cash">Caisse Espèces (Tiroir physique)</option>
              <option value="orange_money">Portefeuille Orange Money</option>
              <option value="mtn_momo">Portefeuille MTN Mobile Money</option>
              <option value="bank">Compte Bancaire / Coffre-fort</option>
              <option value="other">Autre service financier</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Solde Initial (GNF)</label>
            <input
              type="number"
              value={registerForm.initial_balance}
              onChange={(e) => setRegisterForm({ ...registerForm, initial_balance: e.target.value })}
              placeholder="0 GNF"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-bold focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Numéro de téléphone rattaché (si Mobile Money)</label>
            <input
              type="text"
              value={registerForm.phone_number}
              onChange={(e) => setRegisterForm({ ...registerForm, phone_number: e.target.value })}
              placeholder="+224 6..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Remarques / Emplacement</label>
            <textarea
              rows={2}
              value={registerForm.notes}
              onChange={(e) => setRegisterForm({ ...registerForm, notes: e.target.value })}
              placeholder="Détails complémentaires..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-2.5 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setAddRegisterModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold transition active:scale-95 shadow-sm"
            >
              Créer la Caisse
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
