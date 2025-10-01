require('dotenv').config();
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json()); // important

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET_KEY || 'Portail';

// Hardcoded users
const users = { Gap: 'Gap', Veynes: 'Veynes' };

// HTTP server
const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

// WebSocket server (attach to same http server)
const wss = new WebSocket.Server({ server });

// Authenticate incoming websocket with token sent as first message of type 'auth'
function authenticateToken(ws, next) {
    const authListener = function incoming(message) {
        try {
            const data = JSON.parse(message);
            if (data.type === 'auth') {
                try {
                    const decoded = jwt.verify(data.token, SECRET);
                    ws.user = decoded;
                    ws.send(JSON.stringify({ type: 'auth_success' }));
                    ws.off('message', authListener); // remove auth listener
                    next();
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'auth_error' }));
                    ws.close();
                }
            } else {
                ws.send(JSON.stringify({ type: 'auth_required' }));
            }
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        }
    };
    ws.on('message', authListener);
}

wss.on('connection', (ws) => {
    console.log('New WS connection');
    authenticateToken(ws, () => {
        ws.on('message', (message) => {
            // broadcast to other clients
            try {
                const data = JSON.parse(message);
                if (['chat', 'offer', 'answer', 'candidate'].includes(data.type)) {
                    wss.clients.forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(message);
                        }
                    });
                }
            } catch (err) {
                console.warn('WS message non JSON', err);
            }
        });
    });
});

// test endpoints
app.get('/', (req, res) => res.send('WebSocket Server Running'));
app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: 'username et password requis' });
    }
    if (users[username] && users[username] === password) {
        const token = jwt.sign({ username }, SECRET, { expiresIn: '1h' });
        return res.json({ token });
    } else {
        return res.status(401).json({ error: "Nom d'utilisateur ou mot de passe invalide" });
    }
});
