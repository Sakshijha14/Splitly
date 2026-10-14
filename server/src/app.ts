// Builds the Express app: middleware first, then routes, then the error handler last.
import cors from 'cors';
import express from 'express';
import { env } from './env.js';
import { errorHandler } from './middleware/errors.js';
import { authRoutes } from './routes/auth.routes.js';
import { expenseRoutes } from './routes/expenses.routes.js';
import { groupRoutes } from './routes/groups.routes.js';
import { settlementRoutes } from './routes/settlements.routes.js';

export const app = express();

app.use(cors({ origin: env.clientUrl }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/auth', authRoutes);
app.use('/api/groups/:groupId/expenses', expenseRoutes);
app.use('/api/groups/:groupId/settlements', settlementRoutes);
app.use('/api/groups', groupRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});
app.use(errorHandler);
