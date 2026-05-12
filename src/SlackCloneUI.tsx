import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://raes-app.onrender.com";

type Msg = {
  sender: string;
  uid: string;
  text: string;
  avatar: string;
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

  const [messages, setMessages] = useState<Record<string, Msg[]>>({
    general: [],
    random: [],
    build: [],
  });

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    // ✅ CONNECTED
    s.on("connect", () => {
      console.log("✅ CONNECTED:", s.id);
    });

    // ❌ CONNECTION ERROR
    s.on("connect_error", (err) => {
      console.error("❌ SOCKET ERROR:", err.message);
    });

    // ❌ DISCONNECTED
    s.on("disconnect", () => {
      console.log("❌ DISCONNECTED");
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
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

    const handler = ({ room, msg }: any) => {
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

    setInput("");
  };

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white p-3">
        <h2 className="font-bold mb-4">Channels</h2>

        {["general", "random", "build"].map((c) => (
          <div
            key={c}
            onClick={() => setActiveChat(c)}
            className={`p-2 cursor-pointer rounded ${
              activeChat === c ? "bg-gray-700" : ""
            }`}
          >
            # {c}
          </div>
        ))}
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col">
        <div className="border-b p-3 font-bold">{activeChat}</div>

        <div className="flex-1 p-3 overflow-y-auto space-y-2">
          {(messages[activeChat] || []).map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2 mb-3 ${
                msg.uid === uid ? "justify-end" : "justify-start"
              }`}
            >
              {msg.uid !== uid && (
                <img
                  src={msg.avatar}
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
              )}

              <div
                className={`max-w-md px-3 py-2 rounded-lg text-sm ${
                  msg.uid === uid ? "bg-blue-500 text-white" : "bg-white border"
                }`}
              >
                <div className="font-semibold text-xs mb-1">{msg.sender}</div>

                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t flex gap-2">
          <input
            className="flex-1 border p-2 rounded"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Message..."
          />

          <button
            onClick={sendMessage}
            className="bg-blue-500 text-white px-4 rounded"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
