require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const db      = require('./db');
const { connectMongo, getMongo } = require('./mongo');
 
const app  = express();
const PORT = 3000;
 
app.use(cors());
app.use(express.json());
 
// ── ROOT ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'ERA Tech Solutions Help Desk API is running' });
});
 
// ── MYSQL GET ROUTES ──────────────────────────────────────────
app.get('/departments', (req, res) => { /* ... */ });
app.get('/users',       (req, res) => { /* ... */ });
app.get('/tickets',     (req, res) => { /* ... */ });
app.get('/tickets/open',(req, res) => { /* ... */ });
app.get('/tickets/:id', (req, res) => { /* ... */ });
 
// ── MYSQL POST ROUTES ─────────────────────────────────────────
 
// POST /users
app.post('/users', (req, res) => {
  const { first_name, last_name, email, password, role, department_id } = req.body;
  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ error: 'first_name, last_name, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }
  const specialChar = /[!@#$%]/;
  if (!specialChar.test(password)) {
    return res.status(400).json({ error: 'Password must include at least one special character: ! @ # $ %' });
  }
  const sql = `INSERT INTO users (first_name, last_name, email, password, role, department_id) VALUES (?, ?, ?, ?, ?, ?)`;
  const userRole = role || 'employee';
  const deptId   = department_id || null;
  db.query(sql, [first_name, last_name, email, password, userRole, deptId], (error, results) => {
    if (error) return res.status(500).json({ error: 'Failed to create user' });
    res.status(201).json({ message: 'User created successfully', userId: results.insertId });
  });
});
 
// POST /tickets
app.post('/tickets', async (req, res) => {
  const { title, description, priority, status, submitted_by, assigned_to, department_id } = req.body;
  if (!title || !submitted_by) {
    return res.status(400).json({ error: 'title and submitted_by are required' });
  }
  const sql = `INSERT INTO tickets (title, description, priority, status, submitted_by, assigned_to, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const vals = [title, description, priority||'medium', status||'open', submitted_by, assigned_to||null, department_id||null];
  db.query(sql, vals, async (error, results) => {
    if (error) return res.status(500).json({ error: 'Failed to create ticket' });
    const newTicketId = results.insertId;
    try {
      const mongoDb = getMongo();
      await mongoDb.collection('activity_logs').insertOne({
        action: 'ticket_created', user_id: submitted_by,
        ticket_id: newTicketId, details: `Ticket created: ${title}`,
        timestamp: new Date()
      });
    } catch (mongoError) { console.error('Failed to log activity:', mongoError); }
    res.status(201).json({ message: 'Ticket created successfully', ticketId: newTicketId });
  });
});
 
// ── MONGODB GET ROUTES ────────────────────────────────────────
app.get('/ticket-notes',          async (req, res) => { /* ... */ });
app.get('/ticket-notes/:ticketId',async (req, res) => { /* ... */ });
app.get('/activity-logs',         async (req, res) => { /* ... */ });
 
// ── MONGODB POST ROUTES ───────────────────────────────────────
 
// POST /ticket-notes
app.post('/ticket-notes', async (req, res) => {
  const { ticket_id, note, added_by } = req.body;
  if (!ticket_id || !note || !added_by) {
    return res.status(400).json({ error: 'ticket_id, note, and added_by are required' });
  }
  try {
    const mongoDb = getMongo();
    const result  = await mongoDb.collection('ticket_notes').insertOne({
      ticket_id: parseInt(ticket_id), note, added_by, created_at: new Date()
    });
    res.status(201).json({ message: 'Note added successfully', noteId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add note' });
  }
});
 
// POST /activity-logs
app.post('/activity-logs', async (req, res) => {
  const { action, user_id, ticket_id, details } = req.body;
  if (!action || !details) {
    return res.status(400).json({ error: 'action and details are required' });
  }
  try {
    const mongoDb = getMongo();
    const result  = await mongoDb.collection('activity_logs').insertOne({
      action, user_id: user_id||null, ticket_id: ticket_id||null,
      details, timestamp: new Date()
    });
    res.status(201).json({ message: 'Activity log created', logId: result.insertedId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create activity log' });
  }
});
 
// ── START SERVER ──────────────────────────────────────────────
async function startServer() {
  await connectMongo();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
startServer();
