import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client"; // adjust if your client lives elsewhere

const HEARTBEAT_MS = 30_000;
const NEW_SESSION_AFTER_MS = 30 * 60 * 1000; // 30 min away = new visit

const uuid = () => crypto.randomUUID();

function getVisitorId(): string {
  try {
    let id = localStorage.getItem("visitor_id");
    if (!id) {
      id = uuid();
      localStorage.setItem("visitor_id", id);
    }
    return id;
  } catch {
    return uuid();
  }
}

const visitorId = getVisitorId();
const platform = Capacitor.getPlatform() as "web" | "android" | "ios";

let sessionId = uuid();
let lastActive = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
let getPath: () => string = () => window.location.pathname;

async function ping() {
  lastActive = Date.now();
  try {
    await supabase.rpc("track_visit", {
      p_session_id: sessionId,
      p_visitor_id: visitorId,
      p_platform: platform,
      p_path: getPath(),
      p_referrer: document.referrer || null,
      p_user_agent: navigator.userAgent,
    });
  } catch {
    // tracking must never break the app
  }
}

function onActive() {
  if (Date.now() - lastActive > NEW_SESSION_AFTER_MS) sessionId = uuid();
  ping();
  if (!timer) timer = setInterval(ping, HEARTBEAT_MS);
}

function onInactive() {
  ping();
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

let started = false;
export function startVisitTracking(pathGetter?: () => string) {
  if (started) return;
  started = true;
  if (pathGetter) getPath = pathGetter;

  onActive();

  document.addEventListener("visibilitychange", () =>
    document.visibilityState === "visible" ? onActive() : onInactive()
  );
  window.addEventListener("pagehide", onInactive);

  if (Capacitor.isNativePlatform()) {
    App.addListener("appStateChange", ({ isActive }) =>
      isActive ? onActive() : onInactive()
    );
  }

  // attach the session to the account as soon as a guest logs in
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") ping();
  });
}

export const trackPageChange = () => ping();