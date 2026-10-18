import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'seydou_cosmetique_secure_jwt_token_2026';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'manager' | 'cashier' | 'stock_manager';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Accès refusé. Token manquant ou invalide.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expirée ou token invalide. Veuillez vous reconnecter.' });
    return;
  }
}

export function requireRole(allowedRoles: Array<'admin' | 'manager' | 'cashier' | 'stock_manager'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Permission refusée. Vous n\'avez pas les droits suffisants pour cette opération.' });
      return;
    }

    next();
  };
}
