import db from './database.js';
import { cleanAllPredefinedData } from './seed.js';

cleanAllPredefinedData(false);
db.prepare('DELETE FROM cash_registers WHERE id > 4').run();
console.log('Base nettoyée!');
