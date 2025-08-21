// =======================
//  Import Dependencies
// =======================
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');

// Import new database
const db = require('./database/database');

// =======================
//  Express App Setup
// =======================
const app = express();
const PORT = 3002;

// =======================
//  View Engine Setup
// =======================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// =======================
//  Middleware
// =======================
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'fixsewa-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// =======================
//  Routes
// =======================

// Root route
app.get('/', (req, res) => {
  res.render('select-role', { user: req.session.user });
});

// Services route
app.get('/services', (req, res) => {
  res.render('services', { user: req.session.user });
});

// Login route
app.get('/login', (req, res) => {
  const role = req.query.role || '';
  res.render('login', { role, error: '', user: req.session.user });
});

// Signup route
app.get('/signup', (req, res) => {
  res.render('signup', { user: req.session.user });
});

// Become Worker route
app.get('/become-worker', (req, res) => {
  res.redirect('/signup?role=worker');
});

// Login - POST
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.send('❌ Error: User not found.');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.send('❌ Error: Invalid password.');
    }

    req.session.user = user;

    // Redirect based on user role
    if (user.role === 'worker') {
      res.redirect('/worker-dashboard');
    } else {
      res.redirect('/'); // Customers go to home landing page
    }
  } catch (error) {
    console.error('Login error:', error);
    res.send('❌ Error: An unexpected error occurred.');
  }
});

// Signup - POST
app.post('/signup', async (req, res) => {
  console.log('📝 Signup request received:', req.body);
  
  const { email, password, role, name, phone, service, experience } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log('📊 Processed signup data:', { email, role, name, phone, service, experience });

  // Validate required fields based on role
  if (!email || !password || !role || !name || !phone) {
    console.log('❌ Validation failed - missing required fields');
    return res.send('❌ Error: All required fields must be filled.');
  }

  // Additional validation for workers
  if (role === 'worker' && (!service || !experience)) {
    console.log('❌ Worker validation failed - missing service or experience');
    return res.send('❌ Error: Workers must specify service and experience.');
  }

  try {
    console.log('💾 Attempting to insert user into database...');
    
    // Insert user
    db.run(
      'INSERT INTO users (email, password, role, name, phone) VALUES (?, ?, ?, ?, ?)',
      [email, hashedPassword, role, name, phone],
      function(err) {
        if (err) {
          console.error('❌ Database error during user insertion:', err);
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.send('❌ Error: Email already exists.');
          }
          return res.send('❌ Error: Database error occurred.');
        }

        console.log('✅ User inserted successfully, ID:', this.lastID);
        const userId = this.lastID;

        // If worker, insert additional worker details
        if (role === 'worker') {
          console.log('👷 Inserting worker details...');
          db.run(
            'INSERT INTO workers (user_id, service, experience) VALUES (?, ?, ?)',
            [userId, service, experience],
            (workerErr) => {
              if (workerErr) {
                console.error('❌ Worker details error:', workerErr);
                // Still redirect to login even if worker details fail
              }
              console.log('✅ Worker signup completed, redirecting to login');
              res.redirect('/login?role=worker');
            }
          );
        } else {
          console.log('👤 Customer signup completed, redirecting to login');
          res.redirect('/login?role=customer');
        }
      }
    );
  } catch (error) {
    console.error('❌ Signup error:', error);
    res.send('❌ Error: An unexpected error occurred.');
  }
});

// Logout route
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
});

