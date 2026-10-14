// Starts the server.
import { app } from './app.js';
import { env } from './env.js';

app.listen(env.port, () => {
  console.log(`Splitly server running on http://localhost:${env.port}`);
});
