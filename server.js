require("dotenv").config();
const express = require("express");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(cors());

// Middleware pour vérifier le token d'authentification (pour améliorer la sécurité)
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

    // Gérer l'authentification avec JWT
    authenticateToken(ws, () => {
        // Quand l'utilisateur est authentifié, il peut envoyer et recevoir des messages
        ws.on("message", (message) => {
            const data = JSON.parse(message);

            // Si c'est un message de chat, on le diffuse à tous les autres clients
            if (data.type === "chat") {
                wss.clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }

            // Si c'est un message WebRTC (offer, answer, ou candidate), on le renvoie aux autres
            if (data.type === "offer" || data.type === "answer" || data.type === "candidate") {
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

// Authentification avec JWT - endpoint d'exemple pour obtenir un token
app.post("/login", (req, res) => {
    const username = req.body.username; // Exemple d'authentification par nom d'utilisateur

    // Créer un token JWT à la connexion
    const token = jwt.sign({ username }, process.env.SECRET_KEY, { expiresIn: "1h" });
    res.json({ token });
});
