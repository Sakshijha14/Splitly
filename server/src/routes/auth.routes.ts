// POST /api/auth/signup, POST /api/auth/login, GET /api/auth/me
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { createToken, requireLogin } from '../middleware/auth.js';
import { AppError, asyncRoute } from '../middleware/errors.js';

export const authRoutes = Router();

// Rules for what the browser is allowed to send. zod checks the body against these.
const signupBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

// The user fields that are safe to send to the browser (never the password hash).
const publicFields = { id: true, name: true, email: true } as const;

authRoutes.post(
  '/signup',
  asyncRoute(async (req, res) => {
    const { name, email, password } = signupBody.parse(req.body);

    const existing = await db.user.findUnique({ where: { email } });
    if (existing?.passwordHash) throw new AppError(409, 'An account with this email already exists');

    // If a friend already added this email to a group, claim that invited account (keeping its
    // groups and expenses) instead of creating a new one.
    const passwordHash = await bcrypt.hash(password, 10);
    const user = existing
      ? await db.user.update({ where: { id: existing.id }, data: { name, passwordHash }, select: publicFields })
      : await db.user.create({ data: { name, email, passwordHash }, select: publicFields });
    res.status(201).json({ token: createToken(user.id), user });
  }),
);

authRoutes.post(
  '/login',
  asyncRoute(async (req, res) => {
    const { email, password } = loginBody.parse(req.body);

    const user = await db.user.findUnique({ where: { email } });
    // Same message whether the email or the password is wrong, so attackers can't tell which emails exist.
    // Invited people who haven't signed up yet have no password, so they can't log in.
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, 'Wrong email or password');
    }
    res.json({ token: createToken(user.id), user: { id: user.id, name: user.name, email: user.email } });
  }),
);

// Used by the website on page load to check whether the saved token still belongs to a real user.
authRoutes.get(
  '/me',
  requireLogin,
  asyncRoute(async (_req, res) => {
    const user = await db.user.findUnique({ where: { id: res.locals.userId }, select: publicFields });
    if (!user) throw new AppError(401, 'Please log in');
    res.json({ user });
  }),
);
