require("dotenv").config();
const express = require("express");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json()); // To parse JSON body

// Middleware pour vérifier le token d'authentification
function authenticateToken(ws, next) {
    ws.on("message", (message) => {
        const data = JSON.parse(message);
        if (data.type === "auth") {
            try {
                const decoded = jwt.verify(data.token, process.env.SECRET_KEY);
                ws.user = decoded;
                ws.send(JSON.stringify({ type: "auth_success" }));
                next(); // Appel de la fonction de traitement après authentification
            } catch (err) {
                ws.send(JSON.stringify({ type: "auth_error" }));
                ws.close();
            }
        }
    });
}

// Créer un serveur HTTP
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Serveur démarré sur le port ${process.env.PORT || 3000}`);
});

// Création du serveur WebSocket
const wss = new WebSocket.Server({ server });

// Écouter les connexions WebSocket
wss.on("connection", (ws, req) => {
    console.log("Nouvelle connexion WebSocket");

    authenticateToken(ws, () => {
        ws.on("message", (message) => {
            const data = JSON.parse(message);

            // Chat messages
            if (data.type === "chat") {
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }

            // WebRTC messages
            if (["offer", "answer", "candidate"].includes(data.type)) {
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }
        });
    });
});

// Endpoint simple pour tester le serveur
app.get("/", (req, res) => res.send("WebSocket Server Running"));

// Authentification avec username/password
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    if (
        (username === "Gap" && password === "Gap") ||
        (username === "Veynes" && password === "Veynes")
    ) {
        const token = jwt.sign({ username }, process.env.SECRET_KEY, { expiresIn: "1h" });
        res.json({ token });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});
