import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  TrendingUp,
  CreditCard,
  Building2,
  Package,
  Smartphone,
  Wallet,
  Coins,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../services/api.js';
import { formatGNF, formatDate } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';

export const ReportsPage: React.FC = () => {
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const toast = useToast();

  const loadReport = async () => {
    try {
      setLoading(true);
      const params: any = { period };
      if (period === 'custom') {
        if (!dateStart || !dateEnd) {
          toast.warning('Veuillez renseigner les dates de début et de fin.');
          setLoading(false);
          return;
        }
        params.date_start = dateStart;
        params.date_end = dateEnd;
      }
      const data = await api.getReports(params);
      setReport(data);
    } catch (err: any) {
      toast.error('Erreur génération rapport.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom') {
      loadReport();
    }
  }, [period]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!report) return;

    // Build CSV content with BOM for French Excel compatibility
    let csvContent = "\uFEFF";
    csvContent += "RAPPORT DE GESTION - MS BAH PARFUM\n";
    csvContent += `Période: ${period}\n`;
    csvContent += `Généré le: ${new Date().toLocaleDateString('fr-FR')}\n\n`;

    csvContent += "INDICATEUR;VALEUR\n";
    csvContent += `Chiffre d'Affaires Net;${report.sales?.total_revenue} GNF\n`;
    csvContent += `Bénéfice Brut Ventes;${report.sales?.estimated_profit} GNF\n`;
    csvContent += `Commissions Mobile Money;${report.transfers?.totalCommissions} GNF\n`;
    csvContent += `Total Dépenses d'Exploitation;${report.expenses?.total} GNF\n`;
    csvContent += `BÉNÉFICE NET ESTIMÉ;${report.estimatedNetProfit} GNF\n\n`;

    csvContent += "TOP PRODUITS VENDUS\n";
    csvContent += "Code;Désignation;Catégorie;Unités Vendues;Chiffre d'Affaires;Bénéfice\n";
    for (const p of report.topProducts || []) {
      csvContent += `"${p.code}";"${p.name}";"${p.category_name || ''}";${p.units_sold};${p.total_revenue};${p.total_profit}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport_ms_bah_parfum_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Rapport exporté au format Excel/CSV.');
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm no-print">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#176B52]" />
            <span>Rapports Financiers & Statistiques Périodiques</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Bilan des ventes, bénéfices nets, dépenses, commissions Mobile Money et soldes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Pills */}
          <div className="flex rounded-xl bg-[#F4F6F3] border border-[#E1E6E2] p-1 text-xs font-semibold">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1 rounded-lg transition ${
                period === 'today'
                  ? 'bg-[#176B52] text-white shadow-sm font-bold'
                  : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1 rounded-lg transition ${
                period === 'week'
                  ? 'bg-[#176B52] text-white shadow-sm font-bold'
                  : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              7 Jours
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1 rounded-lg transition ${
                period === 'month'
                  ? 'bg-[#176B52] text-white shadow-sm font-bold'
                  : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              Ce Mois
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-3 py-1 rounded-lg transition ${
                period === 'year'
                  ? 'bg-[#176B52] text-white shadow-sm font-bold'
                  : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              Année
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-3 py-1 rounded-lg transition ${
                period === 'custom'
                  ? 'bg-[#176B52] text-white shadow-sm font-bold'
                  : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              Période
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1F2937] bg-white hover:bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl transition shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#176B52]" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#176B52] hover:bg-[#125541] rounded-xl shadow-sm transition active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer A4</span>
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div className="bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm flex flex-wrap items-center gap-3 no-print text-xs">
          <span className="font-bold text-[#1F2937]">Du :</span>
          <input
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            className="bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
          />
          <span className="font-bold text-[#1F2937]">Au :</span>
          <input
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
          />
          <button
            onClick={loadReport}
            className="px-4 py-1.5 bg-[#176B52] hover:bg-[#125541] text-white font-bold rounded-xl shadow-sm transition active:scale-95"
          >
            Générer
          </button>
        </div>
      )}

      {/* Printable Report Section */}
      <div className="print-area space-y-6">
        {/* Printable Header */}
        <div className="text-center pb-4 border-b border-[#E1E6E2]">
          <h2 className="text-xl font-extrabold text-[#176B52]">MS BAH PARFUM</h2>
          <p className="text-xs text-[#64748B]">Parfumerie, Cosmétique & Articles Divers • Marché Madina, Conakry • Tél : 626 96 39 82</p>
          <div className="mt-2 inline-block bg-[#EBF4F0] text-[#176B52] font-bold px-3 py-1 rounded-full text-xs border border-[#C2DDD3]">
            Rapport de synthèse ({period === 'today' ? "Aujourd'hui" : period === 'week' ? '7 derniers jours' : period === 'month' ? 'Ce mois' : period === 'year' ? 'Cette année' : `Du ${dateStart} au ${dateEnd}`})
          </div>
        </div>

        {/* Global Net Result Highlight Box */}
        <div className="bg-[#176B52] text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-white/80 block">
              Résultat Net Réel Estimé sur la Période
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 text-white">
              {formatGNF(report?.estimatedNetProfit)}
            </div>
            <p className="text-xs text-white/80 mt-1">
              (Bénéfice Ventes + Commissions Mobile Money - Dépenses d'exploitation)
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center border-t md:border-t-0 md:border-l border-white/20 pt-4 md:pt-0 md:pl-6 w-full md:w-auto">
            <div>
              <span className="text-[10px] text-white/80 block uppercase">Marge Ventes</span>
              <span className="text-sm font-bold text-white">+{formatGNF(report?.sales?.estimated_profit)}</span>
            </div>
            <div>
              <span className="text-[10px] text-white/80 block uppercase">Commissions OM/MoMo</span>
              <span className="text-sm font-bold text-white">+{formatGNF(report?.transfers?.totalCommissions)}</span>
            </div>
            <div>
              <span className="text-[10px] text-white/80 block uppercase">Dépenses</span>
              <span className="text-sm font-bold text-[#F6CEB4]">-{formatGNF(report?.expenses?.total)}</span>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Ventes & Encaissements */}
          <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm space-y-3">
            <h3 className="font-bold text-[#1F2937] text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#176B52]" />
              <span>Chiffre d'Affaires & Encaissements</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]/60">
                <span className="text-[#64748B]">Total Ventes Brutes :</span>
                <span className="font-bold text-[#1F2937]">{formatGNF(report?.sales?.total_subtotal)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]/60">
                <span className="text-[#64748B]">Remises Accordées :</span>
                <span className="font-semibold text-[#D97732] font-mono">-{formatGNF(report?.sales?.total_discounts)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#EBF4F0] border border-[#176B52]/20 rounded-xl font-bold">
                <span className="text-[#176B52]">Total Ventes Net :</span>
                <span className="text-[#176B52] font-black">{formatGNF(report?.sales?.total_revenue)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]/60">
                <span className="text-[#64748B]">Encaissements Espèces :</span>
                <span className="font-bold text-[#1F2937]">{formatGNF(report?.sales?.sales_cash)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]/60">
                <span className="text-[#64748B]">Encaissements Mobile Money :</span>
                <span className="font-bold text-[#1F2937]">{formatGNF((report?.sales?.sales_orange_money || 0) + (report?.sales?.sales_mtn_momo || 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]/60">
                <span className="text-[#64748B]">Ventes à Crédit :</span>
                <span className="font-bold text-[#1F2937]">{formatGNF(report?.sales?.sales_credit)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Dépenses par catégorie */}
          <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm space-y-3">
            <h3 className="font-bold text-[#1F2937] text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#176B52]" />
              <span>Dépenses d'Exploitation ({formatGNF(report?.expenses?.total)})</span>
            </h3>

            <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
              {report?.expenses?.breakdown?.map((exp: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]/60">
                  <span className="text-[#1F2937] font-medium">{exp.category}</span>
                  <span className="font-bold text-[#D97732]">-{formatGNF(exp.total_amount)}</span>
                </div>
              ))}

              {(!report?.expenses?.breakdown || report.expenses.breakdown.length === 0) && (
                <p className="text-center py-8 text-[#64748B] text-xs">Aucune dépense sur cette période.</p>
              )}
            </div>
          </div>

          {/* Card 3: Mobile Money Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm space-y-3">
            <h3 className="font-bold text-[#1F2937] text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#176B52]" />
              <span>Dépôts & Retraits Mobile Money</span>
            </h3>

            <div className="space-y-2 text-xs">
              {report?.transfers?.breakdown?.map((t: any, idx: number) => (
                <div key={idx} className="p-2.5 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]/60 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[#1F2937] capitalize">
                      {t.type === 'deposit' ? 'Dépôt' : 'Retrait'} {t.service === 'orange_money' ? 'OM' : 'MoMo'}
                    </span>
                    <span className="text-[10px] text-[#64748B] block">{t.count} opération(s) • Vol : {formatGNF(t.total_amount)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#176B52] block">+{formatGNF(t.total_commission)}</span>
                    <span className="text-[10px] text-[#64748B]">Commission</span>
                  </div>
                </div>
              ))}

              {(!report?.transfers?.breakdown || report.transfers.breakdown.length === 0) && (
                <p className="text-center py-8 text-[#64748B] text-xs">Aucune opération Mobile Money sur cette période.</p>
              )}
            </div>
          </div>
        </div>

        {/* Top 10 Best Selling Products on Period */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm space-y-4">
          <h3 className="font-bold text-[#1F2937] text-sm">
            Top 10 des Produits les Plus Vendus sur la Période
          </h3>

          <div className="overflow-x-auto border border-[#E1E6E2] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider text-[11px] font-bold border-b border-[#E1E6E2]">
                <tr>
                  <th className="p-3">Rang</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Désignation</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3 text-center">Unités Vendues</th>
                  <th className="p-3 text-right">Chiffre d'Affaires</th>
                  <th className="p-3 text-right">Bénéfice Réalisé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2]">
                {report?.topProducts?.map((p: any, idx: number) => (
                  <tr key={p.id} className="hover:bg-[#F4F6F3]/70 transition">
                    <td className="p-3 font-bold text-[#64748B]">#{idx + 1}</td>
                    <td className="p-3 font-mono text-[#64748B]">{p.code}</td>
                    <td className="p-3 font-bold text-[#1F2937]">{p.name}</td>
                    <td className="p-3 text-[#64748B]">{p.category_name}</td>
                    <td className="p-3 text-center font-bold text-[#1F2937]">{p.units_sold}</td>
                    <td className="p-3 text-right font-bold text-[#1F2937]">{formatGNF(p.total_revenue)}</td>
                    <td className="p-3 text-right font-bold text-[#176B52]">+{formatGNF(p.total_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
