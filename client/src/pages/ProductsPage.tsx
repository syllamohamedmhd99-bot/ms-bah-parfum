import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Archive,
  RotateCcw,
  AlertTriangle,
  AlertOctagon,
  Calendar,
  History,
  Tag,
  Trash2,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../services/api.js';
import { Product, Category, Supplier } from '../types.js';
import { formatGNF, formatDate, formatDateTime, getMovementTypeLabel } from '../utils/formatters.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { Modal } from '../components/Modal.js';
import { ExcelImportModal } from '../components/ExcelImportModal.js';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [stockStatus, setStockStatus] = useState<string>('all'); // all, needs_completion, low_stock, out_of_stock, archived
  const [needsCompletionCount, setNeedsCompletionCount] = useState(0);

  // Excel Import Modal
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);

  // Category Management Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Quick inline creation in product form
  const [quickCatOpen, setQuickCatOpen] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [quickSupOpen, setQuickSupOpen] = useState(false);
  const [quickSupName, setQuickSupName] = useState('');
  const [quickSupPhone, setQuickSupPhone] = useState('');

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category_id: '',
    brand: '',
    description: '',
    supplier_id: '',
    purchase_price: '',
    sale_price: '',
    stock_quantity: '',
    alert_threshold: '5',
    expiry_date: '',
    batch_number: '',
    image_url: ''
  });

  // Product Movement History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedProductHistory, setSelectedProductHistory] = useState<{ product: Product; movements: any[] } | null>(null);

  const toast = useToast();
  const { hasRole } = useAuth();

  const loadData = async () => {
    try {
      setLoading(true);
      const isArchived = stockStatus === 'archived';
      const [prods, cats, sups, needsCompProds] = await Promise.all([
        api.getProducts({
          is_archived: isArchived ? 'true' : 'false',
          status: stockStatus !== 'archived' && stockStatus !== 'all' ? stockStatus : undefined
        }),
        api.getCategories(),
        api.getSuppliers(),
        api.getProducts({ status: 'needs_completion' }).catch(() => [])
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
      setNeedsCompletionCount(Array.isArray(needsCompProds) ? needsCompProds.length : 0);
    } catch (err: any) {
      toast.error('Erreur chargement des produits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [stockStatus]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = !selectedCategory || String(p.category_id) === selectedCategory;
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, search]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      code: `PRD-${Date.now().toString().slice(-6)}`,
      name: '',
      category_id: categories.length > 0 ? String(categories[0].id) : '',
      brand: '',
      description: '',
      supplier_id: suppliers.length > 0 ? String(suppliers[0].id) : '',
      purchase_price: '',
      sale_price: '',
      stock_quantity: '0',
      alert_threshold: '5',
      expiry_date: '',
      batch_number: '',
      image_url: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      code: p.code,
      name: p.name,
      category_id: p.category_id ? String(p.category_id) : '',
      brand: p.brand || '',
      description: p.description || '',
      supplier_id: p.supplier_id ? String(p.supplier_id) : '',
      purchase_price: String(p.purchase_price),
      sale_price: String(p.sale_price),
      stock_quantity: String(p.stock_quantity),
      alert_threshold: String(p.alert_threshold),
      expiry_date: p.expiry_date || '',
      batch_number: p.batch_number || '',
      image_url: p.image_url || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      toast.error('Code référence et nom requis.');
      return;
    }

    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, {
          ...formData,
          category_id: formData.category_id ? Number(formData.category_id) : null,
          supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
          purchase_price: Number(formData.purchase_price) || 0,
          sale_price: Number(formData.sale_price) || 0,
          alert_threshold: Number(formData.alert_threshold) || 5
        });
        toast.success(`Produit ${formData.name} mis à jour.`);
      } else {
        await api.createProduct({
          ...formData,
          category_id: formData.category_id ? Number(formData.category_id) : null,
          supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
          purchase_price: Number(formData.purchase_price) || 0,
          sale_price: Number(formData.sale_price) || 0,
          stock_quantity: Number(formData.stock_quantity) || 0,
          alert_threshold: Number(formData.alert_threshold) || 5
        });
        toast.success(`Produit ${formData.name} créé avec succès.`);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur enregistrement produit.');
    }
  };

  const handleToggleArchive = async (p: Product) => {
    try {
      await api.toggleArchiveProduct(p.id);
      toast.success(p.is_archived === 1 ? `Produit ${p.name} restauré.` : `Produit ${p.name} archivé.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur archivage produit.');
    }
  };

  const viewProductHistory = async (p: Product) => {
    try {
      const movements = await api.getStockMovements({ product_id: p.id });
      setSelectedProductHistory({ product: p, movements });
      setHistoryModalOpen(true);
    } catch (err: any) {
      toast.error('Erreur chargement historique du produit.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toast.error('Le nom de catégorie est obligatoire.');
      return;
    }
    try {
      await api.createCategory({ name: newCatName.trim(), description: newCatDesc.trim() || undefined });
      toast.success(`Catégorie "${newCatName}" ajoutée.`);
      setNewCatName('');
      setNewCatDesc('');
      const cats = await api.getCategories();
      setCategories(cats);
    } catch (err: any) {
      toast.error(err.message || 'Erreur création catégorie.');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette catégorie ?')) return;
    try {
      await api.deleteCategory(id);
      toast.success('Catégorie supprimée.');
      const cats = await api.getCategories();
      setCategories(cats);
    } catch (err: any) {
      toast.error(err.message || 'Erreur suppression catégorie.');
    }
  };

  const handleLoadDefaultCategories = async () => {
    try {
      const res = await api.loadDefaultCategories();
      toast.success(res.message || 'Catégories cosmétiques ajoutées avec succès.');
      const cats = await api.getCategories();
      setCategories(cats);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement des catégories.');
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer définitivement le produit "${p.name}" (Réf: ${p.code}) ?`)) {
      return;
    }
    try {
      const res = await api.deleteProduct(p.id);
      toast.success(res.message || `Produit "${p.name}" supprimé.`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression du produit.');
    }
  };

  const handleQuickCreateCategory = async () => {
    if (!quickCatName.trim()) {
      toast.error('Indiquez un nom de catégorie.');
      return;
    }
    try {
      const res = await api.createCategory({ name: quickCatName.trim() });
      toast.success(`Catégorie "${quickCatName.trim()}" ajoutée.`);
      const cats = await api.getCategories();
      setCategories(cats);
      setFormData((prev) => ({ ...prev, category_id: String(res.id) }));
      setQuickCatName('');
      setQuickCatOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur ajout catégorie.');
    }
  };

  const handleQuickCreateSupplier = async () => {
    if (!quickSupName.trim()) {
      toast.error('Indiquez le nom du fournisseur.');
      return;
    }
    try {
      const res = await api.createSupplier({
        name: quickSupName.trim(),
        company_name: quickSupName.trim(),
        phone: quickSupPhone.trim() || undefined
      });
      toast.success(`Fournisseur "${quickSupName.trim()}" ajouté.`);
      const sups = await api.getSuppliers();
      setSuppliers(sups);
      setFormData((prev) => ({ ...prev, supplier_id: String(res.id) }));
      setQuickSupName('');
      setQuickSupPhone('');
      setQuickSupOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur ajout fournisseur.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div>
          <h1 className="text-xl font-extrabold text-[#1F2937] tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-[#176B52]" />
            <span>Catalogue des produits et articles divers</span>
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Articles tous genres : cosmétiques, hygiène, mode, beauté et marchandises diverses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasRole(['admin', 'manager', 'stock_manager']) && (
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold text-[#1F2937] bg-white hover:bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl transition active:scale-95 shrink-0 shadow-sm"
            >
              <Tag className="w-3.5 h-3.5 text-[#176B52]" />
              <span>Gérer les Catégories ({categories.length})</span>
            </button>
          )}

          {hasRole(['admin', 'manager', 'stock_manager']) && (
            <button
              onClick={() => setIsExcelImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#176B52] bg-white hover:bg-[#EBF4F0] border-2 border-[#176B52] rounded-xl shadow-xs transition active:scale-95 shrink-0"
              title="Importer le catalogue et tarifs depuis un fichier Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#176B52]" />
              <span>Importer depuis Excel</span>
            </button>
          )}

          {hasRole(['admin', 'manager', 'stock_manager']) && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#176B52] hover:bg-[#125541] rounded-xl shadow-sm transition active:scale-95 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter un Article</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, code ou marque..."
            className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl pl-10 pr-4 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
          >
            <option value="">Toutes les catégories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.product_count || 0})
              </option>
            ))}
          </select>

          {/* Stock Status filter */}
          <div className="flex rounded-xl bg-[#F4F6F3] border border-[#E1E6E2] p-1 text-xs">
            <button
              onClick={() => setStockStatus('all')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                stockStatus === 'all'
                  ? 'bg-[#176B52] text-white shadow-sm font-bold'
                  : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setStockStatus('needs_completion')}
              className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                stockStatus === 'needs_completion'
                  ? 'bg-[#D97732] text-white shadow-sm font-bold'
                  : 'text-[#D97732] hover:bg-[#FDF3EB]'
              }`}
            >
              <span>À compléter</span>
              {needsCompletionCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  stockStatus === 'needs_completion' ? 'bg-white text-[#D97732]' : 'bg-[#D97732] text-white'
                }`}>
                  {needsCompletionCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setStockStatus('low_stock')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                stockStatus === 'low_stock'
                  ? 'bg-[#D97732] text-white shadow-sm font-bold'
                  : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              Stock faible
            </button>
            <button
              onClick={() => setStockStatus('out_of_stock')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                stockStatus === 'out_of_stock'
                  ? 'bg-[#D97732] text-white shadow-sm font-bold'
                  : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              Ruptures
            </button>
            <button
              onClick={() => setStockStatus('archived')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                stockStatus === 'archived'
                  ? 'bg-[#176B52] text-white shadow-sm font-bold'
                  : 'text-[#64748B] hover:text-[#1F2937]'
              }`}
            >
              Archivés
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider border-b border-[#E1E6E2]">
              <tr>
                <th className="p-3.5">Réf / Code</th>
                <th className="p-3.5">Article & Marque</th>
                <th className="p-3.5">Catégorie</th>
                <th className="p-3.5 text-right">P. Achat</th>
                <th className="p-3.5 text-right">P. Vente</th>
                <th className="p-3.5 text-right">Marge</th>
                <th className="p-3.5 text-center">Stock</th>
                <th className="p-3.5">Expiration / Lot</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6E2]">
              {filteredProducts.map((p) => {
                const margin = p.sale_price - p.purchase_price;
                const marginPercent = p.purchase_price > 0 ? ((margin / p.purchase_price) * 100).toFixed(0) : '0';
                const isOutOfStock = p.stock_quantity <= 0;
                const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= p.alert_threshold;
                const isNeedsCompletion = p.needs_completion === 1 || p.sale_price <= 0;

                return (
                  <tr key={p.id} className={`hover:bg-[#F4F6F3]/60 transition ${isNeedsCompletion ? 'bg-[#FDF3EB]/30' : ''}`}>
                    <td className="p-3.5 font-mono font-bold text-[#176B52]">{p.code}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-[#1F2937] flex items-center gap-2">
                        <span>{p.name}</span>
                        {isNeedsCompletion && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D97732] bg-[#FDF3EB] px-2 py-0.5 rounded border border-[#F6CEB4]">
                            <AlertTriangle className="w-3 h-3" />
                            À compléter
                          </span>
                        )}
                      </div>
                      {p.brand && <div className="text-[10px] text-[#64748B]">{p.brand}</div>}
                    </td>
                    <td className="p-3.5">
                      <span className="inline-block bg-[#F4F6F3] text-[#1F2937] px-2 py-0.5 rounded text-[11px] font-medium border border-[#E1E6E2]">
                        {p.category_name || 'Divers'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right text-[#64748B]">{formatGNF(p.purchase_price)}</td>
                    <td className="p-3.5 text-right font-bold text-[#1F2937]">
                      {isNeedsCompletion ? (
                        <span className="text-[#D97732] font-bold text-[11px] bg-[#FDF3EB] px-2 py-0.5 rounded border border-[#F6CEB4]">
                          Non défini
                        </span>
                      ) : (
                        formatGNF(p.sale_price)
                      )}
                    </td>
                    <td className="p-3.5 text-right font-semibold text-[#176B52]">
                      +{formatGNF(margin)} <span className="text-[10px] text-[#64748B]">({marginPercent}%)</span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isOutOfStock
                            ? 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4] font-extrabold'
                            : isLowStock
                            ? 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4] font-extrabold'
                            : 'bg-[#EBF4F0] text-[#176B52] border border-[#C2DDD3]'
                        }`}
                      >
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td className="p-3.5 text-[#64748B] text-[11px]">
                      {p.expiry_date ? (
                        <div>
                          <span>Exp: {formatDate(p.expiry_date)}</span>
                          {p.batch_number && <div className="text-[10px] text-[#64748B]">Lot: {p.batch_number}</div>}
                        </div>
                      ) : (
                        <span className="text-[#64748B]">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right space-x-1 shrink-0">
                      <button
                        onClick={() => viewProductHistory(p)}
                        className="p-1.5 text-[#64748B] hover:text-[#176B52] hover:bg-[#EBF4F0] rounded-lg transition"
                        title="Historique des mouvements"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>

                      {hasRole(['admin', 'manager', 'stock_manager']) && (
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-[#64748B] hover:text-[#176B52] hover:bg-[#EBF4F0] rounded-lg transition"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {hasRole(['admin', 'manager']) && (
                        <button
                          onClick={() => handleToggleArchive(p)}
                          className="p-1.5 rounded-lg transition text-[#64748B] hover:text-[#176B52] hover:bg-[#EBF4F0]"
                          title={p.is_archived === 1 ? 'Restaurer' : 'Archiver'}
                        >
                          {p.is_archived === 1 ? <RotateCcw className="w-3.5 h-3.5 text-[#176B52]" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      {hasRole(['admin', 'manager', 'stock_manager']) && (
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          className="p-1.5 text-[#64748B] hover:text-[#D97732] hover:bg-[#FDF3EB] rounded-lg transition"
                          title="Supprimer définitivement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#64748B] text-xs">
                    {products.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-6 space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#EBF4F0] border border-[#C2DDD3] flex items-center justify-center text-[#176B52] font-bold shadow-sm">
                          <Package className="w-6 h-6" />
                        </div>
                        <div className="text-sm font-extrabold text-[#1F2937]">Votre catalogue est actuellement vide</div>
                        <p className="text-xs text-[#64748B] max-w-md">
                          Toutes les données prédéfinies ont été retirées. Vous pouvez enregistrer vos articles personnalisés ou charger les 11 catégories cosmétiques standard.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                          {hasRole(['admin', 'manager', 'stock_manager']) && (
                            <button
                              onClick={openCreateModal}
                              className="px-4 py-2 bg-[#176B52] hover:bg-[#125541] text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Ajouter un Article</span>
                            </button>
                          )}
                          <button
                            onClick={() => setIsCategoryModalOpen(true)}
                            className="px-4 py-2 bg-white hover:bg-[#F4F6F3] text-[#1F2937] font-bold rounded-xl text-xs transition border border-[#E1E6E2] flex items-center gap-1.5 shadow-sm"
                          >
                            <Tag className="w-3.5 h-3.5 text-[#176B52]" />
                            <span>Gérer les Catégories</span>
                          </button>
                          <button
                            onClick={handleLoadDefaultCategories}
                            className="px-4 py-2 bg-[#176B52] hover:bg-[#125541] text-white font-bold rounded-xl text-xs transition border border-[#176B52] flex items-center gap-1.5 shadow-sm"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-white" />
                            <span>Charger les 11 catégories cosmétiques</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      'Aucun article trouvé dans cette sélection.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? `Modifier l'article: ${editingProduct.name}` : 'Nouvel Article / Produit Divers'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Code ou Référence Unique *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-mono focus:outline-none focus:border-[#176B52]"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Nom du Produit *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Parfum, Savon, Crème, T-shirt, Chaussure, Sac..."
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-[#1F2937]">Catégorie</label>
                <button
                  type="button"
                  onClick={() => setQuickCatOpen(!quickCatOpen)}
                  className="text-[10px] text-[#176B52] font-bold hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>{quickCatOpen ? 'Annuler' : 'Créer catégorie'}</span>
                </button>
              </div>

              {quickCatOpen && (
                <div className="flex gap-1.5 p-2 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2] mb-1.5 animate-fadeIn">
                  <input
                    type="text"
                    value={quickCatName}
                    onChange={(e) => setQuickCatName(e.target.value)}
                    placeholder="Nom nouvelle catégorie..."
                    className="flex-1 bg-white border border-[#E1E6E2] rounded-lg px-2.5 py-1 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateCategory}
                    className="px-2.5 py-1 bg-[#176B52] hover:bg-[#125541] text-white rounded-lg font-bold text-xs shrink-0 transition"
                  >
                    Ajouter
                  </button>
                </div>
              )}

              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              >
                <option value="">(Aucune catégorie)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Marque</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Ex: Mixa, Nivea, Dudu Osun..."
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Prix d'Achat Unitaire (GNF) *</label>
              <input
                type="number"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                placeholder="0 GNF"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Prix de Vente Unitaire (GNF) *</label>
              <input
                type="number"
                value={formData.sale_price}
                onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                placeholder="0 GNF"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-bold focus:outline-none focus:border-[#176B52]"
                required
              />
            </div>

            {!editingProduct && (
              <div>
                <label className="block font-bold text-[#1F2937] mb-1">Stock Initial en Rayon</label>
                <input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  placeholder="0"
                  className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Seuil d'Alerte Stock Faible</label>
              <input
                type="number"
                value={formData.alert_threshold}
                onChange={(e) => setFormData({ ...formData, alert_threshold: e.target.value })}
                placeholder="5"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-[#1F2937]">Fournisseur</label>
                <button
                  type="button"
                  onClick={() => setQuickSupOpen(!quickSupOpen)}
                  className="text-[10px] text-[#176B52] font-bold hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>{quickSupOpen ? 'Annuler' : 'Créer fournisseur'}</span>
                </button>
              </div>

              {quickSupOpen && (
                <div className="space-y-1.5 p-2 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2] mb-1.5 animate-fadeIn">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={quickSupName}
                      onChange={(e) => setQuickSupName(e.target.value)}
                      placeholder="Nom établissement..."
                      className="flex-1 bg-white border border-[#E1E6E2] rounded-lg px-2.5 py-1 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                    />
                    <button
                      type="button"
                      onClick={handleQuickCreateSupplier}
                      className="px-2.5 py-1 bg-[#176B52] hover:bg-[#125541] text-white rounded-lg font-bold text-xs shrink-0 transition"
                    >
                      Ajouter
                    </button>
                  </div>
                  <input
                    type="text"
                    value={quickSupPhone}
                    onChange={(e) => setQuickSupPhone(e.target.value)}
                    placeholder="Téléphone (facultatif)..."
                    className="w-full bg-white border border-[#E1E6E2] rounded-lg px-2.5 py-1 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                  />
                </div>
              )}

              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              >
                <option value="">(Aucun fournisseur)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Date d'Expiration</label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              />
            </div>

            <div>
              <label className="block font-bold text-[#1F2937] mb-1">Numéro de Lot</label>
              <input
                type="text"
                value={formData.batch_number}
                onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                placeholder="Ex: LOT-2024-09"
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-[#1F2937] mb-1">Description</label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Détails du produit..."
                className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-[#E1E6E2]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium border border-transparent hover:border-[#E1E6E2] transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold shadow-sm transition active:scale-95"
            >
              {editingProduct ? 'Mettre à jour' : 'Enregistrer le produit'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Movement History Modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Historique de stock: ${selectedProductHistory?.product?.name || ''}`}
        maxWidth="2xl"
      >
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2] font-medium">
            <span>Stock actuel: <strong className="text-[#176B52]">{selectedProductHistory?.product?.stock_quantity} unités</strong></span>
            <span>Prix Vente: <strong className="text-[#1F2937]">{formatGNF(selectedProductHistory?.product?.sale_price)}</strong></span>
          </div>

          <div className="overflow-x-auto max-h-[50vh]">
            <table className="w-full text-left">
              <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider border-b border-[#E1E6E2] text-[10px]">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Type Mouvement</th>
                  <th className="p-2.5 text-center">Variation</th>
                  <th className="p-2.5 text-center">Nouveau Stock</th>
                  <th className="p-2.5">Motif / Justification</th>
                  <th className="p-2.5">Utilisateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2] text-[11px]">
                {selectedProductHistory?.movements?.map((m: any) => (
                  <tr key={m.id} className="hover:bg-[#F4F6F3]/50">
                    <td className="p-2.5 text-[#64748B]">{formatDateTime(m.created_at)}</td>
                    <td className="p-2.5 font-medium text-[#1F2937]">{getMovementTypeLabel(m.movement_type)}</td>
                    <td className={`p-2.5 text-center font-bold ${m.quantity > 0 ? 'text-[#176B52]' : 'text-[#D97732]'}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="p-2.5 text-center font-semibold text-[#1F2937]">{m.new_quantity}</td>
                    <td className="p-2.5 text-[#64748B] max-w-xs truncate">{m.reason}</td>
                    <td className="p-2.5 text-[#64748B]">{m.user_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Category Management Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Gestion des Catégories de Produits"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          {/* Quick populate button */}
          <div className="p-3.5 bg-[#176B52] text-white rounded-xl flex items-center justify-between gap-3 shadow-sm">
            <div>
              <strong className="text-white block font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-white" />
                <span>Catégories Cosmétiques Suggérées</span>
              </strong>
              <span className="text-[11px] text-white/80 block mt-0.5">
                Les 11 catégories recommandées (Maquillage, Parfums, Crèmes, Savons, Bébés, Hygiène intime...)
              </span>
            </div>
            <button
              type="button"
              onClick={handleLoadDefaultCategories}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-[#176B52] hover:bg-[#F4F6F3] font-bold text-xs rounded-xl shadow-sm shrink-0 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Charger</span>
            </button>
          </div>

          {/* Add custom category form */}
          <form onSubmit={handleCreateCategory} className="p-3.5 bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl space-y-2.5">
            <label className="font-bold text-[#1F2937] block">Créer une nouvelle catégorie personnalisée :</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Ex: Soins Visage Bio, Perruques, Accessoires Spa..."
                className="flex-1 bg-white border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#176B52] hover:bg-[#125541] text-white rounded-xl font-bold text-xs shrink-0 transition shadow-sm active:scale-95"
              >
                + Ajouter
              </button>
            </div>
            <input
              type="text"
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              placeholder="Description facultative..."
              className="w-full bg-white border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#176B52]"
            />
          </form>

          {/* Categories List */}
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            <span className="font-bold text-[#1F2937] block mb-1">
              Catégories enregistrées ({categories.length}) :
            </span>
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-2.5 bg-white border border-[#E1E6E2] rounded-xl hover:border-[#176B52]/40 transition"
              >
                <div>
                  <span className="font-bold text-[#1F2937]">{c.name}</span>
                  {c.description && <span className="text-[10px] text-[#64748B] block">{c.description}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EBF4F0] font-bold text-[#176B52] border border-[#C2DDD3]">
                    {c.product_count || 0} produit(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(c.id)}
                    className="p-1 text-[#64748B] hover:text-[#D97732] hover:bg-[#FDF3EB] transition rounded"
                    title="Supprimer la catégorie"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <div className="py-6 text-center text-[#64748B] italic">
                Aucune catégorie pour le moment. Créez-en une ci-dessus ou chargez les catégories suggérées.
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Excel Catalogue Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        onImportSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
};
