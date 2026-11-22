import { createContext, createElement, useCallback, useContext, useEffect, useState } from "react";

export const API = (process.env.REACT_APP_BACKEND_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");

export function formatDriveImg(url) {
  if (!url || typeof url !== "string") return url || "";
  if (url.includes("drive.google.com")) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  }
  return url;
}

export function resolveBackendMedia(url) {
  if (!url || typeof url !== "string") return "";
  const cleaned = formatDriveImg(url);
  if (cleaned.startsWith("/api/") || cleaned.startsWith("api/") || cleaned.startsWith("/uploads/") || cleaned.startsWith("uploads/")) {
    const clean = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
    return API ? `${API}${clean}` : clean;
  }
  return cleaned;
}

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => (e && typeof e.msg === "string" ? e.msg.replace(/^Value error, /, "") : JSON.stringify(e))).join(" ");
  if (typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export async function api(path, { method = "GET", body } = {}) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const token = typeof sessionStorage !== "undefined" ? (sessionStorage.getItem("bds_token") || localStorage.getItem("bds_token")) : null;
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const headers = isForm ? (token ? authHeader : undefined) : {
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...authHeader
  };
  const payload = isForm ? body : (body ? JSON.stringify(body) : undefined);
  const res = await fetch(`${API}/api${path}`, { method, credentials: "include", headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(formatApiError(data.detail)); err.status = res.status; throw err; }
  return data;
}

const read = (storage, key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };

export const EMPTY_SEARCH = { where: "", lat: null, lng: null, nearby: false, checkIn: "", checkOut: "", adults: 0, children: 0, infants: 0, pets: 0, flex: 0, tier: "" };

const StaysCtx = createContext(null);
export function StaysProvider({ children }) {
  const [search, setSearchState] = useState(() => ({ ...EMPTY_SEARCH, ...read(sessionStorage, "bds_stay_search", {}) }));
  const [favs, setFavs] = useState(() => read(localStorage, "bds_stay_favs", []));
  useEffect(() => { sessionStorage.setItem("bds_stay_search", JSON.stringify(search)); }, [search]);
  useEffect(() => { localStorage.setItem("bds_stay_favs", JSON.stringify(favs)); }, [favs]);
  const setSearch = useCallback((patch) => setSearchState((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) })), []);
  const toggleFav = useCallback((slug) => setFavs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug])), []);
  return createElement(StaysCtx.Provider, { value: { search, setSearch, favs, toggleFav } }, children);
}
export const useStays = () => useContext(StaysCtx);

const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const check = useCallback(async () => {
    try {
      const data = await api("/auth/status");
      setUser(data.user || false);
      if (typeof data.payments_enabled === "boolean") {
        window.__BDS_PAYMENTS_ENABLED = data.payments_enabled;
      }
    } catch {
      setUser(false);
    }
  }, []);
  useEffect(() => {
    // Returning from Google: AuthCallback exchanges the session first
    if (window.location.hash?.includes("session_id=")) { setUser(false); return; }
    check();
  }, [check]);
  const logout = useCallback(async () => {
    try { sessionStorage.removeItem("bds_token"); localStorage.removeItem("bds_token"); } catch {}
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(false);
  }, []);
  return createElement(AuthCtx.Provider, { value: { user, setUser, logout, check } }, children);
}
export const useAuth = () => useContext(AuthCtx);

export function useAvailability(stayName) {
  const [state, setState] = useState({ booked: [], requested: [], loading: true, error: "" });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    api(`/stays/availability${stayName ? `?stay=${encodeURIComponent(stayName)}` : ""}`)
      .then((d) => live && setState({ booked: d.booked || [], requested: d.requested || [], loading: false, error: "" }))
      .catch(() => live && setState({ booked: [], requested: [], loading: false, error: "Couldn't load live availability. Dates will be re-checked when you book." }));
    return () => { live = false; };
  }, [stayName]);
  return state;
}

export function useIsMobile(query = "(max-width: 768px)") {
  const [match, setMatch] = useState(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      try { return window.matchMedia(query).matches; } catch { return false; }
    }
    return false;
  });
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    try {
      const mq = window.matchMedia(query);
      const on = () => setMatch(mq.matches);
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", on);
        return () => mq.removeEventListener("change", on);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(on);
        return () => mq.removeListener(on);
      }
    } catch {}
    return undefined;
  }, [query]);
  return match;
}
