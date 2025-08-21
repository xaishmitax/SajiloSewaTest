const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log('🔄 Initializing new database...');

// Create database connection
const dbPath = path.join(__dirname, 'fixsewa.db');
const db = new sqlite3.Database(dbPath);

console.log(`📁 Database path: ${dbPath}`);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create users table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('❌ Error creating users table:', err.message);
  } else {
    console.log('✅ Users table created successfully');
  }
});

// Create workers table
db.run(`
  CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service TEXT NOT NULL,
    experience TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`, (err) => {
  if (err) {
    console.error('❌ Error creating workers table:', err.message);
  } else {
    console.log('✅ Workers table created successfully');
  }
});

// Create bookings table
db.run(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_phone TEXT NOT NULL,
    location TEXT NOT NULL,
    work TEXT NOT NULL,
    date TEXT NOT NULL,
    location_text TEXT NOT NULL,
    work_text TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    worker_id INTEGER,
    worker_assigned_date TIMESTAMP,
    estimated_price REAL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (worker_id) REFERENCES users (id)
  )
`, (err) => {
  if (err) {
    console.error('❌ Error creating bookings table:', err.message);
  } else {
    console.log('✅ Bookings table created successfully');
  }
});

// Create notifications table for customer alerts
db.run(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )
`, (err) => {
  if (err) {
    console.error('❌ Error creating notifications table:', err.message);
  } else {
    console.log('✅ Notifications table created successfully');
  }
});

// Create worker_reviews table
db.run(`
  CREATE TABLE IF NOT EXISTS worker_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    booking_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES users (id),
    FOREIGN KEY (customer_id) REFERENCES users (id),
    FOREIGN KEY (booking_id) REFERENCES bookings (id)
  )
`, (err) => {
  if (err) {
    console.error('❌ Error creating worker_reviews table:', err.message);
  } else {
    console.log('✅ Worker reviews table created successfully');
  }
});

// Test database connection
db.get('SELECT 1', (err) => {
  if (err) {
    console.error('❌ Database connection test failed:', err.message);
  } else {
    console.log('✅ Database connection test successful');
    console.log('🎉 Database initialization completed!');
  }
});

module.exports = db;
