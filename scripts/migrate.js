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
  // SQL Server hay bao loi tong quat (vd "Could not create constraint or
  // index. See previous errors.") va giau loi CHI TIET that su o cac thong
  // bao truoc do trong cung 1 batch - driver mssql gom nhung loi nay vao
  // err.precedingErrors. In het ra de biet duoc nguyen nhan that.
  if (Array.isArray(err.precedingErrors) && err.precedingErrors.length > 0) {
    console.error('Chi tiet loi truoc do (nguyen nhan that):');
    err.precedingErrors.forEach((e, i) => {
      console.error(`  [${i + 1}] ${e.message}`);
    });
  }
  if (err.originalError && err.originalError.message && err.originalError.message !== err.message) {
    console.error('originalError:', err.originalError.message);
  }
  process.exit(1);
});
