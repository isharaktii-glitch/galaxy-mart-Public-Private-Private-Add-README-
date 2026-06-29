const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ads WHERE is_active=true ORDER BY created_at DESC');
    res.json({ success: true, ads: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, link_url, image_url, is_active } = req.body;
    const result = await db.query(
      'INSERT INTO ads (title, link_url, image_url, is_active) VALUES ($1,$2,$3,$4) RETURNING *',
      [title, link_url || '', image_url || '', is_active !== undefined ? is_active : true]
    );
    res.json({ success: true, ad: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { title, link_url, image_url, is_active } = req.body;
    const result = await db.query(
      `UPDATE ads SET title=$1, link_url=$2, image_url=$3, is_active=$4, updated_at=NOW() 
       WHERE id=$5 RETURNING *`,
      [title, link_url, image_url, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, ad: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM ads WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
