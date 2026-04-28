const { getPool } = require('../models/db');

async function getFarmerId(userId) {
  const pool = getPool();
  const [rows] = await pool.query('SELECT farmer_id FROM farmers WHERE user_id = ?', [userId]);
  if (!rows.length) return null;
  return rows[0].farmer_id;
}

async function myProducts(req, res) {
  const farmerId = await getFarmerId(req.session.user.id);
  const pool = getPool();
  const [rows] = await pool.query('SELECT * FROM products WHERE farmer_id = ? ORDER BY updated_at DESC', [farmerId]);
  res.json({ products: rows });
}

async function addProduct(req, res) {
  const { name, category, price, quantity, seasonal } = req.body || {};
  const file = req.file || null;
  const imgPath = file ? `/uploads/${file.filename}` : null;
  const p = Number(price);
  const q = Number(quantity);
  const seasonalFlag = seasonal === '1' || seasonal === 'true' || seasonal === 1 ? 1 : 0;
  if (!name || !category || !p || p <= 0 || !q || q <= 0) return res.status(400).json({ error: 'Invalid input' });
  const farmerId = await getFarmerId(req.session.user.id);
  const pool = getPool();
  await pool.query(
    'INSERT INTO products (name, category, price, quantity, image, farmer_id, seasonal) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, category, p, q, imgPath, farmerId, seasonalFlag]
  );
  const [customers] = await pool.query("SELECT id FROM users WHERE role = 'customer'");
  if (customers.length) {
    const values = customers.map(c => [c.id, `New product added: ${name}`]);
    await pool.query('INSERT INTO notifications (user_id, message) VALUES ?', [values]);
  }
  res.json({ success: true });
}

async function updateProduct(req, res) {
  const { productId, name, category, price, quantity, seasonal } = req.body || {};
  const p = Number(price);
  const q = Number(quantity);
  const seasonalFlag = seasonal === '1' || seasonal === 'true' || seasonal === 1 ? 1 : 0;
  const farmerId = await getFarmerId(req.session.user.id);
  const pool = getPool();
  await pool.query(
    `UPDATE products SET name = ?, category = ?, price = ?, quantity = ?, seasonal = ?
     WHERE product_id = ? AND farmer_id = ?`,
    [name, category, p, q, seasonalFlag, productId, farmerId]
  );
  res.json({ success: true });
}

async function deleteProduct(req, res) {
  const { productId } = req.body || {};
  const farmerId = await getFarmerId(req.session.user.id);
  const pool = getPool();
  await pool.query('DELETE FROM products WHERE product_id = ? AND farmer_id = ?', [productId, farmerId]);
  res.json({ success: true });
}

async function orders(req, res) {
  const farmerId = await getFarmerId(req.session.user.id);
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT o.order_id, o.date, u.name AS customer_name, p.name AS product_name, od.quantity, od.price
     FROM order_details od
     JOIN orders o ON o.order_id = od.order_id
     JOIN products p ON p.product_id = od.product_id
     JOIN users u ON u.id = o.customer_id
     WHERE p.farmer_id = ?
     ORDER BY o.date DESC`,
    [farmerId]
  );
  res.json({ orders: rows });
}

async function sales(req, res) {
  const farmerId = await getFarmerId(req.session.user.id);
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT p.name, SUM(od.quantity) AS units_sold, SUM(od.quantity * od.price) AS revenue
     FROM order_details od
     JOIN products p ON p.product_id = od.product_id
     WHERE p.farmer_id = ?
     GROUP BY p.product_id
     ORDER BY revenue DESC`,
    [farmerId]
  );
  res.json({ sales: rows });
}

async function notifications(req, res) {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT id, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
    [req.session.user.id]
  );
  res.json({ notifications: rows });
}

async function markNotification(req, res) {
  const { id } = req.body || {};
  const pool = getPool();
  await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.session.user.id]);
  res.json({ success: true });
}

module.exports = { myProducts, addProduct, updateProduct, deleteProduct, orders, sales, notifications, markNotification };
