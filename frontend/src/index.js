import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";


const mountNode = document.getElementById("bdsm-marvel-root") || document.getElementById("root");
const root = ReactDOM.createRoot(mountNode);
async function start() {
  // WordPress injects the current public content into BDS_WORDPRESS during
  // page rendering. Mount immediately instead of waiting for a duplicate API
  // request before showing the homepage.
  const { default: App } = await import('@/App');
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
start();
