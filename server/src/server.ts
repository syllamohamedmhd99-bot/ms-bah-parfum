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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Seydou Boutique Cosmétique & Hygiène API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Settings endpoint
app.get('/api/settings', (req, res) => {
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
});

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/sync', syncRoutes);

// Serve Frontend SPA if built
const clientDistCandidates = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.join(__dirname, '../client/dist'),
];
const clientDistPath = clientDistCandidates.find(p => fs.existsSync(p)) || clientDistCandidates[0];

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
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

