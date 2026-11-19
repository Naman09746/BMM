import React from "react";
import { Building, Sparkles } from "lucide-react";

export function WorkspaceSwitcher({ activeWorkspace, onSwitch }) {
  return (
    <div className="od-ws-switcher" data-testid="workspace-switcher" role="navigation" aria-label="Workspace Switcher">
      <div className="od-ws-pills">
        <button
          type="button"
          className={`od-ws-pill ${activeWorkspace === "business" ? "is-active" : ""}`}
          onClick={() => onSwitch("business")}
          data-testid="ws-btn-business"
          aria-label="Switch to Business Operations workspace"
        >
          <Building size={15} className="od-ws-icon" />
          <span className="od-ws-label">Business Operations</span>
          <span className="od-ws-subtag">Bookings & CRM</span>
        </button>

        <button
          type="button"
          className={`od-ws-pill ${activeWorkspace === "studio" ? "is-active" : ""}`}
          onClick={() => onSwitch("studio")}
          data-testid="ws-btn-studio"
          aria-label="Switch to Website Studio workspace"
        >
          <Sparkles size={15} className="od-ws-icon" />
          <span className="od-ws-label">Website Studio</span>
          <span className="od-ws-highlight">VISUAL CMS</span>
        </button>
      </div>
    </div>
  );
}

export default WorkspaceSwitcher;

