const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db/database');

const app = express();
const PORT = 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: 'sajilosewa-secret',
  resave: false,
  saveUninitialized: true
}));

// Make session available in all views
app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Middleware to allow only workers
function requireWorker(req, res, next) {
  if (req.session.user && req.session.user.role === 'worker') {
    next();
  } else {
    res.status(403).send('Access denied: Workers only.');
  }
}

// ✅ Home Route (default landing page after login)
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('home');
});

// ✅ Services Page
app.get('/services', (req, res) => {
  res.render('services');
});

// ✅ Login GET
app.get('/login', (req, res) => {
  const role = req.query.role || '';
  res.render('login', { role });
});

// ✅ Login POST
app.post('/login', (req, res) => {
  const { email, password, role } = req.body;
  db.get('SELECT * FROM users WHERE email = ? AND role = ?', [email, role], async (err, user) => {
    if (err) return res.render('login', { error: 'Database error', role });
    if (!user) return res.render('login', { error: 'Invalid credentials or role', role });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.render('login', { error: 'Invalid password', role });

    req.session.user = { id: user.id, email: user.email, role: user.role };

    // ✅ Send customer to homepage, worker to bookings
    if (role === 'customer') {
      res.redirect('/');
    } else {
      res.redirect('/bookings');
    }
  });
});

// ✅ Signup GET
app.get('/signup', (req, res) => {
  res.render('signup');
});

// ✅ Signup POST
app.post('/signup', async (req, res) => {
  const { email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
    [email, hashedPassword, role],
    (err) => {
      if (err) return res.send('❌ Error: Email already exists or invalid data.');
      res.redirect('/login');
    }
  );
});

// ✅ Bookings Page (Workers only)
app.get('/bookings', requireWorker, (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.send('Error fetching bookings');
    res.render('bookings', { bookings: rows });
  });
});

// ✅ Booking form submission
app.post('/book', (req, res) => {
  const { name, phone, service } = req.body;

  db.run(
    'INSERT INTO bookings (name, phone, service) VALUES (?, ?, ?)',
    [name, phone, service],
    (err) => {
      if (err) return res.send('Something went wrong!');
      res.redirect('/thankyou');
    }
  );
});

// ✅ Thank You Page
app.get('/thankyou', (req, res) => {
  res.render('thankyou');
});

// ✅ Delete Booking
app.post('/delete/:id', (req, res) => {
  const bookingId = req.params.id;

  db.run('DELETE FROM bookings WHERE id = ?', [bookingId], (err) => {
    if (err) return res.send('Error deleting booking');
    res.redirect('/bookings');
  });
});

// ✅ Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ✅ Server Start
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
app.get('/book', (req, res) => {
  res.render('book'); // Make sure you create views/book.ejs
});