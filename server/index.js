require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

//
// ✅ MONGODB CONNECT
//

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    console.log("DB:", mongoose.connection.name);
  })
  .catch((err) => {
    console.error("❌ Mongo connection error");
    console.error(err);
  });

//
// ✅ MESSAGE MODEL
//

const MessageSchema = new mongoose.Schema({
  room: String,
  sender: String,
  uid: String,
  text: String,
  time: Number,
});

const Message = mongoose.model("Message", MessageSchema);

const UserSchema = new mongoose.Schema({
  uid: String,
  email: String,
  displayName: String,
  avatar: String,
  createdAt: Number,
});

const User = mongoose.model("User", UserSchema);

//
// ✅ SOCKET.IO
//

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  //
  // JOIN ROOM
  //
  socket.on("join", ({ room }) => {
    socket.join(room);

    console.log(`➡️ ${socket.id} joined ${room}`);
  });

  //
  // SEND MESSAGE
  //
  socket.on("message", async ({ room, sender, uid, text }) => {
    try {
      console.log("📤 Incoming message:", text);

      const msg = {
        room,
        sender,
        uid,
        text,
        time: Date.now(),
      };

      //
      // ✅ SAVE TO MONGO
      //
      const savedMessage = await Message.create(msg);

      console.log("✅ Saved to Mongo:", savedMessage._id);

      //
      // ✅ EMIT TO ROOM
      //
      io.to(room).emit("message", {
        room,
        msg: savedMessage,
      });
    } catch (err) {
      console.error("❌ MESSAGE SAVE ERROR");
      console.error(err);
    }
  });

  //
  // LOAD MESSAGE HISTORY
  //
  socket.on("getMessages", async ({ room }, cb) => {
    try {
      console.log("📜 Loading history for:", room);

      const msgs = await Message.find({ room }).sort({ time: 1 });

      console.log(`✅ Loaded ${msgs.length} messages`);

      cb(msgs);
    } catch (err) {
      console.error("❌ LOAD MESSAGES ERROR");
      console.error(err);

      cb([]);
    }
  });

  //
  // DISCONNECT
  //
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});

//
// TEST ROUTE
//

app.get("/", (req, res) => {
  res.send("🚀 Server running");
});

//
// CREATE / GET USER
//

app.post("/api/users", async (req, res) => {
  try {
    const { uid, email } = req.body;

    //
    // CHECK EXISTING
    //
    let user = await User.findOne({ uid });

    //
    // CREATE IF MISSING
    //
    if (!user) {
      user = await User.create({
        uid,
        email,
        displayName: email.split("@")[0],
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${email}`,
        createdAt: Date.now(),
      });

      console.log("✅ Created user:", email);
    }

    res.json(user);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to create user",
    });
  }
});

//
// START SERVER
//

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server listening on ${PORT}`);
});
