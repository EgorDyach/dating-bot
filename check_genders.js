const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const result = await pool.query('SELECT * FROM ref_genders');
    console.log(result.rows);
  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
}
check();
