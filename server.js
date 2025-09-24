require("dotenv").config();
const express = require("express");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// Hardcoded users
const users = {
    Gap: "Gap",
    Veynes: "Veynes"
};

// Create HTTP server
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Serveur démarré sur le port ${process.env.PORT || 3000}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

// Authenticate WebSocket connections
function authenticateToken(ws, next) {
    ws.on("message", (message) => {
        const data = JSON.parse(message);
        if (data.type === "auth") {
            try {
                const decoded = jwt.verify(data.token, process.env.SECRET_KEY);
                ws.user = decoded;
                ws.send(JSON.stringify({ type: "auth_success" }));
                next();
            } catch (err) {
                ws.send(JSON.stringify({ type: "auth_error" }));
                ws.close();
            }
        }
    });
}

// Handle WebSocket connections
wss.on("connection", (ws) => {
    console.log("Nouvelle connexion WebSocket");
    authenticateToken(ws, () => {
        ws.on("message", (message) => {
            const data = JSON.parse(message);
            // Broadcast chat and WebRTC messages to others
            if (["chat", "offer", "answer", "candidate"].includes(data.type)) {
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }
        });
    });
});

// Simple endpoint
app.get("/", (req, res) => res.send("WebSocket Server Running"));

// Login endpoint
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (users[username] && users[username] === password) {
        const token = jwt.sign({ username }, process.env.SECRET_KEY, { expiresIn: "1h" });
        res.json({ token });
    } else {
        res.status(401).json({ error: "Nom d'utilisateur ou mot de passe invalide" });
    }
});
