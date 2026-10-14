// GET /api/groups, POST /api/groups, GET /api/groups/:id, POST /api/groups/:id/members
// Every route here needs a login, and you can only see groups you are a member of.
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { checkMember } from '../lib/membership.js';
import { requireLogin } from '../middleware/auth.js';
import { AppError, asyncRoute } from '../middleware/errors.js';

export const groupRoutes = Router();
groupRoutes.use(requireLogin);

const groupBody = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(60, 'Group name is too long'),
});

const memberBody = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  name: z.string().trim().max(50, 'Name is too long').optional(), // used if they don't have an account yet
});

const publicUser = { id: true, name: true, email: true } as const;
// passwordHash is only read to tell whether someone has signed up. It is never sent to the browser.
const memberFields = { ...publicUser, passwordHash: true } as const;

function toMember(u: { id: string; name: string; email: string; passwordHash: string | null }) {
  return { id: u.id, name: u.name, email: u.email, invited: u.passwordHash === null };
}

// Your groups, newest first, with how many people are in each.
groupRoutes.get(
  '/',
  asyncRoute(async (_req, res) => {
    const groups = await db.group.findMany({
      where: { members: { some: { userId: res.locals.userId } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, createdAt: true, _count: { select: { members: true } } },
    });
    res.json({
      groups: groups.map((g) => ({ id: g.id, name: g.name, createdAt: g.createdAt, memberCount: g._count.members })),
    });
  }),
);

// Create a group. The creator becomes its first member.
groupRoutes.post(
  '/',
  asyncRoute(async (req, res) => {
    const { name } = groupBody.parse(req.body);
    const userId = res.locals.userId;
    const group = await db.group.create({
      data: { name, createdById: userId, members: { create: { userId } } },
      select: { id: true, name: true, createdAt: true },
    });
    res.status(201).json({ group: { ...group, memberCount: 1 } });
  }),
);

// One group with its members.
groupRoutes.get(
  '/:id',
  asyncRoute(async (req, res) => {
    await checkMember(req.params.id, res.locals.userId);
    const group = await db.group.findUniqueOrThrow({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        createdById: true,
        createdAt: true,
        members: { orderBy: { joinedAt: 'asc' }, select: { user: { select: memberFields } } },
      },
    });
    res.json({ group: { ...group, members: group.members.map((m) => toMember(m.user)) } });
  }),
);

// Add a friend by email. If they don't have an account yet, an invited account is made for them,
// which they claim by signing up with that email.
groupRoutes.post(
  '/:id/members',
  asyncRoute(async (req, res) => {
    const groupId = req.params.id;
    await checkMember(groupId, res.locals.userId);
    const { email, name } = memberBody.parse(req.body);

    const friend =
      (await db.user.findUnique({ where: { email }, select: memberFields })) ??
      (await db.user.create({ data: { email, name: name || email.split('@')[0] }, select: memberFields }));

    const already = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: friend.id } } });
    if (already) throw new AppError(409, `${friend.name} is already in this group`);

    await db.groupMember.create({ data: { groupId, userId: friend.id } });
    res.status(201).json({ member: toMember(friend) });
  }),
);
