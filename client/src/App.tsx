import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { api } from './services/api.js';
import { CashSession } from './types.js';

import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';

import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { POSPage } from './pages/POSPage.js';
import { ProductsPage } from './pages/ProductsPage.js';
import { StockPage } from './pages/StockPage.js';
import { TransfersPage } from './pages/TransfersPage.js';
import { CashPage } from './pages/CashPage.js';
import { ClientsPage } from './pages/ClientsPage.js';
import { SuppliersPage } from './pages/SuppliersPage.js';
import { InventoryPage } from './pages/InventoryPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [alertsCount, setAlertsCount] = useState<number>(0);

  const fetchSessionAndAlerts = async () => {
    if (!isAuthenticated) return;
    try {
      const [session, alerts] = await Promise.all([
        api.getCurrentSession(),
        api.getAlerts()
      ]);
      setCurrentSession(session);
      setAlertsCount(alerts?.totalCount || 0);
    } catch (e) {
      // Ignore background refresh errors
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessionAndAlerts();
      const interval = setInterval(fetchSessionAndAlerts, 30000); // 30s background sync
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F6F3] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#176B52] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#F4F6F3] text-[#1F2937] flex selection:bg-[#176B52] selection:text-white">
      {/* Sidebar (Desktop fixed & Mobile drawer) */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
        alertsCount={alertsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <Navbar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          setIsOpenMobile={setIsOpenMobile}
          currentSession={currentSession}
          alertsCount={alertsCount}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <div key={currentTab} className="animate-fade-in-up">
            {currentTab === 'dashboard' && <DashboardPage onNavigate={setCurrentTab} />}
            {currentTab === 'pos' && <POSPage />}
            {currentTab === 'products' && <ProductsPage />}
            {currentTab === 'stock' && <StockPage />}
            {currentTab === 'transfers' && <TransfersPage />}
            {currentTab === 'cash' && <CashPage />}
            {currentTab === 'clients' && <ClientsPage />}
            {currentTab === 'suppliers' && <SuppliersPage />}
            {currentTab === 'inventory' && <InventoryPage />}
            {currentTab === 'reports' && <ReportsPage />}
            {currentTab === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <MainLayout />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
