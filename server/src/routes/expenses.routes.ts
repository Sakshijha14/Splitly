// GET /api/groups/:groupId/expenses        expenses, payments made, balances and suggested payments
// POST /api/groups/:groupId/expenses       add an expense, split equally
// DELETE /api/groups/:groupId/expenses/:id delete an expense
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { netBalances, settleUp, splitEqually } from '../lib/balances.js';
import { checkMember, memberIds } from '../lib/membership.js';
import { rupeesToPaise } from '../lib/money.js';
import { requireLogin } from '../middleware/auth.js';
import { AppError, asyncRoute } from '../middleware/errors.js';

// mergeParams lets these routes read :groupId from the path this router is mounted on.
export const expenseRoutes = Router({ mergeParams: true });
expenseRoutes.use(requireLogin);

const expenseBody = z.object({
  description: z.string().trim().min(1, 'Description is required').max(100, 'Description is too long'),
  amount: rupeesToPaise,
  paidById: z.string(),
  splitWith: z.array(z.string()).min(1, 'Pick at least one person to split with'),
});

expenseRoutes.get(
  '/',
  asyncRoute(async (req, res) => {
    const { groupId } = req.params as { groupId: string };
    await checkMember(groupId, res.locals.userId);

    const [ids, expenses, settlements] = await Promise.all([
      memberIds(groupId),
      db.expense.findMany({
        where: { groupId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          description: true,
          amount: true,
          paidById: true,
          createdAt: true,
          shares: { select: { userId: true, amount: true } },
        },
      }),
      db.settlement.findMany({
        where: { groupId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, fromId: true, toId: true, amount: true, createdAt: true },
      }),
    ]);

    const balances = netBalances(ids, expenses, settlements);
    res.json({
      expenses,
      settlements,
      balances: [...balances].map(([userId, amount]) => ({ userId, amount })),
      payments: settleUp(balances),
    });
  }),
);

expenseRoutes.post(
  '/',
  asyncRoute(async (req, res) => {
    const { groupId } = req.params as { groupId: string };
    await checkMember(groupId, res.locals.userId);
    const body = expenseBody.parse(req.body);

    // The payer and everyone in the split must be in this group.
    const members = new Set(await memberIds(groupId));
    const splitWith = [...new Set(body.splitWith)];
    if (!members.has(body.paidById) || splitWith.some((id) => !members.has(id))) {
      throw new AppError(400, 'Everyone in an expense must be a member of the group');
    }

    const { amount } = body;
    if (amount < splitWith.length) throw new AppError(400, 'Amount is too small to split between that many people');

    const expense = await db.expense.create({
      data: {
        groupId,
        description: body.description,
        amount,
        paidById: body.paidById,
        createdById: res.locals.userId,
        shares: { create: splitEqually(amount, splitWith) },
      },
      select: { id: true },
    });
    res.status(201).json({ expense });
  }),
);

expenseRoutes.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const { groupId, id } = req.params as { groupId: string; id: string };
    await checkMember(groupId, res.locals.userId);
    // groupId in the filter stops someone deleting another group's expense through this group's URL.
    const { count } = await db.expense.deleteMany({ where: { id, groupId } });
    if (count === 0) throw new AppError(404, 'Expense not found');
    res.status(204).end();
  }),
);
