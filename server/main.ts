/**
 * Starts the multiplayer server: `npm run server`.
 *
 * Environment variables (optional):
 *   PORT             — port to listen on (default 8787)
 *   ALLOWED_ORIGINS  — comma-separated list of web addresses allowed to
 *                      connect, e.g. https://you.github.io (recommended once deployed)
 */
import { DEFAULT_SERVER_PORT } from '../src/multiplayer/protocol';
import { startServer } from './index';

const port = Number(process.env.PORT) || DEFAULT_SERVER_PORT;
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

startServer({ port, allowedOrigins }).catch((error: Error) => {
  console.error(`[typel] could not start: ${error.message}`);
  process.exit(1);
});
