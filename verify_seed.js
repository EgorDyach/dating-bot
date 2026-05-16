const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verify() {
  try {
    const users = await pool.query('SELECT id, telegram_id, first_name, last_name FROM users ORDER BY id');
    console.log('Total users:', users.rows.length);
    users.rows.forEach(u => console.log(`  - ID ${u.id}: ${u.first_name} ${u.last_name} (TG: ${u.telegram_id})`));

    const profiles = await pool.query('SELECT p.id, p.user_id, p.display_name, p.gender_code FROM profiles p ORDER BY p.id');
    console.log('\nTotal profiles:', profiles.rows.length);
    profiles.rows.forEach(p => console.log(`  - ${p.display_name} (${p.gender_code})`));

    const photos = await pool.query('SELECT COUNT(*) as total FROM profile_photos');
    console.log('\nTotal photos:', photos.rows[0].total);
  } catch (e) {
    console.error(e.message);
  } finally {
    await pool.end();
  }
}
verify();
