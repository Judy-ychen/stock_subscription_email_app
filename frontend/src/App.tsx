import { useState } from "react";
import { loginUser, fetchCurrentUser, logoutUser } from "./lib/authApi";
import { useAuthStore } from "./stores/authStore";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Idle");

  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const handleLogin = async () => {
    setStatus("Logging in...");

    try {
      const result = await loginUser(email, password);
      console.log("login success:", result);
      setStatus("Login succeeded");
    } catch (error) {
      console.error("login failed:", error);
      setStatus("Login failed");
    }
  };

  const handleFetchMe = async () => {
    setStatus("Fetching /me/...");

    try {
      const result = await fetchCurrentUser();
      console.log("/me success:", result);
      setStatus("Fetched current user successfully");
    } catch (error) {
      console.error("/me failed:", error);
      setStatus("Fetching /me failed");
    }
  };

  const handleLogout = () => {
    logoutUser();
    setStatus("Logged out");
  };

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 32,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Stock Subscription App — Auth Debug Page</h1>
      <p>
        Use this page to test JWT login, token persistence, and current-user
        fetch.
      </p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
          marginTop: 24,
          marginBottom: 24,
        }}
      >
        <h2>Login Form</h2>

        <div style={{ marginBottom: 12 }}>
          <label>
            Email
            <br />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              style={{
                width: "100%",
                maxWidth: 400,
                padding: 10,
                marginTop: 6,
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>
            Password
            <br />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{
                width: "100%",
                maxWidth: 400,
                padding: 10,
                marginTop: 6,
              }}
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button onClick={handleLogin} style={{ padding: "10px 16px" }}>
            Login
          </button>

          <button onClick={handleFetchMe} style={{ padding: "10px 16px" }}>
            Fetch /me
          </button>

          <button onClick={handleLogout} style={{ padding: "10px 16px" }}>
            Logout
          </button>
        </div>

        <p style={{ marginTop: 16 }}>
          <strong>Status:</strong> {status}
        </p>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h2>Auth Store State</h2>
        <p>
          <strong>Authenticated:</strong> {String(isAuthenticated)}
        </p>
        <p>
          <strong>Access Token:</strong>{" "}
          {accessToken ? "Present" : "Missing"}
        </p>
        <p>
          <strong>Refresh Token:</strong>{" "}
          {refreshToken ? "Present" : "Missing"}
        </p>

        <div style={{ marginTop: 16 }}>
          <strong>User:</strong>
          <pre
            style={{
              background: "#f6f8fa",
              padding: 12,
              borderRadius: 6,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
        }}
      >
        <h2>How to verify this page works</h2>
        <ol>
          <li>Enter a valid email and password for a user in your backend.</li>
          <li>Click Login.</li>
          <li>
            Confirm Authenticated becomes <code>true</code>.
          </li>
          <li>Confirm access and refresh tokens are present.</li>
          <li>Confirm user JSON appears below.</li>
          <li>Refresh the browser page and check the state is still there.</li>
          <li>Click Logout and confirm everything clears.</li>
        </ol>
      </div>
    </div>
  );
}

export default App;