const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

router.post('/register', async (req, res) => {
  try {
    const { username, first_name, last_name, email, password, phone, whatsapp, address, role, preferred_language } = req.body;
    if (!username || !email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Required fields missing' });
    }
    const exists = await db.query('SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }
    const userRole = ['customer', 'seller'].includes(role) ? role : 'customer';
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (username, first_name, last_name, email, password_hash, phone, whatsapp, address, role, preferred_language)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, username, email, role`,
      [username, first_name, last_name, email, hash, phone, whatsapp, address, userRole, preferred_language || 'en']
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Fields required' });
    const result = await db.query('SELECT * FROM users WHERE email=$1 OR username=$1', [identifier]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
