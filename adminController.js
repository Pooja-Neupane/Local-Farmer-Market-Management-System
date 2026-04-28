const { getPool } = require('../models/db');

async function pendingFarmers(req, res) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.status, f.farm_name, f.location
     FROM users u
     JOIN farmers f ON f.user_id = u.id
     WHERE u.role = 'farmer' AND u.status = 'pending'
     ORDER BY u.created_at DESC`
  );
  res.json({ farmers: rows });
}

async function approveFarmer(req, res) {
  const { userId } = req.body || {};
  const pool = getPool();
  await pool.query('UPDATE users SET status = ? WHERE id = ? AND role = ?', ['active', userId, 'farmer']);
  res.json({ success: true });
}

async function rejectFarmer(req, res) {
  const { userId } = req.body || {};
  const pool = getPool();
  await pool.query('UPDATE users SET status = ? WHERE id = ? AND role = ?', ['rejected', userId, 'farmer']);
  res.json({ success: true });
}

async function users(req, res) {
  const pool = getPool();
  const [rows] = await pool.query('SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC');
  res.json({ users: rows });
}

async function products(req, res) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT p.*, f.farm_name, u.name AS farmer_name
     FROM products p
     JOIN farmers f ON f.farmer_id = p.farmer_id
     JOIN users u ON u.id = f.user_id
     ORDER BY p.updated_at DESC`
  );
  res.json({ products: rows });
}

async function deleteProduct(req, res) {
  const { productId } = req.body || {};
  const pool = getPool();
  await pool.query('DELETE FROM products WHERE product_id = ?', [productId]);
  res.json({ success: true });
}

async function updateUserStatus(req, res) {
  const { userId, status } = req.body || {};
  if (!['active','pending','rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const pool = getPool();
  await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
  res.json({ success: true });
}

async function orders(req, res) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT o.order_id, o.total_amount, o.date, u.name AS customer_name, u.email
     FROM orders o
     JOIN users u ON u.id = o.customer_id
     ORDER BY o.date DESC`
  );
  res.json({ orders: rows });
}

async function reports(req, res) {
  const pool = getPool();
  const [[sales]] = await pool.query('SELECT IFNULL(SUM(total_amount),0) AS total_sales, COUNT(*) AS total_orders FROM orders');
  const [users] = await pool.query('SELECT role, COUNT(*) AS count FROM users GROUP BY role');
  const [[products]] = await pool.query('SELECT COUNT(*) AS total_products FROM products');
  res.json({ sales, users, products });
}

module.exports = { pendingFarmers, approveFarmer, rejectFarmer, users, products, deleteProduct, updateUserStatus, orders, reports };
