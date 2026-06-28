const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin } = require('../middleware/auth');

// GET ALL USERS
router.get('/users', verifyToken, isAdmin, async (req, res) => {
  try {
    const { role, search } = req.query;
    let query = `SELECT id, username, first_name, last_name, email, phone, 
                 whatsapp, address, role, status, kyc_status, 
                 phone_verified, created_at FROM users WHERE 1=1`;
    const params = [];

    if (role) {
      params.push(role);
      query += ` AND role=$${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (username ILIKE $${params.length} 
                 OR email ILIKE $${params.length} 
                 OR first_name ILIKE $${params.length})`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// UPDATE USER STATUS
router.put('/users/:id/status', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(
      'UPDATE users SET status=$1 WHERE id=$2',
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE USER
router.delete('/users/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET ALL ORDERS
router.get('/orders', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*, 
        u.username as customer_name,
        s.username as seller_name
      FROM orders o
      LEFT JOIN users u ON o.customer_id=u.id
      LEFT JOIN users s ON o.seller_id=s.id
      ORDER BY o.created_at DESC
    `);
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// UPDATE ORDER STATUS
router.put('/orders/:id/status', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    await db.query(
      `UPDATE orders SET status=$1, rejection_reason=$2, 
       updated_at=NOW() WHERE id=$3`,
      [status, rejection_reason || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET MARKUP SETTINGS
router.get('/markup', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM markup_settings WHERE type=$1', ['global']
    );
    res.json({ success: true, markup: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// UPDATE MARKUP SETTINGS
router.put('/markup', verifyToken, isAdmin, async (req, res) => {
  try {
    const {
      admin_markup_percent,
      seller_commission_percent,
      reseller_commission_percent,
      delivery_commission_percent,
      type,
      reference_id
    } = req.body;

    const markupType = type || 'global';
    const exists = await db.query(
      'SELECT id FROM markup_settings WHERE type=$1',
      [markupType]
    );

    if (exists.rows.length > 0) {
      await db.query(
        `UPDATE markup_settings SET 
         admin_markup_percent=$1,
         seller_commission_percent=$2,
         reseller_commission_percent=$3,
         delivery_commission_percent=$4,
         updated_at=NOW()
         WHERE type=$5`,
        [admin_markup_percent, seller_commission_percent,
         reseller_commission_percent, delivery_commission_percent,
         markupType]
      );
    } else {
      await db.query(
        `INSERT INTO markup_settings 
         (type, reference_id, admin_markup_percent, seller_commission_percent,
          reseller_commission_percent, delivery_commission_percent)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [markupType, reference_id, admin_markup_percent,
         seller_commission_percent, reseller_commission_percent,
         delivery_commission_percent]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET PAYMENT REQUESTS
router.get('/payment-requests', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT pr.*, u.username, u.email 
      FROM payment_requests pr
      LEFT JOIN users u ON pr.seller_id=u.id
      ORDER BY pr.created_at DESC
    `);
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// UPDATE PAYMENT REQUEST
router.put('/payment-requests/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(
      'UPDATE payment_requests SET status=$1 WHERE id=$2',
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// SEND ANNOUNCEMENT
router.post('/announcement', verifyToken, isAdmin, async (req, res) => {
  try {
    const { target, target_user_id, title, message } = req.body;
    await db.query(
      `INSERT INTO announcements 
       (admin_id, target, target_user_id, title, message)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, target, target_user_id || null, title, message]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// CATEGORIES CRUD
router.get('/categories', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM categories ORDER BY created_at DESC'
    );
    res.json({ success: true, categories: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.post('/categories', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name_en, name_si, name_ta, parent_id } = req.body;
    const result = await db.query(
      `INSERT INTO categories (name_en, name_si, name_ta, parent_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name_en, name_si, name_ta, parent_id || null]
    );
    res.json({ success: true, category: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.put('/categories/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const { name_en, name_si, name_ta, is_active } = req.body;
    await db.query(
      `UPDATE categories SET name_en=$1, name_si=$2, 
       name_ta=$3, is_active=$4 WHERE id=$5`,
      [name_en, name_si, name_ta, is_active, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

router.delete('/categories/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// SET ADMIN BANK DETAILS
router.post('/bank-details', verifyToken, isAdmin, async (req, res) => {
  try {
    const { bank_name, account_number, account_holder, branch } = req.body;
    await db.query('UPDATE admin_bank_details SET is_active=false');
    await db.query(
      `INSERT INTO admin_bank_details 
       (bank_name, account_number, account_holder, branch)
       VALUES ($1,$2,$3,$4)`,
      [bank_name, account_number, account_holder, branch]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET DASHBOARD STATS
router.get('/dashboard', verifyToken, isAdmin, async (req, res) => {
  try {
    const [users, orders, products, payments] = await Promise.all([
      db.query('SELECT COUNT(*) FROM users'),
      db.query('SELECT COUNT(*), SUM(total_amount) FROM orders'),
      db.query('SELECT COUNT(*) FROM products'),
      db.query(`SELECT COUNT(*) FROM payment_requests 
                WHERE status='pending'`)
    ]);
    res.json({
      success: true,
      stats: {
        total_users: users.rows[0].count,
        total_orders: orders.rows[0].count,
        total_revenue: orders.rows[0].sum || 0,
        total_products: products.rows[0].count,
        pending_payments: payments.rows[0].count
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
