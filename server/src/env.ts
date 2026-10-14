// Loads settings from server/.env and stops the server early if one is missing.
import 'dotenv/config';

function mustHave(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing. Copy server/.env.example to server/.env and fill it in.`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: mustHave('JWT_SECRET'),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
};
