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

    // Ghi nhan TOAN BO file .sql hien co la "da ap dung" vao dbo.SchemaMigrations (tao o chinh
    // sql/032 - da duoc ap dung o vong lap tren truoc khi toi day, vi file duoc duyet theo dung
    // thu tu ten) - app doc lai bang nay luc khoi dong de tu choi chay neu CSDL con thieu migration
    // nao (xem src/utils/schemaCheck.js). Bulk, idempotent (IF NOT EXISTS tung dong): AN TOAN de
    // "backfill" luon cac file DA tung duoc ap dung tu TRUOC KHI co bang nay (lan dau nang cap len
    // ban co SchemaMigrations) - vong lap ben tren da chay toi day nghia la MOI file hien co deu
    // da duoc ap dung thanh cong (du vua chay that su hay chi la no-op vi da ton tai tu truoc).
    for (const file of files) {
      await pool
        .request()
        .input('filename', sql.NVarChar(255), file)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Filename = @filename)
            INSERT INTO dbo.SchemaMigrations (Filename) VALUES (@filename)
        `);
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
