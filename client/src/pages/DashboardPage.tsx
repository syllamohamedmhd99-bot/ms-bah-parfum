import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Package,
  AlertOctagon,
  AlertTriangle,
  Wallet,
  Smartphone,
  CreditCard,
  ShoppingBag,
  PlusCircle,
  Eye,
  RefreshCw,
  Coins,
  Receipt,
  ArrowLeftRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';
import { api } from '../services/api.js';
import { formatGNF, formatDateTime, formatDate } from '../utils/formatters.js';

interface DashboardPageProps {
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboard();
      setData(res);
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#176B52] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#64748B]">Chargement des données en temps réel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#1F2937] tracking-tight">
              Vue d'ensemble de la boutique
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#EBF4F0] border border-[#176B52]/20 text-[#176B52] rounded-full text-[11px] font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#176B52] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#176B52]"></span>
              </span>
              <span>En direct</span>
            </div>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Indicateurs financiers, valorisation des stocks et flux Mobile Money en temps réel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1F2937] hover:bg-[#F4F6F3] bg-white border border-[#E1E6E2] rounded-xl transition active:scale-95 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Actualiser</span>
          </button>

          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#176B52] hover:bg-[#125541] rounded-xl shadow-sm transition active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Vente Caisse (POS)</span>
          </button>
        </div>
      </div>

      {/* Boutique Quick Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
        <button
          onClick={() => onNavigate('pos')}
          className="p-3 rounded-2xl bg-[#176B52] hover:bg-[#125541] text-white shadow-sm transition-all flex items-center gap-3 text-left group active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-tight leading-tight">Vente Caisse</p>
            <p className="text-[10px] text-white/80 truncate mt-0.5">Encaisser un client</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('transfers')}
          className="p-3 rounded-2xl bg-white hover:bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2] shadow-sm transition-all flex items-center gap-3 text-left group active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-[#EBF4F0] text-[#176B52] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-tight leading-tight">Mobile Money</p>
            <p className="text-[10px] text-[#64748B] truncate mt-0.5">Dépôts & Retraits</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('stock')}
          className="p-3 rounded-2xl bg-white hover:bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2] shadow-sm transition-all flex items-center gap-3 text-left group active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-[#EBF4F0] text-[#176B52] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-tight leading-tight">Entrées Stock</p>
            <p className="text-[10px] text-[#64748B] truncate mt-0.5">Nouvelle marchandise</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('products')}
          className="p-3 rounded-2xl bg-white hover:bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2] shadow-sm transition-all flex items-center gap-3 text-left group active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-[#EBF4F0] text-[#176B52] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-tight leading-tight">Ajouter Article</p>
            <p className="text-[10px] text-[#64748B] truncate mt-0.5">Nouveau produit</p>
          </div>
        </button>
      </div>

      {/* Primary KPI Grid (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Ventes du Jour */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Chiffre d'Affaires (Jour)
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EBF4F0] text-[#176B52] border border-[#176B52]/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#1F2937] tracking-tight">
              {formatGNF(data?.sales?.today)}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-[#64748B]">
              <span className="font-semibold text-[#1F2937]">{data?.sales?.todayCount} vente(s)</span>
              <span>•</span>
              <span>Semaine: <strong className="text-[#1F2937]">{formatGNF(data?.sales?.week)}</strong></span>
            </div>
          </div>
        </div>

        {/* Card 2: Bénéfice Estimé */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Bénéfice Ventes (Jour)
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EBF4F0] text-[#176B52] border border-[#176B52]/20 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#176B52] tracking-tight">
              +{formatGNF(data?.profits?.today)}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-[#64748B]">
              <span>Mois: <strong className="text-[#1F2937]">+{formatGNF(data?.profits?.month)}</strong></span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Liquidités Caisses & Wallets */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Liquidités Disponibles
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EBF4F0] text-[#176B52] border border-[#176B52]/20 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#1F2937] tracking-tight">
              {formatGNF(data?.cash?.totalAvailable)}
            </div>
            <div className="text-xs text-[#64748B] mt-1.5">
              Réparti sur {data?.cash?.registers?.length || 0} comptes & portefeuilles
            </div>
          </div>
        </div>

        {/* Card 4: Mobile Money Aujourd'hui */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Mobile Money (Jour)
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#EBF4F0] text-[#176B52] border border-[#176B52]/20 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#176B52] tracking-tight">
              +{formatGNF(data?.transfers?.todayCommissions)}
            </div>
            <div className="text-xs text-[#64748B] mt-1.5">
              Commissions nettes sur {data?.transfers?.todayCount || 0} opération(s)
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Row: Stock Values & Balances per Register */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Valuation Card */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1F2937] text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-[#176B52]" />
              <span>Valeur & État du Stock</span>
            </h3>
            <button
              onClick={() => onNavigate('products')}
              className="text-xs text-[#176B52] hover:text-[#125541] font-semibold flex items-center gap-0.5"
            >
              <span>Voir tout</span>
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]">
              <span className="text-xs text-[#64748B]">Valeur au coût d'achat:</span>
              <span className="text-sm font-bold text-[#1F2937]">{formatGNF(data?.stock?.totalPurchaseValue)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]">
              <span className="text-xs text-[#64748B]">Valeur au prix de vente:</span>
              <span className="text-sm font-bold text-[#1F2937]">{formatGNF(data?.stock?.totalSaleValue)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]">
              <span className="text-xs text-[#64748B]">Total articles référencés:</span>
              <span className="text-sm font-bold text-[#1F2937]">{data?.stock?.totalProducts} articles</span>
            </div>

            {/* Alert counters (Orange #D97732) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div
                onClick={() => onNavigate('inventory')}
                className="cursor-pointer p-2.5 rounded-xl border border-[#F6CEB4] bg-[#FDF3EB] flex items-center gap-2 hover:bg-[#FCEADE] transition active:scale-95"
              >
                <AlertOctagon className="w-4 h-4 text-[#D97732] shrink-0" />
                <div>
                  <div className="text-base font-extrabold text-[#D97732]">{data?.stock?.outOfStockCount}</div>
                  <div className="text-[10px] text-[#D97732] uppercase font-bold">Ruptures</div>
                </div>
              </div>

              <div
                onClick={() => onNavigate('inventory')}
                className="cursor-pointer p-2.5 rounded-xl border border-[#F6CEB4] bg-[#FDF3EB] flex items-center gap-2 hover:bg-[#FCEADE] transition active:scale-95"
              >
                <AlertTriangle className="w-4 h-4 text-[#D97732] shrink-0" />
                <div>
                  <div className="text-base font-extrabold text-[#D97732]">{data?.stock?.lowStockCount}</div>
                  <div className="text-[10px] text-[#D97732] uppercase font-bold">Stock faible</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Register Balances */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1F2937] text-sm flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#176B52]" />
              <span>Soldes des Caisses & Comptes</span>
            </h3>
            <button
              onClick={() => onNavigate('cash')}
              className="text-xs text-[#176B52] hover:text-[#125541] font-semibold flex items-center gap-0.5"
            >
              <span>Gérer</span>
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {data?.cash?.registers?.map((reg: any) => (
              <div key={reg.id} className="p-3 bg-[#F4F6F3] rounded-xl flex items-center justify-between border border-[#E1E6E2]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#EBF4F0] text-[#176B52] font-bold">
                    {reg.type === 'orange_money' || reg.type === 'mtn_momo' ? (
                      <Smartphone className="w-4 h-4" />
                    ) : (
                      <Wallet className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1F2937]">{reg.name}</div>
                    <div className="text-[10px] text-[#64748B]">{reg.phone_number || 'Caisse physique'}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-[#1F2937]">{formatGNF(reg.balance)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dépenses & Crédits Clients */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#1F2937] text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#176B52]" />
                <span>Dépenses & Dettes Clients</span>
              </h3>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl">
                <div className="text-xs text-[#64748B] font-medium">Dépenses du jour:</div>
                <div className="text-lg font-bold text-[#1F2937] mt-0.5">
                  -{formatGNF(data?.expenses?.today)}
                </div>
              </div>

              <div className="p-3.5 bg-[#FDF3EB] border border-[#F6CEB4] rounded-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs text-[#D97732] font-semibold">Crédits Clients en attente:</div>
                    <div className="text-lg font-extrabold text-[#D97732] mt-0.5">
                      {formatGNF(data?.clientCredit?.totalDebt)}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold bg-[#D97732] text-white px-2 py-0.5 rounded-full shadow-sm">
                    {data?.clientCredit?.indebtedClientsCount} client(s)
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl">
                <div className="text-xs text-[#64748B] font-medium">Total Achats de Marchandises:</div>
                <div className="text-base font-bold text-[#1F2937] mt-0.5">
                  {formatGNF(data?.purchases?.total)}
                </div>
                <div className="text-[11px] text-[#64748B] mt-0.5">
                  Dettes fournisseurs: <strong className="text-[#D97732] font-bold">{formatGNF(data?.purchases?.remainingDebt)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart: Évolution des Ventes & Bénéfices */}
      <div className="bg-white p-6 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="font-bold text-[#1F2937] text-sm sm:text-base">
              Évolution des Ventes et Bénéfices (14 Derniers Jours)
            </h3>
            <p className="text-xs text-[#64748B]">Visualisation quotidienne en Francs Guinéens (GNF)</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-[#176B52]">
              <span className="w-3 h-3 rounded-full bg-[#176B52] inline-block" /> Ventes (GNF)
            </span>
            <span className="flex items-center gap-1.5 text-[#64748B]">
              <span className="w-3 h-3 rounded-full bg-[#64748B] inline-block" /> Bénéfice (GNF)
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.charts?.dailyTrends || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#176B52" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#176B52" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748B" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#64748B" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickFormatter={(val) => formatDate(val).slice(0, 5)} stroke="#64748B" fontSize={11} />
              <YAxis tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} stroke="#64748B" fontSize={11} />
              <Tooltip
                formatter={(val: any) => [formatGNF(Number(val)), '']}
                labelFormatter={(lbl) => `Date: ${formatDate(String(lbl))}`}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E1E6E2',
                  borderRadius: '12px',
                  color: '#1F2937',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
              />
              <Area type="monotone" dataKey="ventes" name="Ventes" stroke="#176B52" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
              <Area type="monotone" dataKey="benefices" name="Bénéfice estimé" stroke="#64748B" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Grid: Top Selling Products & Recent Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Products */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1F2937] text-sm">Top Produits les Plus Vendus</h3>
            <span className="text-xs text-[#64748B]">Par volume d'unités</span>
          </div>

          <div className="divide-y divide-[#E1E6E2]">
            {data?.charts?.topProducts?.map((p: any, idx: number) => (
              <div key={p.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-[#EBF4F0] text-[#176B52] font-bold text-xs flex items-center justify-center">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="text-xs font-bold text-[#1F2937]">{p.name}</div>
                    <div className="text-[10px] text-[#64748B]">{p.category || 'Article'} • Réf: {p.code}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-[#1F2937]">{p.total_qty} vendus</div>
                  <div className="text-[11px] text-[#176B52] font-bold">{formatGNF(p.total_revenue)}</div>
                </div>
              </div>
            ))}

            {(!data?.charts?.topProducts || data.charts.topProducts.length === 0) && (
              <p className="text-center py-6 text-xs text-[#64748B]">Aucune vente enregistrée pour le moment.</p>
            )}
          </div>
        </div>

        {/* Recent Operations Activity Feed */}
        <div className="bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#1F2937] text-sm">Dernières Opérations Enregistrées</h3>
            <span className="text-xs text-[#64748B]">Flux temps réel</span>
          </div>

          <div className="space-y-3">
            {data?.recentOperations?.sales?.slice(0, 3).map((sale: any) => (
              <div key={sale.id} className="p-3 bg-[#F4F6F3] rounded-xl flex items-center justify-between border border-[#E1E6E2] text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EBF4F0] text-[#176B52] flex items-center justify-center font-bold">
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-[#1F2937]">Vente {sale.reference}</span>
                    <span className="block text-[10px] text-[#64748B]">{formatDateTime(sale.date)} • Par {sale.user_name}</span>
                  </div>
                </div>
                <div className="font-bold text-[#176B52]">
                  +{formatGNF(sale.amount)}
                </div>
              </div>
            ))}

            {data?.recentOperations?.transfers?.slice(0, 2).map((trf: any) => (
              <div key={trf.id} className="p-3 bg-[#F4F6F3] rounded-xl flex items-center justify-between border border-[#E1E6E2] text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#EBF4F0] text-[#176B52] flex items-center justify-center font-bold">
                    <Smartphone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-[#1F2937]">{trf.type}</span>
                    <span className="block text-[10px] text-[#64748B]">{formatDateTime(trf.date)} • Réf: {trf.reference}</span>
                  </div>
                </div>
                <div className="font-bold text-[#1F2937]">
                  {formatGNF(trf.amount)}
                </div>
              </div>
            ))}

            {data?.recentOperations?.expenses?.slice(0, 2).map((exp: any) => (
              <div key={exp.id} className="p-3 bg-[#F4F6F3] rounded-xl flex items-center justify-between border border-[#E1E6E2] text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#FDF3EB] text-[#D97732] flex items-center justify-center font-bold">
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-[#1F2937]">Dépense: {exp.type}</span>
                    <span className="block text-[10px] text-[#64748B]">{formatDateTime(exp.date)}</span>
                  </div>
                </div>
                <div className="font-bold text-[#D97732]">
                  -{formatGNF(exp.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
