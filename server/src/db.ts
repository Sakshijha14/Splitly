// One shared database client for the whole server.
import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient();
