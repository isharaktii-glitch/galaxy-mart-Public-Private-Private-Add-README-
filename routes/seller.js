const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isSeller } = require('../middleware/auth');

// GET SELLER DASHBOARD STATS
router.get('/dashboard', verifyToken, isSeller, async (req, res) => {
  try {
    const [orders, earnings, products, pending] = await Promise.all([
      db.query('SELECT COUNT(*) FROM orders WHERE seller_id=$1', [req.user.id]),
      db.query(`SELECT SUM(seller_earning) FROM orders 
                WHERE seller_id=$1 AND status='done'`, [req.user.id]),
      db.query('SELECT COUNT(*) FROM products WHERE seller_id=$1', [req.user.id]),
      db.query(`SELECT COUNT(*) FROM orders 
                WHERE seller_id=$1 AND status='pending'`, [req.user.id])
    ]);
    res.json({
      success: true,
      stats: {
        total_orders: orders.rows[0].count,
        total_earnings: earnings.rows[0].sum || 0,
        total_products: products.rows[0].count,
        pending_orders: pending.rows[0].count
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET SELLER ORDERS
router.get('/orders', verifyToken, isSeller, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*, u.username as customer_name,
        u.phone as customer_phone
      FROM orders o
      LEFT JOIN users u ON o.customer_id=u.id
      WHERE o.seller_id=$1
      ORDER BY o.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// APPROVE / REJECT / DONE ORDER
router.put('/orders/:id/status', verifyToken, isSeller, async (req, res) => {
  try {
    const { status, rejection_reason } = req.body;
    const validStatus = ['approved', 'rejected', 'processing', 'done'];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await db.query(
      `UPDATE orders SET status=$1, rejection_reason=$2,
       updated_at=NOW() WHERE id=$3 AND seller_id=$4`,
      [status, rejection_reason || null, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET SELLER PRODUCTS
router.get('/products', verifyToken, isSeller, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, c.name_en as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id=c.id
      WHERE p.seller_id=$1
      ORDER BY p.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, products: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ADD PRODUCT
router.post('/products', verifyToken, isSeller, async (req, res) => {
  try {
    const {
      category_id, name_en, name_si, name_ta,
      description_en, description_si, description_ta,
      base_price, wholesale_price, images, stock
    } = req.body;

    // GET MARKUP
    const markup = await db.query(
      `SELECT * FROM markup_settings WHERE type='global'`
    );
    const m = markup.rows[0];
    const finalPrice = base_price * (1 + m.admin_markup_percent / 100);

    const result = await db.query(
      `INSERT INTO products
        (seller_id, category_id, name_en, name_si, name_ta,
         description_en, description_si, description_ta,
         base_price, wholesale_price, images, stock)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [req.user.id, category_id, name_en, name_si, name_ta,
       description_en, description_si, description_ta,
       finalPrice, wholesale_price, images || [], stock || 0]
    );
    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// UPDATE PRODUCT
router.put('/products/:id', verifyToken, isSeller, async (req, res) => {
  try {
    const {
      name_en, name_si, name_ta,
      description_en, description_si, description_ta,
      base_price, wholesale_price, images, stock, status
    } = req.body;
    await db.query(
      `UPDATE products SET
        name_en=$1, name_si=$2, name_ta=$3,
        description_en=$4, description_si=$5, description_ta=$6,
        base_price=$7, wholesale_price=$8, images=$9,
        stock=$10, status=$11, updated_at=NOW()
       WHERE id=$12 AND seller_id=$13`,
      [name_en, name_si, name_ta,
       description_en, description_si, description_ta,
       base_price, wholesale_price, images,
       stock, status, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE PRODUCT
router.delete('/products/:id', verifyToken, isSeller, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM products WHERE id=$1 AND seller_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// REQUEST PAYMENT
router.post('/payment-request', verifyToken, isSeller, async (req, res) => {
  try {
    const { bank_name, account_number, account_holder, amount } = req.body;
    await db.query(
      `INSERT INTO payment_requests
        (seller_id, bank_name, account_number, account_holder, amount)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.user.id, bank_name, account_number, account_holder, amount]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET PAYMENT HISTORY
router.get('/payment-history', verifyToken, isSeller, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM payment_requests 
       WHERE seller_id=$1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET ANNOUNCEMENTS
router.get('/announcements', verifyToken, isSeller, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM announcements 
       WHERE target='all' OR target='sellers'
       OR (target='specific' AND target_user_id=$1)
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, announcements: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET SELLER PROFILE
router.get('/profile', verifyToken, isSeller, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, first_name, last_name, email,
       phone, whatsapp, address, kyc_status, preferred_language
       FROM users WHERE id=$1`,
      [req.user.id]
    );
    res.json({ success: true, profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// UPDATE SELLER PROFILE
router.put('/profile', verifyToken, isSeller, async (req, res) => {
  try {
    const { first_name, last_name, phone, whatsapp, address, preferred_language } = req.body;
    await db.query(
      `UPDATE users SET first_name=$1, last_name=$2,
       phone=$3, whatsapp=$4, address=$5,
       preferred_language=$6, updated_at=NOW()
       WHERE id=$7`,
      [first_name, last_name, phone, whatsapp,
       address, preferred_language, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
