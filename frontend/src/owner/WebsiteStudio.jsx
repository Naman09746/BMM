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
  Edit3,
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
  Layers,
  BedDouble,
  Boxes,
  FileText,
  Sliders,
  LogOut
} from "lucide-react";
import { api, useAuth, resolveBackendMedia } from "../stays/store";
import { publicAsset } from "../wordpress";
import { img } from "../App";
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
import "./websiteStudio.css";

const SCREENS = [
  { id: "home", num: "01", name: "Homepage", path: "/" },
  { id: "stays", num: "02", name: "Luxury Stays", path: "/stays" },
  { id: "projects", num: "03", name: "Projects & Work", path: "/projects" },
  { id: "catalogue", num: "04", name: "Materials Catalogue", path: "/catalogue" },
  { id: "divisions", num: "05", name: "Divisions", path: "/businesses/marble-and-stone" },
  { id: "about", num: "06", name: "About Studio", path: "/about" },
  { id: "clients", num: "07", name: "Clientele & Logos", path: "/contact" },
];

export function WebsiteStudio({ onSwitchWorkspace }) {
  const { user, logout } = useAuth();

  // Navigation & Viewport state
  const [activeScreen, setActiveScreen] = useState("home");
  const [viewport, setViewport] = useState("desktop"); // "desktop" | "tablet" | "mobile"
  const [mode, setMode] = useState("edit"); // "edit" | "preview"

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

  // Collections state for rich site preview
  const [stays, setStays] = useState([]);
  const [projects, setProjects] = useState([]);
  const [catalogue, setCatalogue] = useState([]);

  // UI status
  const [loading, setLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState("");

  // Inspector state
  const [selectedElement, setSelectedElement] = useState(null); // { type, id, title }

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
      const [studioState, staysData, projData, catData] = await Promise.all([
        api("/admin/studio/state").catch(() => null),
        api("/stays?all=true").catch(() => []),
        api("/projects?all=true").catch(() => []),
        api("/catalogue?all=true").catch(() => []),
      ]);

      setStays(Array.isArray(staysData) ? staysData : []);
      setProjects(Array.isArray(projData) ? projData : []);
      setCatalogue(Array.isArray(catData) ? catData : []);

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
    setSelectedElement(null);
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

  // Helper to open live website pages in a new tab
  const openLivePage = (path) => {
    window.open(path, "_blank");
  };

  const activeScreenMeta = useMemo(() => {
    return SCREENS.find((s) => s.id === activeScreen) || SCREENS[0];
  }, [activeScreen]);

  return (
    <div className={`ws-page ws-mode-${mode}`} data-testid="website-studio">
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

        {/* Center: Device Viewport & Mode Switcher */}
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

          <div className="ws-mode-switch" data-testid="mode-switcher" role="group" aria-label="Editor Mode">
            <button
              type="button"
              className={`ws-mode-btn ${mode === "edit" ? "is-active" : ""}`}
              onClick={() => setMode("edit")}
              data-testid="mode-edit"
            >
              <Edit3 size={13} />
              <span>Click to Edit</span>
            </button>
            <button
              type="button"
              className={`ws-mode-btn ${mode === "preview" ? "is-active" : ""}`}
              onClick={() => {
                setMode("preview");
                setSelectedElement(null);
              }}
              data-testid="mode-preview"
            >
              <Eye size={13} />
              <span>Live Preview</span>
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

      {/* Screen / Page Selection Bar */}
      <nav className="ws-page-rail" aria-label="Page Directory">
        <div className="ws-page-tabs">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`ws-page-tab ${activeScreen === s.id ? "is-active" : ""}`}
              onClick={() => {
                setActiveScreen(s.id);
                setSelectedElement(null);
              }}
              data-testid={`studio-screen-${s.id}`}
            >
              <span className="ws-page-tab-num">{s.num}</span>
              <span>{s.name}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="ws-btn ws-btn--ghost"
          onClick={() => openLivePage(activeScreenMeta.path)}
          style={{ fontSize: 11, padding: "4px 10px" }}
          data-testid="view-live-screen-btn"
        >
          <span>View Public Page</span>
          <ExternalLink size={12} />
        </button>
      </nav>

      {/* Toast Alert */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 300, background: "var(--ws-gold)", color: "#0e0d0b", padding: "10px 22px", borderRadius: 999, fontWeight: 700, fontSize: 13, boxShadow: "0 6px 24px rgba(0,0,0,0.4)" }}>
          {toast}
        </div>
      )}

      {/* Main Workspace Layout (Canvas + Contextual Inspector) */}
      <div className="ws-workspace">
        {/* Canvas Area with Responsive Frame */}
        <div className="ws-canvas-wrap">
          <div className={`ws-viewport-frame is-${viewport}`}>
            {loading ? (
              <div className="ws-center-box"><Loader2 size={26} className="od-spin" /><p>Loading Website Studio Canvas...</p></div>
            ) : (
              <VisualCanvas
                screen={activeScreen}
                content={draftContent}
                stays={stays}
                projects={projects}
                catalogue={catalogue}
                mode={mode}
                selectedElement={selectedElement}
                onSelectElement={(el) => setSelectedElement(el)}
              />
            )}
          </div>
        </div>

        {/* Right Docked Inspector Panel */}
        {selectedElement && mode === "edit" && (
          <aside className="ws-inspector" data-testid="studio-inspector">
            <div className="ws-inspector-head">
              <h3 className="ws-inspector-title">
                <Sliders size={15} />
                <span>{selectedElement.title}</span>
              </h3>
              <button
                type="button"
                className="ws-modal-close"
                onClick={() => setSelectedElement(null)}
                data-testid="close-inspector-btn"
              >
                <X size={16} />
              </button>
            </div>

            <div className="ws-inspector-body">
              <InspectorForm
                element={selectedElement}
                content={draftContent}
                onUpdateDraft={updateDraft}
                onOpenMediaPicker={openMediaPicker}
              />
            </div>
          </aside>
        )}
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

