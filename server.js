require("dotenv").config();
const express = require("express");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(cors());

const server = app.listen(process.env.PORT || 3000, () => {
    console.log(`Serveur démarré sur le port ${process.env.PORT || 3000}`);
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
    ws.on("message", (message) => {
        const data = JSON.parse(message);
        if (data.type === "auth") {
            try {
                const decoded = jwt.verify(data.token, process.env.SECRET_KEY);
                ws.user = decoded;
                ws.send(JSON.stringify({ type: "auth_success" }));
            } catch (err) {
                ws.send(JSON.stringify({ type: "auth_error" }));
                ws.close();
            }
        } else {
            wss.clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
    });
});

app.get("/", (req, res) => res.send("WebSocket Server Running"));