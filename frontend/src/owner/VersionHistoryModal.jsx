import React, { useState, useEffect, useCallback } from "react";
import { X, History, RotateCcw, Check, Loader2, Calendar, User, FileText, AlertTriangle } from "lucide-react";
import { api } from "../stays/store";

export function VersionHistoryModal({ isOpen, onClose, onRollbackComplete }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rollingBackId, setRollingBackId] = useState(null);
  const [error, setError] = useState("");
  const [confirmVersion, setConfirmVersion] = useState(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api("/admin/studio/versions");
      setVersions(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err.message || "Failed to load version snapshots");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, loadVersions]);

  const handleRollback = async (ver) => {
    if (!ver) return;
    setRollingBackId(ver.version_id);
    setError("");
    try {
      await api(`/admin/studio/rollback/${encodeURIComponent(ver.version_id)}`, { method: "POST" });
      setConfirmVersion(null);
      if (onRollbackComplete) {
        await onRollbackComplete(ver.version_id);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Rollback failed");
    } finally {
      setRollingBackId(null);
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="ws-modal-backdrop" data-testid="version-history-modal">
      <div className="ws-modal-card ws-history-modal">
        {/* Header */}
        <div className="ws-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="ws-modal-icon-badge"><History size={18} /></div>
            <div>
              <h2 className="ws-modal-title">Version History & Rollback</h2>
              <p className="ws-modal-subtitle">Immutable audit trail of all published website releases with instant 1-click rollback.</p>
            </div>
          </div>
          <button type="button" className="ws-modal-close" onClick={onClose} data-testid="close-history-modal">
            <X size={18} />
          </button>
        </div>

        {error && <div className="ws-alert ws-alert--error">{error}</div>}

        {/* Confirmation Banner */}
        {confirmVersion && (
          <div className="ws-confirm-banner" data-testid="rollback-confirm-banner">
            <AlertTriangle size={18} />
            <div style={{ flex: 1 }}>
              <strong>Confirm Rollback to Snapshot #{confirmVersion.version_id.slice(-6)}?</strong>
              <p>This will restore the public website content to the snapshot from {fmtTime(confirmVersion.created_at)}.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="ws-btn ws-btn--ghost"
                onClick={() => setConfirmVersion(null)}
                disabled={Boolean(rollingBackId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ws-btn ws-btn--danger"
                onClick={() => handleRollback(confirmVersion)}
                disabled={Boolean(rollingBackId)}
                data-testid="confirm-rollback-btn"
              >
                {rollingBackId ? <Loader2 size={13} className="od-spin" /> : <RotateCcw size={13} />}
                <span>{rollingBackId ? "Restoring..." : "Yes, Restore Now"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Body / Timeline */}
        <div className="ws-history-body">
          {loading ? (
            <div className="ws-center-box"><Loader2 size={24} className="od-spin" /><p>Loading version snapshots...</p></div>
          ) : versions.length === 0 ? (
            <div className="ws-empty-box">
              <History size={36} />
              <p>No version snapshots found yet.</p>
              <span>Every time you click "Publish Changes", a rollback snapshot will be automatically recorded here.</span>
            </div>
          ) : (
            <div className="ws-timeline">
              {versions.map((ver, idx) => {
                const isLatest = idx === 0;
                return (
                  <div key={ver.version_id} className={`ws-timeline-item ${isLatest ? "is-latest" : ""}`} data-testid={`version-item-${ver.version_id}`}>
                    <div className="ws-timeline-node">
                      <div className="ws-timeline-dot">{isLatest ? <Check size={11} /> : null}</div>
                    </div>

                    <div className="ws-timeline-content">
                      <div className="ws-timeline-top">
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span className="ws-ver-id">#{ver.version_id.slice(-6)}</span>
                          {isLatest && <span className="ws-pill-live">CURRENT LIVE VERSION</span>}
                          <span className="ws-timeline-date"><Calendar size={12} /> {fmtTime(ver.created_at)}</span>
                        </div>

                        {!isLatest && (
                          <button
                            type="button"
                            className="ws-btn ws-btn--secondary ws-btn--sm"
                            onClick={() => setConfirmVersion(ver)}
                            disabled={Boolean(rollingBackId)}
                            data-testid={`rollback-btn-${ver.version_id}`}
                          >
                            <RotateCcw size={12} /> Rollback
                          </button>
                        )}
                      </div>

                      <p className="ws-timeline-note">
                        <FileText size={13} /> {ver.note || "Published release"}
                      </p>

                      <div className="ws-timeline-meta">
                        <span><User size={12} /> {ver.created_by || "Admin"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ws-modal-footer">
          <button type="button" className="ws-btn ws-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default VersionHistoryModal;

