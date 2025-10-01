require("dotenv").config();
const express = require("express");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Endpoint simple pour tester
app.get("/", (req, res) => res.send("Serveur WebSocket actif 🚀"));

// Endpoint login
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    // Deux utilisateurs autorisés
    const users = {
        "Gap": "Gap",
        "Veynes": "Veynes"
    };

    if (users[username] && users[username] === password) {
        const token = jwt.sign({ username }, process.env.SECRET_KEY || "secret123", { expiresIn: "1h" });
        return res.json({ token });
    }

    res.status(401).json({ error: "Nom d'utilisateur ou mot de passe invalide" });
});

// Lancer le serveur HTTP
const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`✅ Serveur démarré sur le port ${process.env.PORT || 3000}`);
});

// Serveur WebSocket
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
    console.log("Nouvelle connexion WebSocket");

    ws.on("message", (message) => {
        let data;
        try {
            data = JSON.parse(message);
        } catch (err) {
            console.error("Message invalide:", message);
            return;
        }

        // Authentification
        if (data.type === "auth") {
            try {
                const decoded = jwt.verify(data.token, process.env.SECRET_KEY || "secret123");
                ws.user = decoded;
                ws.send(JSON.stringify({ type: "auth_success", user: decoded.username }));
            } catch (err) {
                ws.send(JSON.stringify({ type: "auth_error" }));
                ws.close();
            }
            return;
        }

        // Diffusion des messages (chat ou WebRTC)
        if (["chat", "offer", "answer", "candidate"].includes(data.type)) {
            const payload = {
                ...data,
                from: ws.user?.username || "inconnu"
            };
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(payload));
                }
            });
        }
    });
});
