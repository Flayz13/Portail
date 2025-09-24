require("dotenv").config();
const express = require("express");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // <-- important to parse JSON body

// Hardcoded login credentials
const users = [
    { username: "Gap", password: "Gap" },
    { username: "Veynes", password: "Veynes" }
];

// Middleware pour vérifier le token d'authentification
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

// HTTP server
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    authenticateToken(ws, () => {
        ws.on("message", (message) => {
            const data = JSON.parse(message);

            // Broadcast chat messages
            if (data.type === "chat" || data.type === "offer" || data.type === "answer" || data.type === "candidate") {
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }
        });
    });
});

// Test endpoint
app.get("/", (req, res) => res.send("WebSocket Server Running"));

// Login endpoint
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) return res.status(401).json({ error: "Invalid username or password" });

    const token = jwt.sign({ username }, process.env.SECRET_KEY, { expiresIn: "1h" });
    res.json({ token });
});
