import io from "socket.io-client";

// client/src/socket.js
const SOCKET_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "camyko-production.up.railway.app"; // <--- PASTE HERE

export const socket = io(SOCKET_URL);

socket.on("connect_error", (err) => {
  console.error("Socket Connection Error:", err.message);
  console.log(
    "Tip: Make sure your backend server is running and the URL is correct in socket.js",
  );
});

socket.on("connect", () => {
  console.log("Successfully connected to signaling server!");
});
