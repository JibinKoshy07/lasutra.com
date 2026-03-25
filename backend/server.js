const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('./db');
const { sendOrderConfirmation, sendAdminNotification } = require('./emailService');

// Rate limiting for auth endpoints
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function checkRateLimit(key) {
  const now = Date.now();
  const record = rateLimit.get(key);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    rateLimit.set(key, { windowStart: now, attempts: 1 });
    return true;
  }
  
  if (record.attempts >= MAX_ATTEMPTS) {
    return false;
  }
  
  record.attempts++;
  return true;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database on startup
initDatabase();

// ============ AUTH ROUTES ============

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, country, state, pinCode } = req.body;
    
    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Password strength
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user with optional address
    const result = await pool.query(
      'INSERT INTO users (name, email, password, country, state, pin_code) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, country, state, pin_code',
      [name, email, hashedPassword, country || null, state || null, pinCode || null]
    );
    
    const user = result.rows[0];
    res.status(201).json({
      message: 'User created successfully',
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        country: user.country,
        state: user.state,
        pinCode: user.pin_code
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const result = await pool.query(
      'SELECT id, name, email, password FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Return user without password (including address)
    res.json({
      message: 'Login successful',
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        country: user.country,
        state: user.state,
        pinCode: user.pin_code
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT id, name, email, country, state, pin_code, created_at FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      country: user.country,
      state: user.state,
      pinCode: user.pin_code,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user address
app.put('/api/users/:id/address', async (req, res) => {
  try {
    const { id } = req.params;
    const { country, state, pinCode } = req.body;
    
    const result = await pool.query(
      'UPDATE users SET country = $1, state = $2, pin_code = $3 WHERE id = $4 RETURNING id, name, email, country, state, pin_code',
      [country, state, pinCode, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      message: 'Address updated successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        country: user.country,
        state: user.state,
        pinCode: user.pin_code
      }
    });
  } catch (err) {
    console.error('Update address error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ ORDER ROUTES ============

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const { userId, items, totalAmount, address } = req.body;
    
    if (!userId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Invalid order data' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get user details for address
      const userResult = await client.query(
        'SELECT name, email, country, state, pin_code FROM users WHERE id = $1',
        [userId]
      );
      
      const user = userResult.rows[0];
      const shippingAddress = {
        country: (address && address.country) ? address.country : user.country,
        state: (address && address.state) ? address.state : user.state,
        pinCode: (address && address.pinCode) ? address.pinCode : user.pin_code
      };
      
      // Create order with shipping address
      const orderResult = await client.query(
        'INSERT INTO orders (user_id, total_amount, shipping_country, shipping_state, shipping_pin_code) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [userId, totalAmount, shippingAddress.country, shippingAddress.state, shippingAddress.pinCode]
      );
      
      const orderId = orderResult.rows[0].id;
      
      // Add order items
      for (const item of items) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity) VALUES ($1, $2, $3, $4, $5)',
          [orderId, item.id, item.name, item.price, item.quantity]
        );
      }
      
      await client.query('COMMIT');
      
      // Send emails (async, don't wait)
      sendOrderConfirmation(
        { name: user.name, email: user.email },
        orderId,
        items,
        totalAmount,
        shippingAddress
      );
      
      sendAdminNotification(
        { name: user.name, email: user.email },
        orderId,
        items,
        totalAmount,
        shippingAddress
      );
      
      res.status(201).json({
        message: 'Order created successfully',
        orderId
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user orders
app.get('/api/orders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const ordersResult = await pool.query(
      'SELECT id, total_amount, status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    const orders = await Promise.all(ordersResult.rows.map(async (order) => {
      const itemsResult = await pool.query(
        'SELECT product_name, product_price, quantity FROM order_items WHERE order_id = $1',
        [order.id]
      );
      
      return {
        ...order,
        items: itemsResult.rows
      };
    }));
    
    res.json(orders);
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ ADMIN ROUTES ============

// Admin login with rate limiting
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    if (!checkRateLimit(`admin:${clientIP}`)) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const result = await pool.query(
      'SELECT id, name, email, password FROM admins WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const admin = result.rows[0];
    const isMatch = await bcrypt.compare(password, admin.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Clear rate limit on successful login
    rateLimit.delete(`admin:${clientIP}`);
    
    res.json({
      message: 'Admin login successful',
      admin: { id: admin.id, name: admin.name, email: admin.email }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all orders (admin only)
app.get('/api/admin/orders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        o.id, o.total_amount, o.status, o.created_at,
        o.shipping_country, o.shipping_state, o.shipping_pin_code,
        u.name as user_name, u.email as user_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);
    
    // Get items for each order
    const orders = await Promise.all(result.rows.map(async (order) => {
      const itemsResult = await pool.query(
        'SELECT product_name, product_price, quantity FROM order_items WHERE order_id = $1',
        [order.id]
      );
      return {
        ...order,
        items: itemsResult.rows
      };
    }));
    
    res.json(orders);
  } catch (err) {
    console.error('Get all orders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update order status (admin only)
app.put('/api/admin/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'in_progress', 'shipped', 'delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const result = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json({
      message: 'Order status updated',
      order: result.rows[0]
    });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
