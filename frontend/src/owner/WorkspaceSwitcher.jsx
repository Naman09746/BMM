import React from "react";
import { Building, Sparkles, ArrowRight } from "lucide-react";

export function WorkspaceSwitcher({ activeWorkspace, onSwitch }) {
  return (
    <div className="od-ws-switcher" data-testid="workspace-switcher" role="navigation" aria-label="Workspace Switcher">
      <div className="od-ws-pills">
        <button
          type="button"
          className={`od-ws-pill ${activeWorkspace === "business" ? "is-active" : ""}`}
          onClick={() => onSwitch("business")}
          data-testid="ws-btn-business"
        >
          <Building size={15} />
          <span>Business Operations</span>
          <span className="od-ws-subtag">Bookings & CRM</span>
        </button>

        <button
          type="button"
          className={`od-ws-pill ${activeWorkspace === "studio" ? "is-active" : ""}`}
          onClick={() => onSwitch("studio")}
          data-testid="ws-btn-studio"
        >
          <Sparkles size={15} />
          <span>Website Studio</span>
          <span className="od-ws-highlight">VISUAL CMS</span>
        </button>
      </div>
    </div>
  );
}

export default WorkspaceSwitcher;

