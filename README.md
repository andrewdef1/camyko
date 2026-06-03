# Camyko: WebRTC Mobile to OBS Streamer

Camyko is a real-time web application that allows you to use your mobile phone's camera as a wireless video source for OBS Studio.

## Features
- **Real-time Streaming**: Ultra-low latency video/audio via WebRTC.
- **10 Dedicated Rooms**: Manage multiple camera sources from a single dashboard.
- **OBS Optimized**: Viewer pages are designed to be used as Browser Sources with transparent backgrounds and zero UI.
- **GitHub Pages Ready**: The frontend is built for static hosting.

## Project Structure
- `/server`: Node.js + Socket.io signaling server.
- `/client`: React + Vite + Tailwind CSS frontend.

## Local Setup

### 1. Start the Backend
```bash
cd server
npm install
npm start
```
The server will run on `http://localhost:3001`.

### 2. Start the Frontend
```bash
cd client
npm install
npm run dev
```
Open the provided URL (usually `http://localhost:5173`) in your browser.

## Deployment

### Backend (Signal Server)
Deploy the `/server` folder to a service like **Render**, **Railway**, or **Fly.io**.
1. Set the `PORT` environment variable if needed.
2. Once deployed, update the `SOCKET_URL` in `client/src/App.jsx` with your production backend URL.

### Frontend (GitHub Pages)
1. Initialize a Git repository in the root.
2. Push your code to GitHub.
3. Use the `gh-pages` package or GitHub Actions to deploy the `client/dist` folder.

**Vite Note**: If your GitHub Pages URL has a subpath (e.g., `username.github.io/camyko/`), update `base: './'` in `client/vite.config.js`.

## Usage
1. Open the **Dashboard** on your PC.
2. Click **Enter Cam Room** on your **Mobile Phone** to start the camera.
3. On the Dashboard, click **Copy OBS URL**.
4. In OBS, add a **Browser Source**, paste the URL, and set the width/height (e.g., 1920x1080).
