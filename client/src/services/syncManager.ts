import { api } from './api.js';

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  engine: 'neon_postgresql' | 'local_sqlite' | 'offline';
  neonConnected: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  productsCount: number;
  latencyMs?: number;
  error?: string | null;
}

const QUEUE_STORAGE_KEY = 'ms_bah_sync_queue';
const LAST_SYNC_KEY = 'ms_bah_last_sync_time';

type Listener = (state: SyncState) => void;

class SyncManager {
  private state: SyncState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    engine: 'local_sqlite',
    neonConnected: false,
    pendingCount: 0,
    lastSyncTime: null,
    productsCount: 320,
    latencyMs: undefined,
    error: null,
  };

  private listeners: Set<Listener> = new Set();
  private checkInterval: any = null;

  constructor() {
    this.loadInitialState();
    this.setupNetworkListeners();
    this.startPeriodicCheck();
  }

  private loadInitialState() {
    if (typeof localStorage !== 'undefined') {
      try {
        const queue = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
        this.state.pendingCount = queue.length;
        const lastSync = localStorage.getItem(LAST_SYNC_KEY);
        if (lastSync) {
          this.state.lastSyncTime = new Date(lastSync);
        }
      } catch {
        this.state.pendingCount = 0;
      }
    }
  }

  private setupNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.state.isOnline = true;
        this.notify();
        this.syncNow();
      });

      window.addEventListener('offline', () => {
        this.state.isOnline = false;
        this.state.engine = 'offline';
        this.notify();
      });
    }

    // Support @capacitor/network si disponible sur mobile
    try {
      import('@capacitor/network').then(({ Network }) => {
        Network.addListener('networkStatusChange', (status) => {
          this.state.isOnline = status.connected;
          if (status.connected) {
            this.syncNow();
          } else {
            this.state.engine = 'offline';
          }
          this.notify();
        });
      }).catch(() => {
        // En mode web standard
      });
    } catch {
      // Ignore
    }
  }

  private startPeriodicCheck() {
    // Vérifier l'état toutes les 30 secondes
    this.checkStatus();
    this.checkInterval = setInterval(() => {
      this.checkStatus();
    }, 30000);
  }

  public async checkStatus(): Promise<SyncState> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.state.isOnline = false;
      this.state.engine = 'offline';
      this.notify();
      return this.state;
    }

    try {
      const res = await api.getSyncStatus();
      this.state.isOnline = true;
      this.state.engine = res.engine || 'local_sqlite';
      this.state.neonConnected = !!res.neon_connected;
      this.state.productsCount = res.catalogue?.products_count || this.state.productsCount;
      this.state.latencyMs = res.neon_details?.latencyMs;
      this.state.error = null;
    } catch (err: any) {
      this.state.isOnline = false;
      this.state.engine = 'offline';
      this.state.error = err.message || 'Impossible de joindre le serveur';
    }

    this.notify();
    return this.state;
  }

  /**
   * Enregistre une mutation locale en mode déconnecté
   */
  public enqueueMutation(mutation: {
    entity_type: 'sale' | 'stock_movement' | 'cash_operation' | 'transfer';
    action: 'create' | 'update' | 'delete';
    payload: any;
  }) {
    if (typeof localStorage === 'undefined') return;

    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
      const newMutation = {
        mutation_id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        ...mutation,
        timestamp: new Date().toISOString()
      };

      queue.push(newMutation);
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      this.state.pendingCount = queue.length;
      this.notify();

      // Si le réseau est disponible, tenter la synchronisation immédiate
      if (this.state.isOnline) {
        this.syncNow();
      }
    } catch (err) {
      console.error('[SYNC] Erreur enfilage mutation:', err);
    }
  }

  /**
   * Déclenche une synchronisation complète (Push + Pull)
   */
  public async syncNow(): Promise<boolean> {
    if (this.state.isSyncing) return false;

    this.state.isSyncing = true;
    this.notify();

    try {
      // 1. Envoyer les mutations en attente (Push)
      let queue: any[] = [];
      try {
        queue = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
      } catch {
        queue = [];
      }

      if (queue.length > 0) {
        const pushRes = await api.syncPush(queue);
        if (pushRes && pushRes.summary) {
          // Vider les mutations traitées avec succès
          localStorage.removeItem(QUEUE_STORAGE_KEY);
          this.state.pendingCount = 0;
        }
      }

      // 2. Récupérer les nouveautés du serveur (Pull)
      const lastSyncIso = this.state.lastSyncTime ? this.state.lastSyncTime.toISOString() : undefined;
      const pullRes = await api.syncPull(lastSyncIso);
      
      this.state.productsCount = pullRes.delta_count?.products || this.state.productsCount;
      this.state.lastSyncTime = new Date();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LAST_SYNC_KEY, this.state.lastSyncTime.toISOString());
      }

      // 3. Re-vérifier le statut
      await this.checkStatus();
      return true;
    } catch (err: any) {
      console.warn('[SYNC] Échec de la synchronisation:', err.message);
      this.state.error = err.message;
      return false;
    } finally {
      this.state.isSyncing = false;
      this.notify();
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  public getState(): SyncState {
    return { ...this.state };
  }
}

export const syncManager = new SyncManager();
