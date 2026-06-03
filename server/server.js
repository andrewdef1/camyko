const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allows connection from GitHub Pages or any other domain
    methods: ["GET", "POST"],
  },
});

// Initial room state for 10 rooms
const rooms = {};
for (let i = 1; i <= 10; i++) {
  rooms[i.toString()] = {
    isLive: false,
    broadcasterId: null,
  };
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Send current room states to the newly connected client
  socket.emit("room-update", rooms);

  socket.on("join-room", ({ roomId, role }) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId} as ${role}`);

    if (role === "broadcaster") {
      rooms[roomId].isLive = true;
      rooms[roomId].broadcasterId = socket.id;
      io.emit("room-update", rooms);
    }
  });

  socket.on("webrtc-offer", ({ roomId, offer }) => {
    // Relay offer to others in the room (viewers)
    socket.to(roomId).emit("webrtc-offer", { roomId, offer });
  });

  socket.on("webrtc-answer", ({ roomId, answer }) => {
    // Relay answer back to the broadcaster
    const broadcasterId = rooms[roomId].broadcasterId;
    if (broadcasterId) {
      io.to(broadcasterId).emit("webrtc-answer", { roomId, answer });
    }
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    // Relay ICE candidate to others in the room
    socket.to(roomId).emit("ice-candidate", { roomId, candidate });
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (rooms[roomId] && rooms[roomId].broadcasterId === socket.id) {
        rooms[roomId].isLive = false;
        rooms[roomId].broadcasterId = null;
        io.emit("room-update", rooms);
        console.log(`Broadcaster disconnected from room ${roomId}`);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
