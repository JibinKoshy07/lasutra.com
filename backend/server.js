const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool, initDatabase } = require('./db');
const { sendOrderConfirmation, sendAdminNotification, sendStatusUpdateEmail } = require('./emailService');

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

// Order stage constants used across the API
const ORDER_STATUSES = ['Placed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Payment Failed', 'Returned', 'Refunded'];

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded product images
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|gif|webp|svg\+xml|avif)$/.test(file.mimetype)) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

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
    const { userId, items, totalAmount, address, paymentMethod } = req.body;
    
    if (!userId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Invalid order data' });
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get user details for address
      const userResult = await client.query(
        'SELECT name, email FROM users WHERE id = $1',
        [userId]
      );
      
      const user = userResult.rows[0];
      
      // Snapshot of the currently chosen shipping address (JSONB)
      const shippingAddress = address && address.fullName ? {
        fullName: address.fullName || null,
        phone: address.phone || null,
        house: address.house || null,
        street: address.street || null,
        landmark: address.landmark || null,
        city: address.city || null,
        state: address.state || null,
        pinCode: address.pinCode || null,
        country: address.country || null
      } : null;
      
      // Create order with payment placeholder and full address snapshot
      const orderResult = await client.query(
        'INSERT INTO orders (user_id, total_amount, status, payment_method, payment_status, shipping_address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [userId, totalAmount, 'Placed', paymentMethod || 'Offline Placeholder', 'Pending', shippingAddress ? JSON.stringify(shippingAddress) : null]
      );
      
      const orderId = orderResult.rows[0].id;
      
      // Record the first status entry for the timeline
      await client.query(
        'INSERT INTO order_status_history (order_id, status) VALUES ($1, $2)',
        [orderId, 'Placed']
      );
      
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
        shippingAddress || {}
      );
      
      sendAdminNotification(
        { name: user.name, email: user.email },
        orderId,
        items,
        totalAmount,
        shippingAddress || {}
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
      'SELECT id, total_amount, status, payment_method, payment_status, shipping_address, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    const orders = await Promise.all(ordersResult.rows.map(async (order) => {
      const itemsResult = await pool.query(
        'SELECT product_id, product_name, product_price, quantity FROM order_items WHERE order_id = $1',
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

// Get single order detail + status history (user must own the order)
app.get('/api/orders/:userId/:orderId', async (req, res) => {
  try {
    const { userId, orderId } = req.params;
    
    const orderResult = await pool.query(
      'SELECT id, user_id, total_amount, status, payment_method, payment_status, shipping_address, created_at FROM orders WHERE id = $1',
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = orderResult.rows[0];
    if (parseInt(userId) !== order.user_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const itemsResult = await pool.query(
      'SELECT product_id, product_name, product_price, quantity FROM order_items WHERE order_id = $1',
      [orderId]
    );
    
    const historyResult = await pool.query(
      'SELECT status, changed_at FROM order_status_history WHERE order_id = $1 ORDER BY changed_at ASC, id ASC',
      [orderId]
    );
    
    res.json({
      ...order,
      items: itemsResult.rows,
      history: historyResult.rows
    });
  } catch (err) {
    console.error('Get order detail error:', err);
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
        o.id, o.total_amount, o.status, o.payment_method, o.payment_status,
        o.shipping_address, o.created_at,
        u.name as user_name, u.email as user_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);
    
    // Get items for each order
    const orders = await Promise.all(result.rows.map(async (order) => {
      const itemsResult = await pool.query(
        'SELECT product_id, product_name, product_price, quantity FROM order_items WHERE order_id = $1',
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
    
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Get current order info
    const orderResult = await pool.query(
      'SELECT user_id FROM orders WHERE id = $1',
      [id]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const userId = orderResult.rows[0].user_id;
    
    // Record history entry only when the status actually changes
    await pool.query(
      'INSERT INTO order_status_history (order_id, status) VALUES ($1, $2)',
      [id, status]
    );
    
    // Update status
    await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      [status, id]
    );
    
    // Get user and order details for email
    const userResult = await pool.query(
      'SELECT name, email FROM users WHERE id = $1',
      [userId]
    );
    
    const itemsResult = await pool.query(
      'SELECT product_name, product_price, quantity FROM order_items WHERE order_id = $1',
      [id]
    );
    
    const totalResult = await pool.query(
      'SELECT total_amount FROM orders WHERE id = $1',
      [id]
    );
    
    // Send status update email
    sendStatusUpdateEmail(
      { name: userResult.rows[0].name, email: userResult.rows[0].email },
      id,
      status,
      itemsResult.rows,
      parseFloat(totalResult.rows[0].total_amount)
    );
    
    res.json({
      message: 'Order status updated',
      order: { id: parseInt(id), status }
    });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ PRODUCT & CATEGORY ROUTES ============

// Public: list categories (with product count)
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: list products (optionally filter by category id)
app.get('/api/products', async (req, res) => {
  try {
    const { category } = req.query;
    const params = [];
    let where = '';
    if (category) {
      params.push(category);
      where = 'WHERE p.category_id = $1';
    }
    const result = await pool.query(`
      SELECT p.id, p.name, p.price, p.image, p.description, p.stock, p.created_at,
             p.category_id, c.name AS category
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY p.id
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: get one product for the details page
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT p.id, p.name, p.price, p.image, p.description, p.stock, p.created_at,
             p.category_id, c.name AS category
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create product
app.post('/api/admin/products', async (req, res) => {
  try {
    const { name, categoryId, price, image, description, stock } = req.body;

    if (!name || price === undefined || price === null || price === '') {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({ error: 'Price must be a valid positive number' });
    }

    const result = await pool.query(
      'INSERT INTO products (name, category_id, price, image, description, stock) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, categoryId || null, parseFloat(price), image || null, description || null, parseInt(stock) || 0]
    );
    res.status(201).json({ message: 'Product created', product: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid category' });
    }
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: update product
app.put('/api/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categoryId, price, image, description, stock } = req.body;

    if (!name || price === undefined || price === null || price === '') {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({ error: 'Price must be a valid positive number' });
    }

    const result = await pool.query(
      'UPDATE products SET name = $1, category_id = $2, price = $3, image = $4, description = $5, stock = $6 WHERE id = $7 RETURNING *',
      [name, categoryId || null, parseFloat(price), image || null, description || null, parseInt(stock) || 0, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product updated', product: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid category' });
    }
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete product
app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: create category
app.post('/api/admin/categories', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const result = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    res.status(201).json({ message: 'Category created', category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: delete category (products in it are kept, category set to null)
app.delete('/api/admin/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: upload a product image, returns its public URL
app.post('/api/admin/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.status(201).json({ message: 'Image uploaded', imageUrl: url });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
