require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

const initDatabase = async () => {
  const client = await pool.connect();
  
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        country VARCHAR(255),
        state VARCHAR(255),
        pin_code VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add address columns if they don't exist (for existing tables)
    try {
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(255)`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(255)`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20)`);
    } catch (e) {
      // Columns might already exist, ignore
    }
    
    // Create orders table with address/status history/payment placeholders
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'Placed',
        payment_method VARCHAR(50),
        payment_status VARCHAR(50) DEFAULT 'Pending',
        shipping_address JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate old columns/shape if needed (runs on existing tables)
    await client.query(`ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'Placed'`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pending'`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB`);

    // Status history per order: powers the user's tracking timeline
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create admins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create default admin from environment variables (only if not exists)
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Admin';
    
    if (adminEmail && adminPassword) {
      const existingAdmin = await client.query('SELECT id FROM admins WHERE email = $1', [adminEmail]);
      if (existingAdmin.rows.length === 0) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await client.query(
          'INSERT INTO admins (name, email, password) VALUES ($1, $2, $3)',
          [adminName, adminEmail, hashedPassword]
        );
        console.log(`✓ Admin user created: ${adminEmail}`);
      }
    }
    
    // Create order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        product_price DECIMAL(10, 2) NOT NULL,
        quantity INTEGER NOT NULL
      )
    `);

    // Create categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Self-reference for subcategories (one level deep). Idempotent for existing DBs.
    await client.query(`
      ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL
    `);

    // Create products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        price DECIMAL(10, 2) NOT NULL,
        image VARCHAR(1024),
        description TEXT,
        stock INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed categories and products only if empty (preserves existing store content)
    const existingProducts = await client.query('SELECT id FROM products LIMIT 1');
    if (existingProducts.rows.length === 0) {
      const seedCategories = ['Dresses', 'Outerwear', 'Knitwear', 'Bottoms', 'Tops'];
      const categoryIds = {};

      for (const name of seedCategories) {
        const result = await client.query(
          'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id',
          [name]
        );
        if (result.rows.length > 0) {
          categoryIds[name] = result.rows[0].id;
        } else {
          const existing = await client.query('SELECT id FROM categories WHERE name = $1', [name]);
          categoryIds[name] = existing.rows[0].id;
        }
      }

      const seedProducts = [
        { name: 'Silk Evening Gown', category: 'Dresses', price: 289, image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop', description: 'Elegant floor-length silk gown for evening occasions.', stock: 10 },
        { name: 'Leather Biker Jacket', category: 'Outerwear', price: 345, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop', description: 'Classic genuine leather biker jacket with asymmetric zip.', stock: 8 },
        { name: 'Cashmere Sweater', category: 'Knitwear', price: 199, image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=500&fit=crop', description: 'Ultra-soft pure cashmere crew-neck sweater.', stock: 15 },
        { name: 'Tailored Trousers', category: 'Bottoms', price: 159, image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop', description: 'Sharp tailored trousers with a slim, modern fit.', stock: 20 },
        { name: 'Linen Summer Dress', category: 'Dresses', price: 175, image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=500&fit=crop', description: 'Breathable linen dress, perfect for warm days.', stock: 12 },
        { name: 'Denim Jacket', category: 'Outerwear', price: 189, image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400&h=500&fit=crop', description: 'Vintage-wash denim jacket with button closure.', stock: 14 },
        { name: 'Silk Blouse', category: 'Tops', price: 145, image: 'https://images.unsplash.com/photo-1598554747436-c9293d6a588f?w=400&h=500&fit=crop', description: 'Lightweight silk blouse with a relaxed silhouette.', stock: 18 },
        { name: 'Pleated Midi Skirt', category: 'Bottoms', price: 129, image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0uj5b?w=400&h=500&fit=crop', description: 'Flowing pleated midi skirt with elastic waistband.', stock: 16 }
      ];

      for (const p of seedProducts) {
        await client.query(
          'INSERT INTO products (name, category_id, price, image, description, stock) VALUES ($1, $2, $3, $4, $5, $6)',
          [p.name, categoryIds[p.category], p.price, p.image, p.description, p.stock]
        );
      }
      console.log(`✓ Seeded ${seedProducts.length} products and ${seedCategories.length} categories`);
    }

    console.log('✅ Database tables created successfully');
  } catch (err) {
    console.error('❌ Error initializing database:', err.message);
  } finally {
    client.release();
  }
};

module.exports = { pool, initDatabase };
