import io from 'socket.io-client';

const SOCKET_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://your-backend-url.onrender.com';

export const socket = io(SOCKET_URL);
