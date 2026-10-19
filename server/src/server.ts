import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Initialize database
import db from './database.js';

// Import routes
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import categoriesRoutes from './routes/categories.js';
import productsRoutes from './routes/products.js';
import stockRoutes from './routes/stock.js';
import salesRoutes from './routes/sales.js';
import transfersRoutes from './routes/transfers.js';
import cashRoutes from './routes/cash.js';
import financesRoutes from './routes/finances.js';
import clientsRoutes from './routes/clients.js';
import suppliersRoutes from './routes/suppliers.js';
import inventoryRoutes from './routes/inventory.js';
import alertsRoutes from './routes/alerts.js';
import reportsRoutes from './routes/reports.js';
import auditRoutes from './routes/audit.js';
import backupRoutes from './routes/backup.js';
import syncRoutes from './routes/sync.js';

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check (supports both /api/health and /health)
const handleHealth = (req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    app: 'Seydou Boutique Cosmétique & Hygiène API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
};
app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

// Settings endpoint (supports both /api/settings and /settings)
const handleSettings = (req: express.Request, res: express.Response) => {
  try {
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settingsObj: Record<string, string> = {};
    for (const row of settingsRows) {
      settingsObj[row.key] = row.value;
    }
    res.json(settingsObj);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
};
app.get('/api/settings', handleSettings);
app.get('/settings', handleSettings);

// Helper to register routes on both /api and root /
const registerRoute = (prefix: string, handler: express.Router) => {
  app.use(`/api${prefix}`, handler);
  app.use(prefix, handler);
};

// Register API Routes
registerRoute('/auth', authRoutes);
registerRoute('/dashboard', dashboardRoutes);
registerRoute('/categories', categoriesRoutes);
registerRoute('/products', productsRoutes);
registerRoute('/stock', stockRoutes);
registerRoute('/sales', salesRoutes);
registerRoute('/transfers', transfersRoutes);
registerRoute('/cash', cashRoutes);
registerRoute('/finances', financesRoutes);
registerRoute('/clients', clientsRoutes);
registerRoute('/suppliers', suppliersRoutes);
registerRoute('/inventory', inventoryRoutes);
registerRoute('/alerts', alertsRoutes);
registerRoute('/reports', reportsRoutes);
registerRoute('/audit', auditRoutes);
registerRoute('/backup', backupRoutes);
registerRoute('/sync', syncRoutes);

// Serve Frontend SPA if built
const clientDistCandidates = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.join(__dirname, '../client/dist'),
];
const clientDistPath = clientDistCandidates.find(p => fs.existsSync(p)) || clientDistCandidates[0];

if (fs.existsSync(clientDistPath)) {
  const apiPrefixes = [
    '/api', '/auth', '/dashboard', '/categories', '/products', '/stock',
    '/sales', '/transfers', '/cash', '/finances', '/clients', '/suppliers',
    '/inventory', '/alerts', '/reports', '/audit', '/backup', '/sync',
    '/settings', '/health'
  ];
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (apiPrefixes.some(p => req.path === p || req.path.startsWith(`${p}/`))) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erreur Serveur Non interceptée:', err);
  res.status(500).json({
    error: err.message || 'Une erreur interne est survenue sur le serveur.'
  });
});

export function startServer(initialPort: number = 5050): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const host = process.env.HOST || '0.0.0.0';
    const basePort = Number(process.env.PORT) || initialPort;
    const maxPort = basePort + 50;

    function tryListen(portToTry: number) {
      const server = http.createServer(app);

      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[SERVER] Port ${portToTry} déjà utilisé, tentative sur le port suivant...`);
          if (portToTry < maxPort) {
            tryListen(portToTry + 1);
          } else {
            console.warn(`[SERVER] Plage épuisée, attribution dynamique automatique (port 0)...`);
            tryListen(0);
          }
        } else {
          console.error(`[SERVER] Erreur serveur critique:`, err);
          reject(err);
        }
      });

      server.once('listening', () => {
        const address = server.address();
        const actualPort = typeof address === 'object' && address ? address.port : portToTry;
        console.log(`=======================================================`);
        console.log(`  MS BAH PARFUM - SERVEUR BACKEND DÉMARRÉ`);
        console.log(`  Port: ${actualPort}`);
        console.log(`  Hôte: ${host}`);
        console.log(`  Mode: ${process.env.NODE_ENV || 'développement'}`);
        console.log(`  URL API: http://${host === '0.0.0.0' ? 'localhost' : host}:${actualPort}/api`);
        console.log(`=======================================================`);
        resolve({ server, port: actualPort });
      });

      server.listen(portToTry, host);
    }

    tryListen(basePort);
  });
}

// Auto-start if running outside Electron
if (!process.versions || !process.versions.electron) {
  startServer().catch((err) => {
    console.error('Erreur au démarrage du serveur:', err);
  });
}

export default app;

