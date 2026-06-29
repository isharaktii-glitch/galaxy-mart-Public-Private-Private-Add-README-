const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status, payment_status, search } = req.query;
    let query = `
      SELECT o.*,
        u.username as customer_name,
        s.username as seller_name
      FROM orders o
      LEFT JOIN users u ON o.customer_id=u.id
      LEFT JOIN users s ON o.seller_id=s.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND o.status=$${params.length}`;
    }
    if (payment_status) {
      params.push(payment_status);
      query += ` AND o.payment_status=$${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      const i1 = params.length;
      params.push(`%${search}%`);
      const i2 = params.length;
      query += ` AND (u.username ILIKE $${i1} OR s.username ILIKE $${i2})`;
    }

    query += ' ORDER BY o.created_at DESC';
    const result = await db.query(query, params);
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    console.error('Orders fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/track', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, status, rejection_reason,
        payment_status, created_at, updated_at
       FROM orders WHERE id=$1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const order = await db.query(
      `SELECT o.*,
        u.username as customer_name,
        u.phone as customer_phone,
        s.username as seller_name
       FROM orders o
       LEFT JOIN users u ON o.customer_id=u.id
       LEFT JOIN users s ON o.seller_id=s.id
       WHERE o.id=$1`,
      [req.params.id]
    );

    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = await db.query(
      `SELECT oi.*,
        p.name_en as product_name,
        p.name_si as product_name_si,
        p.name_ta as product_name_ta,
        p.images
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id=p.id
       WHERE oi.order_id=$1`,
      [req.params.id]
    );

    const o = order.rows[0];
    if (
      req.user.role !== 'admin' &&
      o.customer_id !== req.user.id &&
      o.seller_id !== req.user.id
    ) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ success: true, order: o, items: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
