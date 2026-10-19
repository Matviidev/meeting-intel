import { loadConfig } from '../config.js';
import { createDb } from './client.js';
import { migrate } from './migrate.js';

const { db, close } = createDb(loadConfig().DATABASE_URL);
const ran = await migrate(db);
console.log(ran.length ? `applied: ${ran.join(', ')}` : 'up to date');
await close();
