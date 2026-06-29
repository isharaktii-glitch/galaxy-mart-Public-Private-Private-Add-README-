const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, u.username as seller_name
      FROM products p
      LEFT JOIN users u ON p.seller_id=u.id
      WHERE p.status='active'
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, products: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories/all', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM categories WHERE is_active=true ORDER BY name_en ASC');
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
