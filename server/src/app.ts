// Builds the Express app: middleware first, then routes, then the error handler last.
import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Once deployed, this server also hands out the built website (client/dist), so the whole app
// lives at one address. Any non-API URL gets index.html and React Router shows the right page.
// In development the folder may not exist, and Vite serves the website instead.
const website = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (existsSync(website)) {
  app.use(express.static(website));
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: website });
  });
}

app.use(errorHandler);
