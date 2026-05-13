import { useEffect, useState } from "react";
import SlackCloneUI from "./SlackCloneUI";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";

import { auth } from "./firebase";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const login = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const signup = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      await fetch("https://raes-app.onrender.com/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: cred.user.uid,
          email: cred.user.email,
          username,
        }),
      });

      console.log("✅ Account created");
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  const logout = () => signOut(auth);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-6 rounded shadow w-80">
          <h2 className="text-xl font-bold mb-4">
            {isLogin ? "Login" : "Sign Up"}
          </h2>

          <input
            className="w-full border p-2 mb-2 rounded"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {!isLogin && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border px-3 py-2 mb-3 rounded"
            />
          )}

          <input
            className="w-full border p-2 mb-3 rounded"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            onClick={isLogin ? login : signup}
            className="w-full bg-blue-500 text-white py-2 rounded"
          >
            {isLogin ? "Login" : "Create Account"}
          </button>

          <button
            onClick={() => setIsLogin(!isLogin)}
            className="w-full mt-3 text-sm text-blue-500"
          >
            Switch mode
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen">
      <button
        onClick={logout}
        className="absolute top-2 right-2 bg-white px-3 py-1 rounded shadow"
      >
        Logout
      </button>

      <SlackCloneUI currentUser={user.email || "Unknown"} uid={user.uid} />
    </div>
  );
}
