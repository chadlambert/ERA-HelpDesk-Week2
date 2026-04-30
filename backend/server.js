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

//start server
async function startServer () {
    await connectMongo();
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

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

//

startServer();

