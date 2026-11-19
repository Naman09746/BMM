import React, { useState } from "react";
import { X, Rocket, Check, Loader2, AlertCircle, FileText } from "lucide-react";

export function PublishModal({ isOpen, onClose, onConfirmPublish, isPublishing }) {
  const [note, setNote] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirmPublish(note.trim() || "Published via Website Studio");
  };

  return (
    <div className="ws-modal-backdrop" data-testid="publish-modal">
      <div className="ws-modal-card ws-publish-modal">
        {/* Header */}
        <div className="ws-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="ws-modal-icon-badge ws-icon-badge--rocket"><Rocket size={18} /></div>
            <div>
              <h2 className="ws-modal-title">Publish to Live Website</h2>
              <p className="ws-modal-subtitle">Push all staged draft changes live. Changes reflect immediately across all visitors without a code rebuild.</p>
            </div>
          </div>
          <button type="button" className="ws-modal-close" onClick={onClose} disabled={isPublishing}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ws-publish-body">
            <div className="ws-callout-info">
              <AlertCircle size={18} />
              <div>
                <strong>Zero-Downtime Instant Propagation:</strong>
                <p>An immutable version snapshot will be created in the database. You can rollback to any previous version at any time from Version History.</p>
              </div>
            </div>

            <label className="od-field" style={{ marginTop: 14 }}>
              <span>Release Note / Change Summary (Optional)</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Refreshed hero video, updated Living Studio amenities & stays copy"
                disabled={isPublishing}
                data-testid="publish-note-input"
                autoFocus
              />
            </label>
          </div>

          <div className="ws-modal-footer">
            <button type="button" className="ws-btn ws-btn--ghost" onClick={onClose} disabled={isPublishing}>
              Cancel
            </button>
            <button
              type="submit"
              className="ws-btn ws-btn--primary ws-btn--publish-cta"
              disabled={isPublishing}
              data-testid="confirm-publish-btn"
            >
              {isPublishing ? <Loader2 size={15} className="od-spin" /> : <Rocket size={15} />}
              <span>{isPublishing ? "Publishing Live..." : "Publish Live Website"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PublishModal;