// ---------------------------------------------------------------------------
// VISUAL CANVAS (Matching Public Website Layout with Click-to-Edit Hooks)
// ---------------------------------------------------------------------------
function VisualCanvas({ screen, content, stays, projects, catalogue, mode, selectedElement, onSelectElement }) {
  const triggerSelect = (type, id, title, data = {}) => {
    if (mode !== "edit") return;
    onSelectElement({ type, id, title, data });
  };

  if (screen === "home") {
    const hero = content.hero || DEFAULT_HERO;
    const approach = content.approach || DEFAULT_APPROACH;
    const livingStudio = content.living_studio || DEFAULT_LIVING_STUDIO;

    return (
      <div className="ws-live-page" style={{ padding: "40px 32px 80px" }}>
        {/* Section 01: Hero Headline & Media */}
        <section
          className={`ws-editable ${selectedElement?.id === "hero" ? "is-selected" : ""}`}
          onClick={() => triggerSelect("hero", "hero", "Homepage Hero Section", hero)}
          style={{ padding: "40px 30px", background: "#11100e", color: "#fff", borderRadius: 16, marginBottom: 36, position: "relative" }}
          data-testid="canvas-hero"
        >
          <span className="ws-edit-pill"><Edit3 size={11} /> Edit Hero</span>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "var(--ws-gold)", marginBottom: 12 }}>
            {hero.eyebrow || "BDSM · BDS MARVEL"}
          </div>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "clamp(34px, 5vw, 54px)", fontWeight: 500, lineHeight: 1.1, margin: "0 0 16px" }}>
            {hero.title_1 || "Architecture."} <br />
            <em>{hero.title_2 || "Interiors."}</em> <br />
            {hero.title_3 || "Everything In Between."}
          </h1>
          <p style={{ maxWidth: 640, color: "#a59d90", fontSize: 15, lineHeight: 1.6, margin: "0 0 24px" }}>
            {hero.subtitle || "One design and build studio for marble and stone, flooring, turnkey construction and interior design."}
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", background: "var(--ws-gold)", color: "#0e0d0b", padding: "10px 22px", borderRadius: 999, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              Explore Stays
            </span>
            <span style={{ display: "inline-flex", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "10px 22px", borderRadius: 999, fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
              View Projects
            </span>
          </div>
        </section>

        {/* Section 02: Craft Philosophy (5 Pillars) */}
        <section style={{ marginBottom: 44 }}>
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#8a8172", fontWeight: 700 }}>01 — HOW WE BUILD</span>
            <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 32, margin: "4px 0 0" }}>The 5 Craft Philosophy Pillars</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {approach.map((pillar, idx) => {
              const pId = `pillar_${idx}`;
              const isSelected = selectedElement?.id === pId;
              return (
                <article
                  key={pillar.number || idx}
                  className={`ws-editable ${isSelected ? "is-selected" : ""}`}
                  onClick={() => triggerSelect("pillar", pId, `Pillar ${pillar.number || idx + 1}: ${pillar.title}`, { index: idx, pillar })}
                  style={{ background: "#fff", border: "1px solid #e3dbcc", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}
                  data-testid={`canvas-pillar-${idx}`}
                >
                  <span className="ws-edit-pill"><Edit3 size={11} /> Edit Pillar</span>
                  <div style={{ aspectRatio: "16/10", overflow: "hidden", background: "#0e0d0b" }}>
                    <img src={img(pillar.image, 400)} alt={pillar.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ padding: 14, flex: 1, display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ws-gold)", letterSpacing: 1 }}>{pillar.number || `0${idx + 1}`}</span>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: "4px 0 6px" }}>{pillar.title}</h3>
                    <p style={{ fontSize: 12, color: "#6f685c", lineHeight: 1.5, margin: 0 }}>{pillar.text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Section 03: Living Studio Spotlight */}
        <section
          className={`ws-editable ${selectedElement?.id === "living_studio" ? "is-selected" : ""}`}
          onClick={() => triggerSelect("living_studio", "living_studio", "Living Studio Spotlight", livingStudio)}
          style={{ background: "#1b1916", color: "#fff", borderRadius: 16, overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", position: "relative" }}
          data-testid="canvas-living-studio"
        >
          <span className="ws-edit-pill"><Edit3 size={11} /> Edit Showcase</span>
          <div style={{ padding: 32, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--ws-gold)", fontWeight: 700 }}>
              {livingStudio.kicker || "STAYABLE SHOWROOM"}
            </span>
            <h2 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 32, margin: "8px 0 12px", lineHeight: 1.2 }}>
              {livingStudio.tagline || "Not a showroom — a home we built ourselves."}
            </h2>
            <p style={{ color: "#a59d90", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 18px" }}>
              {livingStudio.body || "A guesthouse we built ourselves — our own stone, flooring, finishes and furniture throughout."}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(livingStudio.details || ["Three suites", "Material library", "Hosted walkthroughs"]).map((d) => (
                <span key={d} style={{ fontSize: 11, background: "rgba(255,255,255,0.08)", padding: "4px 12px", borderRadius: 999 }}>{d}</span>
              ))}
            </div>
          </div>
          <div style={{ aspectRatio: "16/10", overflow: "hidden" }}>
            <img src={img(livingStudio.hero, 700)} alt="Living Studio" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </section>
      </div>
    );
  }

  if (screen === "stays") {
    return (
      <div className="ws-live-page" style={{ padding: "40px 32px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#8a8172", fontWeight: 700 }}>02 — LUXURY STAYS</span>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 36, margin: "4px 0 8px" }}>Stay Inside What We Built</h1>
          <p style={{ color: "#6f685c", fontSize: 14 }}>Full homes built end-to-end with our stone, floors, and bespoke joinery.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {stays.map((s, idx) => (
            <article
              key={s.slug || idx}
              className={`ws-editable ${selectedElement?.id === `stay_${s.slug}` ? "is-selected" : ""}`}
              onClick={() => triggerSelect("stay", `stay_${s.slug}`, `Stay: ${s.name}`, { stay: s, index: idx })}
              style={{ background: "#fff", border: "1px solid #e3dbcc", borderRadius: 16, overflow: "hidden" }}
              data-testid={`canvas-stay-${s.slug}`}
            >
              <span className="ws-edit-pill"><Edit3 size={11} /> Edit Stay</span>
              <div style={{ aspectRatio: "16/10", overflow: "hidden", background: "#0e0d0b" }}>
                <img src={img(s.hero, 600)} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ws-gold)", textTransform: "uppercase" }}>{s.tier || "Premium"}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{s.price || "₹28,000"} <small style={{ fontSize: 10, color: "#8a8172" }}>/ night</small></span>
                </div>
                <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, margin: "0 0 4px" }}>{s.name}</h3>
                <p style={{ fontSize: 12, color: "#8a8172", margin: "0 0 10px" }}>{s.location}</p>
                <p style={{ fontSize: 12.5, color: "#6f685c", lineHeight: 1.5, margin: 0 }}>{s.blurb || s.description?.slice(0, 90) + "..."}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "projects") {
    return (
      <div className="ws-live-page" style={{ padding: "40px 32px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#8a8172", fontWeight: 700 }}>03 — ARCHITECTURAL WORK</span>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 36, margin: "4px 0 8px" }}>Selected Projects</h1>
          <p style={{ color: "#6f685c", fontSize: 14 }}>Twenty years of facade engineering, commercial concourses, and bespoke villas.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {projects.map((p, idx) => (
            <article
              key={p.slug || idx}
              className={`ws-editable ${selectedElement?.id === `proj_${p.slug}` ? "is-selected" : ""}`}
              onClick={() => triggerSelect("project", `proj_${p.slug}`, `Project: ${p.title}`, { project: p, index: idx })}
              style={{ background: "#fff", border: "1px solid #e3dbcc", borderRadius: 16, overflow: "hidden" }}
              data-testid={`canvas-project-${p.slug}`}
            >
              <span className="ws-edit-pill"><Edit3 size={11} /> Edit Project</span>
              <div style={{ aspectRatio: "16/10", overflow: "hidden", background: "#0e0d0b" }}>
                <img src={img(p.image, 600)} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ padding: 18 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ws-gold)", letterSpacing: 1.5, textTransform: "uppercase" }}>
                  {p.segment} · {p.category}
                </span>
                <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 22, margin: "6px 0 4px" }}>{p.title}</h3>
                <p style={{ fontSize: 12, color: "#8a8172", margin: "0 0 10px" }}>{p.location} ({p.year})</p>
                <p style={{ fontSize: 12.5, color: "#6f685c", lineHeight: 1.5, margin: 0 }}>{p.description?.slice(0, 110)}...</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "catalogue") {
    return (
      <div className="ws-live-page" style={{ padding: "40px 32px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#8a8172", fontWeight: 700 }}>04 — MATERIALS CATALOGUE</span>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 36, margin: "4px 0 8px" }}>The Stone & Surface Library</h1>
          <p style={{ color: "#6f685c", fontSize: 14 }}>Hand-carved architectural elements, pietra dura, SPC flooring, and joinery.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {catalogue.slice(0, 16).map((item, idx) => (
            <article
              key={item.slug || idx}
              className={`ws-editable ${selectedElement?.id === `cat_${item.slug}` ? "is-selected" : ""}`}
              onClick={() => triggerSelect("catalogue", `cat_${item.slug}`, `Catalogue: ${item.name}`, { item, index: idx })}
              style={{ background: "#fff", border: "1px solid #e3dbcc", borderRadius: 14, overflow: "hidden" }}
              data-testid={`canvas-catalogue-${item.slug}`}
            >
              <span className="ws-edit-pill"><Edit3 size={11} /> Edit Product</span>
              <div style={{ aspectRatio: "1", overflow: "hidden", background: "#0e0d0b" }}>
                <img src={img(item.image, 400)} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ padding: 14 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ws-gold)", textTransform: "uppercase" }}>{item.brand}</span>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: "4px 0" }}>{item.name}</h3>
                <p style={{ fontSize: 11.5, color: "#8a8172", margin: 0 }}>{item.origin || item.material}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "divisions") {
    const divisions = content.divisions || DEFAULT_DIVISIONS;
    return (
      <div className="ws-live-page" style={{ padding: "40px 32px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#8a8172", fontWeight: 700 }}>05 — SPECIALIZED TRADES</span>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 36, margin: "4px 0 8px" }}>Four In-House Divisions</h1>
          <p style={{ color: "#6f685c", fontSize: 14 }}>One contract, one accountable team, from facade to floor to furniture.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {divisions.map((d, idx) => (
            <article
              key={d.slug || idx}
              className={`ws-editable ${selectedElement?.id === `div_${d.slug}` ? "is-selected" : ""}`}
              onClick={() => triggerSelect("division", `div_${d.slug}`, `Division: ${d.name}`, { division: d, index: idx })}
              style={{ background: "#fff", border: "1px solid #e3dbcc", borderRadius: 16, overflow: "hidden" }}
              data-testid={`canvas-division-${d.slug}`}
            >
              <span className="ws-edit-pill"><Edit3 size={11} /> Edit Division</span>
              <div style={{ aspectRatio: "16/10", overflow: "hidden", background: "#0e0d0b" }}>
                <img src={img(d.hero, 600)} alt={d.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ padding: 18 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ws-gold)", letterSpacing: 1.5, textTransform: "uppercase" }}>{d.kicker || "SPECIALIZED TRADE"}</span>
                <h3 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 24, margin: "6px 0 4px" }}>{d.name}</h3>
                <p style={{ fontSize: 13, fontStyle: "italic", color: "#8a8172", margin: "0 0 10px" }}>{d.tagline}</p>
                <p style={{ fontSize: 12.5, color: "#6f685c", lineHeight: 1.5, margin: 0 }}>{d.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (screen === "about") {
    const about = content.about || DEFAULT_ABOUT;
    return (
      <div className="ws-live-page" style={{ padding: "40px 32px 80px" }}>
        <section
          className={`ws-editable ${selectedElement?.id === "about_story" ? "is-selected" : ""}`}
          onClick={() => triggerSelect("about", "about_story", "About Studio Narrative", about)}
          style={{ background: "#fff", border: "1px solid #e3dbcc", borderRadius: 16, padding: 32, marginBottom: 32 }}
          data-testid="canvas-about-story"
        >
          <span className="ws-edit-pill"><Edit3 size={11} /> Edit Story</span>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#8a8172", fontWeight: 700 }}>06 — STUDIO MANIFESTO</span>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 36, margin: "6px 0 16px" }}>Twenty Years of Craft & Structure</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "#2c2825", marginBottom: 14 }}>{about.lede_1}</p>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#6f685c", margin: 0 }}>{about.lede_2}</p>
        </section>
      </div>
    );
  }

  if (screen === "clients") {
    const clients = content.clients || DEFAULT_CLIENTS;
    return (
      <div className="ws-live-page" style={{ padding: "40px 32px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#8a8172", fontWeight: 700 }}>07 — CLIENTELE & CONTACT</span>
          <h1 style={{ fontFamily: "Cormorant Garamond, serif", fontSize: 36, margin: "4px 0 8px" }}>Institutional Clientele</h1>
          <p style={{ color: "#6f685c", fontSize: 14 }}>Trusted by India's leading hotel groups, civic authorities, and developers.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
          {clients.map((c, idx) => (
            <article
              key={c.name || idx}
              className={`ws-editable ${selectedElement?.id === `client_${idx}` ? "is-selected" : ""}`}
              onClick={() => triggerSelect("client", `client_${idx}`, `Client Logo: ${c.name}`, { client: c, index: idx })}
              style={{ background: "#fff", border: "1px solid #e3dbcc", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
              data-testid={`canvas-client-${idx}`}
            >
              <span className="ws-edit-pill"><Edit3 size={11} /> Edit Logo</span>
              <div style={{ height: 50, display: "grid", placeItems: "center", marginBottom: 10 }}>
                <img src={publicAsset(c.logo)} alt={c.name} style={{ maxHeight: 42, maxWidth: 120, objectFit: "contain" }} />
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#2c2825" }}>{c.name}</span>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// CONTEXTUAL INSPECTOR FORM (Live Bidirectional Editor for Selected Elements)
// ---------------------------------------------------------------------------
function InspectorForm({ element, content, onUpdateDraft, onOpenMediaPicker }) {
  const { type, id, data } = element;

  if (type === "hero") {
    const hero = content.hero || DEFAULT_HERO;
    return (
      <div className="ws-inspector-section">
        <h4 className="ws-inspector-section-title">Hero Headlines & Video</h4>

        <label className="od-field">
          <span>Eyebrow Tagline</span>
          <input
            type="text"
            value={hero.eyebrow || ""}
            onChange={(e) => onUpdateDraft((prev) => ({ ...prev, hero: { ...prev.hero, eyebrow: e.target.value } }))}
            placeholder="BDSM · BDS MARVEL"
          />
        </label>

        <label className="od-field">
          <span>Title Line 1</span>
          <input
            type="text"
            value={hero.title_1 || ""}
            onChange={(e) => onUpdateDraft((prev) => ({ ...prev, hero: { ...prev.hero, title_1: e.target.value } }))}
            placeholder="Architecture."
          />
        </label>

        <label className="od-field">
          <span>Title Line 2 (Italicized)</span>
          <input
            type="text"
            value={hero.title_2 || ""}
            onChange={(e) => onUpdateDraft((prev) => ({ ...prev, hero: { ...prev.hero, title_2: e.target.value } }))}
            placeholder="Interiors."
          />
        </label>

        <label className="od-field">
          <span>Title Line 3</span>
          <input
            type="text"
            value={hero.title_3 || ""}
            onChange={(e) => onUpdateDraft((prev) => ({ ...prev, hero: { ...prev.hero, title_3: e.target.value } }))}
            placeholder="Everything In Between."
          />
        </label>

        <label className="od-field">
          <span>Subtitle Lede</span>
          <textarea
            rows={3}
            value={hero.subtitle || ""}
            onChange={(e) => onUpdateDraft((prev) => ({ ...prev, hero: { ...prev.hero, subtitle: e.target.value } }))}
            placeholder="One design and build studio..."
          />
        </label>
      </div>
    );
  }

  if (type === "pillar") {
    const idx = data.index;
    const pillar = content.approach?.[idx] || {};

    return (
      <div className="ws-inspector-section">
        <h4 className="ws-inspector-section-title">Pillar 0{idx + 1} Settings</h4>

        <label className="od-field">
          <span>Title</span>
          <input
            type="text"
            value={pillar.title || ""}
            onChange={(e) => {
              const next = [...(content.approach || DEFAULT_APPROACH)];
              next[idx] = { ...next[idx], title: e.target.value };
              onUpdateDraft({ approach: next });
            }}
          />
        </label>

        <label className="od-field">
          <span>Image Key / Asset</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={pillar.image || ""}
              onChange={(e) => {
                const next = [...(content.approach || DEFAULT_APPROACH)];
                next[idx] = { ...next[idx], image: e.target.value };
                onUpdateDraft({ approach: next });
              }}
            />
            <button
              type="button"
              className="ws-btn ws-btn--secondary"
              onClick={() => onOpenMediaPicker((url) => {
                const next = [...(content.approach || DEFAULT_APPROACH)];
                next[idx] = { ...next[idx], image: url };
                onUpdateDraft({ approach: next });
              })}
            >
              <ImageIcon size={13} />
            </button>
          </div>
        </label>

        <label className="od-field">
          <span>Description</span>
          <textarea
            rows={4}
            value={pillar.text || ""}
            onChange={(e) => {
              const next = [...(content.approach || DEFAULT_APPROACH)];
              next[idx] = { ...next[idx], text: e.target.value };
              onUpdateDraft({ approach: next });
            }}
          />
        </label>
      </div>
    );
  }

  if (type === "living_studio") {
    const ls = content.living_studio || DEFAULT_LIVING_STUDIO;

    return (
      <div className="ws-inspector-section">
        <h4 className="ws-inspector-section-title">Living Studio Showcase</h4>

        <label className="od-field">
          <span>Kicker</span>
          <input
            type="text"
            value={ls.kicker || ""}
            onChange={(e) => onUpdateDraft((prev) => ({ ...prev, living_studio: { ...prev.living_studio, kicker: e.target.value } }))}
          />
        </label>

        <label className="od-field">
          <span>Headline Tagline</span>
          <input
            type="text"
            value={ls.tagline || ""}
            onChange={(e) => onUpdateDraft((prev) => ({ ...prev, living_studio: { ...prev.living_studio, tagline: e.target.value } }))}
          />
        </label>

        <label className="od-field">
          <span>Hero Image Key</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={ls.hero || ""}
              onChange={(e) => onUpdateDraft((prev) => ({ ...prev, living_studio: { ...prev.living_studio, hero: e.target.value } }))}
            />
            <button
              type="button"
              className="ws-btn ws-btn--secondary"
              onClick={() => onOpenMediaPicker((url) => onUpdateDraft((prev) => ({ ...prev, living_studio: { ...prev.living_studio, hero: url } })))}
            >
              <ImageIcon size={13} />
            </button>
          </div>
        </label>

        <label className="od-field">
          <span>Body Description</span>
          <textarea
            rows={4}
            value={ls.body || ""}
            onChange={(e) => onUpdateDraft((prev) => ({ ...prev, living_studio: { ...prev.living_studio, body: e.target.value } }))}
          />
        </label>
      </div>
    );
  }

  if (type === "about") {
    const about = content.about || DEFAULT_ABOUT;

    return (
      <div className="ws-inspector-section">
        <h4 className="ws-inspector-section-title">Studio Manifesto Story</h4>

        <label className="od-field">
          <span>Main Lede Statement</span>
          <textarea
            rows={4}
            value={about.lede_1 || ""}
            onChange={(e) => onUpdateDraft((prev) => ({ ...prev, about: { ...prev.about, lede_1: e.target.value } }))}
          />
        </label>

        <label className="od-field">
          <span>Heritage / Secondary Lede</span>
          <textarea
            rows={4}
            value={about.lede_2 || ""}
            onChange={(e) => onUpdateDraft((prev) => ({ ...prev, about: { ...prev.about, lede_2: e.target.value } }))}
          />
        </label>
      </div>
    );
  }

  if (type === "client") {
    const idx = data.index;
    const client = content.clients?.[idx] || {};

    return (
      <div className="ws-inspector-section">
        <h4 className="ws-inspector-section-title">Client Brand Logo</h4>

        <label className="od-field">
          <span>Client / Institutional Name</span>
          <input
            type="text"
            value={client.name || ""}
            onChange={(e) => {
              const next = [...(content.clients || DEFAULT_CLIENTS)];
              next[idx] = { ...next[idx], name: e.target.value };
              onUpdateDraft({ clients: next });
            }}
          />
        </label>

        <label className="od-field">
          <span>Logo Asset Path</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={client.logo || ""}
              onChange={(e) => {
                const next = [...(content.clients || DEFAULT_CLIENTS)];
                next[idx] = { ...next[idx], logo: e.target.value };
                onUpdateDraft({ clients: next });
              }}
            />
            <button
              type="button"
              className="ws-btn ws-btn--secondary"
              onClick={() => onOpenMediaPicker((url) => {
                const next = [...(content.clients || DEFAULT_CLIENTS)];
                next[idx] = { ...next[idx], logo: url };
                onUpdateDraft({ clients: next });
              })}
            >
              <ImageIcon size={13} />
            </button>
          </div>
        </label>
      </div>
    );
  }

  if (type === "division") {
    const idx = data.index;
    const div = content.divisions?.[idx] || {};

    return (
      <div className="ws-inspector-section">
        <h4 className="ws-inspector-section-title">{div.name || "Division"}</h4>

        <label className="od-field">
          <span>Division Name</span>
          <input
            type="text"
            value={div.name || ""}
            onChange={(e) => {
              const next = [...(content.divisions || DEFAULT_DIVISIONS)];
              next[idx] = { ...next[idx], name: e.target.value };
              onUpdateDraft({ divisions: next });
            }}
          />
        </label>

        <label className="od-field">
          <span>Tagline</span>
          <input
            type="text"
            value={div.tagline || ""}
            onChange={(e) => {
              const next = [...(content.divisions || DEFAULT_DIVISIONS)];
              next[idx] = { ...next[idx], tagline: e.target.value };
              onUpdateDraft({ divisions: next });
            }}
          />
        </label>

        <label className="od-field">
          <span>Hero Image</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={div.hero || ""}
              onChange={(e) => {
                const next = [...(content.divisions || DEFAULT_DIVISIONS)];
                next[idx] = { ...next[idx], hero: e.target.value };
                onUpdateDraft({ divisions: next });
              }}
            />
            <button
              type="button"
              className="ws-btn ws-btn--secondary"
              onClick={() => onOpenMediaPicker((url) => {
                const next = [...(content.divisions || DEFAULT_DIVISIONS)];
                next[idx] = { ...next[idx], hero: url };
                onUpdateDraft({ divisions: next });
              })}
            >
              <ImageIcon size={13} />
            </button>
          </div>
        </label>

        <label className="od-field">
          <span>Overview Body</span>
          <textarea
            rows={4}
            value={div.body || ""}
            onChange={(e) => {
              const next = [...(content.divisions || DEFAULT_DIVISIONS)];
              next[idx] = { ...next[idx], body: e.target.value };
              onUpdateDraft({ divisions: next });
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="ws-inspector-section">
      <p style={{ color: "var(--ws-muted)", fontSize: 13, margin: 0 }}>
        Select an element on the canvas to inspect and edit its fields.
      </p>
    </div>
  );
}

export default WebsiteStudio;

