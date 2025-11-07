const { Pool } = require('pg');
const bcrypt = require('bcrypt');
(async ()=>{
  const DATABASE_URL = process.env.DATABASE_URL;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';
  if(!DATABASE_URL) return console.error('Set DATABASE_URL env var');
  if(!ADMIN_PASSWORD) return console.error('Set ADMIN_PASSWORD env var');
  const pool = new Pool({ connectionString: DATABASE_URL });
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  try{
    const r = await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES ($1,$2,$3,$4) RETURNING id', [ADMIN_NAME, ADMIN_EMAIL, hash, 'admin']);
    console.log('Admin created with id', r.rows[0].id);
  }catch(e){ console.error('Error creating admin', e); }
  process.exit(0);
})();
