const bcrypt = require('bcrypt');
const { getPool } = require('../models/db');

async function register(req, res) {
  const { name, email, password, role, farm_name, location } = req.body || {};
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  if (!['farmer', 'customer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role === 'farmer' && (!farm_name || !location)) return res.status(400).json({ error: 'Missing farm details' });

  const pool = getPool();
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const status = role === 'farmer' ? 'pending' : 'active';
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [userRes] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      [name, email, hash, role, status]
    );
    if (role === 'farmer') {
      await conn.query(
        'INSERT INTO farmers (user_id, farm_name, location) VALUES (?, ?, ?)',
        [userRes.insertId, farm_name, location]
      );
    }
    await conn.commit();
    res.json({ success: true, status });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    conn.release();
  }
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.role === 'farmer' && user.status !== 'active') {
    return res.status(403).json({ error: user.status === 'rejected' ? 'Registration rejected' : 'Awaiting approval' });
  }
  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ success: true, user: req.session.user });
}

async function logout(req, res) {
  req.session.destroy(() => res.json({ success: true }));
}

async function me(req, res) {
  res.json({ user: req.session.user || null });
}

module.exports = { register, login, logout, me };
