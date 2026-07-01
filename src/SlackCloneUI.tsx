import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://raes-app.onrender.com";

type Msg = {
  _id?: string;
  sender: string;
  uid: string;
  avatar?: string;
  text: string;
  time?: number;
  reactions?: Record<string, string[]>;
};

type UserProfile = {
  uid: string;
  email: string;
  displayName: string;
  avatar: string;
  online: boolean;
  showEmail?: boolean;
  lastSeen?: number;
};

const getDmRoom = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};

const formatTime = (time?: number) => {
  if (!time) return "";

  const date = new Date(time);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [recentDms, setRecentDms] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const typingTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<Record<string, Msg[]>>({
    general: [],
    random: [],
    build: [],
  });

  const channels = ["general", "random", "build"];

  const addRecentDm = (room: string) => {
    setRecentDms((prev) => [room, ...prev.filter((r) => r !== room)]);
  };

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { uid },
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
    const fetchConversations = async () => {
      try {
        const res = await fetch(`${SOCKET_URL}/api/conversations/${uid}`);
        const data = await res.json();

        setRecentDms(data.map((conversation: any) => conversation.room));
      } catch (err) {
        console.error("Failed to fetch conversations", err);
      }
    };

    fetchConversations();
  }, [uid]);

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

      if (room.startsWith("dm_")) {
        addRecentDm(room);
      }

      if (room !== activeChat && msg.uid !== uid) {
        setUnreadCounts((prev) => ({
          ...prev,
          [room]: (prev[room] || 0) + 1,
        }));
      }
    };

    socket.on("message", handler);

    return () => {
      socket.off("message", handler);
    };
  }, [socket, activeChat, uid]);

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

  useEffect(() => {
    if (!socket) return;

    const handleReactionUpdated = ({
      room,
      messageId,
      reactions,
    }: {
      room: string;
      messageId: string;
      reactions: Record<string, string[]>;
    }) => {
      setMessages((prev) => ({
        ...prev,
        [room]: (prev[room] || []).map((msg) =>
          msg._id === messageId ? { ...msg, reactions } : msg
        ),
      }));
    };

    socket.on("reactionUpdated", handleReactionUpdated);

    return () => {
      socket.off("reactionUpdated", handleReactionUpdated);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, activeChat]);

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

  const toggleReaction = (msg: Msg, emoji: string) => {
    if (!socket || !msg._id) return;

    socket.emit("reaction", {
      messageId: msg._id,
      room: activeChat,
      emoji,
      uid,
    });
  };

  const openDm = (otherUid: string) => {
    const dmRoom = `dm_${getDmRoom(uid, otherUid)}`;

    setActiveChat(dmRoom);
    addRecentDm(dmRoom);

    setUnreadCounts((prev) => ({
      ...prev,
      [dmRoom]: 0,
    }));
  };

  return (
    <div className="h-screen flex flex-col sm:flex-row bg-gray-100">
      <aside className="w-full sm:w-64 bg-gray-900 text-white flex flex-col p-3">
        <div className="font-bold text-lg mb-4">Rae&apos;s App</div>

        <div>
          <h2 className="text-xs uppercase text-gray-400 mb-2">Channels</h2>

          {channels.map((channel) => (
            <button
              key={channel}
              onClick={() => {
                setActiveChat(channel);
                setUnreadCounts((prev) => ({
                  ...prev,
                  [channel]: 0,
                }));
              }}
              className={`w-full flex items-center justify-between text-left p-2 rounded text-sm ${
                activeChat === channel ? "bg-gray-700" : "hover:bg-gray-800"
              }`}
            >
              <span># {channel}</span>

              {unreadCounts[channel] > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2">
                  {unreadCounts[channel]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <h2 className="text-xs uppercase text-gray-400 mb-2">
            Direct Messages
          </h2>

          {recentDms.length === 0 && (
            <div className="text-xs text-gray-500 px-2">
              No conversations yet
            </div>
          )}

          <div className="space-y-1">
            {recentDms.map((room) => {
              const otherUid = room
                .replace("dm_", "")
                .split("_")
                .find((id) => id !== uid);

              const user = users.find((u) => u.uid === otherUid);

              if (!user) return null;

              return (
                <button
                  key={room}
                  onClick={() => {
                    setActiveChat(room);

                    setUnreadCounts((prev) => ({
                      ...prev,
                      [room]: 0,
                    }));
                  }}
                  className={`w-full flex items-center gap-2 p-2 rounded hover:bg-gray-800 ${
                    activeChat === room ? "bg-gray-700" : ""
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      user.online ? "bg-green-400" : "bg-gray-500"
                    }`}
                  />

                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedUser(user);
                    }}
                    className="w-6 h-6 rounded-full bg-white cursor-pointer"
                  />

                  <span className="text-sm truncate flex-1 text-left">
                    {user.displayName}
                  </span>

                  {unreadCounts[room] > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2">
                      {unreadCounts[room]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-0">
        <div className="h-12 bg-white border-b flex items-center px-4 font-medium">
          {activeChat.startsWith("dm_") ? "Direct Message" : `# ${activeChat}`}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {(messages[activeChat] || []).map((msg, idx, arr) => {
            const previous = arr[idx - 1];

            const isGrouped =
              previous &&
              previous.uid === msg.uid &&
              msg.time &&
              previous.time &&
              msg.time - previous.time < 5 * 60 * 1000;

            return (
              <div
                key={idx}
                className={`flex items-start gap-2 ${
                  msg.uid === uid ? "justify-end" : "justify-start"
                } ${isGrouped ? "mb-1" : "mb-3"}`}
              >
                {msg.uid !== uid &&
                  (isGrouped ? (
                    <div className="w-10 shrink-0" />
                  ) : (
                    <button
                      onClick={() => {
                        const user = users.find((u) => u.uid === msg.uid);
                        if (user) setSelectedUser(user);
                      }}
                      className="shrink-0"
                    >
                      <img
                        src={msg.avatar}
                        alt={msg.sender}
                        className="w-10 h-10 rounded-full border bg-white hover:ring-2 hover:ring-blue-400"
                      />
                    </button>
                  ))}

                <div
                  className={`max-w-md px-3 py-2 rounded-lg text-sm ${
                    msg.uid === uid
                      ? "bg-blue-500 text-white"
                      : "bg-white border"
                  }`}
                >
                  {!isGrouped && (
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className="font-semibold">{msg.sender}</span>

                      <span
                        className={
                          msg.uid === uid ? "text-blue-100" : "text-gray-400"
                        }
                      >
                        {formatTime(msg.time)}
                      </span>
                    </div>
                  )}

                  <div>{msg.text}</div>

                  <div className="flex gap-1 mt-2 flex-wrap">
                    {["❤️", "🤗", "🕯️", "🙏"].map((emoji) => {
                      const count = msg.reactions?.[emoji]?.length || 0;
                      const reacted = msg.reactions?.[emoji]?.includes(uid);

                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg, emoji)}
                          className={`text-xs px-2 py-1 rounded-full border ${
                            reacted
                              ? "bg-blue-100 text-blue-700 border-blue-300"
                              : "bg-white text-gray-600"
                          }`}
                        >
                          {emoji} {count > 0 ? count : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {msg.uid === uid &&
                  (isGrouped ? (
                    <div className="w-10 shrink-0" />
                  ) : (
                    <img
                      src={msg.avatar}
                      alt={msg.sender}
                      className="w-10 h-10 rounded-full border bg-white"
                    />
                  ))}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
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
            placeholder={
              activeChat.startsWith("dm_")
                ? "Send a direct message"
                : `Message #${activeChat}`
            }
          />

          <button
            onClick={sendMessage}
            className="bg-blue-500 text-white px-4 rounded"
          >
            Send
          </button>
        </div>
      </main>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-80 p-5">
            <div className="flex flex-col items-center text-center">
              <img
                src={selectedUser.avatar}
                alt={selectedUser.displayName}
                className="w-20 h-20 rounded-full border mb-3"
              />

              <h2 className="text-xl font-bold">{selectedUser.displayName}</h2>

              {selectedUser.showEmail ? (
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Email hidden</p>
              )}

              <div className="mt-3 flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    selectedUser.online ? "bg-green-500" : "bg-gray-400"
                  }`}
                />

                <span>{selectedUser.online ? "Online" : "Offline"}</span>
              </div>

              {!selectedUser.online && selectedUser.lastSeen && (
                <p className="text-xs text-gray-400 mt-1">
                  Last seen {formatTime(selectedUser.lastSeen)}
                </p>
              )}

              <div className="mt-5 flex gap-2">
                <button
                  onClick={() => {
                    openDm(selectedUser.uid);
                    setSelectedUser(null);
                  }}
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                  Message
                </button>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="border px-4 py-2 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
