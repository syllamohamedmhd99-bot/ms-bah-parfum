import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ArrowLeftRight,
  Smartphone,
  Wallet,
  Users,
  Building2,
  ClipboardCheck,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { getRoleBadge } from '../utils/formatters.js';
import { BoutiqueLogo } from './BoutiqueLogo.js';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
  alertsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  setCurrentTab,
  isOpenMobile,
  setIsOpenMobile,
  alertsCount
}) => {
  const { user, logout, hasRole } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin', 'manager', 'cashier', 'stock_manager'] },
    { id: 'pos', label: 'Caisse & Point de Vente', icon: ShoppingCart, roles: ['admin', 'manager', 'cashier'] },
    { id: 'products', label: 'Catalogue Produits', icon: Package, roles: ['admin', 'manager', 'cashier', 'stock_manager'] },
    { id: 'stock', label: 'Entrées / Sorties Stock', icon: ArrowLeftRight, roles: ['admin', 'manager', 'stock_manager'] },
    { id: 'transfers', label: 'Orange Money & MoMo', icon: Smartphone, roles: ['admin', 'manager', 'cashier'] },
    { id: 'cash', label: 'Caisses & Dépenses', icon: Wallet, roles: ['admin', 'manager', 'cashier'] },
    { id: 'clients', label: 'Clients & Crédits', icon: Users, roles: ['admin', 'manager', 'cashier'] },
    { id: 'suppliers', label: 'Fournisseurs & Achats', icon: Building2, roles: ['admin', 'manager', 'stock_manager'] },
    { id: 'inventory', label: 'Inventaire & Alertes', icon: ClipboardCheck, roles: ['admin', 'manager', 'stock_manager'], badge: alertsCount > 0 ? alertsCount : null },
    { id: 'reports', label: 'Rapports Financiers', icon: BarChart3, roles: ['admin', 'manager'] },
    { id: 'settings', label: 'Paramètres & Sécurité', icon: Settings, roles: ['admin', 'manager'] },
  ];

  const filteredNavItems = navItems.filter(item => hasRole(item.roles as any));
  const roleBadge = user ? getRoleBadge(user.role) : null;

  return (
    <>
      {/* Mobile overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-[#121212] text-white flex flex-col transition-transform duration-300 ease-in-out border-r border-white/10 shadow-2xl ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Boutique Brand Header */}
        <div className="p-4 border-b border-white/10 bg-black/40">
          <BoutiqueLogo size="md" variant="full" isInSidebar={true} />
        </div>

        {/* User Card */}
        {user && (
          <div className="px-4 py-3 border-b border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#176B52] text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm border border-white/15">
                {user.fullName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate tracking-tight">{user.fullName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-white/90 border border-white/15 font-semibold">
                    {roleBadge?.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentTab(item.id);
                  setIsOpenMobile(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-[#176B52] text-white shadow-md font-bold translate-x-1'
                    : 'text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-0.5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-1.5 rounded-lg transition-colors ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80 group-hover:bg-white/20 group-hover:text-white'
                  }`}>
                    <Icon className="w-4 h-4 shrink-0" />
                  </div>
                  <span className="truncate tracking-tight">{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge !== undefined && item.badge !== null && (
                    <span className="bg-[#D97732] text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm">
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white" />}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-[11px] text-white/80 bg-white/[0.05] px-3 py-2 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#176B52] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#176B52]" />
              </span>
              <span className="text-white font-bold text-[10px]">Boutique Ouverte</span>
            </div>
            <span className="font-mono text-[10px] text-white/70">100% Hors Ligne</span>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white border border-white/15 transition active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
};
