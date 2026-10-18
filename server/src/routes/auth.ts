import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import db, { logAudit } from '../database.js';
import { generateToken, authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) {
    res.status(401).json({ error: 'Identifiants incorrects.' });
    return;
  }

  if (user.is_active !== 1) {
    res.status(403).json({ error: 'Ce compte utilisateur a été désactivé par l\'administrateur.' });
    return;
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    res.status(401).json({ error: 'Identifiants incorrects.' });
    return;
  }

  const authUser = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role
  };

  const token = generateToken(authUser as any);
  logAudit(user.id, user.full_name, 'LOGIN', 'user', user.id, `Connexion réussie de ${user.full_name} (${user.role})`);

  res.json({
    token,
    user: authUser
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = db.prepare('SELECT id, username, full_name, role, phone, is_active FROM users WHERE id = ?').get(req.user!.id);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }
  res.json(user);
});

// GET /api/users (Admin only)
router.get('/users', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const users = db.prepare('SELECT id, username, full_name, role, phone, is_active, created_at FROM users ORDER BY id ASC').all();
  res.json(users);
});

// POST /api/users (Admin only)
router.post('/users', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { username, password, fullName, role, phone } = req.body;
  if (!username || !password || !fullName || !role) {
    res.status(400).json({ error: 'Tous les champs obligatoires doivent être renseignés.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    res.status(400).json({ error: 'Ce nom d\'utilisateur existe déjà.' });
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, phone, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  const result = stmt.run(username, passwordHash, fullName, role, phone || null);

  logAudit(req.user!.id, req.user!.fullName, 'CREATE_USER', 'user', Number(result.lastInsertRowid), `Création de l'utilisateur ${fullName} (${role})`);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Utilisateur créé avec succès.' });
});

// PUT /api/users/:id (Admin only)
router.put('/users/:id', authenticate, requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { fullName, role, phone, password, is_active } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }

  if (password && password.trim() !== '') {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    db.prepare(`
      UPDATE users SET full_name = ?, role = ?, phone = ?, password_hash = ?, is_active = ?
      WHERE id = ?
    `).run(fullName || user.full_name, role || user.role, phone ?? user.phone, passwordHash, is_active ?? user.is_active, id);
  } else {
    db.prepare(`
      UPDATE users SET full_name = ?, role = ?, phone = ?, is_active = ?
      WHERE id = ?
    `).run(fullName || user.full_name, role || user.role, phone ?? user.phone, is_active ?? user.is_active, id);
  }

  logAudit(req.user!.id, req.user!.fullName, 'UPDATE_USER', 'user', Number(id), `Modification de l'utilisateur ${user.username}`);
  res.json({ message: 'Utilisateur mis à jour avec succès.' });
});

export default router;
