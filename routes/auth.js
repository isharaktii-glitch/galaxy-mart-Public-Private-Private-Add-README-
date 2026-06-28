const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const {
      username, first_name, last_name,
      email, password, phone, whatsapp,
      address, role, preferred_language
    } = req.body;

    if (!username || !email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const exists = await db.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2',
      [email, username]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    const validRoles = ['customer', 'seller'];
    const userRole = validRoles.includes(role) ? role : 'customer';

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users 
        (username, first_name, last_name, email, password_hash, 
         phone, whatsapp, address, role, preferred_language)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, username, email, role`,
      [username, first_name, last_name, email, hash,
       phone, whatsapp, address, userRole,
       preferred_language || 'en']
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ success: true, token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Fields required' });
    }

    const result = await db.query(
      'SELECT * FROM users WHERE email=$1 OR username=$1',
      [identifier]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true, token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        preferred_language: user.preferred_language
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await db.query(
      'SELECT id FROM users WHERE email=$1', [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    await db.query(
      `INSERT INTO otp_codes (phone, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [email, resetCode]
    );
    res.json({ success: true, message: 'Reset code sent', code: resetCode });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// RESET PASSWORD
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, new_password } = req.body;
    const result = await db.query(
      `SELECT * FROM otp_codes 
       WHERE phone=$1 AND code=$2 
       AND used=false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash=$1 WHERE email=$2', [hash, email]);
    await db.query('UPDATE otp_codes SET used=true WHERE id=$1', [result.rows[0].id]);
    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// SEND OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await db.query(
      `INSERT INTO otp_codes (phone, code, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '5 minutes')`,
      [phone, otp]
    );
    res.json({ success: true, otp, message: 'OTP sent' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// VERIFY OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    const result = await db.query(
      `SELECT * FROM otp_codes 
       WHERE phone=$1 AND code=$2 
       AND used=false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, code]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    await db.query('UPDATE otp_codes SET used=true WHERE id=$1', [result.rows[0].id]);
    await db.query('UPDATE users SET phone_verified=true WHERE phone=$1', [phone]);
    res.json({ success: true, message: 'Phone verified' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
