import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://raes-app.onrender.com";

type Msg = {
  sender: string;
  uid: string;
  avatar?: string;
  text: string;
};

type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  avatar: string;
  online: boolean;
};

const getDmRoom = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};

export default function SlackCloneUI({
  currentUser,
  uid,
}: {
  currentUser: string;
  uid: string;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeChat, setActiveChat] = useState("general");
  const [input, setInput] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const [messages, setMessages] = useState<Record<string, Msg[]>>({
    general: [],
    random: [],
    build: [],
  });

  const channels = ["general", "random", "build"];

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: {
        uid,
      },
    });

    s.on("connect", () => {
      console.log("✅ CONNECTED:", s.id);
    });

    s.on("connect_error", (err) => {
      console.error("❌ SOCKET ERROR:", err.message);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [uid]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/users`);
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error("Failed to fetch users", err);
      }
    };

    fetchUsers();

    const interval = setInterval(fetchUsers, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.emit("join", { room: activeChat });

    socket.emit("getMessages", { room: activeChat }, (msgs: Msg[]) => {
      setMessages((prev) => ({
        ...prev,
        [activeChat]: msgs || [],
      }));
    });
  }, [socket, activeChat]);

  useEffect(() => {
    if (!socket) return;

    const handler = ({ room, msg }: { room: string; msg: Msg }) => {
      setMessages((prev) => ({
        ...prev,
        [room]: [...(prev[room] || []), msg],
      }));
    };

    socket.on("message", handler);

    return () => {
      socket.off("message", handler);
    };
  }, [socket]);

  const sendMessage = () => {
    if (!socket || !input.trim()) return;

    socket.emit("message", {
      room: activeChat,
      sender: currentUser,
      uid,
      text: input,
    });

    socket.emit("stopTyping", {
      room: activeChat,
      uid,
    });

    setInput("");
  };

  useEffect(() => {
    if (!socket) return;

    const handleTyping = ({ room, sender, uid: typingUid }: any) => {
      if (room === activeChat && typingUid !== uid) {
        setTypingUser(sender);
      }
    };

    const handleStopTyping = ({ room, uid: typingUid }: any) => {
      if (room === activeChat && typingUid !== uid) {
        setTypingUser(null);
      }
    };

    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);

    return () => {
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
    };
  }, [socket, activeChat, uid]);

  const handleTyping = (value: string) => {
    setInput(value);

    if (!socket) return;

    socket.emit("typing", {
      room: activeChat,
      sender: users.find((u) => u.uid === uid)?.displayName || currentUser,
      uid,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit("stopTyping", {
        room: activeChat,
        uid,
      });
    }, 1000);
  };

  return (
    <div className="h-screen flex flex-col sm:flex-row bg-gray-100">
      {/* Sidebar */}
      <aside className="w-full sm:w-64 bg-gray-900 text-white flex flex-col p-3">
        <div className="font-bold text-lg mb-4">Slack Clone</div>

        <div>
          <h2 className="text-xs uppercase text-gray-400 mb-2">Channels</h2>

          {channels.map((channel) => (
            <button
              key={channel}
              onClick={() => setActiveChat(channel)}
              className={`w-full text-left p-2 rounded text-sm ${
                activeChat === channel ? "bg-gray-700" : "hover:bg-gray-800"
              }`}
            >
              # {channel}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <h2 className="text-xs uppercase text-gray-400 mb-2">Online Users</h2>

          <div className="space-y-1">
            {users.map((user) => (
              <div
                key={user.uid}
                onClick={() => {
                  if (user.uid === uid) return;

                  const dmRoom = `dm_${getDmRoom(uid, user.uid)}`;
                  setActiveChat(dmRoom);
                }}
                className="flex items-center gap-2 p-2 rounded hover:bg-gray-800 cursor-pointer"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    user.online ? "bg-green-400" : "bg-gray-500"
                  }`}
                />

                <img
                  src={user.avatar}
                  alt={user.displayName}
                  className="w-6 h-6 rounded-full bg-white"
                />

                <span className="text-sm truncate">{user.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col min-h-0">
        <div className="h-12 bg-white border-b flex items-center px-4 font-medium">
          #{" "}
          {activeChat.startsWith("dm_") ? "Direct Message" : `# ${activeChat}`}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {(messages[activeChat] || []).map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 mb-3 ${
                msg.uid === uid ? "justify-end" : "justify-start"
              }`}
            >
              {msg.uid !== uid && (
                <img
                  src={msg.avatar}
                  alt={msg.sender}
                  className="w-10 h-10 rounded-full border bg-white"
                />
              )}

              <div
                className={`max-w-md px-3 py-2 rounded-lg text-sm ${
                  msg.uid === uid ? "bg-blue-500 text-white" : "bg-white border"
                }`}
              >
                <div className="font-semibold text-xs mb-1">{msg.sender}</div>

                <div>{msg.text}</div>
              </div>

              {msg.uid === uid && (
                <img
                  src={msg.avatar}
                  alt={msg.sender}
                  className="w-10 h-10 rounded-full border bg-white"
                />
              )}
            </div>
          ))}
        </div>

        {typingUser && (
          <div className="px-4 py-1 text-xs text-gray-500 bg-white border-t">
            {typingUser} is typing...
          </div>
        )}

        <div className="p-3 border-t bg-white flex gap-2">
          <input
            className="flex-1 border p-2 rounded"
            value={input}
            onChange={(e) => handleTyping(e.target.value)}
            onInput={(e) => handleTyping((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder={`Message #${activeChat}`}
          />

          <button
            onClick={sendMessage}
            className="bg-blue-500 text-white px-4 rounded"
          >
            Send
          </button>
        </div>
      </main>
    </div>
  );
}
