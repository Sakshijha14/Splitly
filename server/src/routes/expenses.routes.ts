// GET /api/groups/:groupId/expenses        expenses, payments made, balances and suggested payments
// POST /api/groups/:groupId/expenses       add an expense, split equally, by exact amounts or by percent
// DELETE /api/groups/:groupId/expenses/:id delete an expense
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { netBalances, settleUp, splitByPercent, splitEqually } from '../lib/balances.js';
import { checkMember, memberIds } from '../lib/membership.js';
import { rupeesToPaise } from '../lib/money.js';
import { requireLogin } from '../middleware/auth.js';
import { AppError, asyncRoute } from '../middleware/errors.js';

// mergeParams lets these routes read :groupId from the path this router is mounted on.
export const expenseRoutes = Router({ mergeParams: true });
expenseRoutes.use(requireLogin);

// 12.5 (%) -> 1250 hundredths of a percent, so percentages can be added up without rounding errors.
const percent = z
  .number({ invalid_type_error: 'Enter a percentage' })
  .positive('Each percentage must be more than 0')
  .max(100, 'A percentage can be at most 100')
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Use at most 2 decimal places in percentages')
  .transform((n) => Math.round(n * 100));

const atLeastOne = 'Pick at least one person to split with';

// "type" says which shape the rest of the split has.
const split = z.discriminatedUnion('type', [
  z.object({ type: z.literal('equal'), userIds: z.array(z.string()).min(1, atLeastOne) }),
  z.object({ type: z.literal('exact'), shares: z.array(z.object({ userId: z.string(), amount: rupeesToPaise })).min(1, atLeastOne) }),
  z.object({ type: z.literal('percent'), shares: z.array(z.object({ userId: z.string(), percent })).min(1, atLeastOne) }),
]);

const expenseBody = z.object({
  description: z.string().trim().min(1, 'Description is required').max(100, 'Description is too long'),
  amount: rupeesToPaise,
  paidById: z.string(),
  split,
});

/** Works out each person's share in paise, checking that the shares match the total. */
function sharesFor(amount: number, s: z.infer<typeof split>): { userId: string; amount: number }[] {
  if (s.type === 'equal') {
    if (amount < s.userIds.length) throw new AppError(400, 'Amount is too small to split between that many people');
    return splitEqually(amount, s.userIds);
  }
  if (s.type === 'exact') {
    const sum = s.shares.reduce((total, x) => total + x.amount, 0);
    if (sum !== amount) {
      throw new AppError(400, `The amounts add up to ₹${(sum / 100).toFixed(2)}, but the total is ₹${(amount / 100).toFixed(2)}`);
    }
    return s.shares;
  }
  const sum = s.shares.reduce((total, x) => total + x.percent, 0);
  if (sum !== 10000) throw new AppError(400, `The percentages add up to ${sum / 100}%, not 100%`);
  const shares = splitByPercent(amount, s.shares.map((x) => ({ userId: x.userId, basisPoints: x.percent })));
  if (shares.some((x) => x.amount === 0)) throw new AppError(400, 'Amount is too small for those percentages');
  return shares;
}

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
          splitType: true,
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

    const { amount } = body;
    const shares = sharesFor(amount, body.split);

    // Everyone in the split must be listed once, and they and the payer must be in this group.
    const members = new Set(await memberIds(groupId));
    const splitIds = shares.map((x) => x.userId);
    if (new Set(splitIds).size !== splitIds.length) throw new AppError(400, 'Each person can only appear once in a split');
    if (!members.has(body.paidById) || splitIds.some((id) => !members.has(id))) {
      throw new AppError(400, 'Everyone in an expense must be a member of the group');
    }

    const expense = await db.expense.create({
      data: {
        groupId,
        description: body.description,
        amount,
        splitType: body.split.type,
        paidById: body.paidById,
        createdById: res.locals.userId,
        shares: { create: shares },
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
