import { useMemo, useState } from "react";
import { loginUser, fetchCurrentUser, logoutUser } from "./lib/authApi";
import {
  fetchSubscriptions,
  createSubscription,
  deleteSubscription,
  sendNowSubscription,
} from "./lib/subscriptionApi";
import { validateTicker, fetchStockPrice } from "./lib/stockApi";
import { useAuthStore } from "./stores/authStore";
import type { Subscription } from "./types/subscription";

function App() {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("12345678");
  const [status, setStatus] = useState("Idle");
  const [result, setResult] = useState<unknown>(null);
  const [createSubscriptionError, setCreateSubscriptionError] = useState("");

  const [newTicker, setNewTicker] = useState("AAPL");
  const [newRecipientEmail, setNewRecipientEmail] = useState("test@example.com");
  const [testSubscriptionId, setTestSubscriptionId] = useState("1");
  const [stockTicker, setStockTicker] = useState("AAPL");

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const selectedSubscriptionId = useMemo(() => {
    const parsed = Number(testSubscriptionId);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [testSubscriptionId]);

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    setStatus(`${label}...`);
    try {
      const data = await fn();
      setResult(data ?? "OK");
      setStatus(`${label} succeeded`);
      return data;
    } catch (error) {
      console.error(`${label} failed:`, error);
      setResult(error instanceof Error ? error.message : String(error));
      setStatus(`${label} failed`);
      throw error;
    }
  };

  const handleLogin = async () => {
    await runAction("Login", () => loginUser(email, password));
  };

  const handleFetchMe = async () => {
    await runAction("Fetch /me", () => fetchCurrentUser());
  };

  const handleLogout = () => {
    logoutUser();
    setResult(null);
    setStatus("Logged out");
  };

  const handleFetchSubscriptions = async () => {
    const data = await runAction("Fetch subscriptions", () => fetchSubscriptions());

    if (Array.isArray(data)) {
      const subs = data as Subscription[];
      setSubscriptions(subs);

      if (subs.length > 0) {
        setTestSubscriptionId(String(subs[0].id));
      } else {
        setTestSubscriptionId("");
      }
    }
  };

  const handleCreateSubscription = async () => {
    setCreateSubscriptionError("");

    try {
      const data = await runAction("Create subscription", () =>
        createSubscription({
          ticker: newTicker,
          email: newRecipientEmail,
        })
      );

      if (data && typeof data === "object" && "id" in (data as Record<string, unknown>)) {
        const created = data as Subscription;
        setTestSubscriptionId(String(created.id));
      }

      await handleFetchSubscriptions();
    } catch (error) {
      const message = getApiErrorMessage(error);
      setCreateSubscriptionError(message);
    }
  };

  const handleDeleteSubscription = async () => {
    if (!selectedSubscriptionId) {
      setStatus("Delete failed: invalid subscription id");
      return;
    }

    const exists = subscriptions.some((sub) => sub.id === selectedSubscriptionId);
    if (!exists) {
      setStatus("Delete failed: selected subscription id does not exist in current list");
      return;
    }

    await runAction("Delete subscription", () =>
      deleteSubscription(selectedSubscriptionId)
    );

    await handleFetchSubscriptions();
  };

  const handleSendNow = async () => {
    if (!selectedSubscriptionId) {
      setStatus("Send Now failed: invalid subscription id");
      return;
    }

    const exists = subscriptions.some((sub) => sub.id === selectedSubscriptionId);
    if (!exists) {
      setStatus("Send Now failed: selected subscription id does not exist in current list");
      return;
    }

    await runAction("Send Now", () => sendNowSubscription(selectedSubscriptionId));
  };

  const handleValidateTicker = async () => {
    await runAction("Validate ticker", () => validateTicker(stockTicker));
  };

  const handleFetchPrice = async () => {
    await runAction("Fetch stock price", () => fetchStockPrice(stockTicker));
  };

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 32,
        fontFamily: "Arial, sans-serif",
        lineHeight: 1.5,
      }}
    >
      <h1>Stock Subscription App — Frontend Integration Debug Page</h1>
      <p>
        This page is for testing the current frontend service layer before building
        the final dashboard UI.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h2>1. Auth Test</h2>

          <div style={{ marginBottom: 12 }}>
            <label>
              Email
              <br />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
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
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={handleLogin}>Login</button>
            <button onClick={handleFetchMe}>Fetch /me</button>
            <button onClick={handleLogout}>Logout</button>
          </div>

          <div style={{ marginTop: 20 }}>
            <h3>Auth Store State</h3>
            <p>
              <strong>Authenticated:</strong> {String(isAuthenticated)}
            </p>
            <p>
              <strong>Access Token:</strong> {accessToken ? "Present" : "Missing"}
            </p>
            <p>
              <strong>Refresh Token:</strong> {refreshToken ? "Present" : "Missing"}
            </p>

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
        </section>

        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h2>2. Stocks API Test</h2>

          <div style={{ marginBottom: 12 }}>
            <label>
              Ticker
              <br />
              <input
                type="text"
                value={stockTicker}
                onChange={(e) => setStockTicker(e.target.value.toUpperCase())}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={handleValidateTicker}>Validate Ticker</button>
            <button onClick={handleFetchPrice}>Fetch Price</button>
          </div>
        </section>
      </div>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
          marginTop: 20,
        }}
      >
        <h2>3. Subscriptions API Test</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 160px",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <label>
              Subscription Ticker
              <br />
              <input
                type="text"
                value={newTicker}
                onChange={(e) => {
                  setNewTicker(e.target.value.toUpperCase());
                  setCreateSubscriptionError("");
                }}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>
          </div>

          <div>
            <label>
              Recipient Email
              <br />
              <input
                type="email"
                value={newRecipientEmail}
                onChange={(e) => {
                  setNewRecipientEmail(e.target.value);
                  setCreateSubscriptionError("");
                }}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>
          </div>

          <div>
            <label>
              Target ID
              <br />
              <input
                type="text"
                value={testSubscriptionId}
                onChange={(e) => setTestSubscriptionId(e.target.value)}
                style={{ width: "100%", padding: 10, marginTop: 6 }}
              />
            </label>
          </div>
        </div>

        <p style={{ marginTop: 8, color: "#666" }}>
          Available IDs:{" "}
          {subscriptions.length > 0
            ? subscriptions.map((sub) => sub.id).join(", ")
            : "none"}
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <button onClick={handleFetchSubscriptions}>Fetch Subscriptions</button>
          <button onClick={handleCreateSubscription}>Create Subscription</button>
          <button onClick={handleSendNow}>Send Now</button>
          <button onClick={handleDeleteSubscription}>Delete Subscription</button>
        </div>

        {createSubscriptionError && (
          <p
            style={{
              marginTop: 12,
              color: "#b00020",
              background: "#fdecea",
              border: "1px solid #f5c2c7",
              padding: "10px 12px",
              borderRadius: 6,
            }}
          >
            {createSubscriptionError}
          </p>
        )}

        <h3>Subscription List</h3>
        {subscriptions.length === 0 ? (
          <p>No subscriptions loaded yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1px solid #ddd",
              }}
            >
              <thead>
                <tr style={{ background: "#f7f7f7" }}>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Ticker</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Created At</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td style={tdStyle}>{sub.id}</td>
                    <td style={tdStyle}>{sub.ticker}</td>
                    <td style={tdStyle}>{sub.email}</td>
                    <td style={tdStyle}>{sub.created_at ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
          marginTop: 20,
        }}
      >
        <h2>4. Debug Output</h2>
        <p>
          <strong>Status:</strong> {status}
        </p>

        <strong>Last Result:</strong>
        <pre
          style={{
            background: "#f6f8fa",
            padding: 12,
            borderRadius: 6,
            overflowX: "auto",
            minHeight: 120,
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
          marginTop: 20,
          marginBottom: 40,
        }}
      >
        <h2>5. What success looks like</h2>
        <ol>
          <li>Login succeeds and Authenticated becomes true.</li>
          <li>Refresh the page and Authenticated stays true.</li>
          <li>Fetch /me returns the current user.</li>
          <li>Fetch subscriptions returns an array.</li>
          <li>Create subscription creates a new item and refreshes the table.</li>
          <li>Send Now succeeds for a valid subscription id.</li>
          <li>Delete subscription removes the item and refreshes the table.</li>
          <li>Validate ticker and Fetch Price both return typed responses.</li>
        </ol>
      </section>
    </div>
  );
}

function getApiErrorMessage(error: unknown): string {
  const fallback = "Something went wrong.";

  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response
  ) {
    const data = error.response.data as Record<string, unknown>;

    // DRF non_field_errors
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return String(data.non_field_errors[0]);
    }

    // field-level errors like { ticker: ["Invalid ticker symbol."] }
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && value.length > 0) {
        return String(value[0]);
      }
    }

    if (typeof data.detail === "string") {
      return data.detail;
    }

    if (typeof data.message === "string") {
      return data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #ddd",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
};

export default App;