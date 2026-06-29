const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

router.get('/profile', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, first_name, last_name, email, phone, address, kyc_status FROM users WHERE id=$1', [req.user.id]);
    res.json({ success: true, profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profile', verifyToken, async (req, res) => {
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

router.post('/orders', verifyToken, async (req, res) => {
  try {
    const { seller_id, items } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items' });
    let total = 0;
    for (const item of items) {
      const p = await db.query('SELECT base_price FROM products WHERE id=$1', [item.product_id]);
      if (p.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
      total += p.rows[0].base_price * item.quantity;
    }
    const order = await db.query(
      `INSERT INTO orders (customer_id, seller_id, total_amount)
       VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, seller_id, total]
    );
    const orderId = order.rows[0].id;
    for (const item of items) {
      const p = await db.query('SELECT base_price FROM products WHERE id=$1', [item.product_id]);
      await db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderId, item.product_id, item.quantity, p.rows[0].base_price, p.rows[0].base_price * item.quantity]
      );
    }
    res.json({ success: true, order: order.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders', verifyToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*, u.username as seller_name
      FROM orders o
      LEFT JOIN users u ON o.seller_id=u.id
      WHERE o.customer_id=$1
      ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/orders/:id/payment', verifyToken, async (req, res) => {
  try {
    const { receipt } = req.body;
    await db.query('UPDATE orders SET payment_receipt=$1, payment_status=$2 WHERE id=$3 AND customer_id=$4', [
      receipt, 'paid', req.params.id, req.user.id
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin-bank', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM admin_bank_details WHERE is_active=true LIMIT 1');
    res.json({ success: true, bank: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
