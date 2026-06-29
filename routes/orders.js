const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', verifyToken, isAdmin, async (req, res) => {
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

module.exports = router;
