import React, { useState } from 'react';
import { Lock, User, ArrowRight, ShieldCheck, CheckCircle2, Sparkles, Store, Smartphone, Settings, Globe, Wifi, X, Check } from 'lucide-react';
import { api, getApiBaseUrl, setApiBaseUrl } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { BoutiqueLogo } from '../components/BoutiqueLogo.js';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(getApiBaseUrl());
  const { login } = useAuth();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Veuillez saisir votre identifiant et votre mot de passe.');
      return;
    }

    try {
      setLoading(true);
      const data = await api.login({ username, password });
      login(data.token, data.user);
      toast.success(`Bienvenue chez MS BAH PARFUM, ${data.user.fullName} !`);
    } catch (err: any) {
      console.warn('Erreur connexion réseau au serveur:', err);

      // Authentification de secours Hors-Ligne (si le serveur réseau n'est pas joignable)
      const offlineAccounts: Record<string, { pass: string; user: any }> = {
        admin: {
          pass: 'admin123',
          user: { id: 1, username: 'admin', fullName: 'Elhadj Seydou Diallo', role: 'admin' }
        },
        gerant: {
          pass: 'gerant123',
          user: { id: 2, username: 'gerant', fullName: 'Mamadou Alpha Barry', role: 'manager' }
        },
        caissier: {
          pass: 'caissier123',
          user: { id: 3, username: 'caissier', fullName: 'Fatoumata Binta Camara', role: 'cashier' }
        },
        stock: {
          pass: 'stock123',
          user: { id: 4, username: 'stock', fullName: 'Ibrahima Sory Soumah', role: 'stock_manager' }
        }
      };

      const account = offlineAccounts[username.trim().toLowerCase()];
      if (account && account.pass === password) {
        const offlineToken = `offline_token_${Date.now()}_${account.user.id}`;
        login(offlineToken, account.user);
        toast.info(`Mode Hors-Ligne activé : Bienvenue, ${account.user.fullName} !`);
        return;
      }

      toast.error(err.message || 'Identifiants invalides.');
    } finally {
      setLoading(false);
    }
  };

  const setQuickUser = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  const handleSaveServerUrl = () => {
    setApiBaseUrl(serverUrlInput);
    setShowServerModal(false);
    toast.success('Adresse du serveur enregistrée avec succès !');
  };

  return (
    <div className="min-h-screen bg-[#F4F6F3] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      <div className="relative w-full max-w-lg bg-white border border-[#E1E6E2] rounded-3xl p-6 sm:p-9 shadow-xl text-[#1F2937] animate-scale-in">
        {/* Brand Showcase Header */}
        <div className="mb-7">
          <BoutiqueLogo size="xl" variant="vertical" />

          {/* Boutique highlight feature tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2.5 py-1 rounded-lg bg-[#F4F6F3] border border-[#E1E6E2] text-[#1F2937]">
              <Store className="w-3.5 h-3.5 text-[#176B52]" />
              <span>Parfumerie & Cosmétique</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2.5 py-1 rounded-lg bg-[#F4F6F3] border border-[#E1E6E2] text-[#1F2937]">
              <Smartphone className="w-3.5 h-3.5 text-[#176B52]" />
              <span>Dépôt & Retrait</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2.5 py-1 rounded-lg bg-[#F4F6F3] border border-[#E1E6E2] text-[#1F2937]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#176B52]" />
              <span>100% Hors Ligne (GNF)</span>
            </span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1.5 tracking-tight">
              Nom d'utilisateur / Compte
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: admin, gerant, caissier, stock"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52] transition"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1.5 tracking-tight">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52] transition"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#176B52] hover:bg-[#125541] text-white font-bold py-3 px-4 rounded-xl shadow-md transition active:scale-[0.98] disabled:opacity-50 text-sm tracking-wide mt-2"
          >
            {loading ? (
              <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <span>Accéder à MS BAH PARFUM</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Fast Role Selection Buttons */}
        <div className="mt-6 pt-5 border-t border-[#E1E6E2]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] mb-2.5 text-center flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#176B52]" />
            <span>Sélection rapide de compte</span>
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setQuickUser('admin', 'admin123')}
              className={`p-2.5 rounded-xl text-left border transition-all ${
                username === 'admin'
                  ? 'bg-[#EBF4F0] border-[#176B52] text-[#176B52] shadow-sm font-bold'
                  : 'bg-[#F4F6F3] border-[#E1E6E2] text-[#64748B] hover:bg-white hover:text-[#1F2937]'
              }`}
            >
              <div className="font-bold flex items-center justify-between text-xs">
                <span>Administrateur</span>
                {username === 'admin' && <CheckCircle2 className="w-3.5 h-3.5 text-[#176B52]" />}
              </div>
              <div className="text-[10px] text-[#64748B] mt-0.5">Accès total boutique</div>
            </button>

            <button
              type="button"
              onClick={() => setQuickUser('gerant', 'gerant123')}
              className={`p-2.5 rounded-xl text-left border transition-all ${
                username === 'gerant'
                  ? 'bg-[#EBF4F0] border-[#176B52] text-[#176B52] shadow-sm font-bold'
                  : 'bg-[#F4F6F3] border-[#E1E6E2] text-[#64748B] hover:bg-white hover:text-[#1F2937]'
              }`}
            >
              <div className="font-bold flex items-center justify-between text-xs">
                <span>Gérant</span>
                {username === 'gerant' && <CheckCircle2 className="w-3.5 h-3.5 text-[#176B52]" />}
              </div>
              <div className="text-[10px] text-[#64748B] mt-0.5">Ventes & Caisses</div>
            </button>

            <button
              type="button"
              onClick={() => setQuickUser('caissier', 'caissier123')}
              className={`p-2.5 rounded-xl text-left border transition-all ${
                username === 'caissier'
                  ? 'bg-[#EBF4F0] border-[#176B52] text-[#176B52] shadow-sm font-bold'
                  : 'bg-[#F4F6F3] border-[#E1E6E2] text-[#64748B] hover:bg-white hover:text-[#1F2937]'
              }`}
            >
              <div className="font-bold flex items-center justify-between text-xs">
                <span>Caissier(ère)</span>
                {username === 'caissier' && <CheckCircle2 className="w-3.5 h-3.5 text-[#176B52]" />}
              </div>
              <div className="text-[10px] text-[#64748B] mt-0.5">Point de vente POS</div>
            </button>

            <button
              type="button"
              onClick={() => setQuickUser('stock', 'stock123')}
              className={`p-2.5 rounded-xl text-left border transition-all ${
                username === 'stock'
                  ? 'bg-[#EBF4F0] border-[#176B52] text-[#176B52] shadow-sm font-bold'
                  : 'bg-[#F4F6F3] border-[#E1E6E2] text-[#64748B] hover:bg-white hover:text-[#1F2937]'
              }`}
            >
              <div className="font-bold flex items-center justify-between text-xs">
                <span>Gestionnaire Stock</span>
                {username === 'stock' && <CheckCircle2 className="w-3.5 h-3.5 text-[#176B52]" />}
              </div>
              <div className="text-[10px] text-[#64748B] mt-0.5">Marchandises & Entrées</div>
            </button>
          </div>

          {/* Bouton de configuration du serveur */}
          <div className="mt-4 pt-3 border-t border-[#E1E6E2] flex items-center justify-between text-xs">
            <span className="text-[#64748B] text-[11px] truncate max-w-[200px]" title={getApiBaseUrl()}>
              Serveur : <span className="font-mono text-[#176B52] font-semibold">{getApiBaseUrl()}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setServerUrlInput(getApiBaseUrl());
                setShowServerModal(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#176B52] hover:underline"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Changer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de configuration du serveur */}
      {showServerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-[#E1E6E2] space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-[#E1E6E2] pb-3">
              <div className="flex items-center gap-2 text-[#176B52] font-black">
                <Globe className="w-5 h-5" />
                <span className="text-base">Adresse du Serveur API</span>
              </div>
              <button
                onClick={() => setShowServerModal(false)}
                className="text-[#64748B] hover:text-[#1F2937] p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              Pour connecter votre smartphone au serveur de caisse, sélectionnez une option ou entrez l'adresse :
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setServerUrlInput('http://172.20.10.2:5050/api')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E1E6E2] bg-[#F4F6F3] hover:bg-[#EBF4F0] hover:border-[#176B52] text-left transition"
              >
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-[#176B52]" />
                  <div>
                    <div className="text-xs font-bold text-[#1F2937]">Mon PC en Wi-Fi direct</div>
                    <div className="text-[11px] text-[#64748B] font-mono">http://172.20.10.2:5050/api</div>
                  </div>
                </div>
                {serverUrlInput === 'http://172.20.10.2:5050/api' && <Check className="w-4 h-4 text-[#176B52]" />}
              </button>

              <button
                type="button"
                onClick={() => setServerUrlInput('https://ms-bah-parfum-production.up.railway.app/api')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-[#E1E6E2] bg-[#F4F6F3] hover:bg-[#EBF4F0] hover:border-[#176B52] text-left transition"
              >
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-[#176B52]" />
                  <div>
                    <div className="text-xs font-bold text-[#1F2937]">Railway Cloud (En Ligne 24/7)</div>
                    <div className="text-[11px] text-[#64748B] font-mono">https://...up.railway.app/api</div>
                  </div>
                </div>
                {serverUrlInput.includes('railway') && <Check className="w-4 h-4 text-[#176B52]" />}
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1F2937] mb-1">
                Adresse URL personnalisée :
              </label>
              <input
                type="text"
                value={serverUrlInput}
                onChange={(e) => setServerUrlInput(e.target.value)}
                placeholder="http://192.168.x.x:5050/api ou https://..."
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3.5 py-2 text-xs font-mono text-[#1F2937] focus:ring-2 focus:ring-[#176B52] focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="flex-1 px-4 py-2 text-xs font-bold text-[#64748B] bg-[#F4F6F3] rounded-xl hover:bg-[#E1E6E2]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveServerUrl}
                className="flex-1 px-4 py-2 text-xs font-bold text-white bg-[#176B52] rounded-xl hover:bg-[#0f4e3b] shadow-sm transition active:scale-95"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
