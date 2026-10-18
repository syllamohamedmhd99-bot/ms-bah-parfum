// Utility functions for formatting currencies, dates, and badges

export function formatGNF(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 GNF';
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' GNF';
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

export function getRoleBadge(role: string): { label: string; color: string } {
  switch (role) {
    case 'admin':
      return { label: 'Administrateur', color: 'bg-[#176B52] text-white border border-[#125541] font-bold' };
    case 'manager':
      return { label: 'Gérant', color: 'bg-[#EBF4F0] text-[#176B52] border border-[#C2DFD4] font-bold' };
    case 'cashier':
      return { label: 'Caissier', color: 'bg-white text-[#1F2937] border border-[#E1E6E2] font-medium' };
    case 'stock_manager':
      return { label: 'Gestionnaire Stock', color: 'bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2] font-medium' };
    default:
      return { label: role, color: 'bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2]' };
  }
}

export function getPaymentModeBadge(mode: string): { label: string; color: string } {
  switch (mode) {
    case 'cash':
      return { label: 'Espèces', color: 'bg-[#EBF4F0] text-[#176B52] border border-[#C2DFD4] font-semibold' };
    case 'orange_money':
      return { label: 'Orange Money', color: 'bg-white text-[#1F2937] border border-[#E1E6E2] font-semibold' };
    case 'mtn_momo':
      return { label: 'MTN MoMo', color: 'bg-white text-[#1F2937] border border-[#E1E6E2] font-semibold' };
    case 'credit':
      return { label: 'Vente à Crédit', color: 'bg-[#FDF3EB] text-[#D97732] border border-[#F6CEB4] font-bold' };
    case 'mixed':
      return { label: 'Paiement Mixte', color: 'bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2] font-semibold' };
    default:
      return { label: mode, color: 'bg-[#F4F6F3] text-[#1F2937] border border-[#E1E6E2]' };
  }
}

export function getMovementTypeLabel(type: string): string {
  switch (type) {
    case 'reception': return 'Réception marchandise';
    case 'sale': return 'Vente comptoir';
    case 'damaged': return 'Produit endommagé';
    case 'expired': return 'Produit expiré';
    case 'loss_theft': return 'Perte ou vol';
    case 'internal_use': return 'Utilisation interne';
    case 'return_supplier': return 'Retour au fournisseur';
    case 'return_client': return 'Retour client';
    case 'inventory_adjustment': return 'Ajustement inventaire';
    case 'transfer_in': return 'Transfert entrant';
    case 'transfer_out': return 'Transfert sortant';
    default: return type;
  }
}
