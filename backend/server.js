require ('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const {connectMongo, getMongo} = require('./mongo');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// root route
app.get('/', (req, res) => {
    res.json({message: 'ERA Tech Solutions helpdesk api is running'});
});



//get /departments 
app.get('/departments', (req, res) => {
    const sql = 'SELECT * FROM departments';
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Error getting departments:', error);
            return res.status(500).json({error: 'Fail to get departments'});
        }
        res.json(results);
    });
});

//get /users
app.get('/users', (req, res) => {
    const sql = 'SELECT id, first_name, last_name, email, role, department_id FROM users';
    db.query(sql, (error, results) => {
        if (error) {
            console.error('error getting users:', error);
            return res.status(500).json({error: 'fail to get users'});
        }
        res.json(results);
    });
});

//get /tickets
app.get('/tickets', (req, res) => {
    const sql = 'SELECT * FROM tickets';
    db.query(sql, (error, results) => {
        if (error) {
            console.error('error getting tickets:', error);
            return res.status(500).json({error: 'fail to get tickets'});
        }
        res.json(results);
    });
});

//get /tickets/open
app.get('/tickets/open', (req, res) => {
    const sql = 'SELECT * FROM tickets WHERE status = "open"';
    db.query(sql, (error, results) => {
        if (error) {
            console.error('error getting tickets:', error);
            return res.status(500).json({error: 'fail to get tickets'});
        }
        res.json(results);
    });
});

//get /tickets/:id
app.get('/tickets/:id', (req, res) => {
    const ticketId = req.params.id;
    const sql = 'SELECT * FROM tickets WHERE id = ?';
    db.query(sql, [ticketId], (error, results) => {
        if (error) {
            console.error('error getting tickets:', error);
            return res.status(500).json({error: 'fail to get tickets'});
        }
        if (results.length === 0) {
            return res.status(404).json({error: 'ticket not found'});
        }
        res.json(results);
    });
});

//post /users
app.post('/users', (req, res) => {
    const {first_name, last_name, email, password, role, department_id} = req.body;
    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({error: 'first_name, last_name, email, password are required'});
    }
    if(password.length < 8 ) {
        return res.status(400).json({error: 'password must be at least 8 charcter long'});
    }
    const specialChar = /[!@#$%]/;
    if(!specialChar.test(password)) {
        return res.status(400).json({error: 'password must include at least one special character: ! @ # $ % '});
    }
    const sql = `INSERT INTO users (first_name, last_name, email, password, role, department_id) VALUES (?, ?, ?, ?, ?, ?)`;
    const userRole = role || 'employee';
    const deptId = department_id || null;
    db.query(sql, [first_name, last_name, email, password, userRole, deptId], (error, results) => {
        if (error) {
            console.error('error creating user: ', error);
            return res.status(500).json({error: 'fail to create user'});
        }
        res.status(201).json({message: 'user created successfully', userId : results.insertId});
    });
});

//post /tickets
app.post('/tickets', (req, res) => {
    const {title, description, priority, status, submitted_by, assigned_to, department_id} =req.body;
    if( !title || !submitted_by ) {
        return res.status(400).json({error: 'title and submitted_by are required'});
    }
    const ticketPriority = priority || 'medium';
    const ticketStatus = status || 'open';
    const assignedTo = assigned_to || null;
    const deptId = department_id || null;
    const sql = `INSERT INTO tickets (title, description, priority, status, submitted_by, assigned_to, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [title, description, ticketPriority, ticketStatus, submitted_by, assignedTo, deptId], async(error, results) => {
        if (error) {
            console.error('error creating ticket:', error);
            return res.status(500).json({error: 'fail to create ticket'});
        }
        const newTicketId = results.insertId;
        try {
            const mongoDb = getMongo();
            await mongoDb.collection('activity_logs').insertOne({
                action: 'ticket_created',
                user_id: submitted_by,
                ticket_id: newTicketId,
                details: `Ticket created: ${title}`,
                timestamp: new Date()
            });
        } catch (mongoError) {
            console.error('fail to log activity:', mongoError);
        }
        res.status(201).json({message: 'ticket created successfully', ticketId: newTicketId});
    });
});

//post /ticket-notes
app.post('/ticket-notes', async (req, res) => {
    const {ticket_id, note, added_by} = req.body;
    if(!ticket_id|| !note || !added_by) {
        return res.status(400).json({error: 'ticket_id, note, added_by are required'});
    }
    try {
        const mongoDb = getMongo();
        const result = await mongoDb.collection('ticket_notes').insertOne({
            ticket_id: parseInt(ticket_id),
            note: note,
            added_by: added_by,
            created_at: new Date()
        });
        res.status(201).json({message: 'note added successfully', noteId: result.insertId});
    } catch(error) {
        console.error('error adding note:', error);
        res.status(500).json({error: 'failed to add notes'});
    }
});

//post activity logs
app.post('/activity-logs', async (req, res) => {
    const {action, user_id, ticket_id, details} = req.body;
    if(!action || !details) {
        return res.status(400).json({error: 'action and details are required'});
    }
    try {
        const mongoDb = getMongo();
        const result = await mongoDb.collection('activity_logs').insertOne({
            action: action,
            user_id: user_id || null,
            ticket_id: ticket_id || null,
            details: details,
            timestamp: new Date()
        });
        res.status(201).json({message: 'activity log created', logId: result.insertId});
    } catch (error) {
        console.error('error creating activity log:', error);
        res.status(500).json({error: 'fail to create activity log'});
    }
});

//get /ticket-notes
app.get('/ticket-notes', async (req, res) => {
    try {
        const mongoDb = getMongo();
        const notes = await mongoDb.collection('ticket_notes').find({}).toArray();
        res.json(notes);
    } catch(error) {
        console.error('error getting ticket notes:', error);
        res.status(500).json({error: 'fail to get ticket notes'});
    }
});

// get /tickets-notes/:ticketId
app.get('/ticket-notes/:ticketId', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.ticketId);
        const mongoDb = getMongo();
        const notes = await mongoDb.collection('ticket_notes').find({ticket_id: ticketId})
        .toArray();
        res.json(notes);
    } catch(error) {
        console.error('error getting notes for tickets:', error);
        res.status(500).json({error: 'fail to get ticket notes'});
    }
});

//get /activity-logs
app.get('/activity-logs', async (req, res) => {
    try {
        const mongoDb = getMongo();
        const logs = await mongoDb.collection('activity_logs').find({}).sort({timestamp: -1})
        .toArray();
        res.json(logs);
    } catch (error) {
        console.error('error getting activity logs:', error);
        res.status(500).json({error: 'fail to get activity logs'});
    }
});


//start server
async function startServer () {
    await connectMongo();
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}
startServer();

