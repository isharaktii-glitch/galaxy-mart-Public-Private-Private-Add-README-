const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, isAdmin, isSeller } = require('../middleware/auth');

// GET ALL ACTIVE AUCTIONS (public)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, u.username as seller_name,
        (SELECT COUNT(*) FROM auction_bids WHERE auction_id=a.id) as bid_count,
        (SELECT bid_amount FROM auction_bids WHERE auction_id=a.id ORDER BY bid_amount DESC LIMIT 1) as highest_bid
      FROM auctions a
      LEFT JOIN users u ON a.seller_id=u.id
      WHERE a.status='active' AND a.end_time > NOW()
      ORDER BY a.end_time ASC
    `);
    res.json({ success: true, auctions: result.rows });
  } catch(err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET SINGLE AUCTION
router.get('/:id', async (req, res) => {
  try {
    const auction = await db.query(`
      SELECT a.*, u.username as seller_name
      FROM auctions a
      LEFT JOIN users u ON a.seller_id=u.id
      WHERE a.id=$1
    `, [req.params.id]);

    const bids = await db.query(`
      SELECT ab.*, u.username as bidder_name
      FROM auction_bids ab
      LEFT JOIN users u ON ab.bidder_id=u.id
      WHERE ab.auction_id=$1
      ORDER BY ab.bid_amount DESC
    `, [req.params.id]);

    res.json({ success: true, auction: auction.rows[0], bids: bids.rows });
  } catch(err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// CREATE AUCTION (seller/admin)
router.post('/', verifyToken, isSeller, async (req, res) => {
  try {
    const {
      product_name, description, images,
      starting_price, min_bid_increment, end_time
    } = req.body;

    const result = await db.query(`
      INSERT INTO auctions
        (seller_id, product_name, description, images,
         starting_price, current_price, min_bid_increment, end_time)
      VALUES ($1,$2,$3,$4,$5,$5,$6,$7)
      RETURNING *
    `, [req.user.id, product_name, description,
        images || [], starting_price,
        min_bid_increment || 100, end_time]);

    res.json({ success: true, auction: result.rows[0] });
  } catch(err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PLACE BID
router.post('/:id/bid', verifyToken, async (req, res) => {
  try {
    const { bid_amount } = req.body;
    const auction = await db.query(
      'SELECT * FROM auctions WHERE id=$1 AND status=$2 AND end_time > NOW()',
      [req.params.id, 'active']
    );

    if(auction.rows.length === 0) {
      return res.status(400).json({ error: 'Auction not found or ended' });
    }

    const a = auction.rows[0];
    if(a.seller_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot bid on your own auction' });
    }

    const minBid = Number(a.current_price) + Number(a.min_bid_increment);
    if(Number(bid_amount) < minBid) {
      return res.status(400).json({ error: `Minimum bid is LKR ${minBid}` });
    }

    await db.query(
      'INSERT INTO auction_bids (auction_id, bidder_id, bid_amount) VALUES ($1,$2,$3)',
      [req.params.id, req.user.id, bid_amount]
    );

    await db.query(
      'UPDATE auctions SET current_price=$1 WHERE id=$2',
      [bid_amount, req.params.id]
    );

    res.json({ success: true, message: 'Bid placed!' });
  } catch(err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// UPDATE AUCTION TIME (seller/admin)
router.put('/:id/time', verifyToken, async (req, res) => {
  try {
    const { end_time } = req.body;
    const auction = await db.query('SELECT * FROM auctions WHERE id=$1', [req.params.id]);
    if(auction.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    if(req.user.role !== 'admin' && auction.rows[0].seller_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await db.query('UPDATE auctions SET end_time=$1 WHERE id=$2', [end_time, req.params.id]);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// END AUCTION (admin)
router.put('/:id/end', verifyToken, isAdmin, async (req, res) => {
  try {
    const topBid = await db.query(`
      SELECT * FROM auction_bids
      WHERE auction_id=$1
      ORDER BY bid_amount DESC LIMIT 1
    `, [req.params.id]);

    const winner_id = topBid.rows.length > 0 ? topBid.rows[0].bidder_id : null;

    await db.query(
      'UPDATE auctions SET status=$1, winner_id=$2 WHERE id=$3',
      ['ended', winner_id, req.params.id]
    );

    res.json({ success: true, winner_id });
  } catch(err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// DELETE AUCTION (admin)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM auctions WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
