import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Shield,
  ShieldAlert,
  Download,
  RotateCcw,
  Trash2,
  Plus,
  CheckCircle,
  FileText,
  AlertTriangle,
  Lock,
  UserCheck,
  Sparkles,
  Tag,
  HardDrive,
  FolderOpen,
  Upload,
  Database
} from 'lucide-react';
import { api } from '../services/api.js';
import { User, AuditLog } from '../types.js';
import { formatDateTime, getRoleBadge } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Modal } from '../components/Modal.js';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit' | 'backup'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  // User Create / Edit Modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    fullName: '',
    role: 'cashier',
    phone: '',
    password: ''
  });

  // Danger Zone Confirmation Modals
  const [resetDemoModalOpen, setResetDemoModalOpen] = useState(false);
  const [resetDemoConfirmation, setResetDemoConfirmation] = useState('');

  const [cleanProdModalOpen, setCleanProdModalOpen] = useState(false);
  const [cleanProdConfirmation, setCleanProdConfirmation] = useState('');

  const [cleanEverythingModalOpen, setCleanEverythingModalOpen] = useState(false);
  const [cleanEverythingConfirmation, setCleanEverythingConfirmation] = useState('');
  const [keepCategoriesInClean, setKeepCategoriesInClean] = useState(false);
  const [dbInfo, setDbInfo] = useState<any>(null);

  const toast = useToast();
  const { user: currentUser, hasRole } = useAuth();

  const loadData = async () => {
    try {
      setLoading(true);
      if (hasRole(['admin'])) {
        const uList = await api.getUsers();
        setUsers(uList);
      }
      const logs = await api.getAuditLogs({ limit: 80 });
      setAuditLogs(logs);

      try {
        const info = await api.getBackupInfo();
        setDbInfo(info);
      } catch {
        // Non-bloquant
      }
    } catch (err: any) {
      toast.error('Erreur chargement paramètres.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateUserModal = () => {
    setEditingUser(null);
    setUserForm({
      username: '',
      fullName: '',
      role: 'cashier',
      phone: '',
      password: ''
    });
    setUserModalOpen(true);
  };

  const openEditUserModal = (u: User) => {
    setEditingUser(u);
    setUserForm({
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      phone: u.phone || '',
      password: '' // Leave empty if not changing
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.fullName || !userForm.role) {
      toast.error('Nom et rôle obligatoires.');
      return;
    }

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, userForm);
        toast.success(`Utilisateur ${editingUser.username} mis à jour.`);
      } else {
        if (!userForm.username || !userForm.password) {
          toast.error('Identifiant et mot de passe obligatoires pour un nouvel utilisateur.');
          return;
        }
        await api.createUser(userForm);
        toast.success(`Utilisateur ${userForm.username} créé avec succès.`);
      }

      setUserModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur enregistrement utilisateur.');
    }
  };

  const handleDownloadBackup = () => {
    window.open('/api/backup/download', '_blank');
  };

  const handleResetDemo = async () => {
    if (resetDemoConfirmation !== 'REINITIALISER_DEMO') {
      toast.error('Saisissez exactement REINITIALISER_DEMO.');
      return;
    }

    try {
      await api.resetDemoData('REINITIALISER_DEMO');
      toast.success('Données de démonstration réinitialisées avec succès.');
      setResetDemoModalOpen(false);
      setResetDemoConfirmation('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur réinitialisation.');
    }
  };

  const handleCleanForProduction = async () => {
    if (cleanProdConfirmation !== 'PASSER_EN_PRODUCTION') {
      toast.error('Saisissez exactement PASSER_EN_PRODUCTION.');
      return;
    }

    try {
      await api.cleanForProduction('PASSER_EN_PRODUCTION');
      toast.success('Base de données purgée des transactions de test. Prête pour la production !');
      setCleanProdModalOpen(false);
      setCleanProdConfirmation('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur passage en production.');
    }
  };

  const handleCleanEverything = async () => {
    if (cleanEverythingConfirmation !== 'VIDER_TOUT') {
      toast.error('Saisissez exactement VIDER_TOUT.');
      return;
    }

    try {
      await api.cleanEverything('VIDER_TOUT', keepCategoriesInClean);
      toast.success('Toutes les données prédéfinies ont été purgées avec succès ! Base propre.');
      setCleanEverythingModalOpen(false);
      setCleanEverythingConfirmation('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression de toutes les données prédéfinies.');
    }
  };

  const handleUsbBackup = async () => {
    try {
      if (window.electronAPI?.selectBackupDirectory) {
        const folder = await window.electronAPI.selectBackupDirectory();
        if (!folder) return;
        const res = await api.backupToPath(folder);
        toast.success(res.message || 'Sauvegarde effectuée avec succès !');
        const info = await api.getBackupInfo();
        setDbInfo(info);
      } else {
        handleDownloadBackup();
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde sur support externe.');
    }
  };

  const handleRestoreFile = async () => {
    try {
      if (window.electronAPI?.selectRestoreFile) {
        const file = await window.electronAPI.selectRestoreFile();
        if (!file) return;
        if (!window.confirm(`ATTENTION : Confirmez-vous le remplacement de la base actuelle par "${file}" ? L'application va redémarrer.`)) return;
        await api.restoreFromPath(file, 'RESTAURER_BASE');
        toast.success('Base de données restaurée avec succès ! Redémarrage en cours...');
      } else {
        toast.info("La restauration directe requiert l'application Desktop Windows.");
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la restauration.');
    }
  };

  const handleOpenDataFolder = async () => {
    try {
      if (window.electronAPI?.openUserDataFolder) {
        await window.electronAPI.openUserDataFolder();
      } else {
        toast.info("Disponible dans l'application Desktop Windows.");
      }
    } catch {
      toast.error("Impossible d'ouvrir le dossier de données.");
    }
  };

  const handleLoadDefaultCategories = async () => {
    try {
      const res = await api.loadDefaultCategories();
      toast.success(res.message || '11 catégories cosmétiques standard chargées avec succès !');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur chargement catégories.');
    }
  };

  const handleDeleteAuditLog = async (id: number) => {
    if (!window.confirm("Supprimer définitivement cette ligne du journal d'audit ?")) {
      return;
    }
    try {
      await api.deleteAuditLog(id);
      toast.success("Ligne d'audit supprimée.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression.');
    }
  };

  const handleClearAuditLogs = async () => {
    if (!window.confirm("Êtes-vous certain de vouloir vider TOUT le journal d'audit ? Cette action est irréversible.")) {
      return;
    }
    try {
      await api.clearAuditLogs();
      toast.success("Journal d'audit vidé avec succès.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du vidage du journal.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#176B52]" />
            <span>Paramètres, Sécurité & Sauvegardes</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Gestion des accès par rôles, journal d'audit immuable et sauvegarde de la base de données.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex rounded-xl bg-[#F4F6F3] p-1 text-xs font-semibold border border-[#E1E6E2]">
          {hasRole(['admin']) && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'users' ? 'bg-[#176B52] text-white shadow-sm font-bold' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              Utilisateurs & Rôles
            </button>
          )}

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'audit' ? 'bg-[#176B52] text-white shadow-sm font-bold' : 'text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            Journal d'Audit ({auditLogs.length})
          </button>

          {hasRole(['admin']) && (
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'backup' ? 'bg-[#176B52] text-white shadow-sm font-bold' : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              Sauvegarde & Déploiement
            </button>
          )}
        </div>
      </div>

      {activeTab === 'users' && hasRole(['admin']) && (
        /* USERS LIST */
        <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-[#1F2937]">Comptes Utilisateurs & Permissions</h3>
              <p className="text-xs text-[#64748B]">Rôles : Administrateur, Gérant, Caissier, Gestionnaire de Stock</p>
            </div>

            <button
              onClick={openCreateUserModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#176B52] hover:bg-[#125541] text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Créer un Utilisateur</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-[#E1E6E2] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider text-[11px] font-bold border-b border-[#E1E6E2]">
                <tr>
                  <th className="p-3">Identifiant</th>
                  <th className="p-3">Nom Complet</th>
                  <th className="p-3">Rôle Assigné</th>
                  <th className="p-3">Téléphone</th>
                  <th className="p-3 text-center">État</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2]">
                {users.map((u) => {
                  const roleBadge = getRoleBadge(u.role);
                  return (
                    <tr key={u.id} className="hover:bg-[#F4F6F3]/70 transition">
                      <td className="p-3 font-mono font-bold text-[#1F2937]">{u.username}</td>
                      <td className="p-3 font-bold text-[#1F2937]">{u.fullName}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded border text-[11px] font-semibold ${roleBadge.color}`}>
                          {roleBadge.label}
                        </span>
                      </td>
                      <td className="p-3 text-[#64748B]">{u.phone || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.is_active === 1 ? 'bg-[#EBF4F0] text-[#176B52] border border-[#176B52]/20' : 'bg-[#F4F6F3] text-[#64748B] border border-[#E1E6E2]'
                        }`}>
                          {u.is_active === 1 ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => openEditUserModal(u)}
                          className="px-3 py-1 rounded-lg bg-white hover:bg-[#F4F6F3] border border-[#E1E6E2] text-[#1F2937] font-semibold text-xs transition"
                        >
                          Modifier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        /* IMMUTABLE AUDIT LOG */
        <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-[#1F2937] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#176B52]" />
                <span>Journal d'Audit des Opérations</span>
              </h3>
              <p className="text-xs text-[#64748B]">
                Traçabilité des actions réalisées dans l'application avec possibilité de purge pour l'administrateur.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B]">{auditLogs.length} action(s)</span>
              {hasRole(['admin']) && auditLogs.length > 0 && (
                <button
                  onClick={handleClearAuditLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#D97732] bg-[#FDF3EB] hover:bg-[#F6CEB4]/40 border border-[#F6CEB4] rounded-xl transition shadow-sm"
                  title="Vider tout le journal d'audit"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#D97732]" />
                  <span>Vider le journal</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[60vh] border border-[#E1E6E2] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider text-[11px] font-bold border-b border-[#E1E6E2] sticky top-0 z-10">
                <tr>
                  <th className="p-3">Date & Heure</th>
                  <th className="p-3">Utilisateur</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entité</th>
                  <th className="p-3">Détails de l'Opération</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F4F6F3]/70 transition">
                    <td className="p-3 text-[#64748B] whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="p-3 font-bold text-[#1F2937] whitespace-nowrap">{log.user_name || 'Système'}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action.includes('CANCEL')
                          ? 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4]'
                          : log.action.includes('CREATE')
                          ? 'bg-[#EBF4F0] text-[#176B52] border border-[#176B52]/20'
                          : 'bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2]'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-[#64748B] uppercase font-mono text-[10px]">{log.entity_type}</td>
                    <td className="p-3 text-[#1F2937] leading-relaxed">{log.details}</td>
                    <td className="p-3 text-right">
                      {hasRole(['admin']) && (
                        <button
                          onClick={() => handleDeleteAuditLog(log.id)}
                          className="p-1.5 text-[#64748B] hover:text-[#D97732] hover:bg-[#FDF3EB] rounded-lg transition"
                          title="Supprimer cette ligne d'audit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'backup' && hasRole(['admin']) && (
        /* BACKUP AND PRODUCTION MANAGEMENT */
        <div className="space-y-6">
          {/* Desktop Windows 11 Offline & SQLite Box */}
          <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E1E6E2]">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#EBF4F0] text-[#176B52] border border-[#176B52]/20 mb-2">
                  <span className="w-2 h-2 rounded-full bg-[#176B52] animate-pulse"></span>
                  <span>100% Hors Ligne — Aucun Serveur Distant Requis</span>
                </div>
                <h3 className="font-bold text-base text-[#1F2937] flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#176B52]" />
                  <span>Base de Données Locale SQLite & Sauvegardes Externes</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-1 max-w-2xl leading-relaxed">
                  L'application conserve l'intégralité de vos données commerciales dans une base relationnelle locale sécurisée. Vos données restent sur cet ordinateur même en cas de coupure Internet ou d'extinction.
                </p>
              </div>

              {dbInfo && (
                <div className="bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-3 text-xs shrink-0 font-mono">
                  <div className="text-[11px] text-[#64748B] font-sans font-bold">Taille Base de Données</div>
                  <div className="text-sm font-extrabold text-[#1F2937]">{dbInfo.sizeFormatted}</div>
                  <div className="text-[10px] text-[#64748B] font-semibold mt-0.5">Mode Haute Concurrence WAL</div>
                </div>
              )}
            </div>

            {/* Current Path Info */}
            <div className="bg-[#F4F6F3] p-3.5 rounded-xl border border-[#E1E6E2] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[#64748B]">
              <div className="truncate">
                <span className="font-bold text-[#1F2937] font-sans">Emplacement Actif : </span>
                <span className="text-[#1F2937]">{dbInfo?.dbPath || '%APPDATA%\\boutique-manager\\boutique.db'}</span>
              </div>
              <button
                type="button"
                onClick={handleOpenDataFolder}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E1E6E2] hover:bg-[#F4F6F3] rounded-lg text-[#1F2937] font-sans font-bold text-xs shrink-0 shadow-sm transition"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#176B52]" />
                <span>Ouvrir l'Emplacement Windows</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                type="button"
                onClick={handleUsbBackup}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-[#176B52] hover:bg-[#125541] text-white rounded-xl font-bold text-xs shadow-sm transition active:scale-95"
              >
                <HardDrive className="w-4 h-4" />
                <span>Sauvegarder sur Clé USB / Disque</span>
              </button>

              <button
                type="button"
                onClick={handleRestoreFile}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2] rounded-xl font-bold text-xs shadow-sm transition active:scale-95"
              >
                <Upload className="w-4 h-4 text-[#176B52]" />
                <span>Restaurer depuis un Fichier (.db)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadBackup}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2] rounded-xl font-bold text-xs shadow-sm transition active:scale-95"
              >
                <Download className="w-4 h-4 text-[#176B52]" />
                <span>Télécharger Copie (.db)</span>
              </button>
            </div>
          </div>

          {/* Danger Zone: Reset Demo or Clean for Production */}
          <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-6 space-y-6">
            <div>
              <h3 className="font-bold text-base text-[#1F2937] flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#D97732]" />
                <span>Zone d'Administration : Données Démo & Mise en Production</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                Procédures d'initialisation et de préparation pour l'exploitation réelle de MS BAH PARFUM.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* Option 1: Vider TOUT */}
              <div className="p-4 rounded-xl border border-[#F6CEB4] bg-[#FDF3EB] flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-[#D97732] text-sm flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-[#D97732]" />
                    <span>Remise à Zéro Totale (Vider Tout)</span>
                  </h4>
                  <p className="text-xs text-[#1F2937] mt-1.5 leading-relaxed">
                    Supprime tous les articles, clients, fournisseurs, catégories et transactions. Vos comptes utilisateurs sont conservés.
                  </p>
                </div>

                <button
                  onClick={() => setCleanEverythingModalOpen(true)}
                  className="mt-4 w-full py-2 px-3 bg-[#D97732] hover:bg-[#B85F22] text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
                >
                  Vider Toutes les Données
                </button>
              </div>

              {/* Option 2: Charger Catégories Cosmétiques */}
              <div className="p-4 rounded-xl border border-[#E1E6E2] bg-[#F4F6F3] flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-[#1F2937] text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#176B52]" />
                    <span>Catégories Cosmétiques</span>
                  </h4>
                  <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                    Charge en 1 clic les 11 catégories cosmétiques standard (Maquillage, Parfums, Crèmes, Savons, Bébés, etc.).
                  </p>
                </div>

                <button
                  onClick={handleLoadDefaultCategories}
                  className="mt-4 w-full py-2 px-3 bg-[#176B52] hover:bg-[#125541] text-white rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
                >
                  Charger 11 Catégories
                </button>
              </div>

              {/* Option 3: Basculer en production (Transactions uniquement) */}
              <div className="p-4 rounded-xl border border-[#E1E6E2] bg-[#F4F6F3] flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-[#1F2937] text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-[#176B52]" />
                    <span>Purger Ventes & Mouvements</span>
                  </h4>
                  <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                    Efface les ventes et mouvements de test tout en <strong>conservant</strong> vos produits et fournisseurs enregistrés.
                  </p>
                </div>

                <button
                  onClick={() => setCleanProdModalOpen(true)}
                  className="mt-4 w-full py-2 px-3 bg-white hover:bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4] rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
                >
                  Purger Transactions
                </button>
              </div>

              {/* Option 4: Recharger données démo */}
              <div className="p-4 rounded-xl border border-[#E1E6E2] bg-[#F4F6F3] flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-[#1F2937] text-sm flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-[#176B52]" />
                    <span>Recharger Données Démo</span>
                  </h4>
                  <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
                    Restaure le jeu complet d'exemples guinéens (produits réels, fournisseurs de Madina, caisses, ventes de test).
                  </p>
                </div>

                <button
                  onClick={() => setResetDemoModalOpen(true)}
                  className="mt-4 w-full py-2 px-3 bg-white hover:bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2] rounded-xl text-xs font-bold transition shadow-sm active:scale-95"
                >
                  Réinsérer Données Démo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      <Modal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUser ? `Modifier l'utilisateur : ${editingUser.username}` : 'Créer un Nouvel Utilisateur'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveUser} className="space-y-4 text-xs">
          {!editingUser && (
            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Identifiant de connexion *</label>
              <input
                type="text"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                placeholder="Ex : caissier2"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] focus:border-[#176B52] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-mono"
                required
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Nom Complet *</label>
            <input
              type="text"
              value={userForm.fullName}
              onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
              placeholder="Ex : Aissatou Barry"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] focus:border-[#176B52] rounded-xl px-3 py-2 text-xs text-[#1F2937]"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Rôle et Droits d'Accès *</label>
            <select
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] focus:border-[#176B52] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-bold"
            >
              <option value="cashier">Caissier(ère) - Ventes POS et Mobile Money</option>
              <option value="stock_manager">Gestionnaire de Stock - Articles et réceptions</option>
              <option value="manager">Gérant - Ventes, stocks, achats, caisses et rapports</option>
              <option value="admin">Administrateur - Accès complet au système</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Numéro de Téléphone</label>
            <input
              type="text"
              value={userForm.phone}
              onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
              placeholder="+224 6..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] focus:border-[#176B52] rounded-xl px-3 py-2 text-xs text-[#1F2937]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">
              {editingUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe initial *'}
            </label>
            <input
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              placeholder="••••••••"
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] focus:border-[#176B52] rounded-xl px-3 py-2 text-xs text-[#1F2937]"
              required={!editingUser}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold shadow-sm transition active:scale-95"
            >
              {editingUser ? 'Mettre à jour' : 'Créer le compte'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal Reset Demo */}
      <Modal
        isOpen={resetDemoModalOpen}
        onClose={() => setResetDemoModalOpen(false)}
        title="Confirmation Réinitialisation Démo"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-[#64748B] leading-relaxed">
            Cette opération va réinsérer les données de test par défaut. Pour confirmer, tapez le code : <strong className="font-mono text-[#1F2937] font-black">REINITIALISER_DEMO</strong>
          </p>

          <input
            type="text"
            value={resetDemoConfirmation}
            onChange={(e) => setResetDemoConfirmation(e.target.value)}
            placeholder="REINITIALISER_DEMO"
            className="w-full bg-[#F4F6F3] border border-[#E1E6E2] focus:border-[#176B52] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#1F2937] focus:outline-none"
          />

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setResetDemoModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3]"
            >
              Annuler
            </button>
            <button
              onClick={handleResetDemo}
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold transition active:scale-95"
            >
              Confirmer
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal Clean for Production */}
      <Modal
        isOpen={cleanProdModalOpen}
        onClose={() => setCleanProdModalOpen(false)}
        title="Confirmation Passage en Production Réelle"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-[#FDF3EB] border border-[#F6CEB4] rounded-xl text-[#1F2937]">
            <p className="font-bold text-[#D97732]">Attention : Purge définitive des transactions de test</p>
            <p className="mt-0.5 text-[11px] text-[#64748B]">
              Toutes les ventes, achats, mouvements de stock et écritures de test seront effacés. Le catalogue d'articles et vos utilisateurs seront préservés.
            </p>
          </div>

          <p className="text-[#64748B]">
            Pour confirmer, veuillez saisir : <strong className="font-mono text-[#1F2937] font-black">PASSER_EN_PRODUCTION</strong>
          </p>

          <input
            type="text"
            value={cleanProdConfirmation}
            onChange={(e) => setCleanProdConfirmation(e.target.value)}
            placeholder="PASSER_EN_PRODUCTION"
            className="w-full bg-[#F4F6F3] border border-[#E1E6E2] focus:border-[#D97732] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#1F2937] focus:outline-none"
          />

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setCleanProdModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3]"
            >
              Annuler
            </button>
            <button
              onClick={handleCleanForProduction}
              className="px-5 py-2 rounded-xl bg-[#D97732] hover:bg-[#B85F22] text-white font-bold transition active:scale-95"
            >
              Purger & Passer en Production
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal Clean Everything */}
      <Modal
        isOpen={cleanEverythingModalOpen}
        onClose={() => setCleanEverythingModalOpen(false)}
        title="Confirmation Remise à Zéro Complète"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-[#FDF3EB] border border-[#F6CEB4] rounded-xl text-[#1F2937]">
            <p className="font-bold text-[#D97732]">Attention : Suppression définitive de toutes les données prédéfinies</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
              Cette action supprimera tous les articles, clients, fournisseurs et transactions. Vos comptes utilisateurs de connexion seront conservés.
            </p>
          </div>

          <label className="flex items-center gap-2 p-2.5 bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={keepCategoriesInClean}
              onChange={(e) => setKeepCategoriesInClean(e.target.checked)}
              className="rounded text-[#176B52] focus:ring-[#176B52]"
            />
            <span className="text-[#1F2937] font-medium">Conserver la liste des catégories existantes</span>
          </label>

          <p className="text-[#64748B]">
            Pour confirmer, veuillez saisir : <strong className="font-mono text-[#1F2937] font-black">VIDER_TOUT</strong>
          </p>

          <input
            type="text"
            value={cleanEverythingConfirmation}
            onChange={(e) => setCleanEverythingConfirmation(e.target.value)}
            placeholder="VIDER_TOUT"
            className="w-full bg-[#F4F6F3] border border-[#E1E6E2] focus:border-[#D97732] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#1F2937] focus:outline-none"
          />

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setCleanEverythingModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3]"
            >
              Annuler
            </button>
            <button
              onClick={handleCleanEverything}
              className="px-5 py-2 rounded-xl bg-[#D97732] hover:bg-[#B85F22] text-white font-bold transition active:scale-95"
            >
              Tout Vider
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
