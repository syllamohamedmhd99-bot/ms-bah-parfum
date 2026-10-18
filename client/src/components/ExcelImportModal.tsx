import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  Search,
  Filter,
  ArrowRight,
  Database,
  Download,
  RefreshCw,
  FolderOpen,
  Info,
  ShieldCheck,
  X,
  Layers,
  HelpCircle
} from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../services/api';
import { ExcelPreviewResult, ParsedProductItem, IgnoredLine, ImportReport } from '../types';
import { formatGNF } from '../utils/formatters';
import { useToast } from '../context/ToastContext';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

type TabFilter = 'all' | 'needs_completion' | 'duplicates' | 'ignored';

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess
}) => {
  const toast = useToast();

  // Wizard steps: 1 = File selection, 2 = Preview & Edit, 3 = Confirmation Report
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Default detected file on host
  const [defaultFile, setDefaultFile] = useState<{
    exists: boolean;
    filePath?: string;
    fileName?: string;
    size?: number;
    rowCount?: number;
    sheetName?: string;
  } | null>(null);

  const [loadingDefaultFile, setLoadingDefaultFile] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  // Selected file/path
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedBrowserFile, setSelectedBrowserFile] = useState<File | null>(null);

  // Parsed preview data
  const [previewData, setPreviewData] = useState<ExcelPreviewResult | null>(null);
  const [editableProducts, setEditableProducts] = useState<ParsedProductItem[]>([]);

  // Preview filtering & search
  const [currentTab, setCurrentTab] = useState<TabFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Final Import Report
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setPreviewData(null);
      setEditableProducts([]);
      setImportReport(null);
      setSelectedFilePath(null);
      setSelectedBrowserFile(null);
      setCurrentTab('all');
      setCategoryFilter('all');
      setSearchQuery('');
      checkDefaultFile();
    }
  }, [isOpen]);

  const checkDefaultFile = async () => {
    try {
      setLoadingDefaultFile(true);
      const res = await api.checkDefaultExcelFile();
      setDefaultFile(res);
      if (res.exists && res.filePath) {
        setSelectedFilePath(res.filePath);
      }
    } catch (err) {
      console.warn('Impossible de vérifier le fichier par défaut:', err);
    } finally {
      setLoadingDefaultFile(false);
    }
  };

  // Step 1: Select via Electron native dialog
  const handleBrowseElectron = async () => {
    if (window.electronAPI?.selectExcelFile) {
      try {
        const filePath = await window.electronAPI.selectExcelFile();
        if (filePath) {
          setSelectedFilePath(filePath);
          setSelectedBrowserFile(null);
          await loadPreview(filePath);
        }
      } catch (err: any) {
        toast.error('Erreur lors du choix de fichier: ' + err.message);
      }
    } else {
      // Fallback click on hidden file input
      document.getElementById('excel-file-input')?.click();
    }
  };

  // Step 1: Select via HTML File Input (Chrome / Web or Electron fallback)
  const handleBrowserFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedBrowserFile(file);
      setSelectedFilePath(null);
      await loadPreview(file);
    }
  };

  // Load and parse preview
  const loadPreview = async (source: string | File) => {
    try {
      setParsing(true);
      const res = await api.importExcelPreview(source);
      if (!res.success) {
        throw new Error(res.error || 'Erreur lors de la lecture du fichier Excel');
      }

      const data: ExcelPreviewResult = res.preview;
      setPreviewData(data);
      // Clone products for in-memory editing
      setEditableProducts(
        data.products.map((p) => ({
          ...p,
          duplicate_action: p.duplicate_action || 'create'
        }))
      );
      setStep(2);
      toast.success(
        `${data.totalDetected} produits détectés dans le fichier Excel (${data.validPriceCount} avec prix, ${data.needsCompletionCount} à compléter).`
      );
    } catch (err: any) {
      toast.error(err.message || "Impossible d'analyser le fichier Excel");
    } finally {
      setParsing(false);
    }
  };

  // Handle inline edits in Preview table
  const handleProductChange = (index: number, field: keyof ParsedProductItem, value: any) => {
    setEditableProducts((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // If price was modified, update needs_completion status accordingly
      if (field === 'selling_price') {
        const num = Number(value);
        if (num > 0) {
          item.selling_price = num;
          item.needs_completion = false;
        } else {
          item.selling_price = null;
          item.needs_completion = true;
        }
      }

      updated[index] = item;
      return updated;
    });
  };

  // Change duplicate action
  const handleDuplicateActionChange = (
    index: number,
    action: 'create' | 'update' | 'skip'
  ) => {
    setEditableProducts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], duplicate_action: action };
      return updated;
    });
  };

  // Bulk duplicate resolution
  const handleSetAllDuplicateActions = (action: 'create' | 'update' | 'skip') => {
    setEditableProducts((prev) =>
      prev.map((p) => (p.duplicate_type ? { ...p, duplicate_action: action } : p))
    );
    toast.info(`Action pour les doublons définie sur : ${action === 'create' ? 'Créer nouveau' : action === 'update' ? 'Mettre à jour' : 'Ignorer'}`);
  };

  // Filtered products in Step 2 table
  const filteredProducts = useMemo(() => {
    return editableProducts.filter((p) => {
      // Tab filter
      if (currentTab === 'needs_completion' && !p.needs_completion) return false;
      if (currentTab === 'duplicates' && !p.duplicate_type) return false;

      // Category filter
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCat = p.category.toLowerCase().includes(q);
        return matchName || matchCat;
      }

      return true;
    });
  }, [editableProducts, currentTab, categoryFilter, searchQuery]);

  // Statistics counters
  const stats = useMemo(() => {
    const total = editableProducts.length;
    const validPrices = editableProducts.filter((p) => !p.needs_completion).length;
    const needsCompletion = editableProducts.filter((p) => p.needs_completion).length;
    const duplicates = editableProducts.filter((p) => p.duplicate_type).length;
    const ignored = previewData?.ignoredLinesCount || 0;
    return { total, validPrices, needsCompletion, duplicates, ignored };
  }, [editableProducts, previewData]);

  // Step 2 Confirm: Execute import transaction
  const handleConfirmImport = async () => {
    if (editableProducts.length === 0) {
      toast.error('Aucun produit à importer.');
      return;
    }

    try {
      setImporting(true);
      const sourceName = previewData?.fileName || selectedBrowserFile?.name || 'Récupération automatique.xlsx';
      const res = await api.importExcelConfirm(editableProducts, sourceName);

      if (!res.success) {
        throw new Error(res.error || "Échec lors de l'enregistrement dans la base de données");
      }

      setImportReport(res.report);
      setStep(3);
      toast.success(
        `Importation terminée ! ${res.report.importedCount} produits enregistrés avec succès.`
      );
      onImportSuccess();
    } catch (err: any) {
      toast.error(err.message || "Erreur critique lors de l'importation");
    } finally {
      setImporting(false);
    }
  };

  // Export import report to CSV
  const handleExportReportCSV = () => {
    if (!importReport) return;

    const rows: string[] = [
      'MS BAH PARFUM - Rapport d Importation Catalogue',
      `Date : ${new Date().toLocaleString('fr-FR')}`,
      `Fichier source : ${previewData?.fileName || 'Récupération automatique.xlsx'}`,
      `Contact : 626 96 39 82 / +224 626 96 39 82`,
      `Sauvegarde SQLite : ${importReport.backupPath || 'Automatique'}`,
      '',
      `Produits importés : ${importReport.importedCount}`,
      `Produits mis à jour : ${importReport.updatedCount}`,
      `Produits ignorés : ${importReport.skippedCount}`,
      `Produits à compléter : ${importReport.needsCompletionCount}`,
      `Doublons gérés : ${importReport.duplicatesCount}`,
      '',
      'ID;Code;Nom du Produit;Catégorie;Prix Vente (GNF);Statut'
    ];

    importReport.importedProducts.forEach((p) => {
      rows.push(
        `${p.id};"${p.code}";"${p.name.replace(/"/g, '""')}";"${p.category.replace(/"/g, '""')}";${p.sale_price};"${p.status}"`
      );
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rapport_Import_Boutique_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Rapport exporté en format CSV.');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!importing) onClose();
      }}
      title="Importation du Catalogue Excel & Tarifs"
      maxWidth="7xl"
    >
      <div className="space-y-5">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between border-b border-[#E1E6E2] pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === 1
                  ? 'bg-[#176B52] text-white shadow-sm'
                  : 'bg-[#EBF4F0] text-[#176B52]'
              }`}
            >
              1
            </div>
            <span
              className={`text-xs font-bold ${
                step === 1 ? 'text-[#1F2937]' : 'text-[#64748B]'
              }`}
            >
              Fichier source
            </span>

            <span className="text-[#CBD5E1]">→</span>

            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === 2
                  ? 'bg-[#176B52] text-white shadow-sm'
                  : step > 2
                  ? 'bg-[#EBF4F0] text-[#176B52]'
                  : 'bg-[#F4F6F3] text-[#64748B]'
              }`}
            >
              2
            </div>
            <span
              className={`text-xs font-bold ${
                step === 2 ? 'text-[#1F2937]' : 'text-[#64748B]'
              }`}
            >
              Aperçu & Vérification
            </span>

            <span className="text-[#CBD5E1]">→</span>

            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                step === 3
                  ? 'bg-[#176B52] text-white shadow-sm'
                  : 'bg-[#F4F6F3] text-[#64748B]'
              }`}
            >
              3
            </div>
            <span
              className={`text-xs font-bold ${
                step === 3 ? 'text-[#1F2937]' : 'text-[#64748B]'
              }`}
            >
              Rapport d'importation
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#64748B] bg-[#F4F6F3] px-3 py-1 rounded-full border border-[#E1E6E2]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#176B52]" />
            <span>Mode 100% Hors Ligne • Sauvegarde SQLite automatique</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1 : SELECTION DU FICHIER EXCEL */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-5 py-2">
            {/* Quick Auto-Detect Card for (Récupération automatique).xlsx */}
            {defaultFile?.exists && (
              <div className="bg-[#EBF4F0] border-2 border-[#176B52] rounded-2xl p-5 shadow-sm transition hover:shadow-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-[#176B52] text-white flex items-center justify-center shrink-0 shadow-sm">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider bg-white text-[#176B52] px-2 py-0.5 rounded border border-[#C2DDD3]">
                          Fichier détecté automatiquement
                        </span>
                        <span className="text-xs text-[#64748B]">Windows 11</span>
                      </div>
                      <h4 className="text-sm font-bold text-[#1F2937] mt-1">
                        {defaultFile.fileName}
                      </h4>
                      <p className="text-xs text-[#64748B] font-mono break-all mt-0.5">
                        {defaultFile.filePath}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-[#1F2937] font-medium">
                        <span>Feuille : <strong>{defaultFile.sheetName}</strong></span>
                        <span>•</span>
                        <span>Lignes brutes : <strong>{defaultFile.rowCount}</strong></span>
                        <span>•</span>
                        <span>Taille : <strong>{(defaultFile.size! / 1024).toFixed(1)} Ko</strong></span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => defaultFile.filePath && loadPreview(defaultFile.filePath)}
                    disabled={parsing}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-[#176B52] hover:bg-[#125541] text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 shrink-0"
                  >
                    {parsing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Analyse en cours...</span>
                      </>
                    ) : (
                      <>
                        <span>Charger ce fichier</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Standard File Picker & Drag-and-Drop */}
            <div className="border-2 border-dashed border-[#CBD5E1] hover:border-[#176B52] bg-[#F4F6F3] rounded-2xl p-8 text-center transition flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-white border border-[#E1E6E2] text-[#176B52] flex items-center justify-center mb-3 shadow-xs">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-[#1F2937]">
                Sélectionner un classeur Excel (.xlsx, .xls)
              </h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-md">
                Glissez-déposez votre fichier ici, ou parcourez l'ordinateur pour sélectionner la liste des produits et prix de votre boutique.
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleBrowseElectron}
                  disabled={parsing}
                  className="px-5 py-2.5 bg-white hover:bg-[#EBF4F0] text-[#176B52] border border-[#C2DDD3] font-bold text-xs rounded-xl shadow-xs transition active:scale-95 flex items-center gap-2"
                >
                  <FolderOpen className="w-4 h-4 text-[#176B52]" />
                  <span>Parcourir les fichiers Windows...</span>
                </button>

                <input
                  id="excel-file-input"
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleBrowserFileChange}
                />
              </div>

              {parsing && (
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#176B52]">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Lecture et extraction des catégories et prix en cours...</span>
                </div>
              )}
            </div>

            {/* Explanatory notes & business rules */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-white border border-[#E1E6E2] rounded-xl flex items-start gap-3">
                <Info className="w-5 h-5 text-[#176B52] shrink-0 mt-0.5" />
                <div className="text-xs text-[#64748B] space-y-1">
                  <h5 className="font-bold text-[#1F2937]">Détection intelligente des catégories</h5>
                  <p>
                    Les titres de sections (Parfums, Savons, Laits, Hygiène, etc.) sont automatiquement convertis en catégories. Les accents et apostrophes sont intégralement préservés.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-white border border-[#E1E6E2] rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#176B52] shrink-0 mt-0.5" />
                <div className="text-xs text-[#64748B] space-y-1">
                  <h5 className="font-bold text-[#1F2937]">Stock et Prix d'achat intègres</h5>
                  <p>
                    Le stock initial est fixé à 0 pour éviter d'inventer des quantités. Les articles sans prix sont placés dans « À compléter » et ne sont pas vendables sans prix.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2 : APERÇU, VALIDATION ET MODIFICATION AVANT ENREGISTREMENT */}
        {/* ========================================================================= */}
        {step === 2 && previewData && (
          <div className="space-y-4">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-[#F4F6F3] p-3 rounded-xl border border-[#E1E6E2]">
                <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">
                  Produits détectés
                </span>
                <span className="text-xl font-extrabold text-[#1F2937] mt-0.5 block">
                  {stats.total}
                </span>
                <span className="text-[10px] text-[#64748B]">Dans {previewData.categoriesDetected.length} catégories</span>
              </div>

              <div className="bg-[#EBF4F0] p-3 rounded-xl border border-[#C2DDD3]">
                <span className="text-[10px] uppercase font-bold text-[#176B52] tracking-wider block">
                  Prix valides
                </span>
                <span className="text-xl font-extrabold text-[#176B52] mt-0.5 block">
                  {stats.validPrices}
                </span>
                <span className="text-[10px] text-[#176B52]">En francs guinéens (GNF)</span>
              </div>

              <div
                onClick={() => setCurrentTab('needs_completion')}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  stats.needsCompletion > 0
                    ? 'bg-[#FDF3EB] border-[#F6CEB4] hover:bg-[#fae8dc]'
                    : 'bg-[#F4F6F3] border-[#E1E6E2]'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-[#D97732] tracking-wider block flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  À compléter
                </span>
                <span className="text-xl font-extrabold text-[#D97732] mt-0.5 block">
                  {stats.needsCompletion}
                </span>
                <span className="text-[10px] text-[#D97732]">Prix manquant ou 0</span>
              </div>

              <div
                onClick={() => setCurrentTab('duplicates')}
                className={`p-3 rounded-xl border cursor-pointer transition ${
                  stats.duplicates > 0
                    ? 'bg-[#FDF3EB] border-[#F6CEB4] hover:bg-[#fae8dc]'
                    : 'bg-[#F4F6F3] border-[#E1E6E2]'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-[#D97732] tracking-wider block flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  Doublons détectés
                </span>
                <span className="text-xl font-extrabold text-[#D97732] mt-0.5 block">
                  {stats.duplicates}
                </span>
                <span className="text-[10px] text-[#D97732]">Noms ou variantes proches</span>
              </div>

              <div
                onClick={() => setCurrentTab('ignored')}
                className="bg-[#F4F6F3] p-3 rounded-xl border border-[#E1E6E2] cursor-pointer hover:bg-[#ECEEEA] transition"
              >
                <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider block">
                  Lignes ignorées
                </span>
                <span className="text-xl font-extrabold text-[#1F2937] mt-0.5 block">
                  {stats.ignored}
                </span>
                <span className="text-[10px] text-[#64748B]">En-têtes et sections</span>
              </div>
            </div>

            {/* Categories pills */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2]">
              <span className="text-[11px] font-bold text-[#64748B] px-2 py-1">Catégories :</span>
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold transition ${
                  categoryFilter === 'all'
                    ? 'bg-[#176B52] text-white shadow-xs'
                    : 'bg-white text-[#1F2937] border border-[#E1E6E2] hover:bg-[#EBF4F0]'
                }`}
              >
                Toutes ({stats.total})
              </button>
              {previewData.categoriesDetected.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setCategoryFilter(cat.name)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition ${
                    categoryFilter === cat.name
                      ? 'bg-[#176B52] text-white font-bold shadow-xs'
                      : 'bg-white text-[#1F2937] border border-[#E1E6E2] hover:bg-[#EBF4F0]'
                  }`}
                >
                  {cat.name} <span className="opacity-70 text-[10px]">({cat.count})</span>
                </button>
              ))}
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E1E6E2]">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCurrentTab('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    currentTab === 'all'
                      ? 'bg-[#176B52] text-white'
                      : 'text-[#64748B] hover:text-[#1F2937] hover:bg-[#F4F6F3]'
                  }`}
                >
                  Tous les articles ({editableProducts.length})
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentTab('needs_completion')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    currentTab === 'needs_completion'
                      ? 'bg-[#D97732] text-white'
                      : 'text-[#D97732] hover:bg-[#FDF3EB]'
                  }`}
                >
                  <span>À compléter</span>
                  <span className="bg-white/30 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                    {stats.needsCompletion}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentTab('duplicates')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    currentTab === 'duplicates'
                      ? 'bg-[#D97732] text-white'
                      : 'text-[#64748B] hover:text-[#1F2937] hover:bg-[#F4F6F3]'
                  }`}
                >
                  <span>Doublons</span>
                  {stats.duplicates > 0 && (
                    <span className="bg-[#D97732] text-white px-1.5 py-0.2 rounded-full text-[10px]">
                      {stats.duplicates}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentTab('ignored')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    currentTab === 'ignored'
                      ? 'bg-[#1F2937] text-white'
                      : 'text-[#64748B] hover:text-[#1F2937] hover:bg-[#F4F6F3]'
                  }`}
                >
                  Lignes ignorées ({stats.ignored})
                </button>
              </div>

              {/* Bulk actions for duplicates */}
              {currentTab === 'duplicates' && stats.duplicates > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#64748B]">Action globale doublons :</span>
                  <button
                    type="button"
                    onClick={() => handleSetAllDuplicateActions('create')}
                    className="px-2 py-1 bg-white border border-[#E1E6E2] text-xs font-bold text-[#176B52] rounded hover:bg-[#EBF4F0]"
                  >
                    Créer tous
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllDuplicateActions('update')}
                    className="px-2 py-1 bg-white border border-[#E1E6E2] text-xs font-bold text-[#1F2937] rounded hover:bg-[#F4F6F3]"
                  >
                    Mettre à jour tous
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllDuplicateActions('skip')}
                    className="px-2 py-1 bg-white border border-[#E1E6E2] text-xs font-bold text-[#D97732] rounded hover:bg-[#FDF3EB]"
                  >
                    Ignorer tous
                  </button>
                </div>
              )}

              {/* Search */}
              {currentTab !== 'ignored' && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer un produit..."
                    className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                  />
                </div>
              )}
            </div>

            {/* Table Area */}
            {currentTab !== 'ignored' ? (
              <div className="border border-[#E1E6E2] rounded-xl overflow-hidden bg-white max-h-[44vh] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F4F6F3] text-[#64748B] uppercase font-bold tracking-wider border-b border-[#E1E6E2] sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-16 text-center">Ligne</th>
                      <th className="p-2.5">Nom de l'article (Modifiable)</th>
                      <th className="p-2.5 w-52">Catégorie</th>
                      <th className="p-2.5 w-44 text-right">Prix de vente (GNF)</th>
                      <th className="p-2.5 w-24 text-center">Stock</th>
                      <th className="p-2.5 w-60">Statut / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E6E2]">
                    {filteredProducts.map((p) => {
                      const originalIndex = editableProducts.findIndex(
                        (orig) => orig.row === p.row && orig.name === p.name
                      );

                      return (
                        <tr
                          key={`${p.row}-${p.name}`}
                          className={`hover:bg-[#F4F6F3]/60 transition ${
                            p.needs_completion
                              ? 'bg-[#FDF3EB]/40'
                              : p.duplicate_type
                              ? 'bg-amber-50/30'
                              : ''
                          }`}
                        >
                          <td className="p-2.5 text-center font-mono text-[11px] text-[#64748B]">
                            #{p.row}
                          </td>

                          {/* Editable Product Name */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={p.name}
                              onChange={(e) =>
                                handleProductChange(originalIndex, 'name', e.target.value)
                              }
                              className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-[#176B52] rounded px-2 py-1 font-bold text-[#1F2937] transition"
                            />
                          </td>

                          {/* Editable Category */}
                          <td className="p-2.5">
                            <select
                              value={p.category}
                              onChange={(e) =>
                                handleProductChange(originalIndex, 'category', e.target.value)
                              }
                              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded px-2 py-1 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                            >
                              {previewData.categoriesDetected.map((cat) => (
                                <option key={cat.name} value={cat.name}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Editable Selling Price */}
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                min="0"
                                step="500"
                                value={p.selling_price ?? ''}
                                placeholder="À définir"
                                onChange={(e) =>
                                  handleProductChange(
                                    originalIndex,
                                    'selling_price',
                                    e.target.value
                                  )
                                }
                                className={`w-32 text-right border rounded px-2 py-1 font-bold transition ${
                                  p.selling_price && p.selling_price > 0
                                    ? 'bg-white border-[#E1E6E2] text-[#176B52] focus:border-[#176B52]'
                                    : 'bg-[#FDF3EB] border-[#F6CEB4] text-[#D97732] placeholder-[#D97732]/70 focus:border-[#D97732]'
                                }`}
                              />
                              <span className="text-[10px] text-[#64748B] font-bold">GNF</span>
                            </div>
                          </td>

                          {/* Initial Stock (Strictly 0 as specified) */}
                          <td className="p-2.5 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#F4F6F3] text-[#64748B] border border-[#E1E6E2]">
                              0
                            </span>
                          </td>

                          {/* Status and Duplicate Resolution */}
                          <td className="p-2.5">
                            {p.duplicate_type ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-[11px] font-bold text-[#D97732]">
                                  <Layers className="w-3 h-3" />
                                  <span>
                                    {p.duplicate_type === 'internal'
                                      ? 'Doublon dans le fichier'
                                      : 'Existe déjà en base'}
                                  </span>
                                </div>
                                <select
                                  value={p.duplicate_action || 'create'}
                                  onChange={(e) =>
                                    handleDuplicateActionChange(
                                      originalIndex,
                                      e.target.value as any
                                    )
                                  }
                                  className="w-full text-[11px] font-medium bg-white border border-[#F6CEB4] rounded px-1.5 py-1 text-[#1F2937]"
                                >
                                  <option value="create">Créer comme nouveau</option>
                                  <option value="update">Mettre à jour l'existant</option>
                                  <option value="skip">Ignorer cette ligne</option>
                                </select>
                              </div>
                            ) : p.needs_completion ? (
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#D97732] bg-[#FDF3EB] px-2 py-1 rounded border border-[#F6CEB4]">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Prix absent : À compléter</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#176B52] bg-[#EBF4F0] px-2 py-1 rounded border border-[#C2DDD3]">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Prêt à l'importation</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-[#64748B]">
                          Aucun produit correspondant aux filtres.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Ignored Lines Table */
              <div className="border border-[#E1E6E2] rounded-xl overflow-hidden bg-white max-h-[44vh] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F4F6F3] text-[#64748B] uppercase font-bold tracking-wider border-b border-[#E1E6E2]">
                    <tr>
                      <th className="p-2.5 w-20 text-center">Ligne</th>
                      <th className="p-2.5 w-60">Raison de l'exclusion</th>
                      <th className="p-2.5">Contenu détecté</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E6E2]">
                    {previewData.ignoredLines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-[#F4F6F3]/50">
                        <td className="p-2.5 text-center font-mono text-[#64748B]">
                          #{line.row}
                        </td>
                        <td className="p-2.5 font-bold text-[#1F2937]">
                          <span className="inline-block bg-[#F4F6F3] px-2 py-0.5 rounded border border-[#E1E6E2] text-[11px]">
                            {line.reason}
                          </span>
                        </td>
                        <td className="p-2.5 text-[#64748B] font-mono text-[11px]">
                          {line.content || '(Cellule vide)'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Disclaimer Banner */}
            <div className="bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5 text-[#64748B]">
                <ShieldCheck className="w-4 h-4 text-[#176B52] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#1F2937]">Sécurité garantie : </strong>
                  Une sauvegarde complète SQLite sera générée avant l'écriture. Les stocks initiaux sont fixés à 0 conformément à vos consignes pour éviter d'inventer des inventaires non vérifiés.
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={importing}
                  className="px-3 py-2 text-xs font-bold text-[#64748B] hover:text-[#1F2937] bg-white border border-[#E1E6E2] rounded-xl hover:bg-[#F4F6F3] transition"
                >
                  Changer de fichier
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={importing || editableProducts.length === 0}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-[#176B52] hover:bg-[#125541] rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importation en cours...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      <span>Confirmer et Importer {editableProducts.length} articles</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3 : RAPPORT COMPLET APRES IMPORTATION */}
        {/* ========================================================================= */}
        {step === 3 && importReport && (
          <div className="space-y-5 py-2">
            <div className="bg-[#EBF4F0] border-2 border-[#176B52] rounded-2xl p-6 text-center space-y-2">
              <div className="w-14 h-14 bg-[#176B52] text-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-[#1F2937]">
                Catalogue Excel importé avec succès dans MS BAH PARFUM !
              </h3>
              <p className="text-xs text-[#64748B] max-w-lg mx-auto">
                Toutes les fiches produits, catégories et prix ont été enregistrées de manière sécurisée dans la base SQLite locale.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-[#E1E6E2] text-center shadow-xs">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                  Produits Importés
                </span>
                <span className="text-2xl font-black text-[#176B52] mt-1 block">
                  {importReport.importedCount}
                </span>
                <span className="text-[10px] text-[#176B52] font-semibold">Nouveaux articles</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#E1E6E2] text-center shadow-xs">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                  Produits Mis à Jour
                </span>
                <span className="text-2xl font-black text-[#1F2937] mt-1 block">
                  {importReport.updatedCount}
                </span>
                <span className="text-[10px] text-[#64748B]">Articles existants</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#E1E6E2] text-center shadow-xs">
                <span className="text-[10px] uppercase font-bold text-[#D97732] block">
                  À Compléter
                </span>
                <span className="text-2xl font-black text-[#D97732] mt-1 block">
                  {importReport.needsCompletionCount}
                </span>
                <span className="text-[10px] text-[#D97732]">Sans prix / Non vendables</span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#E1E6E2] text-center shadow-xs">
                <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                  Lignes Ignorées
                </span>
                <span className="text-2xl font-black text-[#64748B] mt-1 block">
                  {importReport.ignoredLinesCount}
                </span>
                <span className="text-[10px] text-[#64748B]">En-têtes et doublons passés</span>
              </div>
            </div>

            {/* Created Categories Banner */}
            {importReport.categoriesCreated.length > 0 && (
              <div className="p-3 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2] text-xs">
                <span className="font-bold text-[#1F2937]">
                  Nouvelles catégories créées automatiquement ({importReport.categoriesCreated.length}) :
                </span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {importReport.categoriesCreated.map((c) => (
                    <span
                      key={c}
                      className="bg-white border border-[#E1E6E2] text-[#176B52] font-bold px-2.5 py-0.5 rounded-md"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Database Backup Info */}
            {importReport.backupPath && (
              <div className="p-3.5 bg-white rounded-xl border border-[#E1E6E2] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#176B52]" />
                  <div>
                    <span className="font-bold text-[#1F2937]">Sauvegarde SQLite de précaution créée : </span>
                    <span className="text-[#64748B] font-mono text-[11px] block sm:inline">
                      {importReport.backupPath}
                    </span>
                  </div>
                </div>
                {window.electronAPI?.showInFolder && (
                  <button
                    type="button"
                    onClick={() => window.electronAPI?.showInFolder(importReport.backupPath!)}
                    className="text-[11px] font-bold text-[#176B52] hover:underline shrink-0"
                  >
                    Voir le fichier
                  </button>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#E1E6E2]">
              <button
                type="button"
                onClick={handleExportReportCSV}
                className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2] rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-[#176B52]" />
                <span>Exporter le rapport d'importation (CSV)</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#176B52] hover:bg-[#125541] text-white rounded-xl font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>Terminer et voir les produits</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
