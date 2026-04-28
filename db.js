const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'local_farmer_market';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;

let pool;

async function initDatabase() {
  const serverConn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    port: DB_PORT,
    multipleStatements: true,
  });
  await serverConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await serverConn.end();

  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    port: DB_PORT,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('DROP TABLE IF EXISTS reviews');
    await conn.query('DROP TABLE IF EXISTS payments');
    await conn.query('DROP TABLE IF EXISTS order_details');
    await conn.query('DROP TABLE IF EXISTS orders');
    await conn.query('DROP TABLE IF EXISTS products');
    await conn.query('DROP TABLE IF EXISTS farmers');
    await conn.query('DROP TABLE IF EXISTS notifications');
    await conn.query('DROP TABLE IF EXISTS users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    await conn.query(`
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(160) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin','farmer','customer') NOT NULL,
        status ENUM('active','pending','rejected') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE farmers (
        farmer_id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNIQUE NOT NULL,
        farm_name VARCHAR(160) NOT NULL,
        location VARCHAR(160) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await conn.query(`
      CREATE TABLE products (
        product_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        category VARCHAR(120) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        quantity INT NOT NULL,
        image VARCHAR(255) NULL,
        farmer_id INT NOT NULL,
        seasonal TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id) ON DELETE CASCADE
      )
    `);
    await conn.query(`
      CREATE TABLE orders (
        order_id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await conn.query(`
      CREATE TABLE order_details (
        order_detail_id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
      )
    `);
    await conn.query(`
      CREATE TABLE payments (
        payment_id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        payment_status VARCHAR(60) NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
      )
    `);
    await conn.query(`
      CREATE TABLE reviews (
        review_id INT AUTO_INCREMENT PRIMARY KEY,
        farmer_id INT NOT NULL,
        customer_id INT NOT NULL,
        rating INT NOT NULL,
        comment VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (farmer_id) REFERENCES farmers(farmer_id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await conn.query(`
      CREATE TABLE notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        message VARCHAR(400) NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    const saltRounds = 10;
    const adminHash = await bcrypt.hash('admin123', saltRounds);
    const farmerHash = await bcrypt.hash('farmer123', saltRounds);
    const customerHash = await bcrypt.hash('customer123', saltRounds);
    const pendingHash = await bcrypt.hash('pending123', saltRounds);

    const [adminRes] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      ['Admin', 'admin@market.local', adminHash, 'admin', 'active']
    );
    const [farmerRes] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      ['Green Valley Farm', 'farmer@market.local', farmerHash, 'farmer', 'active']
    );
    const [pendingRes] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      ['Sunrise Farm', 'pending@market.local', pendingHash, 'farmer', 'pending']
    );
    const [customerRes] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
      ['Ava Customer', 'customer@market.local', customerHash, 'customer', 'active']
    );

    const [farmerRow] = await conn.query(
      'INSERT INTO farmers (user_id, farm_name, location) VALUES (?, ?, ?)',
      [farmerRes.insertId, 'Green Valley Farm', 'Hilltown']
    );
    await conn.query(
      'INSERT INTO farmers (user_id, farm_name, location) VALUES (?, ?, ?)',
      [pendingRes.insertId, 'Sunrise Farm', 'Riverbend']
    );

    await conn.query(
      'INSERT INTO products (name, category, price, quantity, image, farmer_id, seasonal) VALUES ?',
      [[
        ['Organic Tomatoes', 'Vegetables', 2.99, 60, null, farmerRow.insertId, 1],
        ['Free-range Eggs (dozen)', 'Dairy', 4.50, 40, null, farmerRow.insertId, 0],
        ['Raw Honey (500g)', 'Condiments', 7.99, 25, null, farmerRow.insertId, 0],
        ['Baby Spinach (250g)', 'Vegetables', 1.99, 50, null, farmerRow.insertId, 1],
        ['Strawberries (500g)', 'Fruits', 5.25, 35, null, farmerRow.insertId, 1]
      ]]
    );

    await conn.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [customerRes.insertId, 'Welcome! Browse seasonal picks and place your first order.']
    );

    console.log('Database initialized with admin, farmer, customer, and products');
  } finally {
    conn.release();
  }
}

function getPool() {
  if (!pool) throw new Error('Database not initialized');
  return pool;
}

module.exports = { initDatabase, getPool };
