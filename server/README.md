# SAMC Speedometer Sync Broker Server

This is the lightweight WebSocket broker server designed to route telemetry packets between the host game (CEF) and your remote client devices (such as an Android screen).

## Quick Start (Running Locally)

You can run this server directly on your gaming PC. Because it is on the same local network, the latency will be extremely low (usually < 2ms), and it uses zero external internet bandwidth.

### 1. Install Node.js
Ensure you have Node.js installed on your PC (https://nodejs.org).

### 2. Install dependencies & Run
Open your terminal/command prompt in this folder and run:
```bash
# Install the ws package
npm install

# Start the server
npm start
```
The server will start listening on port `8080`.

### 3. Connect your devices
- **Host URL:** `ws://localhost:8080` (or `ws://127.0.0.1:8080`)
- **Client (Android) URL:** Connect your phone/tablet to the same local Wi-Fi router. Find your PC's local IP address (e.g. `192.168.1.100`), and enter the server URL as `ws://192.168.1.100:8080` in the client sync settings.

---

## Free Cloud Deployment

If you prefer to host it online so you don't have to run it locally every time, you can deploy it to any node-compatible hosting service.

### 1. Glitch (Easiest)
1. Go to https://glitch.com and log in.
2. Click **New Project** > **Import from GitHub**.
3. Import your repository, or create a simple new Node project and paste the contents of `server.js` and `package.json` into Glitch's editor.
4. Glitch will automatically assign a URL (e.g. `https://your-project-name.glitch.me`).
5. Your WebSocket URL will be `wss://your-project-name.glitch.me`.

### 2. Render
1. Go to https://render.com and sign up.
2. Click **New** > **Web Service**.
3. Connect your GitHub repository.
4. Choose the repository and set:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Render will deploy it and give you a `https://...` address. Change `https://` to `wss://` for the WebSocket server URL.
