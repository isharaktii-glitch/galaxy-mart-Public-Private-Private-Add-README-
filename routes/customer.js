const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET CUSTOMER PROFILE
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, first_name, last_name, email,
       phone, whatsapp, address, kyc_status, kyc_id_image,
       kyc_face_image, phone_verified, preferred_language
       FROM users WHERE id=$1`,
      [req.user.id]
    );
    res.json({ success: true, profile: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// UPDATE PROFILE
router.put('/profile', verifyToken, async (req, res) => {
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

// KYC SUBMIT
router.post('/kyc', verifyToken, async (req, res) => {
  try {
    const { kyc_id_image, kyc_face_image } = req.body;
    await db.query(
      `UPDATE users SET kyc_id_image=$1, kyc_face_image=$2,
       kyc_status='pending', updated_at=NOW()
       WHERE id=$3`,
      [kyc_id_image, kyc_face_image, req.user.id]
    );
    res.json({ success: true, message: 'KYC submitted for review' });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ADD BANK DETAILS
router.post('/bank-details', verifyToken, async (req, res) => {
  try {
    const { bank_name, account_number, account_holder, branch } = req.body;
    const result = await db.query(
      `INSERT INTO bank_details
        (user_id, bank_name, account_number, account_holder, branch)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, bank_name, account_number, account_holder, branch]
    );
    res.json({ success: true, bank: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET BANK DETAILS
router.get('/bank-details', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM bank_details WHERE user_id=$1',
      [req.user.id]
    );
    res.json({ success: true, banks: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// LIST ITEMS (customer listing products to sell)
router.post('/listings', verifyToken, async (req, res) => {
  try {
    const {
      category_id, name_en, name_si, name_ta,
      description_en, description_si, description_ta,
      base_price, images, stock
    } = req.body;

    const markup = await db.query(
      `SELECT * FROM markup_settings WHERE type='global'`
    );
    const m = markup.rows[0];
    const finalPrice = base_price * (1 + m.admin_markup_percent / 100);

    const result = await db.query(
      `INSERT INTO products
        (seller_id, category_id, name_en, name_si, name_ta,
         description_en, description_si, description_ta,
         base_price, images, stock, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
       RETURNING *`,
      [req.user.id, category_id, name_en, name_si, name_ta,
       description_en, description_si, description_ta,
       finalPrice, images || [], stock || 0]
    );
    res.json({ success: true, listing: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET MY LISTINGS
router.get('/listings', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, c.name_en as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id=c.id
       WHERE p.seller_id=$1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, listings: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PLACE ORDER (direct buy)
router.post('/orders', verifyToken, async (req, res) => {
  try {
    const { seller_id, items } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items' });
    }

    const markup = await db.query(
      `SELECT * FROM markup_settings WHERE type='global'`
    );
    const m = markup.rows[0];

    let total = 0;
    for (const item of items) {
      const p = await db.query(
        'SELECT base_price FROM products WHERE id=$1', [item.product_id]
      );
      if (p.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      total += p.rows[0].base_price * item.quantity;
    }

    const adminEarning = total * (m.admin_markup_percent / 100);
    const sellerEarning = total * (m.seller_commission_percent / 100);
    const resellerEarning = total * (m.reseller_commission_percent / 100);
    const deliveryEarning = total * (m.delivery_commission_percent / 100);

    const order = await db.query(
      `INSERT INTO orders
        (customer_id, seller_id, total_amount,
         admin_earning, seller_earning,
         reseller_earning, delivery_earning)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [req.user.id, seller_id, total,
       adminEarning, sellerEarning,
       resellerEarning, deliveryEarning]
    );

    const orderId = order.rows[0].id;
    for (const item of items) {
      const p = await db.query(
        'SELECT base_price FROM products WHERE id=$1', [item.product_id]
      );
      await db.query(
        `INSERT INTO order_items
          (order_id, product_id, quantity, unit_price, total_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderId, item.product_id, item.quantity,
         p.rows[0].base_price,
         p.rows[0].base_price * item.quantity]
      );
    }

    res.json({ success: true, order: order.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET MY ORDERS
router.get('/orders', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*,
        oi.quantity, oi.unit_price, oi.total_price,
        p.name_en as product_name,
        s.username as seller_name
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id=o.id
       LEFT JOIN products p ON oi.product_id=p.id
       LEFT JOIN users s ON o.seller_id=s.id
       WHERE o.customer_id=$1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// SUBMIT PAYMENT RECEIPT
router.post('/orders/:id/payment', verifyToken, async (req, res) => {
  try {
    const { receipt } = req.body;
    await db.query(
      `UPDATE orders SET payment_receipt=$1,
       payment_status='paid', updated_at=NOW()
       WHERE id=$2 AND customer_id=$3`,
      [receipt, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// REJECT ORDER (customer side)
router.put('/orders/:id/reject', verifyToken, async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    await db.query(
      `UPDATE orders SET status='rejected',
       rejection_reason=$1, updated_at=NOW()
       WHERE id=$2 AND customer_id=$3`,
      [rejection_reason, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET ADMIN BANK DETAILS (for payment)
router.get('/admin-bank', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM admin_bank_details WHERE is_active=true LIMIT 1`
    );
    res.json({ success: true, bank: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET ANNOUNCEMENTS
router.get('/announcements', verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM announcements
       WHERE target='all' OR target='customers'
       OR (target='specific' AND target_user_id=$1)
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, announcements: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
