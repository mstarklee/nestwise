"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addEntry, clearLocal, flush, resendAllTwice, sentCount, waitingCount } from "@/lib/outbox";

// THROWAWAY SPIKE (Stage 0): copy is hard-coded on purpose; the real app keeps every string in messages/en.json.

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export default function SpikePage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [accountMessage, setAccountMessage] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [permission, setPermission] = useState("unknown");
  const [waiting, setWaiting] = useState(0);
  const [sent, setSent] = useState(0);
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [log, setLog] = useState<string[]>([]);

  const note = useCallback((line: string) => {
    setLog((old) => [`${new Date().toLocaleTimeString()}  ${line}`, ...old].slice(0, 30));
  }, []);

  const refreshCounts = useCallback(async () => {
    setWaiting(await waitingCount());
    setSent(await sentCount());
    if (!navigator.onLine) return;
    try {
      const res = await fetch("/api/entries");
      if (res.ok) setServerCount(((await res.json()) as { count: number }).count);
    } catch {
      // offline
    }
  }, []);

  const flushNow = useCallback(
    async (why: string) => {
      const n = await flush();
      if (n > 0) note(`Sent ${n} waiting entr${n === 1 ? "y" : "ies"} (${why})`);
      await refreshCounts();
    },
    [note, refreshCounts],
  );

  const loadUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) setUserEmail(((await res.json()) as { email: string }).email);
      else if (res.status === 401) setUserEmail(null);
    } catch {
      // offline: keep whatever we showed last
    }
  }, []);

  useEffect(() => {
    setStandalone(isStandalone());
    setOnline(navigator.onLine);
    setPermission("Notification" in window ? Notification.permission : "not available here");
    void loadUser().then(() => flushNow("app opened"));

    const onOnline = () => {
      setOnline(true);
      void flushNow("back online");
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") void flushNow("app came to front");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [flushNow, loadUser]);

  // Reads the boxes directly (not React state), so values filled in by the phone's password manager still count.
  async function submitAccount(kind: "signin" | "signup") {
    const form = formRef.current;
    if (!form) return;
    const email = String(new FormData(form).get("email") ?? "").trim();
    const password = String(new FormData(form).get("password") ?? "");
    if (!email.includes("@")) return setAccountMessage("Type your email address.");
    if (password.length < 8) return setAccountMessage("Type a password of at least 8 characters.");
    setAccountMessage(kind === "signup" ? "Creating your account…" : "Signing in…");
    const res = await postJson(`/api/auth/${kind}`, { email, password });
    if (!res.ok) {
      const reason = String(res.data.error ?? `error ${res.status}`);
      setAccountMessage(reason);
      return note(`${kind === "signup" ? "Sign-up" : "Sign-in"} failed: ${reason}`);
    }
    form.reset();
    setAccountMessage("");
    setUserEmail(String(res.data.email));
    note(kind === "signup" ? "Account created and signed in." : "Signed in.");
    await flushNow(kind === "signup" ? "signed up" : "signed in");
  }

  async function signOut() {
    await postJson("/api/auth/signout", {});
    setUserEmail(null);
    note("Signed out.");
  }

  async function turnOnReminders() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return note("Notifications are not available here. On iPhone, open the app from the Home Screen.");
    }
    if (!userEmail) return note("Sign in first.");
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return note(`Permission: ${result}`);
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    const res = await postJson("/api/push", { action: "subscribe", subscription: subscription.toJSON() });
    note(res.ok ? "Reminders on: this device is saved." : `Saving the device failed (${res.status}).`);
  }

  async function sendTestPush() {
    if (!userEmail) return note("Sign in first.");
    note("Test push will be sent in 10 seconds. Lock your phone now.");
    const res = await postJson("/api/push", { action: "send", delaySeconds: 10 });
    note(res.ok ? `Push sent to ${String(res.data.sent)}/${String(res.data.devices)} device(s) at ${String(res.data.sentAt)}.` : `Push failed (${res.status}).`);
  }

  async function addOfflineEntry() {
    const entry = await addEntry(`Test entry ${new Date().toLocaleTimeString()}`);
    note(`Saved on the phone: ${entry.id.slice(0, 8)}…`);
    await flushNow("new entry");
  }

  async function resendTwice() {
    const n = await resendAllTwice();
    note(`Re-sent ${n} already-sent entr${n === 1 ? "y" : "ies"} twice each.`);
    await refreshCounts();
  }

  async function clearTestData() {
    await fetch("/api/entries", { method: "DELETE" });
    await clearLocal();
    note("Test entries cleared on the phone and the server.");
    await refreshCounts();
  }


  return (
    <main>
      <h1>NestWise iPhone spike</h1>

      <section>
        <h2>Status</h2>
        <dl>
          <dt>Opened as</dt>
          <dd>{standalone ? "Installed app (Home Screen)" : "Browser tab"}</dd>
          <dt>Network</dt>
          <dd>{online ? "Online" : "Offline"}</dd>
          <dt>Signed in</dt>
          <dd>{userEmail ?? "No"}</dd>
          <dt>Notifications</dt>
          <dd>{permission}</dd>
          <dt>Waiting to send</dt>
          <dd>{waiting}</dd>
          <dt>Sent from this phone</dt>
          <dd>{sent}</dd>
          <dt>Rows on server</dt>
          <dd>{serverCount ?? "?"}</dd>
        </dl>
        <button className="secondary" onClick={() => void refreshCounts()}>
          Refresh
        </button>
      </section>

      <section>
        <h2>Account</h2>
        {userEmail ? (
          <button className="secondary" onClick={() => void signOut()}>
            Sign out
          </button>
        ) : (
          <form
            ref={formRef}
            style={{ display: "grid", gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              void submitAccount("signin");
            }}
          >
            <input name="email" type="email" autoComplete="email" placeholder="Email" />
            <input name="password" type="password" autoComplete="current-password" placeholder="Password (8+ characters)" />
            <button type="submit">Sign in</button>
            <button type="button" className="secondary" onClick={() => void submitAccount("signup")}>
              Create account
            </button>
            {accountMessage && <p role="alert">{accountMessage}</p>}
          </form>
        )}
      </section>

      <section>
        <h2>Reminders</h2>
        <button onClick={() => void turnOnReminders()}>Turn on reminders</button>
        <button className="secondary" onClick={() => void sendTestPush()}>
          Send test push (in 10 s)
        </button>
      </section>

      <section>
        <h2>Offline entries</h2>
        <button onClick={() => void addOfflineEntry()}>Add offline entry</button>
        <button className="secondary" onClick={() => void flushNow("button")}>
          Send waiting now
        </button>
        <button className="secondary" onClick={() => void resendTwice()}>
          Resend everything twice (duplicate test)
        </button>
        <button className="secondary" onClick={() => void clearTestData()}>
          Clear test entries
        </button>
      </section>

      <section>
        <h2>Log</h2>
        <pre>{log.join("\n") || "Nothing yet."}</pre>
      </section>
    </main>
  );
}
