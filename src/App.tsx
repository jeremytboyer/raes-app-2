import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = "https://f3nc2l-3000.csb.app";

const initialChannels = [
  { id: "general", name: "# general" },
  { id: "random", name: "# random" },
  { id: "build", name: "# build-log" },
];

const initialDMs = [
  { id: "alice", name: "Alice" },
  { id: "bob", name: "Bob" },
  { id: "sara", name: "Sara" },
];

export default function SlackCloneUI({ currentUser }) {
  const [socket, setSocket] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("channel");
  const [activeChat, setActiveChat] = useState("general");
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<Record<string, any[]>>({
    general: [],
    random: [],
    build: [],
    alice: [],
    bob: [],
    sara: [],
  });

  const list = activeTab === "channel" ? initialChannels : initialDMs;

  // 🔌 SOCKET INIT (FIXED)
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    newSocket.on("connect", () => {
      console.log("✅ CONNECTED:", newSocket.id);
    });

    newSocket.on("connect_error", (err) => {
      console.error("❌ CONNECTION ERROR:", err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // 📡 JOIN ROOM + LOAD HISTORY
  useEffect(() => {
    if (!socket) return;

    socket.emit("join", { room: activeChat });

    socket.emit("getMessages", { room: activeChat }, (msgs: any[]) => {
      setMessages((prev) => ({
        ...prev,
        [activeChat]: msgs || [],
      }));
    });
  }, [socket, activeChat]);

  // 📥 LISTEN FOR MESSAGES
  useEffect(() => {
    if (!socket) return;

    const handleMessage = ({ room, msg }: any) => {
      setMessages((prev) => ({
        ...prev,
        [room]: [...(prev[room] || []), msg],
      }));
    };

    socket.on("message", handleMessage);

    return () => {
      socket.off("message", handleMessage);
    };
  }, [socket]);

  // ✉️ SEND MESSAGE
  const sendMessage = () => {
    if (!socket || !input.trim()) return;

    socket.emit("message", {
      room: activeChat,
      sender: currentUser,
      text: input,
    });

    setInput("");
  };

  return (
    <div className="h-screen flex flex-col sm:flex-row bg-gray-100">
      {/* Sidebar */}
      <aside className="w-full sm:w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-3 font-bold text-lg border-b border-gray-700">
          Rae's App
        </div>

        <div className="flex">
          <button
            onClick={() => setActiveTab("channel")}
            className={`flex-1 p-2 text-sm ${
              activeTab === "channel" ? "bg-gray-800" : ""
            }`}
          >
            Channels
          </button>

          <button
            onClick={() => setActiveTab("dm")}
            className={`flex-1 p-2 text-sm ${
              activeTab === "dm" ? "bg-gray-800" : ""
            }`}
          >
            DMs
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {list.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveChat(item.id)}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-800 ${
                activeChat === item.id ? "bg-gray-800" : ""
              }`}
            >
              {item.name}
            </div>
          ))}
        </div>
      </aside>

      {/* Chat */}
      <main className="flex-1 flex flex-col">
        <div className="h-12 bg-white border-b flex items-center px-4 font-medium">
          {activeChat} —{" "}
          <span className="ml-2 text-sm text-gray-500">{currentUser}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {(messages[activeChat] || []).map((msg, idx) => (
            <div
              key={idx}
              className={`max-w-md px-3 py-2 rounded-lg text-sm ${
                msg.sender === currentUser
                  ? "ml-auto bg-blue-500 text-white"
                  : "bg-white border"
              }`}
            >
              <div className="text-xs opacity-60 mb-1">{msg.sender}</div>
              {msg.text}
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 border-t bg-white flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 border rounded px-3 py-2 text-sm"
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
