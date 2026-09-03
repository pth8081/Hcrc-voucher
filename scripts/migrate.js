require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { getDbConfig } = require('../src/config/env');

async function run() {
  const sqlDir = path.join(__dirname, '..', 'sql');
  const files = fs.readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort();

  const pool = await sql.connect(getDbConfig());
  try {
    for (const file of files) {
      const fullPath = path.join(sqlDir, file);
      const script = fs.readFileSync(fullPath, 'utf8');
      const batches = script.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);

      console.log(`Applying ${file} (${batches.length} batch(es))...`);
      for (const batch of batches) {
        await pool.request().batch(batch);
      }
    }
    console.log('Migration complete.');
  } finally {
    await pool.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
