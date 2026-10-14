// Shared check used by every group and expense route.
import { db } from '../db.js';
import { AppError } from '../middleware/errors.js';

/** Throws 404 unless the user is in the group. 404 (not 403) so outsiders can't tell the group exists. */
export async function checkMember(groupId: string, userId: string) {
  const membership = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!membership) throw new AppError(404, 'Group not found');
}

/** The ids of everyone in a group, oldest member first. */
export async function memberIds(groupId: string): Promise<string[]> {
  const rows = await db.groupMember.findMany({ where: { groupId }, orderBy: { joinedAt: 'asc' }, select: { userId: true } });
  return rows.map((r) => r.userId);
}
