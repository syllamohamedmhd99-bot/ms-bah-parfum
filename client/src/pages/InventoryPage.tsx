import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Calendar,
  CreditCard,
  Building2,
  CheckCircle,
  History,
  FileCheck,
  Search
} from 'lucide-react';
import { api } from '../services/api.js';
import { Product, AlertsSummary, InventoryAudit } from '../types.js';
import { formatGNF, formatDate, formatDateTime } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Modal } from '../components/Modal.js';

export const InventoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'alerts' | 'history'>('alerts');
  const [alerts, setAlerts] = useState<AlertsSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventoryAudit[]>([]);
  const [loading, setLoading] = useState(false);

  // Physical count state: map productId -> actualCount (string) & justification (string)
  const [counts, setCounts] = useState<Record<number, { actual: string; justification: string }>>({});
  const [auditNotes, setAuditNotes] = useState('');
  const [searchAudit, setSearchAudit] = useState('');

  // Audit Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAuditDetail, setSelectedAuditDetail] = useState<any>(null);

  const toast = useToast();
  const { user, hasRole } = useAuth();

  const loadData = async () => {
    try {
      setLoading(true);
      const [al, prods, hist] = await Promise.all([
        api.getAlerts(),
        api.getProducts({ is_archived: 'false' }),
        api.getInventoryAudits()
      ]);
      setAlerts(al);
      setProducts(prods);
      setInventoryHistory(hist);

      // Pre-initialize counts with theoretical quantity
      const initCounts: Record<number, { actual: string; justification: string }> = {};
      for (const p of prods) {
        initCounts[p.id] = { actual: String(p.stock_quantity), justification: '' };
      }
      setCounts(initCounts);
    } catch (err: any) {
      toast.error('Erreur chargement des alertes et inventaire.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Submit physical inventory count
  const handleValidateInventory = async (e: React.FormEvent) => {
    e.preventDefault();

    const itemsToSubmit = products.map((p) => {
      const entry = counts[p.id] || { actual: String(p.stock_quantity), justification: '' };
      const actualQty = Number(entry.actual) || 0;
      const discrepancy = actualQty - p.stock_quantity;
      return {
        productId: p.id,
        theoreticalQty: p.stock_quantity,
        actualQty,
        justification: discrepancy !== 0 ? entry.justification || 'Ajustement inventaire physique' : ''
      };
    });

    // Check if any discrepancy lacks justification
    const missingJustification = itemsToSubmit.find(
      (item) => item.actualQty !== item.theoreticalQty && !item.justification.trim()
    );

    if (missingJustification) {
      toast.error('Une justification explicative est obligatoire pour tout article présentant un écart de stock.');
      return;
    }

    try {
      const res = await api.recordInventoryAudit({
        items: itemsToSubmit,
        notes: auditNotes
      });

      toast.success(res.message);
      setAuditNotes('');
      loadData();
      setActiveTab('history');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la validation de l\'inventaire.');
    }
  };

  const openAuditDetail = async (auditId: number) => {
    try {
      const res = await api.getInventoryAudit(auditId);
      setSelectedAuditDetail(res);
      setDetailModalOpen(true);
    } catch (err) {
      toast.error('Erreur chargement détails inventaire.');
    }
  };

  const filteredProductsForAudit = products.filter((p) =>
    p.name.toLowerCase().includes(searchAudit.toLowerCase()) ||
    p.code.toLowerCase().includes(searchAudit.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#176B52]" />
            <span>Inventaire Physique & Alertes Opérationnelles</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Comptage des stocks réels vs théoriques, détection des ruptures, péremptions et retards financiers.
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex rounded-xl bg-[#F4F6F3] border border-[#E1E6E2] p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'alerts'
                ? 'bg-[#176B52] text-white shadow-sm font-bold'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Centre d'Alertes ({alerts?.totalCount || 0})</span>
          </button>

          {hasRole(['admin', 'manager', 'stock_manager']) && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'bg-[#176B52] text-white shadow-sm font-bold'
                  : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Nouveau Pointage</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-[#176B52] text-white shadow-sm font-bold'
                : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historique ({inventoryHistory.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'alerts' && (
        /* ALERTS CONSOLIDATED CENTER */
        <div className="space-y-6">
          {/* Top Quick Alert KPI Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 bg-white border border-[#E1E6E2] rounded-2xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">Ruptures de stock</span>
              <span className="text-2xl font-extrabold text-[#D97732] mt-1 block">
                {alerts?.outOfStock?.length || 0}
              </span>
              <span className="text-[11px] text-[#64748B]">Articles à 0 unité</span>
            </div>

            <div className="p-4 bg-white border border-[#E1E6E2] rounded-2xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">Stocks Faibles</span>
              <span className="text-2xl font-extrabold text-[#D97732] mt-1 block">
                {alerts?.lowStock?.length || 0}
              </span>
              <span className="text-[11px] text-[#64748B]">Sous le seuil d'alerte</span>
            </div>

            <div className="p-4 bg-white border border-[#E1E6E2] rounded-2xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">Péremptions Proches</span>
              <span className="text-2xl font-extrabold text-[#1F2937] mt-1 block">
                {alerts?.expiringSoon?.length || 0}
              </span>
              <span className="text-[11px] text-[#64748B]">Expire sous 60 jours</span>
            </div>

            <div className="p-4 bg-white border border-[#E1E6E2] rounded-2xl shadow-sm">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">Factures Impayées</span>
              <span className="text-2xl font-extrabold text-[#D97732] mt-1 block">
                {alerts?.unpaidPurchases?.length || 0}
              </span>
              <span className="text-[11px] text-[#64748B]">Dettes fournisseurs</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section 1: Stockouts & Low Stocks */}
            <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E1E6E2]">
                <h3 className="font-extrabold text-sm text-[#1F2937] flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-[#D97732]" />
                  <span>Articles en Rupture & Stock Faible</span>
                </h3>
                <span className="text-xs text-[#D97732] font-bold">
                  {(alerts?.outOfStock?.length || 0) + (alerts?.lowStock?.length || 0)} article(s)
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {alerts?.outOfStock?.map((p) => (
                  <div key={p.id} className="p-2.5 bg-[#FDF3EB] border border-[#F6CEB4] rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1F2937] block">{p.name}</span>
                      <span className="text-[10px] text-[#64748B]">{p.category_name} • Réf: {p.code}</span>
                    </div>
                    <span className="text-xs font-extrabold text-white bg-[#D97732] px-2 py-0.5 rounded-md">
                      0 en stock
                    </span>
                  </div>
                ))}

                {alerts?.lowStock?.map((p) => (
                  <div key={p.id} className="p-2.5 bg-[#FDF3EB] border border-[#F6CEB4] rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1F2937] block">{p.name}</span>
                      <span className="text-[10px] text-[#64748B]">{p.category_name} • Seuil: {p.alert_threshold}</span>
                    </div>
                    <span className="text-xs font-extrabold text-[#D97732] bg-white border border-[#F6CEB4] px-2 py-0.5 rounded-md">
                      {p.stock_quantity} restant(s)
                    </span>
                  </div>
                ))}

                {(!alerts?.outOfStock?.length && !alerts?.lowStock?.length) && (
                  <p className="text-center py-8 text-[#64748B] text-xs">
                    Tous les articles ont un niveau de stock satisfaisant.
                  </p>
                )}
              </div>
            </div>

            {/* Section 2: Expirations (Expired + Expiring Soon) */}
            <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E1E6E2]">
                <h3 className="font-extrabold text-sm text-[#1F2937] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#176B52]" />
                  <span>Dates d'Expiration & Contrôle Lots</span>
                </h3>
                <span className="text-xs text-[#1F2937] font-bold">
                  {(alerts?.expired?.length || 0) + (alerts?.expiringSoon?.length || 0)} article(s)
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {alerts?.expired?.map((p) => (
                  <div key={p.id} className="p-2.5 bg-[#FDF3EB] border border-[#F6CEB4] rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1F2937] block">{p.name}</span>
                      <span className="text-[10px] text-[#64748B]">Lot: {p.batch_number || 'N/A'} • Exp: {formatDate(p.expiry_date)}</span>
                    </div>
                    <span className="text-xs font-extrabold text-white bg-[#D97732] px-2 py-0.5 rounded-md">
                      PÉRIMÉ ({p.stock_quantity} pcs)
                    </span>
                  </div>
                ))}

                {alerts?.expiringSoon?.map((p) => (
                  <div key={p.id} className="p-2.5 bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1F2937] block">{p.name}</span>
                      <span className="text-[10px] text-[#64748B]">Lot: {p.batch_number || 'N/A'} • Expire le {formatDate(p.expiry_date)}</span>
                    </div>
                    <span className="text-xs font-extrabold text-[#1F2937] bg-white border border-[#E1E6E2] px-2 py-0.5 rounded-md">
                      {p.days_remaining} jours restants
                    </span>
                  </div>
                ))}

                {(!alerts?.expired?.length && !alerts?.expiringSoon?.length) && (
                  <p className="text-center py-8 text-[#64748B] text-xs">
                    Aucun produit périmé ou proche de la date d'expiration.
                  </p>
                )}
              </div>
            </div>

            {/* Section 3: Financial Debts & Supplier Invoices */}
            <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E1E6E2]">
                <h3 className="font-extrabold text-sm text-[#1F2937] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#D97732]" />
                  <span>Factures Fournisseurs Impayées</span>
                </h3>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts?.unpaidPurchases?.map((p: any) => (
                  <div key={p.id} className="p-2.5 bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#1F2937]">{p.supplier_name}</span>
                      <span className="text-[10px] text-[#64748B] block">Facture {p.purchase_number} du {formatDate(p.date)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-[#D97732] block">{formatGNF(p.remaining_amount)}</span>
                      <span className="text-[10px] text-[#64748B]">Total: {formatGNF(p.total_amount)}</span>
                    </div>
                  </div>
                ))}

                {(!alerts?.unpaidPurchases || alerts.unpaidPurchases.length === 0) && (
                  <p className="text-center py-6 text-[#64748B] text-xs">Toutes les factures fournisseurs sont réglées.</p>
                )}
              </div>
            </div>

            {/* Section 4: Cash Session Discrepancies */}
            <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E1E6E2]">
                <h3 className="font-extrabold text-sm text-[#1F2937] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#176B52]" />
                  <span>Derniers Écarts de Caisse Constatés</span>
                </h3>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {alerts?.cashDiscrepancies?.map((cs: any) => (
                  <div key={cs.id} className="p-2.5 bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-[#1F2937]">Caisse {cs.register_name} ({cs.cashier_name})</span>
                      <span className="text-[#D97732] font-extrabold">
                        {cs.discrepancy > 0 ? `+${formatGNF(cs.discrepancy)}` : formatGNF(cs.discrepancy)}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#64748B]">Clôturé le {formatDateTime(cs.closing_time)}</div>
                    {cs.justification && (
                      <div className="text-[11px] text-[#1F2937] italic bg-white border border-[#E1E6E2] p-1.5 rounded">
                        Justification: "{cs.justification}"
                      </div>
                    )}
                  </div>
                ))}

                {(!alerts?.cashDiscrepancies || alerts.cashDiscrepancies.length === 0) && (
                  <p className="text-center py-6 text-[#64748B] text-xs">Aucun écart de caisse enregistré.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        /* PHYSICAL INVENTORY AUDIT COUNT FORM */
        <form onSubmit={handleValidateInventory} className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E1E6E2]">
            <div>
              <h3 className="font-extrabold text-sm text-[#1F2937]">Feuille de Pointage d'Inventaire Physique</h3>
              <p className="text-xs text-[#64748B]">Saisissez les quantités réellement comptées dans les rayons de la boutique.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchAudit}
                onChange={(e) => setSearchAudit(e.target.value)}
                placeholder="Filtrer un article..."
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[55vh]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider border-b border-[#E1E6E2] sticky top-0 z-10">
                <tr>
                  <th className="p-3">Réf</th>
                  <th className="p-3">Nom du Produit</th>
                  <th className="p-3 text-center">Stock Théorique</th>
                  <th className="p-3 text-center">Quantité Réelle Comptée</th>
                  <th className="p-3 text-center">Écart Constaté</th>
                  <th className="p-3">Justification (Obligatoire si écart)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2]">
                {filteredProductsForAudit.map((p) => {
                  const entry = counts[p.id] || { actual: String(p.stock_quantity), justification: '' };
                  const actualVal = Number(entry.actual) || 0;
                  const diff = actualVal - p.stock_quantity;

                  return (
                    <tr key={p.id} className={diff !== 0 ? 'bg-[#FDF3EB]/50' : 'hover:bg-[#F4F6F3]/50'}>
                      <td className="p-3 font-mono font-bold text-[#176B52]">{p.code}</td>
                      <td className="p-3 font-bold text-[#1F2937]">{p.name}</td>
                      <td className="p-3 text-center font-bold text-[#64748B]">{p.stock_quantity}</td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          value={entry.actual}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCounts((prev) => ({
                              ...prev,
                              [p.id]: { ...entry, actual: val }
                            }));
                          }}
                          className="w-20 text-center bg-white border border-[#E1E6E2] rounded-xl py-1 text-xs font-extrabold text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                          min="0"
                        />
                      </td>
                      <td className="p-3 text-center font-extrabold">
                        {diff === 0 ? (
                          <span className="text-[#64748B]">0</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[11px] ${
                            diff > 0
                              ? 'bg-[#EBF4F0] text-[#176B52] border border-[#C2DDD3] font-bold'
                              : 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4] font-bold'
                          }`}>
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={entry.justification}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCounts((prev) => ({
                              ...prev,
                              [p.id]: { ...entry, justification: val }
                            }));
                          }}
                          placeholder={diff !== 0 ? "Justification obligatoire..." : "Aucun écart"}
                          className={`w-full border rounded-xl px-2.5 py-1 text-xs focus:outline-none focus:border-[#176B52] ${
                            diff !== 0 && !entry.justification.trim()
                              ? 'bg-[#FDF3EB] border-[#F6CEB4] text-[#D97732] placeholder-[#D97732]/60'
                              : 'bg-white border-[#E1E6E2] text-[#1F2937]'
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t border-[#E1E6E2] flex flex-col sm:flex-row items-center justify-between gap-3">
            <input
              type="text"
              value={auditNotes}
              onChange={(e) => setAuditNotes(e.target.value)}
              placeholder="Notes ou observation générale sur l'inventaire..."
              className="w-full sm:w-96 bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            />

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 bg-[#176B52] hover:bg-[#125541] text-white font-bold rounded-xl shadow-sm text-xs transition active:scale-95"
            >
              Valider l'Inventaire & Régulariser les Stocks
            </button>
          </div>
        </form>
      )}

      {activeTab === 'history' && (
        /* INVENTORY AUDITS HISTORY TABLE */
        <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-[#1F2937]">Historique des Sessions d'Inventaire Réalisées</h3>
            <span className="text-xs text-[#64748B]">{inventoryHistory.length} inventaire(s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider border-b border-[#E1E6E2]">
                <tr>
                  <th className="p-3">Numéro Inventaire</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Auditeur / Responsable</th>
                  <th className="p-3 text-center">Articles Contrôlés</th>
                  <th className="p-3 text-center">Écarts Régularisés</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3 text-right">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2]">
                {inventoryHistory.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#F4F6F3]/50 transition">
                    <td className="p-3 font-mono font-bold text-[#176B52]">{inv.audit_number}</td>
                    <td className="p-3 text-[#64748B]">{formatDateTime(inv.date)}</td>
                    <td className="p-3 text-[#1F2937] font-medium">{inv.auditor_name}</td>
                    <td className="p-3 text-center font-bold text-[#64748B]">{inv.total_items_checked}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        (inv.discrepancies_count || 0) > 0
                          ? 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4]'
                          : 'bg-[#F4F6F3] text-[#64748B]'
                      }`}>
                        {inv.discrepancies_count || 0} écart(s)
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[#EBF4F0] text-[#176B52] border border-[#C2DDD3]">
                        {inv.status === 'completed' ? 'Clôturé' : inv.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openAuditDetail(inv.id)}
                        className="px-3 py-1 rounded-lg bg-[#F4F6F3] hover:bg-[#EBF4F0] text-[#176B52] font-semibold text-xs transition border border-[#E1E6E2]"
                      >
                        Consulter
                      </button>
                    </td>
                  </tr>
                ))}

                {inventoryHistory.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#64748B] text-xs">
                      Aucun inventaire physique n'a encore été enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={`Rapport Inventaire: ${selectedAuditDetail?.audit?.audit_number || ''}`}
        maxWidth="3xl"
      >
        <div className="space-y-4 text-xs">
          <div className="flex justify-between p-3 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]">
            <div>Date: <strong className="text-[#1F2937]">{formatDateTime(selectedAuditDetail?.audit?.date)}</strong></div>
            <div>Auditeur: <strong className="text-[#1F2937]">{selectedAuditDetail?.audit?.auditor_name}</strong></div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider border-b border-[#E1E6E2] text-[10px]">
                <tr>
                  <th className="p-2">Article</th>
                  <th className="p-2 text-center">Théorique</th>
                  <th className="p-2 text-center">Réel</th>
                  <th className="p-2 text-center">Écart</th>
                  <th className="p-2">Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2]">
                {selectedAuditDetail?.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="p-2 font-bold text-[#1F2937]">{item.product_name}</td>
                    <td className="p-2 text-center text-[#64748B]">{item.theoretical_qty}</td>
                    <td className="p-2 text-center font-bold text-[#1F2937]">{item.actual_qty}</td>
                    <td className="p-2 text-center">
                      <span className={`font-bold ${
                        item.discrepancy_qty > 0
                          ? 'text-[#176B52] font-extrabold'
                          : item.discrepancy_qty < 0
                          ? 'text-[#D97732] font-extrabold'
                          : 'text-[#64748B]'
                      }`}>
                        {item.discrepancy_qty > 0 ? `+${item.discrepancy_qty}` : item.discrepancy_qty}
                      </span>
                    </td>
                    <td className="p-2 text-[#64748B] italic">{item.justification || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
};
