const { getPool } = require('../models/db');

async function listProducts(req, res) {
  const { category, search, farmer, seasonal } = req.query || {};
  const pool = getPool();
  const filters = [];
  const params = [];
  if (category) {
    filters.push('p.category = ?');
    params.push(category);
  }
  if (farmer) {
    filters.push('f.farmer_id = ?');
    params.push(farmer);
  }
  if (seasonal === '1' || seasonal === 'true') {
    filters.push('p.seasonal = 1');
  }
  if (search) {
    filters.push('(p.name LIKE ? OR f.farm_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT p.*, f.farm_name, f.location,
     (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.farmer_id = f.farmer_id) AS rating_avg
     FROM products p
     JOIN farmers f ON f.farmer_id = p.farmer_id
     ${where}
     ORDER BY p.updated_at DESC`,
    params
  );
  res.json({ products: rows });
}

async function categories(req, res) {
  const pool = getPool();
  const [rows] = await pool.query('SELECT DISTINCT category FROM products ORDER BY category');
  res.json({ categories: rows.map(r => r.category) });
}

async function farmers(req, res) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT f.farmer_id, f.farm_name, f.location,
     (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.farmer_id = f.farmer_id) AS rating_avg,
     (SELECT COUNT(*) FROM reviews r WHERE r.farmer_id = f.farmer_id) AS review_count
     FROM farmers f`
  );
  res.json({ farmers: rows });
}

async function checkout(req, res) {
  const { items } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cart is empty' });
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let total = 0;
    const lines = [];
    const farmerUsers = new Set();
    for (const it of items) {
      const pid = Number(it.productId);
      const qty = Number(it.quantity);
      if (!pid || !qty || qty <= 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'Invalid cart item' });
      }
      const [rows] = await conn.query(
        `SELECT p.*, f.user_id AS farmer_user_id
         FROM products p
         JOIN farmers f ON f.farmer_id = p.farmer_id
         WHERE p.product_id = ? FOR UPDATE`,
        [pid]
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ error: `Product ${pid} not found` });
      }
      const product = rows[0];
      if (product.quantity < qty) {
        await conn.rollback();
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }
      const newQty = product.quantity - qty;
      await conn.query('UPDATE products SET quantity = ? WHERE product_id = ?', [newQty, pid]);
      const lineTotal = Number(product.price) * qty;
      total += lineTotal;
      lines.push({ productId: pid, name: product.name, quantity: qty, price: Number(product.price), lineTotal });
      farmerUsers.add(product.farmer_user_id);
    }
    const [orderRes] = await conn.query(
      'INSERT INTO orders (customer_id, total_amount) VALUES (?, ?)',
      [req.session.user.id, total]
    );
    for (const line of lines) {
      await conn.query(
        'INSERT INTO order_details (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderRes.insertId, line.productId, line.quantity, line.price]
      );
    }
    await conn.query('INSERT INTO payments (order_id, payment_status) VALUES (?, ?)', [orderRes.insertId, 'paid']);
    await conn.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [req.session.user.id, `Order #${orderRes.insertId} confirmed. Total $${total.toFixed(2)}`]
    );
    if (farmerUsers.size) {
      const values = Array.from(farmerUsers).map(id => [id, `New order received for order #${orderRes.insertId}`]);
      await conn.query('INSERT INTO notifications (user_id, message) VALUES ?', [values]);
    }
    await conn.commit();
    res.json({ success: true, total, lines, orderId: orderRes.insertId });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: 'Checkout failed' });
  } finally {
    conn.release();
  }
}

async function orderHistory(req, res) {
  const pool = getPool();
  const [orders] = await pool.query(
    'SELECT order_id, total_amount, date FROM orders WHERE customer_id = ? ORDER BY date DESC',
    [req.session.user.id]
  );
  if (!orders.length) return res.json({ orders: [] });
  const orderIds = orders.map(o => o.order_id);
  const [details] = await pool.query(
    `SELECT od.order_id, od.quantity, od.price, p.name
     FROM order_details od
     JOIN products p ON p.product_id = od.product_id
     WHERE od.order_id IN (${orderIds.map(() => '?').join(',')})`,
    orderIds
  );
  const grouped = orders.map(o => ({
    ...o,
    items: details.filter(d => d.order_id === o.order_id)
  }));
  res.json({ orders: grouped });
}

async function addReview(req, res) {
  const { farmerId, rating, comment } = req.body || {};
  const r = Number(rating);
  if (!farmerId || !r || r < 1 || r > 5) return res.status(400).json({ error: 'Invalid rating' });
  const pool = getPool();
  await pool.query(
    'INSERT INTO reviews (farmer_id, customer_id, rating, comment) VALUES (?, ?, ?, ?)',
    [farmerId, req.session.user.id, r, comment || null]
  );
  res.json({ success: true });
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

async function profile(req, res) {
  const pool = getPool();
  const [rows] = await pool.query('SELECT id, name, email FROM users WHERE id = ?', [req.session.user.id]);
  res.json({ profile: rows[0] });
}

async function updateProfile(req, res) {
  const { name, email } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Missing fields' });
  const pool = getPool();
  await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.session.user.id]);
  req.session.user.name = name;
  req.session.user.email = email;
  res.json({ success: true });
}

module.exports = { listProducts, categories, farmers, checkout, orderHistory, addReview, notifications, markNotification, profile, updateProfile };
