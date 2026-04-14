/**
 * Simulation DB connection for Observatory pages.
 * Hardcoded to data/simulation/alice-sim.db.
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIM_DB_PATH = path.resolve(__dirname, '../../data/simulation/alice-sim.db');

const simDb = new Database(SIM_DB_PATH, { readonly: true });
simDb.pragma('journal_mode = WAL');

export default simDb;