// Check authentication status
app.get('/check-auth', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

// Customer Dashboard - GET
app.get('/customer-dashboard', (req, res) => {
  // Check if user is authenticated and is a customer
  if (!req.session.user || req.session.user.role !== 'customer') {
    return res.redirect('/login');
  }

  // Get user's bookings
  db.all(`
    SELECT 
      b.id,
      b.work_text,
      b.location_text,
      b.date,
      b.status,
      b.estimated_price,
      b.created_at,
      u.name as worker_name
    FROM bookings b
    LEFT JOIN users u ON b.worker_id = u.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `, [req.session.user.id], (err, userBookings) => {
    if (err) {
      console.error('Error fetching user bookings:', err);
      return res.status(500).send('Database error');
    }

    res.render('customer-dashboard', { 
      user: req.session.user,
      userBookings: userBookings 
    });
  });
});

// Worker Dashboard - GET
app.get('/worker-dashboard', (req, res) => {
  // Check if user is authenticated and is a worker
  if (!req.session.user || req.session.user.role !== 'worker') {
    return res.redirect('/login');
  }

  // Get all bookings for workers to view
  db.all(`
    SELECT 
      b.id,
      b.user_name,
      b.user_phone,
      b.user_email,
      b.location_text,
      b.work_text,
      b.date,
      b.status,
      b.estimated_price,
      b.notes,
      b.created_at,
      b.worker_id,
      u.name as worker_name
    FROM bookings b
    LEFT JOIN users u ON b.worker_id = u.id
    ORDER BY b.created_at DESC
  `, [], (err, bookings) => {
    if (err) {
      console.error('Error fetching bookings:', err);
      return res.status(500).send('Database error');
    }

    res.render('worker-dashboard', { 
      user: req.session.user,
      bookings: bookings 
    });
  });
});

// Worker Dashboard - POST (Update booking status, assign worker, etc.)
app.post('/worker-dashboard', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'worker') {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { action, bookingId, status, estimatedPrice, notes } = req.body;
  const workerId = req.session.user.id;

  if (action === 'assign') {
    // Assign worker to booking
    db.run(
      'UPDATE bookings SET worker_id = ?, status = ?, worker_assigned_date = CURRENT_TIMESTAMP WHERE id = ?',
      [workerId, 'assigned', bookingId],
      function(err) {
        if (err) {
          console.error('Error assigning worker:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true, message: 'Worker assigned successfully' });
      }
    );
  } else if (action === 'update_status') {
    // Update booking status
    db.run(
      'UPDATE bookings SET status = ? WHERE id = ? AND worker_id = ?',
      [status, bookingId, workerId],
      function(err) {
        if (err) {
          console.error('Error updating status:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true, message: 'Status updated successfully' });
      }
    );
  } else if (action === 'update_details') {
    // Update estimated price and notes
    db.run(
      'UPDATE bookings SET estimated_price = ?, notes = ? WHERE id = ? AND worker_id = ?',
      [estimatedPrice, notes, bookingId, workerId],
      function(err) {
        if (err) {
          console.error('Error updating details:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true, message: 'Details updated successfully' });
      }
    );
  } else {
    res.status(400).json({ success: false, error: 'Invalid action' });
  }
});

// Book Service - POST (Updated for new booking system)
app.post('/book', (req, res) => {
  // Check if user is authenticated
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'User not authenticated' });
  }

  const { location, work, date, locationText, workText } = req.body;
  const userId = req.session.user.id;
  const userEmail = req.session.user.email;
  const userName = req.session.user.name;
  const userPhone = req.session.user.phone;

  // Validate required fields
  if (!location || !work || !date) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    // Insert booking into database
    db.run(
      'INSERT INTO bookings (user_id, user_email, user_name, user_phone, location, work, date, location_text, work_text, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [userId, userEmail, userName, userPhone, location, work, date, locationText, workText, 'pending'],
      function(err) {
        if (err) {
          console.error('Booking error:', err);
          return res.status(500).json({ success: false, error: 'Database error' });
        }
        
        res.json({ 
          success: true, 
          message: 'Booking created successfully',
          bookingId: this.lastID 
        });
      }
    );
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Submit Review for Worker - POST
app.post('/submit-review', (req, res) => {
  // Check if user is authenticated
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'User not authenticated' });
  }

  // Check if user is a customer
  if (req.session.user.role !== 'customer') {
    return res.status(403).json({ success: false, error: 'Only customers can submit reviews' });
  }

  const { bookingId, rating, reviewText } = req.body;
  const customerId = req.session.user.id;

  // Validate required fields
  if (!bookingId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: 'Valid booking ID and rating (1-5) are required' });
  }

  // Check if booking exists and belongs to the customer
  db.get(`
    SELECT b.id, b.worker_id, b.status
    FROM bookings b
    WHERE b.id = ? AND b.user_id = ? AND b.status = 'completed'
  `, [bookingId, customerId], (err, booking) => {
    if (err) {
      console.error('Error fetching booking:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Completed booking not found or not assigned to you' });
    }

    if (!booking.worker_id) {
      return res.status(400).json({ success: false, error: 'No worker assigned to this booking' });
    }

    // Check if review already exists
    db.get('SELECT id FROM worker_reviews WHERE worker_id = ? AND customer_id = ? AND booking_id = ?', 
      [booking.worker_id, customerId, bookingId], (checkErr, existingReview) => {
      if (checkErr) {
        console.error('Error checking existing review:', checkErr);
        return res.status(500).json({ success: false, error: 'Database error' });
      }

      if (existingReview) {
        return res.status(400).json({ success: false, error: 'You have already reviewed this booking' });
      }

      // Insert review
      db.run(`
        INSERT INTO worker_reviews (worker_id, customer_id, booking_id, rating, review_text, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [booking.worker_id, customerId, bookingId, rating, reviewText || null], function(reviewErr) {
        if (reviewErr) {
          console.error('Error inserting review:', reviewErr);
          return res.status(500).json({ success: false, error: 'Database error' });
        }

        res.json({ success: true, message: 'Review submitted successfully' });
      });
    });
  });
});

// Test route to debug routing issues
app.get('/test-route', (req, res) => {
  console.log('✅ Test route accessed');
  res.json({ message: 'Test route works!' });
});

console.log('✅ Routes registered successfully');

// Get completed bookings for review - GET
app.get('/customer/completed-bookings', (req, res) => {
  console.log('✅ Route /customer/completed-bookings accessed');
  
  // Check if user is authenticated
  if (!req.session.user) {
    console.log('❌ User not authenticated');
    return res.status(401).json({ success: false, error: 'User not authenticated' });
  }

  // Check if user is a customer
  if (req.session.user.role !== 'customer') {
    console.log('❌ Access denied - user role:', req.session.user.role);
    return res.status(403).json({ success: false, error: 'Access denied' });
  }

  console.log('✅ User authenticated and is customer, fetching bookings...');

  // Get completed bookings that can be reviewed
  db.all(`
    SELECT 
      b.id,
      b.work_text,
      b.location_text,
      b.date,
      b.estimated_price,
      b.created_at,
      u.name as worker_name,
      (SELECT COUNT(*) FROM worker_reviews wr WHERE wr.booking_id = b.id AND wr.customer_id = ?) as has_review
    FROM bookings b
    LEFT JOIN users u ON b.worker_id = u.id
    WHERE b.user_id = ? AND b.status = 'completed' AND b.worker_id IS NOT NULL
    ORDER BY b.created_at DESC
  `, [req.session.user.id, req.session.user.id], (err, bookings) => {
    if (err) {
      console.error('Error fetching completed bookings:', err);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    console.log('✅ Fetched bookings:', bookings);
    res.json({ success: true, bookings: bookings });
  });
});

// =======================
//  Start Server
// =======================
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
