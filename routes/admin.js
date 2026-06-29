const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const { role, search } = req.query;
    let query = 'SELECT id, username, first_name, last_name, email, phone, role, status, kyc_status, created_at FROM users WHERE 1=1';
    const params = [];
    if (role) { params.push(role); query += ` AND role=$${params.length}`; }
    if (search) {
      params.push(`%${search}%`); query += ` AND (username ILIKE $${params.length}`;
      params.push(`%${search}%`); query += ` OR email ILIKE $${params.length}`;
      params.push(`%${search}%`); query += ` OR first_name ILIKE $${params.length})`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/status', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE users SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*, u.username as customer_name, s.username as seller_name
      FROM orders o
      LEFT JOIN users u ON o.customer_id=u.id
      LEFT JOIN users s ON o.seller_id=s.id
      ORDER BY o.created_at DESC
    `);
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/orders/:id/status', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard', verifyToken, isAdmin, async (req, res) => {
  try {
    const users = await db.query('SELECT COUNT(*) FROM users');
    const orders = await db.query('SELECT COUNT(*), SUM(total_amount) FROM orders');
    const products = await db.query('SELECT COUNT(*) FROM products');
    res.json({
      success: true,
      stats: {
        total_users: users.rows[0].count,
        total_orders: orders.rows[0].count,
        total_revenue: orders.rows[0].sum || 0,
        total_products: products.rows[0].count
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
