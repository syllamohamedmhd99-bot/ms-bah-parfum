import React from 'react';
import { Menu, Bell, ShoppingBag, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { CashSession } from '../types.js';
import { formatGNF } from '../utils/formatters.js';
import { BoutiqueLogo } from './BoutiqueLogo.js';
import { SyncStatusBadge } from './SyncStatusBadge.js';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  setIsOpenMobile: (open: boolean) => void;
  currentSession: CashSession | null;
  alertsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  setIsOpenMobile,
  currentSession,
  alertsCount
}) => {
  const { user } = useAuth();

  const getPageTitle = (tab: string) => {
    switch (tab) {
      case 'dashboard': return 'Tableau de bord général';
      case 'pos': return 'Caisse & Point de Vente (POS)';
      case 'products': return 'Catalogue des Articles & Produits';
      case 'stock': return 'Entrées & Sorties de Marchandises';
      case 'transfers': return 'Services Mobile Money (Orange Money & MTN)';
      case 'cash': return 'Caisses, Clôtures & Mouvements Financiers';
      case 'clients': return 'Gestion des Clients & Crédits';
      case 'suppliers': return 'Gestion des Fournisseurs & Factures';
      case 'inventory': return 'Inventaire Physique & Alertes Stock';
      case 'reports': return 'Rapports & Statistiques Financières';
      case 'settings': return 'Paramètres, Utilisateurs & Sauvegardes';
      default: return 'MS BAH PARFUM';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E1E6E2] px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-sm">
      {/* Left: Mobile trigger & Page title / Logo on mobile */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsOpenMobile(true)}
          className="lg:hidden p-2 rounded-xl text-[#1F2937] hover:bg-[#F4F6F3] border border-[#E1E6E2] transition active:scale-95"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="lg:hidden flex items-center">
          <BoutiqueLogo size="sm" variant="icon" />
        </div>

        <div>
          <h2 className="text-base lg:text-lg font-bold text-[#1F2937] tracking-tight flex items-center gap-2">
            <span>{getPageTitle(currentTab)}</span>
          </h2>
          <p className="text-[11px] text-[#64748B] hidden sm:flex items-center gap-1.5 font-medium">
            <span className="font-semibold text-[#176B52]">MS BAH PARFUM</span>
            <span className="text-[#E1E6E2]">•</span>
            <span>Gestion Commerciale</span>
            <span className="text-[#E1E6E2]">•</span>
            <span className="font-semibold text-[#1F2937]">Synchronisé Cloud & Hors-ligne</span>
          </p>
        </div>
      </div>

      {/* Right: Sync Status + Cash Session Pill + Alerts + POS Shortcut */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Cloud Sync Status Badge */}
        <SyncStatusBadge />

        {/* Cash Session Status Pill */}
        <button
          onClick={() => setCurrentTab('cash')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
            currentSession
              ? 'bg-[#EBF4F0] text-[#176B52] border-[#176B52]/30 shadow-sm'
              : 'bg-[#F4F6F3] text-[#64748B] border-[#E1E6E2]'
          }`}
          title={currentSession ? "Session de caisse active" : "Aucune caisse ouverte"}
        >
          {currentSession ? (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#176B52] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#176B52]" />
            </span>
          ) : (
            <Wallet className="w-4 h-4 shrink-0 text-[#64748B]" />
          )}
          <div className="text-left hidden md:block leading-tight">
            <span className="block text-[9px] uppercase tracking-wider font-bold text-[#64748B]">
              {currentSession ? 'Caisse Active' : 'Caisse Fermée'}
            </span>
            <span className="font-bold text-xs text-[#1F2937]">
              {currentSession ? formatGNF(currentSession.theoretical_balance) : 'Ouvrir'}
            </span>
          </div>
        </button>

        {/* Alerts Button */}
        <button
          onClick={() => setCurrentTab('inventory')}
          className="relative p-2.5 rounded-xl text-[#1F2937] hover:bg-[#F4F6F3] border border-[#E1E6E2] transition-all group"
          title="Consulter les alertes stock et dettes"
        >
          <Bell className="w-4 h-4 text-[#1F2937] group-hover:rotate-12 transition-transform duration-200" />
          {alertsCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#D97732] text-[10px] font-black text-white shadow-sm ring-2 ring-white">
              {alertsCount > 9 ? '9+' : alertsCount}
            </span>
          )}
        </button>

        {/* POS Shortcut (for cashiers, managers, admin) */}
        {user?.role !== 'stock_manager' && (
          <button
            onClick={() => setCurrentTab('pos')}
            className="flex items-center gap-2 bg-[#176B52] hover:bg-[#125541] text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-sm transition-all active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Nouvelle Vente</span>
          </button>
        )}
      </div>
    </header>
  );
};
