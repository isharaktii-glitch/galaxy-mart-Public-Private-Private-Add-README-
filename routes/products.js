const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET ALL PUBLIC PRODUCTS
router.get('/', async (req, res) => {
  try {
    const { category_id, search, lang } = req.query;
    let query = `
      SELECT p.*,
        c.name_en as category_name,
        c.name_si as category_name_si,
        c.name_ta as category_name_ta,
        u.username as seller_name
      FROM products p
      LEFT JOIN categories c ON p.category_id=c.id
      LEFT JOIN users u ON p.seller_id=u.id
      WHERE p.status='active' AND c.is_active=true
    `;
    const params = [];

    if (category_id) {
      params.push(category_id);
      query += ` AND p.category_id=$${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name_en ILIKE $${params.length}
                 OR p.name_si ILIKE $${params.length}
                 OR p.name_ta ILIKE $${params.length})`;
    }

    query += ' ORDER BY p.created_at DESC';
    const result = await db.query(query, params);
    res.json({ success: true, products: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET SINGLE PRODUCT
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*,
        c.name_en as category_name,
        u.username as seller_name
       FROM products p
       LEFT JOIN categories c ON p.category_id=c.id
       LEFT JOIN users u ON p.seller_id=u.id
       WHERE p.id=$1 AND p.status='active'`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET ALL CATEGORIES (public)
router.get('/categories/all', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM categories 
       WHERE is_active=true 
       ORDER BY name_en ASC`
    );
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET PRODUCTS BY CATEGORY
router.get('/category/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*,
        u.username as seller_name
       FROM products p
       LEFT JOIN users u ON p.seller_id=u.id
       WHERE p.category_id=$1 AND p.status='active'
       ORDER BY p.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, products: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
