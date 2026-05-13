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

const MessageSchema = new mongoose.Schema({
  room: String,
  sender: String,
  uid: String,
  avatar: String,
  text: String,
  time: Number,
});

const Message = mongoose.model("Message", MessageSchema);

const UserSchema = new mongoose.Schema({
  uid: String,
  email: String,
  displayName: String,
  avatar: String,
  online: {
    type: Boolean,
    default: false,
  },
  lastSeen: Number,
  createdAt: Number,
});

const User = mongoose.model("User", UserSchema);

app.get("/", (req, res) => {
  res.send("🚀 Server running");
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().sort({
      online: -1,
      displayName: 1,
    });

    res.json(users);
  } catch (err) {
    console.error("❌ GET USERS ERROR");
    console.error(err);

    res.status(500).json({
      error: "Failed to fetch users",
    });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    console.log("🔥 /api/users HIT");
    console.log(req.body);

    const { uid, email, username } = req.body;

    let user = await User.findOne({ uid });

    if (!user) {
      if (username) {
        const existingUsername = await User.findOne({
          displayName: username,
        });

        if (existingUsername) {
          return res.status(400).json({
            error: "Username already taken",
          });
        }
      }

      user = await User.create({
        uid,
        email,
        displayName: username || email.split("@")[0],
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${
          username || email.split("@")[0]
        }`,
        online: false,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });

      console.log("✅ Created user:", user.displayName);
    }

    res.json(user);
  } catch (err) {
    console.error("❌ USER ROUTE ERROR");
    console.error(err);

    res.status(500).json({
      error: "Failed to create user",
    });
  }
});

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  const uid = socket.handshake.auth?.uid;

  if (uid) {
    User.findOneAndUpdate(
      { uid },
      {
        online: true,
        lastSeen: Date.now(),
      }
    ).then(() => {
      console.log("🟢 User online:", uid);
    });
  }

  socket.on("join", ({ room }) => {
    socket.join(room);
    console.log(`➡️ ${socket.id} joined ${room}`);
  });

  socket.on("message", async ({ room, sender, uid, text }) => {
    try {
      console.log("📤 Incoming message:", text);

      const user = await User.findOne({ uid });

      const msg = {
        room,
        sender: user?.displayName || sender,
        uid,
        avatar:
          user?.avatar ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${sender}`,
        text,
        time: Date.now(),
      };

      const savedMessage = await Message.create(msg);

      console.log("✅ Saved to Mongo");

      io.to(room).emit("message", {
        room,
        msg: savedMessage,
      });
    } catch (err) {
      console.error("❌ MESSAGE ERROR");
      console.error(err);
    }
  });

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

  socket.on("disconnect", async () => {
    console.log("❌ User disconnected:", socket.id);

    if (uid) {
      await User.findOneAndUpdate(
        { uid },
        {
          online: false,
          lastSeen: Date.now(),
        }
      );

      console.log("⚪ User offline:", uid);
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server listening on ${PORT}`);
});
