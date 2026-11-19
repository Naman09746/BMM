import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ExternalLink,
  Image as ImageIcon,
  Plus,
  Trash2,
  UploadCloud,
  Check,
  Loader2,
  RefreshCw,
  Search,
  ArrowRight,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Rocket,
  History,
  Globe,
  Film,
  Building,
  Sparkles,
  Info,
  X,
  LogOut,
  Layers,
  Sun,
  Moon
} from "lucide-react";
import { api, useAuth, resolveBackendMedia } from "../stays/store";
import { publicAsset } from "../wordpress";
import {
  DEFAULT_HERO,
  DEFAULT_APPROACH,
  DEFAULT_CLIENTS,
  DEFAULT_DIVISIONS,
  DEFAULT_ABOUT,
  DEFAULT_LIVING_STUDIO,
} from "../contentStore";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import MediaLibraryModal from "./MediaLibraryModal";
import SeoManagerModal from "./SeoManagerModal";
import VersionHistoryModal from "./VersionHistoryModal";
import PublishModal from "./PublishModal";
import VisualScreenDirectory from "./VisualScreenDirectory";
import "./websiteStudio.css";

export function WebsiteStudio({ onSwitchWorkspace, theme = "dark", onToggleTheme }) {
  const { user, logout } = useAuth();

  // Navigation & Viewport state
  const [viewport, setViewport] = useState("desktop"); // "desktop" | "tablet" | "mobile"

  // Content state
  const [publishedContent, setPublishedContent] = useState(null);
  const [draftContent, setDraftContent] = useState({
    hero: DEFAULT_HERO,
    approach: DEFAULT_APPROACH,
    clients: DEFAULT_CLIENTS,
    divisions: DEFAULT_DIVISIONS,
    about: DEFAULT_ABOUT,
    living_studio: DEFAULT_LIVING_STUDIO,
    seo: {},
  });
  const [hasServerUnpublished, setHasServerUnpublished] = useState(false);
  const [hasLocalDirty, setHasLocalDirty] = useState(false);
  const [lastPublishedAt, setLastPublishedAt] = useState(null);
  const [versionsCount, setVersionsCount] = useState(0);

  // UI status
  const [loading, setLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState("");

  // Modals state
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaSelectCallback, setMediaSelectCallback] = useState(null);
  const [seoModalOpen, setSeoModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // Load state from backend studio endpoints
  const loadStudioState = useCallback(async () => {
    setLoading(true);
    try {
      const studioState = await api("/admin/studio/state").catch(() => null);

      if (studioState && typeof studioState === "object") {
        setPublishedContent(studioState.published);
        setDraftContent(studioState.draft || studioState.published);
        setHasServerUnpublished(Boolean(studioState.has_unpublished_changes));
        setLastPublishedAt(studioState.last_published_at);
        setVersionsCount(studioState.versions_count || 0);
        setHasLocalDirty(false);
      }
    } catch (err) {
      console.error("Failed to load studio state", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudioState();
  }, [loadStudioState]);

  // Update draft in local state and mark local changes
  const updateDraft = useCallback((updater) => {
    setDraftContent((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      return next;
    });
    setHasLocalDirty(true);
  }, []);

  // Save Draft to Backend
  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    try {
      await api("/admin/studio/draft", {
        method: "PUT",
        body: { content: draftContent },
      });
      setHasLocalDirty(false);
      setHasServerUnpublished(true);
      showToast("Draft saved successfully to studio.");
    } catch (err) {
      showToast("Failed to save draft: " + err.message);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Publish Draft to Live Site
  const handlePublish = async (note) => {
    setIsPublishing(true);
    try {
      const res = await api("/admin/studio/publish", {
        method: "POST",
        body: { note, content: draftContent },
      });
      setPublishedContent(draftContent);
      setHasLocalDirty(false);
      setHasServerUnpublished(false);
      setLastPublishedAt(res.published_at);
      setVersionsCount((c) => c + 1);
      setPublishModalOpen(false);
      showToast("Changes published LIVE to the website!");
    } catch (err) {
      alert("Publish failed: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  // Rollback Complete Callback
  const handleRollbackComplete = async (versionId) => {
    await loadStudioState();
    showToast(`Restored snapshot #${versionId.slice(-6)} successfully!`);
  };

  // Helper to open media picker for a specific field
  const openMediaPicker = (onSelect) => {
    setMediaSelectCallback(() => (url) => {
      onSelect(url);
      setHasLocalDirty(true);
    });
    setMediaModalOpen(true);
  };

  return (
    <div className={`ws-page theme-${theme}`} data-theme={theme} data-testid="website-studio">
      {/* Top Main Navigation Header */}
      <header className="ws-header" data-testid="studio-header">
        {/* Left: Branding & Workspace Switcher */}
        <div className="ws-brand-area">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="ws-brand-title">BDS MARVEL</h1>
            <span className="ws-badge-studio">WEBSITE STUDIO</span>
          </div>

          <WorkspaceSwitcher
            activeWorkspace="studio"
            onSwitch={(ws) => {
              if (ws === "business") onSwitchWorkspace?.("business");
            }}
          />
        </div>

        {/* Center: Device Viewport Switcher */}
        <div className="ws-controls-center">
          <div className="ws-viewport-switch" data-testid="viewport-switcher" role="group" aria-label="Device Viewport">
            <button
              type="button"
              className={`ws-vp-btn ${viewport === "desktop" ? "is-active" : ""}`}
              onClick={() => setViewport("desktop")}
              title="Desktop (100% full width)"
              data-testid="viewport-desktop"
            >
              <Monitor size={14} />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              className={`ws-vp-btn ${viewport === "tablet" ? "is-active" : ""}`}
              onClick={() => setViewport("tablet")}
              title="Tablet View (768px)"
              data-testid="viewport-tablet"
            >
              <Tablet size={14} />
              <span>Tablet</span>
            </button>
            <button
              type="button"
              className={`ws-vp-btn ${viewport === "mobile" ? "is-active" : ""}`}
              onClick={() => setViewport("mobile")}
              title="Mobile View (375px)"
              data-testid="viewport-mobile"
            >
              <Smartphone size={14} />
              <span>Mobile</span>
            </button>
          </div>
        </div>

        {/* Right: Studio Status & Publish Controls */}
        <div className="ws-actions-right">
          {/* Status Pill */}
          {hasLocalDirty ? (
            <span className="ws-status-pill ws-status-pill--dirty" title="Local edits in browser">
              <span className="ws-status-dot" /> Unsaved Edits
            </span>
          ) : hasServerUnpublished ? (
            <span className="ws-status-pill ws-status-pill--draft" title="Draft saved on server, ready to publish">
              <span className="ws-status-dot" /> Draft Staged
            </span>
          ) : (
            <span className="ws-status-pill ws-status-pill--published" title="Live website in sync">
              <span className="ws-status-dot" /> Live Published
            </span>
          )}

          {/* Media Library */}
          <button
            type="button"
            className="ws-btn ws-btn--secondary"
            onClick={() => {
              setMediaSelectCallback(null);
              setMediaModalOpen(true);
            }}
            data-testid="open-media-library-btn"
          >
            <ImageIcon size={14} />
            <span>Media Library</span>
          </button>

          {/* Page SEO */}
          <button
            type="button"
            className="ws-btn ws-btn--secondary"
            onClick={() => setSeoModalOpen(true)}
            data-testid="open-seo-btn"
          >
            <Globe size={14} />
            <span>Page SEO</span>
          </button>

          {/* Version History */}
          <button
            type="button"
            className="ws-btn ws-btn--secondary"
            onClick={() => setHistoryModalOpen(true)}
            title="Version History & Rollback"
            data-testid="open-history-btn"
          >
            <History size={14} />
            <span>History ({versionsCount})</span>
          </button>

          {/* Save Draft */}
          <button
            type="button"
            className="ws-btn ws-btn--ghost"
            onClick={handleSaveDraft}
            disabled={isSavingDraft || !hasLocalDirty}
            data-testid="save-draft-btn"
          >
            {isSavingDraft ? <Loader2 size={13} className="od-spin" /> : null}
            <span>Save Draft</span>
          </button>

          {/* Publish Changes */}
          <button
            type="button"
            className="ws-btn ws-btn--publish"
            onClick={() => setPublishModalOpen(true)}
            disabled={isPublishing}
            data-testid="open-publish-modal-btn"
          >
            <Rocket size={14} />
            <span>Publish Live</span>
          </button>

          {/* Theme Toggle Button */}
          {onToggleTheme && (
            <button
              type="button"
              className="ws-btn ws-btn--secondary ws-btn--theme"
              onClick={onToggleTheme}
              title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
              data-testid="studio-theme-toggle"
              aria-label="Toggle dark/light theme"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
          )}

          {/* Sign Out */}
          <button
            type="button"
            className="ws-btn ws-btn--ghost"
            onClick={logout}
            title="Sign out of Admin"
            style={{ padding: "8px 10px" }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Toast Alert */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 300, background: "var(--ws-gold)", color: "#0e0d0b", padding: "10px 22px", borderRadius: 999, fontWeight: 700, fontSize: 13, boxShadow: "0 6px 24px rgba(0,0,0,0.4)" }}>
          {toast}
        </div>
      )}

      {/* Main Workspace Canvas Container: Renders all 7 Screens with full sub-screen detail */}
      <div className="ws-workspace" style={{ background: "#0e0d0b", padding: "24px 16px 80px", display: "flex", justifyContent: "center" }}>
        <div className={`ws-viewport-frame is-${viewport}`} style={{ width: "100%", background: "var(--od-paper)", color: "var(--od-ink)", padding: 24, borderRadius: 16 }}>
          {loading ? (
            <div className="ws-center-box"><Loader2 size={26} className="od-spin" /><p>Loading Website Studio Screens...</p></div>
          ) : (
            <VisualScreenDirectory initialScreen="home" />
          )}
        </div>
      </div>

      {/* Central Media Library Modal */}
      <MediaLibraryModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelectMedia={mediaSelectCallback}
      />

      {/* SEO Settings Modal */}
      <SeoManagerModal
        isOpen={seoModalOpen}
        onClose={() => setSeoModalOpen(false)}
        seoData={draftContent.seo || {}}
        onSaveSeo={(newSeo) => {
          updateDraft({ seo: newSeo });
          showToast("SEO settings updated in draft.");
        }}
        onOpenMediaLibrary={openMediaPicker}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        onRollbackComplete={handleRollbackComplete}
      />

      {/* Publish Confirmation Modal */}
      <PublishModal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        onConfirmPublish={handlePublish}
        isPublishing={isPublishing}
      />
    </div>
  );
}

export default WebsiteStudio;
