const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

export const nativeWordPress =
  typeof window !== "undefined" && Boolean(window.BDS_WORDPRESS?.apiUrl);

export function apiPath(endpoint) {
  if (typeof window !== "undefined" && window.BDS_WORDPRESS?.apiUrl) {
    const cleanPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${window.BDS_WORDPRESS.apiUrl}${cleanPath}`;
  }
  const cleanPath = endpoint.startsWith("/api")
    ? endpoint
    : `/api${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  return `${BACKEND_URL}${cleanPath}`;
}

export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : apiPath(endpoint);

  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const token = typeof localStorage !== "undefined" ? localStorage.getItem("bds_token") : null;
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    credentials: options.credentials || "include",
    headers,
  });
}

export function publicAsset(path) {
  if (typeof window !== "undefined" && window.BDS_WORDPRESS?.themeUrl) {
    return `${window.BDS_WORDPRESS.themeUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }
  const publicUrl = process.env.PUBLIC_URL || "";
  return `${publicUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
