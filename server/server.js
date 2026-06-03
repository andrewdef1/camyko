const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Camyko Signaling Server is running!");
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
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

  socket.on("get-rooms", () => {
    socket.emit("room-update", rooms);
  });

  socket.on("join-room", ({ roomId, role }) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId} as ${role}`);

    if (role === "broadcaster") {
      rooms[roomId].isLive = true;
      rooms[roomId].broadcasterId = socket.id;
      io.emit("room-update", rooms);
    } else if (role === "viewer") {
      const broadcasterId = rooms[roomId].broadcasterId;
      if (broadcasterId) {
        io.to(broadcasterId).emit("viewer-joined", { viewerId: socket.id });
      }
    }
  });

  socket.on("leave-room", ({ roomId }) => {
    socket.leave(roomId);
    if (rooms[roomId] && rooms[roomId].broadcasterId === socket.id) {
      rooms[roomId].isLive = false;
      rooms[roomId].broadcasterId = null;
      io.emit("room-update", rooms);
      console.log(`Broadcaster manually left room ${roomId}`);
    }
  });

  socket.on("webrtc-offer", ({ to, roomId, offer }) => {
    console.log(`Relaying offer from ${socket.id} to ${to || roomId}`);
    const payload = { from: socket.id, offer };
    if (to) {
      io.to(to).emit("webrtc-offer", payload);
    } else {
      socket.to(roomId).emit("webrtc-offer", payload);
    }
  });

  socket.on("webrtc-answer", ({ to, answer }) => {
    console.log(`Relaying answer from ${socket.id} to ${to}`);
    io.to(to).emit("webrtc-answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, roomId, candidate }) => {
    console.log(`Relaying ICE candidate from ${socket.id} to ${to || roomId}`);
    const payload = { from: socket.id, candidate };
    if (to) {
      io.to(to).emit("ice-candidate", payload);
    } else {
      socket.to(roomId).emit("ice-candidate", payload);
    }
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
