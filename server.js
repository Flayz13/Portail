// server.js
require('dotenv').config();
const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Simple HTTP endpoint to check server status
app.get('/', (req, res) => res.send('Signaling server running'));

// Create HTTP server (used by ws)
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });

// Data structures
// queue: array of clients waiting for partner
const queue = [];

// Map from ws -> meta { ip, partner: ws | null, id }
const clients = new Map();

// Helper: get IP from request (works with proxies if X-Forwarded-For set)
function extractIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // x-forwarded-for may contain a list: client, proxy1, proxy2
        return forwarded.split(',')[0].trim();
    }
    // fallback to socket address
    return req.socket.remoteAddress;
}

// Find a partner in queue with different ip (returns index or -1)
function findPartnerIndex(differentFromIp) {
    for (let i = 0; i < queue.length; i++) {
        const qws = queue[i];
        const meta = clients.get(qws);
        if (!meta) continue;
        if (meta.ip !== differentFromIp && qws.readyState === WebSocket.OPEN) {
            return i;
        }
    }
    return -1;
}

// Pair two clients (wsA, wsB)
function pairClients(wsA, wsB) {
    if (!wsA || !wsB) return;
    const metaA = clients.get(wsA);
    const metaB = clients.get(wsB);
    if (!metaA || !metaB) return;

    metaA.partner = wsB;
    metaB.partner = wsA;

    // Notify both
    safeSend(wsA, { type: 'partner-found' });
    safeSend(wsB, { type: 'partner-found' });
}

// Safe send wrapper
function safeSend(ws, obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(obj));
        } catch (e) {
            console.warn('Erreur en envoyant au client', e);
        }
    }
}

// Remove a ws from queue (if present)
function removeFromQueue(ws) {
    const idx = queue.indexOf(ws);
    if (idx !== -1) queue.splice(idx, 1);
}

// Put ws into queue if not already queued and open and not paired
function enqueue(ws) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const meta = clients.get(ws);
    if (!meta) return;
    if (meta.partner) return;
    if (!queue.includes(ws)) queue.push(ws);
}

// On new connection
wss.on('connection', (ws, req) => {
    const ip = extractIp(req);
    const id = Math.random().toString(36).slice(2, 9);

    // store meta
    clients.set(ws, { ip, partner: null, id });

    // Set up ping/pong keepalive
    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));

    console.log(`[connect] id=${id} ip=${ip} clients=${clients.size}`);

    // On message
    ws.on('message', (raw) => {
        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            console.warn('Message non JSON reçu, ignored');
            return;
        }

        const meta = clients.get(ws);
        if (!meta) return;

        switch (data.type) {
            // Client asks to be matched
            case 'find-partner':
                // Try to find partner in queue with different IP
                removeFromQueue(ws); // ensure not duplicated
                const idx = findPartnerIndex(meta.ip);
                if (idx !== -1) {
                    const partnerWs = queue.splice(idx, 1)[0];
                    pairClients(ws, partnerWs);
                } else {
                    // no partner found yet -> enqueue
                    enqueue(ws);
                    safeSend(ws, { type: 'waiting' });
                }
                break;

            // Client wants to skip (disconnect current partner and requeue both)
            case 'skip':
                {
                    const partner = meta.partner;
                    // notify partner
                    if (partner && partner.readyState === WebSocket.OPEN) {
                        const partnerMeta = clients.get(partner);
                        // break pairing
                        if (partnerMeta) partnerMeta.partner = null;
                        safeSend(partner, { type: 'partner-left' });
                        // re-enqueue partner
                        enqueue(partner);
                    }
                    // break pairing for current ws
                    meta.partner = null;
                    // remove ws from queue (safety) then requeue
                    removeFromQueue(ws);
                    enqueue(ws);
                    // send ack so client may attempt find-partner again if needed
                    safeSend(ws, { type: 'skipped' });
                }
                break;

            // Chat message -> forward to partner
            case 'chat':
            case 'offer':
            case 'answer':
            case 'candidate':
                {
                    const partner = meta.partner;
                    if (partner && partner.readyState === WebSocket.OPEN) {
                        safeSend(partner, data);
                    } else {
                        // No partner: optionally buffer or inform sender
                        safeSend(ws, { type: 'no-partner' });
                    }
                }
                break;

            // Optional: client requests to leave queue
            case 'leave':
                removeFromQueue(ws);
                // If had partner, notify them
                if (meta.partner) {
                    const p = meta.partner;
                    if (p && p.readyState === WebSocket.OPEN) {
                        const pm = clients.get(p);
                        if (pm) pm.partner = null;
                        safeSend(p, { type: 'partner-left' });
                        enqueue(p); // requeue them
                    }
                    meta.partner = null;
                }
                safeSend(ws, { type: 'left' });
                break;

            default:
                console.log('Type non géré:', data.type);
        }
    });

    // On disconnect
    ws.on('close', () => {
        const meta = clients.get(ws);
        if (!meta) return;
        console.log(`[disconnect] id=${meta.id} ip=${meta.ip}`);

        // If paired, notify partner and requeue them
        const partner = meta.partner;
        if (partner && partner.readyState === WebSocket.OPEN) {
            const pm = clients.get(partner);
            if (pm) pm.partner = null;
            safeSend(partner, { type: 'partner-left' });
            enqueue(partner);
        }

        removeFromQueue(ws);
        clients.delete(ws);
    });

    ws.on('error', (err) => {
        console.warn('WS error', err);
    });
});

// Ping/pong to keep connections alive and detect dead sockets
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            ws.terminate();
            return;
        }
        ws.isAlive = false;
        ws.ping(() => {});
    });
}, 30000);

server.listen(PORT, () => {
    console.log(`Signaling server listening on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    clearInterval(interval);
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
