const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/categories/all', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM categories WHERE is_active=true ORDER BY name_en ASC'
    );
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { category_id, search } = req.query;
    let query = `
      SELECT p.*, 
        c.name_en as category_name,
        u.username as seller_name
      FROM products p
      LEFT JOIN categories c ON p.category_id=c.id
      LEFT JOIN users u ON p.seller_id=u.id
      WHERE p.status='active'
    `;
    const params = [];

    if (category_id) {
      params.push(category_id);
      query += ` AND p.category_id=$${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND p.name_en ILIKE $${params.length}`;
    }

    query += ' ORDER BY p.created_at DESC';
    const result = await db.query(query, params);
    res.json({ success: true, products: result.rows });
  } catch (err) {
    console.error('Products error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, 
        c.name_en as category_name,
        u.username as seller_name
       FROM products p
       LEFT JOIN categories c ON p.category_id=c.id
       LEFT JOIN users u ON p.seller_id=u.id
       WHERE p.id=$1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(
      'UPDATE products SET status=$1, updated_at=NOW() WHERE id=$2',
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
