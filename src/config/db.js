const sql = require('mssql');
const { getDbConfig } = require('./env');

let poolPromise = null;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(getDbConfig())
      .connect()
      .then((pool) => {
        pool.on('error', (err) => {
          console.error('MSSQL pool error:', err);
        });
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
