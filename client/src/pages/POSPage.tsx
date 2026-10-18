import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Printer,
  Download,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
  AlertCircle,
  History,
  RotateCcw,
  Package
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api.js';
import { Product, Category, Client, CartItem, Sale, SaleItem } from '../types.js';
import { formatGNF, formatDateTime, getPaymentModeBadge } from '../utils/formatters.js';
import { saveReceiptAsPdf } from '../utils/receiptPdf.js';
import { useToast } from '../context/ToastContext.js';
import { useAuth } from '../context/AuthContext.js';
import { ReceiptModal } from '../components/ReceiptModal.js';
import { Modal } from '../components/Modal.js';

export const POSPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'orange_money' | 'mtn_momo' | 'mixed' | 'credit'>('cash');
  const [discount, setDiscount] = useState<number>(0);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Receipt Modal State
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [completedItems, setCompletedItems] = useState<SaleItem[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Sales History Tab
  const [viewHistory, setViewHistory] = useState(false);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);

  // Cancel Sale Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Quick Client Creation Modal
  const [quickClientModalOpen, setQuickClientModalOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({
    name: '',
    phone: '',
    address: '',
    credit_limit: '500000'
  });

  const toast = useToast();
  const { user, hasRole } = useAuth();

  const handleQuickCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientForm.name.trim()) {
      toast.error('Le nom du client est obligatoire.');
      return;
    }
    try {
      const res = await api.createClient({
        name: quickClientForm.name.trim(),
        phone: quickClientForm.phone.trim() || undefined,
        address: quickClientForm.address.trim() || undefined,
        credit_limit: Number(quickClientForm.credit_limit) || 0
      });
      toast.success(`Client(e) "${quickClientForm.name.trim()}" créé(e) avec succès.`);
      const cls = await api.getClients();
      setClients(cls);
      setSelectedClientId(String(res.id));
      setQuickClientModalOpen(false);
      setQuickClientForm({ name: '', phone: '', address: '', credit_limit: '500000' });
    } catch (err: any) {
      toast.error(err.message || 'Erreur création client.');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats, cls] = await Promise.all([
        api.getProducts({ is_archived: 'false' }).catch((err) => {
          console.warn('getProducts non disponible ou vide:', err);
          return [];
        }),
        api.getCategories().catch((err) => {
          console.warn('getCategories non disponible ou vide:', err);
          return [];
        }),
        api.getClients().catch((err) => {
          console.warn('getClients non disponible ou vide:', err);
          return [];
        })
      ]);
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
      setClients(Array.isArray(cls) ? cls : []);
    } catch (err: any) {
      console.error('Erreur globale POS:', err);
      // Ne lever une alerte que si un problème bloquant réel est survenu
      if (err?.message && !err.message.includes('401')) {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSalesHistory = async () => {
    try {
      const sales = await api.getSales({ limit: 30 }).catch((err) => {
        console.warn('getSales non disponible ou vide:', err);
        return [];
      });
      setRecentSales(Array.isArray(sales) ? sales : []);
    } catch (err) {
      console.error('Erreur chargement historique:', err);
      setRecentSales([]);
    }
  };

  useEffect(() => {
    loadData();
    loadSalesHistory();
  }, []);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory = selectedCategory === 'all' || String(p.category_id) === selectedCategory;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  }, [cart]);

  const netTotal = useMemo(() => {
    return Math.max(0, subtotal - (Number(discount) || 0));
  }, [subtotal, discount]);

  const numReceived = Number(amountReceived) || 0;
  const changeReturned = useMemo(() => {
    if (paymentMode === 'credit') return 0;
    return Math.max(0, numReceived - netTotal);
  }, [numReceived, netTotal, paymentMode]);

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.needs_completion || product.sale_price <= 0) {
      toast.warning(`Le produit "${product.name}" est incomplet (prix non défini). Veuillez compléter sa fiche dans "Produits" avant de le vendre.`);
      return;
    }

    if (product.stock_quantity <= 0) {
      toast.warning(`Le produit "${product.name}" est en rupture de stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.warning(`Quantité maximale en stock atteinte (${product.stock_quantity}).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: product.sale_price }];
    });
  };

  // Update quantity in cart
  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stock_quantity) {
              toast.warning(`Stock insuffisant (${item.product.stock_quantity} dispo).`);
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Remove from cart
  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Auto fill amount received with exact total or round values
  const setQuickAmount = (multiplier = 1) => {
    setAmountReceived(String(netTotal * multiplier));
  };

  // Submit sale
  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.warning('Le panier est vide.');
      return;
    }

    if (paymentMode === 'credit' && !selectedClientId) {
      toast.error('Pour une vente à crédit, vous devez obligatoirement sélectionner un client enregistré.');
      return;
    }

    if (paymentMode !== 'credit' && numReceived < netTotal && paymentMode !== 'mixed') {
      toast.error(`Le montant reçu (${formatGNF(numReceived)}) est insuffisant pour régler le total (${formatGNF(netTotal)}).`);
      return;
    }

    try {
      setLoading(true);
      const payload = {
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          unitPrice: i.unitPrice
        })),
        client_id: selectedClientId ? Number(selectedClientId) : null,
        payment_mode: paymentMode,
        discount: Number(discount) || 0,
        amount_received: paymentMode === 'credit' ? 0 : (numReceived || netTotal),
        notes
      };

      const res = await api.createSale(payload);

      // Trigger celebratory confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });

      toast.success(`Vente ${res.saleNumber} enregistrée avec succès !`);

      // Prepare receipt data
      const fetchedSale = await api.getSale(res.saleId);
      setCompletedSale(fetchedSale.sale);
      setCompletedItems(fetchedSale.items);
      setIsReceiptOpen(true);

      // Reset cart & reload
      setCart([]);
      setDiscount(0);
      setAmountReceived('');
      setSelectedClientId('');
      setNotes('');
      loadData();
      loadSalesHistory();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la validation de la vente.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Cancel Sale
  const handleConfirmCancel = async () => {
    if (!saleToCancel || !cancelReason.trim()) {
      toast.error('Le motif d\'annulation est obligatoire.');
      return;
    }

    try {
      await api.cancelSale(saleToCancel.id, cancelReason);
      toast.success(`Vente ${saleToCancel.sale_number} annulée.`);
      setCancelModalOpen(false);
      setSaleToCancel(null);
      setCancelReason('');
      loadSalesHistory();
      loadData();
      if (selectedSaleDetail && selectedSaleDetail.sale.id === saleToCancel.id) {
        setSelectedSaleDetail(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'annulation.');
    }
  };

  const handleDeleteSale = async (id: number, saleNumber: string) => {
    if (!window.confirm(`Êtes-vous certain de vouloir supprimer définitivement la vente "${saleNumber}" de l'historique ?`)) {
      return;
    }
    try {
      await api.deleteSale(id);
      toast.success(`Vente ${saleNumber} supprimée de l'historique.`);
      loadSalesHistory();
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression de la vente.');
    }
  };

  const handleClearSales = async () => {
    if (!window.confirm("Êtes-vous certain de vouloir vider TOUT l'historique des ventes ? Cette action est irréversible.")) {
      return;
    }
    try {
      await api.clearSalesHistory();
      toast.success("L'historique des ventes a été entièrement vidé.");
      loadSalesHistory();
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du vidage des ventes.');
    }
  };

  return (
    <div className="space-y-4">
      {/* View Switch Header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewHistory(false)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              !viewHistory
                ? 'bg-[#176B52] text-white shadow-sm'
                : 'text-[#1F2937] hover:bg-[#F4F6F3] border border-[#E1E6E2]'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Point de Vente (Comptoir)</span>
          </button>

          <button
            onClick={() => setViewHistory(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              viewHistory
                ? 'bg-[#176B52] text-white shadow-sm'
                : 'text-[#1F2937] hover:bg-[#F4F6F3] border border-[#E1E6E2]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historique des Ventes ({recentSales.length})</span>
          </button>
        </div>

        <div className="text-xs text-[#64748B] hidden sm:block">
          Caissier: <strong className="text-[#1F2937]">{user?.fullName}</strong>
        </div>
      </div>

      {!viewHistory ? (
        /* MAIN POS INTERFACE */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Product Search & Grid (7 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Search and Category Bar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E1E6E2] shadow-sm space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par nom, code-barres ou marque..."
                  className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#1F2937] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52] transition"
                />
              </div>

              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 ${
                    selectedCategory === 'all'
                      ? 'bg-[#176B52] text-white shadow-sm'
                      : 'bg-[#F4F6F3] text-[#1F2937] hover:bg-[#EBF4F0] hover:text-[#176B52] border border-[#E1E6E2]'
                  }`}
                >
                  Tous les articles
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(String(cat.id))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 ${
                      selectedCategory === String(cat.id)
                        ? 'bg-[#176B52] text-white shadow-sm'
                        : 'bg-[#F4F6F3] text-[#1F2937] hover:bg-[#EBF4F0] hover:text-[#176B52] border border-[#E1E6E2]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 max-h-[68vh] overflow-y-auto p-1">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock_quantity <= 0;
                const isLowStock = p.stock_quantity > 0 && p.stock_quantity <= p.alert_threshold;
                const isNeedsCompletion = p.needs_completion === 1 || p.sale_price <= 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && !isNeedsCompletion && addToCart(p)}
                    className={`bg-white rounded-2xl p-3.5 border transition-all flex flex-col justify-between select-none shadow-sm ${
                      isNeedsCompletion
                        ? 'opacity-65 cursor-not-allowed border-[#F6CEB4] bg-[#FDF3EB]/30'
                        : isOutOfStock
                        ? 'opacity-50 cursor-not-allowed border-[#E1E6E2] bg-[#F4F6F3]'
                        : 'cursor-pointer border-[#E1E6E2] hover:border-[#176B52] hover:shadow-md active:scale-95 group'
                    }`}
                    title={
                      isNeedsCompletion
                        ? 'Prix non défini : complétez la fiche produit avant de pouvoir le vendre'
                        : undefined
                    }
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[10px] font-mono text-[#64748B] truncate">
                          {p.code}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            isNeedsCompletion
                              ? 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4]'
                              : isOutOfStock
                              ? 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4]'
                              : isLowStock
                              ? 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4]'
                              : 'bg-[#EBF4F0] text-[#176B52]'
                          }`}
                        >
                          {isNeedsCompletion
                            ? 'Fiche incomplète'
                            : `${p.stock_quantity} en stock`}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[#1F2937] line-clamp-2 leading-tight">
                        {p.name}
                      </h4>
                      {p.brand && (
                        <p className="text-[10px] text-[#64748B] mt-0.5">{p.brand}</p>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-[#E1E6E2] flex items-center justify-between">
                      <span className="text-xs font-bold text-[#176B52]">
                        {isNeedsCompletion ? (
                          <span className="text-[#D97732] font-semibold text-[11px]">Prix à définir</span>
                        ) : (
                          formatGNF(p.sale_price)
                        )}
                      </span>
                      {!isOutOfStock && !isNeedsCompletion && (
                        <div className="w-6 h-6 rounded-lg bg-[#EBF4F0] text-[#176B52] flex items-center justify-center group-hover:bg-[#176B52] group-hover:text-white transition">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredProducts.length === 0 && (
                <div className="col-span-full py-16 text-center text-slate-400 text-xs">
                  {products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-1">
                        <Package className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-800 text-sm">Le catalogue est actuellement vide</p>
                      <p className="text-[11px] text-slate-500 max-w-sm">
                        Toutes les données de test ont été purgées. Rendez-vous dans l'onglet « Produits » pour ajouter vos articles.
                      </p>
                    </div>
                  ) : (
                    'Aucun produit trouvé pour cette recherche.'
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Interactive Cart & Checkout (5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-5 flex flex-col justify-between min-h-[72vh]">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E1E6E2] mb-3">
                  <h3 className="font-bold text-sm text-[#1F2937] flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-[#176B52]" />
                    <span>Panier en cours ({cart.length})</span>
                  </h3>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-[11px] text-[#64748B] hover:text-[#D97732] font-semibold flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Vider</span>
                    </button>
                  )}
                </div>

                {/* Cart Items List */}
                <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-2.5 bg-[#F4F6F3] rounded-xl border border-[#E1E6E2] flex items-center justify-between gap-2 transition-colors animate-fade-in"
                    >
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-[#1F2937] truncate">
                          {item.product.name}
                        </h5>
                        <p className="text-[10px] text-[#64748B]">
                          {formatGNF(item.unitPrice)} / unité
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-6 h-6 rounded-lg bg-white border border-[#E1E6E2] flex items-center justify-center text-[#1F2937] hover:bg-[#F4F6F3] transition shadow-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-[#1F2937]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="w-6 h-6 rounded-lg bg-white border border-[#E1E6E2] flex items-center justify-center text-[#1F2937] hover:bg-[#F4F6F3] transition shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right shrink-0 w-20">
                        <span className="text-xs font-bold text-[#176B52]">
                          {formatGNF(item.quantity * item.unitPrice)}
                        </span>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-[#64748B] hover:text-[#D97732] p-1 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <div className="py-8 text-center text-[#64748B] text-xs flex flex-col items-center gap-2">
                      <ShoppingCart className="w-8 h-8 text-[#E1E6E2]" />
                      <span>Le panier est vide. Cliquez sur un article pour l'ajouter.</span>
                    </div>
                  )}
                </div>

                {/* Client selector */}
                <div className="mt-4 pt-3 border-t border-[#E1E6E2]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-[#1F2937]">
                      Client(e) rattaché(e) :
                    </label>
                    <button
                      type="button"
                      onClick={() => setQuickClientModalOpen(true)}
                      className="text-[10px] text-[#176B52] font-bold hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Nouveau client</span>
                    </button>
                  </div>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
                  >
                    <option value="">Comptoir anonyme (Passage)</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone || 'Sans tel'}) {c.current_debt > 0 ? `• Dette: ${formatGNF(c.current_debt)}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Mode Selector */}
                <div className="mt-3">
                  <label className="block text-[11px] font-bold text-[#1F2937] mb-1.5">
                    Mode de Règlement :
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('cash')}
                      className={`p-2 rounded-xl font-semibold border flex items-center justify-center gap-1.5 transition active:scale-95 ${
                        paymentMode === 'cash'
                          ? 'bg-[#176B52] text-white border-[#176B52] shadow-sm'
                          : 'bg-[#F4F6F3] text-[#1F2937] border-[#E1E6E2] hover:bg-white'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Espèces</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMode('orange_money')}
                      className={`p-2 rounded-xl font-semibold border flex items-center justify-center gap-1.5 transition active:scale-95 ${
                        paymentMode === 'orange_money'
                          ? 'bg-[#176B52] text-white border-[#176B52] shadow-sm'
                          : 'bg-[#F4F6F3] text-[#1F2937] border-[#E1E6E2] hover:bg-white'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Orange Money</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMode('mtn_momo')}
                      className={`p-2 rounded-xl font-semibold border flex items-center justify-center gap-1.5 transition active:scale-95 ${
                        paymentMode === 'mtn_momo'
                          ? 'bg-[#176B52] text-white border-[#176B52] shadow-sm'
                          : 'bg-[#F4F6F3] text-[#1F2937] border-[#E1E6E2] hover:bg-white'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>MTN MoMo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMode('credit')}
                      className={`p-2 rounded-xl font-semibold border flex items-center justify-center gap-1.5 transition active:scale-95 ${
                        paymentMode === 'credit'
                          ? 'bg-[#D97732] text-white border-[#D97732] shadow-sm'
                          : 'bg-[#F4F6F3] text-[#1F2937] border-[#E1E6E2] hover:bg-white'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Vente à Crédit</span>
                    </button>
                  </div>
                </div>

                {/* Discount input */}
                <div className="mt-3 flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-[#64748B] mb-0.5">
                      Remise (GNF) :
                    </label>
                    <input
                      type="number"
                      value={discount || ''}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                      placeholder="0 GNF"
                      className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] focus:outline-none focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
                    />
                  </div>

                  {paymentMode !== 'credit' && (
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-[#64748B] mb-0.5">
                        Montant Reçu (GNF) :
                      </label>
                      <input
                        type="number"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder={formatGNF(netTotal)}
                        className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] font-bold focus:outline-none focus:ring-1 focus:ring-[#176B52] focus:border-[#176B52]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Totals & Submit */}
              <div className="mt-4 pt-4 border-t border-[#E1E6E2] space-y-2">
                <div className="flex justify-between text-xs text-[#64748B]">
                  <span>Sous-total:</span>
                  <span>{formatGNF(subtotal)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-xs text-[#D97732] font-semibold">
                    <span>Remise déduite:</span>
                    <span>-{formatGNF(discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-bold text-[#1F2937] pt-1 border-t border-[#E1E6E2]">
                  <span>TOTAL NET:</span>
                  <span className="text-[#176B52] text-lg font-bold">{formatGNF(netTotal)}</span>
                </div>

                {paymentMode !== 'credit' && (
                  <div className="flex justify-between text-xs font-bold pt-1">
                    <span className="text-[#64748B]">Monnaie à rendre:</span>
                    <span className="text-[#1F2937] text-sm font-bold">
                      {formatGNF(changeReturned)}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={loading || cart.length === 0}
                  className="w-full mt-2 flex items-center justify-center gap-2 bg-[#176B52] hover:bg-[#125541] text-white font-bold py-3 px-4 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-50 text-sm"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Valider & Imprimer Ticket ({formatGNF(netTotal)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SALES HISTORY TAB */
        <div className="bg-white rounded-2xl border border-[#E1E6E2] shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-[#1F2937] text-sm">Historique Récent des Ventes</h3>
              <p className="text-[11px] text-[#64748B]">Visualisez, imprimez, annulez ou supprimez des tickets de vente.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748B]">{recentSales.length} vente(s)</span>
              {hasRole(['admin']) && recentSales.length > 0 && (
                <button
                  onClick={handleClearSales}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#D97732] bg-[#FDF3EB] hover:bg-[#FCEADE] border border-[#F6CEB4] rounded-xl transition shadow-sm active:scale-95"
                  title="Vider tout l'historique des ventes"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#D97732]" />
                  <span>Vider l'historique</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F6F3] text-[#64748B] uppercase tracking-wider border-b border-[#E1E6E2]">
                <tr>
                  <th className="p-3">Réf Ticket</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Client</th>
                  <th className="p-3">Caissier</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3 text-right">Montant</th>
                  <th className="p-3 text-center">Statut</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E6E2]">
                {recentSales.map((s) => {
                  const modeBadge = getPaymentModeBadge(s.payment_mode);
                  return (
                    <tr key={s.id} className="hover:bg-[#F4F6F3]/70 transition">
                      <td className="p-3 font-mono font-bold text-[#1F2937]">{s.sale_number}</td>
                      <td className="p-3 text-[#64748B]">{formatDateTime(s.date)}</td>
                      <td className="p-3 text-[#1F2937] font-medium">{s.client_name || 'Comptoir'}</td>
                      <td className="p-3 text-[#64748B]">{s.cashier_name}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-semibold ${modeBadge.color}`}>
                          {modeBadge.label}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-[#176B52]">{formatGNF(s.total_amount)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.status === 'completed'
                            ? 'bg-[#EBF4F0] text-[#176B52]'
                            : 'bg-[#FDF3EB] text-[#D97732] line-through'
                        }`}>
                          {s.status === 'completed' ? 'Validée' : 'Annulée'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={async () => {
                            const details = await api.getSale(s.id);
                            setCompletedSale(details.sale);
                            setCompletedItems(details.items);
                            setIsReceiptOpen(true);
                          }}
                          className="p-1.5 text-[#1F2937] hover:text-[#176B52] hover:bg-[#EBF4F0] rounded-lg transition"
                          title="Afficher & imprimer le ticket"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={async () => {
                            try {
                              const details = await api.getSale(s.id);
                              const res = await saveReceiptAsPdf(details.sale, details.items);
                              if (res.success) {
                                toast.success(`Ticket ${s.sale_number} enregistré en PDF !`);
                              } else if (res.error) {
                                toast.error(`Erreur : ${res.error}`);
                              }
                            } catch (err: any) {
                              toast.error(`Échec export PDF : ${err.message}`);
                            }
                          }}
                          className="p-1.5 text-[#1F2937] hover:text-[#176B52] hover:bg-[#EBF4F0] rounded-lg transition"
                          title="Enregistrer le ticket en PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {s.status === 'completed' && hasRole(['admin', 'manager']) && (
                          <button
                            onClick={() => {
                              setSaleToCancel(s);
                              setCancelReason('');
                              setCancelModalOpen(true);
                            }}
                            className="p-1.5 text-[#D97732] hover:bg-[#FDF3EB] rounded-lg transition"
                            title="Annuler la vente (contrepassation)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {hasRole(['admin', 'manager']) && (
                          <button
                            onClick={() => handleDeleteSale(s.id, s.sale_number)}
                            className="p-1.5 text-[#64748B] hover:text-[#D97732] hover:bg-[#FDF3EB] rounded-lg transition"
                            title="Supprimer définitivement de l'historique"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={completedSale}
        items={completedItems}
      />

      {/* Cancel Sale Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Annuler la vente (Contrepassation & Remise en Stock)"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-[#FDF3EB] border border-[#F6CEB4] text-[#D97732] p-3 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#D97732]" />
            <div>
              <p className="font-bold">Attention : action traçable</p>
              <p className="mt-0.5 text-[#1F2937]">
                L'annulation réintégrera automatiquement les articles dans le stock et déduira le montant ({formatGNF(saleToCancel?.total_amount)}) de la caisse. Cette opération sera inscrite dans le journal d'audit.
              </p>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">
              Motif d'annulation obligatoire :
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: Erreur de saisie client, retour immédiat marchandise..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl p-2.5 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              required
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setCancelModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium"
            >
              Fermer
            </button>
            <button
              onClick={handleConfirmCancel}
              className="px-4 py-2 rounded-xl bg-[#D97732] text-white hover:bg-[#BF6425] font-bold shadow-sm transition active:scale-95"
            >
              Confirmer l'annulation
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Client Modal */}
      <Modal
        isOpen={quickClientModalOpen}
        onClose={() => setQuickClientModalOpen(false)}
        title="Créer rapidement un(e) Client(e)"
        maxWidth="md"
      >
        <form onSubmit={handleQuickCreateClient} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Nom complet *</label>
            <input
              type="text"
              value={quickClientForm.name}
              onChange={(e) => setQuickClientForm({ ...quickClientForm, name: e.target.value })}
              placeholder="Ex: Hadja Mariama, Alpha Oumar..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
              required
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Téléphone</label>
            <input
              type="text"
              value={quickClientForm.phone}
              onChange={(e) => setQuickClientForm({ ...quickClientForm, phone: e.target.value })}
              placeholder="+224 6..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Adresse / Quartier</label>
            <input
              type="text"
              value={quickClientForm.address}
              onChange={(e) => setQuickClientForm({ ...quickClientForm, address: e.target.value })}
              placeholder="Ex: Madina, Dixinn, Kipé..."
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            />
          </div>

          <div>
            <label className="block font-bold text-[#1F2937] mb-1">Plafond de crédit autorisé (GNF)</label>
            <input
              type="number"
              value={quickClientForm.credit_limit}
              onChange={(e) => setQuickClientForm({ ...quickClientForm, credit_limit: e.target.value })}
              className="w-full bg-[#F4F6F3] border border-[#E1E6E2] rounded-xl px-3 py-2 text-xs text-[#1F2937] font-bold focus:outline-none focus:ring-2 focus:ring-[#176B52]/20 focus:border-[#176B52]"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setQuickClientModalOpen(false)}
              className="px-4 py-2 rounded-xl text-[#64748B] hover:bg-[#F4F6F3] font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#176B52] hover:bg-[#125541] text-white font-bold transition active:scale-95 shadow-sm"
            >
              Enregistrer le client
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default POSPage;
