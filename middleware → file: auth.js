const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

const isSeller = (req, res, next) => {
  if (!['admin', 'seller'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Seller only' });
  }
  next();
};

module.exports = { verifyToken, isAdmin, isSeller };
