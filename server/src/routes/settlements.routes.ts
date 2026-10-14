// POST /api/groups/:groupId/settlements       record a payment between two members
// DELETE /api/groups/:groupId/settlements/:id delete one (e.g. recorded by mistake)
// Payments are listed by GET /api/groups/:groupId/expenses, together with the balances they change.
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { checkMember, memberIds } from '../lib/membership.js';
import { rupeesToPaise } from '../lib/money.js';
import { requireLogin } from '../middleware/auth.js';
import { AppError, asyncRoute } from '../middleware/errors.js';

export const settlementRoutes = Router({ mergeParams: true });
settlementRoutes.use(requireLogin);

const settlementBody = z
  .object({ fromId: z.string(), toId: z.string(), amount: rupeesToPaise })
  .refine((b) => b.fromId !== b.toId, "Someone can't pay themselves");

settlementRoutes.post(
  '/',
  asyncRoute(async (req, res) => {
    const { groupId } = req.params as { groupId: string };
    await checkMember(groupId, res.locals.userId);
    const { fromId, toId, amount } = settlementBody.parse(req.body);

    const members = new Set(await memberIds(groupId));
    if (!members.has(fromId) || !members.has(toId)) throw new AppError(400, 'Both people must be members of the group');

    const settlement = await db.settlement.create({
      data: { groupId, fromId, toId, amount, createdById: res.locals.userId },
      select: { id: true },
    });
    res.status(201).json({ settlement });
  }),
);

settlementRoutes.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const { groupId, id } = req.params as { groupId: string; id: string };
    await checkMember(groupId, res.locals.userId);
    const { count } = await db.settlement.deleteMany({ where: { id, groupId } });
    if (count === 0) throw new AppError(404, 'Payment not found');
    res.status(204).end();
  }),
);
