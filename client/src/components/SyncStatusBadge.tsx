import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle, Database, Zap, X } from 'lucide-react';
import { syncManager, SyncState } from '../services/syncManager.js';
import { getApiBaseUrl, setApiBaseUrl } from '../services/api.js';

export const SyncStatusBadge: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>(syncManager.getState());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state) => {
      setSyncState(state);
    });
    setCustomUrl(localStorage.getItem('ms_bah_api_url') || '');
    return unsubscribe;
  }, []);

  const handleManualSync = async () => {
    await syncManager.syncNow();
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingUrl(true);
    setApiBaseUrl(customUrl);
    setTimeout(() => {
      setIsSavingUrl(false);
      syncManager.checkStatus();
    }, 400);
  };

  // Déterminer l'apparence du badge
  const renderBadge = () => {
    if (syncState.isSyncing) {
      return (
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#3B82F6]/30 bg-[#EFF6FF] text-[#1D4ED8] text-xs font-semibold shadow-sm transition active:scale-95"
          title="Synchronisation en cours avec Neon..."
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2563EB]" />
          <span className="hidden sm:inline">Synchro...</span>
        </button>
      );
    }

    if (!syncState.isOnline) {
      return (
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#D97732]/40 bg-[#FFF7ED] text-[#C2410C] text-xs font-semibold shadow-sm transition active:scale-95"
          title="Mode hors-ligne : les ventes sont sauvegardées localement"
        >
          <CloudOff className="w-3.5 h-3.5 text-[#D97732]" />
          <span className="hidden sm:inline">Hors-ligne</span>
          {syncState.pendingCount > 0 && (
            <span className="bg-[#D97732] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {syncState.pendingCount}
            </span>
          )}
        </button>
      );
    }

    // En ligne
    return (
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#176B52]/30 bg-[#EBF4F0] text-[#176B52] text-xs font-semibold shadow-sm transition active:scale-95"
        title="Connecté à Neon Database en ligne"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#176B52] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#176B52]" />
        </span>
        <Cloud className="w-3.5 h-3.5 text-[#176B52]" />
        <span className="hidden sm:inline">En ligne</span>
        {syncState.pendingCount > 0 && (
          <span className="bg-[#D97732] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full" title={`${syncState.pendingCount} opération(s) en attente de synchronisation`}>
            {syncState.pendingCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {renderBadge()}

      {/* Modal Détails & Forcer Synchronisation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E1E6E2] space-y-5 animate-scaleUp">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E1E6E2]">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${syncState.isOnline ? 'bg-[#EBF4F0] text-[#176B52]' : 'bg-[#FFF7ED] text-[#D97732]'}`}>
                  {syncState.isOnline ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-[#1F2937] text-base">État de Synchronisation</h3>
                  <p className="text-xs text-[#64748B]">MS BAH PARFUM • Données Centralisées</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F4F6F3] hover:text-[#1F2937] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Cards */}
            <div className="space-y-3">
              {/* Statut Réseau & Neon */}
              <div className="p-3.5 rounded-xl bg-[#F4F6F3] border border-[#E1E6E2] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#176B52]" />
                    Connexion
                  </span>
                  <span className={`font-bold flex items-center gap-1 ${syncState.isOnline ? 'text-[#176B52]' : 'text-[#D97732]'}`}>
                    {syncState.isOnline ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Connecté à Internet
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Mode Hors-Ligne (Local)
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-[#176B52]" />
                    Base de Données
                  </span>
                  <span className="font-semibold text-[#1F2937]">
                    {syncState.neonConnected ? 'PostgreSQL (Neon Cloud)' : 'SQLite Local'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#64748B] font-medium">Articles au catalogue</span>
                  <span className="font-bold text-[#176B52]">{syncState.productsCount} produits</span>
                </div>

                {syncState.latencyMs !== undefined && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748B] font-medium">Temps de réponse Cloud</span>
                    <span className="font-semibold text-[#64748B]">{syncState.latencyMs} ms</span>
                  </div>
                )}
              </div>

              {/* Opérations en attente */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                syncState.pendingCount > 0
                  ? 'bg-[#FFF7ED] border-[#D97732]/30 text-[#C2410C]'
                  : 'bg-[#EBF4F0] border-[#176B52]/20 text-[#176B52]'
              }`}>
                <div>
                  <p className="text-xs font-bold">
                    {syncState.pendingCount > 0
                      ? `${syncState.pendingCount} vente(s) / opération(s) en attente`
                      : 'Toutes les données sont synchronisées'}
                  </p>
                  <p className="text-[11px] opacity-80">
                    {syncState.pendingCount > 0
                      ? 'Ces opérations seront envoyées automatiquement dès que le réseau est stable.'
                      : 'Votre boutique est à jour avec le serveur.'}
                  </p>
                </div>
              </div>

              {/* Dernière synchro */}
              <div className="text-right text-[11px] text-[#64748B]">
                {syncState.lastSyncTime ? (
                  <span>Dernière synchro : {new Date(syncState.lastSyncTime).toLocaleTimeString('fr-FR')}</span>
                ) : (
                  <span>Synchronisation automatique active</span>
                )}
              </div>
            </div>

            {/* Bouton de Synchronisation Manuelle */}
            <div className="pt-2">
              <button
                onClick={handleManualSync}
                disabled={syncState.isSyncing}
                className="w-full py-2.5 px-4 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                {syncState.isSyncing ? 'Synchronisation en cours...' : 'Synchroniser maintenant'}
              </button>
            </div>

            {/* Configuration d'URL de serveur pour mobile Android */}
            <div className="pt-3 border-t border-[#E1E6E2]">
              <details className="text-xs text-[#64748B] cursor-pointer group">
                <summary className="font-semibold text-[#1F2937] hover:text-[#176B52] transition">
                  ⚙️ Adresse du serveur API (Mobile Android)
                </summary>
                <form onSubmit={handleSaveApiUrl} className="mt-2.5 space-y-2">
                  <input
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="ex: http://192.168.1.100:5050/api ou https://api.domaine.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#E1E6E2] focus:border-[#176B52] focus:ring-1 focus:ring-[#176B52] outline-hidden font-mono"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#64748B]">Actuel: {getApiBaseUrl()}</span>
                    <button
                      type="submit"
                      disabled={isSavingUrl}
                      className="px-3 py-1 bg-[#1F2937] text-white rounded-lg text-xs font-semibold hover:bg-black transition"
                    >
                      {isSavingUrl ? 'Enregistré...' : 'Appliquer'}
                    </button>
                  </div>
                </form>
              </details>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
