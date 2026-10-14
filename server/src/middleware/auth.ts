// Login tokens (JWT): created at signup/login, then sent by the browser with every request.
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export function createToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: '7d' });
}

/**
 * Protects a route: only lets the request through if it has a valid
 * "Authorization: Bearer <token>" header. Saves the user's id in res.locals.userId.
 */
export function requireLogin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Please log in' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), env.jwtSecret) as { userId: string };
    res.locals.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Your session expired, please log in again' });
  }
}
