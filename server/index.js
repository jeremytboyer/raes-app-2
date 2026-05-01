const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Simple in-memory message store
const messages = {};

/*
  messages structure:
  {
    general: [{ sender, text, time }],
    random: [...],
    alice: [...]
  }
*/

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a room (channel or DM)
  socket.on("join", ({ room }) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined ${room}`);
  });

  // Send message to a room
  socket.on("message", ({ room, sender, text }) => {
    const msg = {
      sender,
      text,
      time: Date.now(),
    };

    if (!messages[room]) {
      messages[room] = [];
    }

    messages[room].push(msg);

    // broadcast to everyone in room
    io.to(room).emit("message", {
      room,
      msg,
    });
  });

  // Get message history for a room
  socket.on("getMessages", ({ room }, cb) => {
    cb(messages[room] || []);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Basic test route
app.get("/", (req, res) => {
  res.send("Slack Clone server is running 🚀");
});

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
