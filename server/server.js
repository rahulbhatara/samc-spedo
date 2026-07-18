const WebSocket = require('ws');
const http = require('http');

// Create standard HTTP server
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SAMC Speedometer WebSocket Sync Server is active\n');
});

// Create WebSocket server attached to HTTP
const wss = new WebSocket.Server({ server });

// Room database structure:
// rooms[roomCode] = { host: socket, clients: Set<socket> }
const rooms = {};

// Heartbeat ping interval to keep connections alive (e.g. on Render/Glitch)
const HEARTBEAT_INTERVAL = 30000; // 30s
const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('[Heartbeat] Terminating inactive connection');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
    clearInterval(heartbeatTimer);
});

wss.on('connection', (ws) => {
    ws.isAlive = true;
    let currentRoom = null;
    let currentRole = null;

    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message);

            if (msg.type === 'join') {
                const { room, role } = msg;
                if (!room || !role) return;

                currentRoom = room.toUpperCase();
                currentRole = role;

                if (!rooms[currentRoom]) {
                    rooms[currentRoom] = { host: null, clients: new Set() };
                }

                if (role === 'host') {
                    // Check if host already exists and disconnect it
                    if (rooms[currentRoom].host && rooms[currentRoom].host !== ws) {
                        console.log(`[Room ${currentRoom}] Overwriting host connection`);
                        rooms[currentRoom].host.send(JSON.stringify({ type: 'error', message: 'Another host took over this room' }));
                        rooms[currentRoom].host.close();
                    }

                    rooms[currentRoom].host = ws;
                    ws.send(JSON.stringify({ type: 'joined', role: 'host', room: currentRoom }));
                    console.log(`[Room ${currentRoom}] Host joined.`);

                    // If clients are already connected, notify host
                    if (rooms[currentRoom].clients.size > 0) {
                        ws.send(JSON.stringify({ type: 'client_connected' }));
                    }
                } else if (role === 'client') {
                    rooms[currentRoom].clients.add(ws);
                    ws.send(JSON.stringify({ type: 'joined', role: 'client', room: currentRoom }));
                    console.log(`[Room ${currentRoom}] Client joined. Active clients: ${rooms[currentRoom].clients.size}`);

                    // Notify host that client joined
                    if (rooms[currentRoom].host && rooms[currentRoom].host.readyState === WebSocket.OPEN) {
                        rooms[currentRoom].host.send(JSON.stringify({ type: 'client_connected' }));
                    }
                }
            } else if (msg.type === 'telemetry') {
                // Forward telemetry data from Host to all Room Clients
                if (currentRole === 'host' && currentRoom && rooms[currentRoom]) {
                    const dataStr = JSON.stringify({ type: 'telemetry', data: msg.data });
                    rooms[currentRoom].clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(dataStr);
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Error handling WebSocket message:', e);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom]) {
            if (currentRole === 'host') {
                if (rooms[currentRoom].host === ws) {
                    rooms[currentRoom].host = null;
                    console.log(`[Room ${currentRoom}] Host disconnected`);
                    
                    // Notify all clients that host disconnected
                    rooms[currentRoom].clients.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({ type: 'host_disconnected' }));
                        }
                    });
                }
            } else if (currentRole === 'client') {
                rooms[currentRoom].clients.delete(ws);
                console.log(`[Room ${currentRoom}] Client disconnected. Remaining: ${rooms[currentRoom].clients.size}`);

                // Notify host that client disconnected only if no remaining clients in room
                if (rooms[currentRoom].clients.size === 0) {
                    if (rooms[currentRoom].host && rooms[currentRoom].host.readyState === WebSocket.OPEN) {
                        rooms[currentRoom].host.send(JSON.stringify({ type: 'client_disconnected' }));
                    }
                }
            }

            // Cleanup room if entirely empty
            if (!rooms[currentRoom].host && rooms[currentRoom].clients.size === 0) {
                delete rooms[currentRoom];
                console.log(`[Room ${currentRoom}] Room destroyed (empty)`);
            }
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket connection error:', err);
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`SAMC Sync Server is running on port ${PORT}`);
});
