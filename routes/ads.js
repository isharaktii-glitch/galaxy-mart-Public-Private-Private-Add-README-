const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Get all active ads (Public)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM ads WHERE is_active=true ORDER BY created_at DESC LIMIT 5'
    );
    res.json({ success: true, ads: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all ads (Admin only)
router.get('/all', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ads ORDER BY created_at DESC');
    res.json({ success: true, ads: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create ad (Admin only)
router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, link_url, image_url, is_active } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    
    const result = await db.query(
      `INSERT INTO ads (title, link_url, image_url, is_active) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, link_url || '', image_url || '', is_active !== undefined ? is_active : true]
    );
    res.json({ success: true, ad: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update ad (Admin only)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, link_url, image_url, is_active } = req.body;
    const result = await db.query(
      `UPDATE ads SET 
        title = COALESCE($1, title),
        link_url = COALESCE($2, link_url),
        image_url = COALESCE($3, image_url),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [title, link_url, image_url, is_active, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    res.json({ success: true, ad: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete ad (Admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM ads WHERE id=$1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
