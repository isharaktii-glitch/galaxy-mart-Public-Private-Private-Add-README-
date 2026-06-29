const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isSeller } = require('../middleware/auth');

router.get('/dashboard', verifyToken, isSeller, async (req, res) => {
  try {
    const orders = await db.query('SELECT COUNT(*) FROM orders WHERE seller_id=$1', [req.user.id]);
    const earnings = await db.query('SELECT SUM(seller_earning) FROM orders WHERE seller_id=$1 AND status=$2', [req.user.id, 'done']);
    const products = await db.query('SELECT COUNT(*) FROM products WHERE seller_id=$1', [req.user.id]);
    res.json({
      success: true,
      stats: {
        total_orders: orders.rows[0].count,
        total_earnings: earnings.rows[0].sum || 0,
        total_products: products.rows[0].count
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders', verifyToken, isSeller, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*, u.username as customer_name
      FROM orders o
      LEFT JOIN users u ON o.customer_id=u.id
      WHERE o.seller_id=$1
      ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/products', verifyToken, isSeller, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products WHERE seller_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ success: true, products: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products', verifyToken, isSeller, async (req, res) => {
  try {
    const { name_en, base_price, stock, description_en, category_id } = req.body;
    const result = await db.query(
      `INSERT INTO products (seller_id, name_en, base_price, stock, description_en, category_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, name_en, base_price, stock || 0, description_en, category_id]
    );
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/products/:id', verifyToken, isSeller, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/payment-request', verifyToken, isSeller, async (req, res) => {
  try {
    const { bank_name, account_number, account_holder, amount } = req.body;
    await db.query(
      `INSERT INTO payment_requests (seller_id, bank_name, account_number, account_holder, amount)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, bank_name, account_number, account_holder, amount]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/payment-history', verifyToken, isSeller, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM payment_requests WHERE seller_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ success: true, payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/profile', verifyToken, isSeller, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, first_name, last_name, email, phone, address FROM users WHERE id=$1', [req.user.id]);
    res.json({ success: true, profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', verifyToken, isSeller, async (req, res) => {
  try {
    const { first_name, last_name, phone, address } = req.body;
    await db.query('UPDATE users SET first_name=$1, last_name=$2, phone=$3, address=$4 WHERE id=$5', [
      first_name, last_name, phone, address, req.user.id
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
