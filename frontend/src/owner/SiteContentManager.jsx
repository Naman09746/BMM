import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  UploadCloud,
  Check,
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  Plus,
  Trash2,
  Layers,
  Award,
  Sparkles,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowDownRight,
  Eye,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { api, resolveBackendMedia } from "../stays/store";
import { publicAsset } from "../wordpress";
import { img } from "../App";

const DEFAULT_HERO_STATE = {
  eyebrow: "BDSM · BDS MARVEL",
  title_1: "Architecture.",
  title_2: "Interiors.",
  title_3: "Everything In Between.",
  subtitle: "One design and build studio for marble and stone, flooring, turnkey construction and interior design.",
};

export function SiteContentManager() {
  const [content, setContent] = useState({
    hero: DEFAULT_HERO_STATE,
    approach: [],
    clients: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Navigation & Sub-Tab Hierarchy
  const [activeTab, setActiveTab] = useState("hero"); // "hero" | "pillars" | "brands"
  
  // Pillar Selection
  const [activePillarIdx, setActivePillarIdx] = useState(0);
  const [pillarViewMode, setPillarViewMode] = useState("focused"); // "focused" | "all"

  // Brand Directory Search & Filters
  const [brandSearch, setBrandSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all"); // "all" | "has_logo" | "no_logo"

  // Upload States
  const [uploadingPillarIdx, setUploadingPillarIdx] = useState(null);
  const [uploadingClientIdx, setUploadingClientIdx] = useState(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/site-content");
      setContent({
        hero: data.hero && typeof data.hero === "object" && Object.keys(data.hero).length > 0
          ? { ...DEFAULT_HERO_STATE, ...data.hero }
          : DEFAULT_HERO_STATE,
        approach: Array.isArray(data.approach) ? data.approach : [],
        clients: Array.isArray(data.clients) ? data.clients : [],
      });
    } catch (err) {
      setError(err.message || "Failed to load site content");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // --- Hero Section Handlers ---
  const handleHeroChange = (field, value) => {
    setContent((prev) => ({
      ...prev,
      hero: { ...(prev.hero || DEFAULT_HERO_STATE), [field]: value },
    }));
  };

  // --- Pillars (Approach) Handlers ---
  const handleApproachChange = (index, field, value) => {
    setContent((prev) => {
      const copy = [...prev.approach];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, approach: copy };
    });
  };

  const handleApproachUpload = async (index, file) => {
    if (!file) return;
    setUploadingPillarIdx(index);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api("/admin/media/upload", { method: "POST", body: data });
      handleApproachChange(index, "image", res.url);
    } catch (err) {
      alert("Image upload failed: " + err.message);
    } finally {
      setUploadingPillarIdx(null);
    }
  };

  const addApproach = () => {
    setContent((prev) => {
      const nextNum = String(prev.approach.length + 1).padStart(2, "0");
      const newPillars = [
        ...prev.approach,
        {
          number: nextNum,
          title: "NEW CRAFT PILLAR",
          text: "Description of your workshop craft and specification process.",
          image: "photo-1618221195710-dd6b41faaea6",
        },
      ];
      setActivePillarIdx(newPillars.length - 1);
      return { ...prev, approach: newPillars };
    });
  };

  const removeApproach = (index) => {
    if (!window.confirm("Are you sure you want to remove this story pillar?")) return;
    setContent((prev) => {
      const filtered = prev.approach.filter((_, i) => i !== index);
      // Renumber
      const renumbered = filtered.map((item, idx) => ({
        ...item,
        number: String(idx + 1).padStart(2, "0"),
      }));
      return { ...prev, approach: renumbered };
    });
    if (activePillarIdx >= content.approach.length - 1) {
      setActivePillarIdx(Math.max(0, content.approach.length - 2));
    }
  };

  const moveApproach = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= content.approach.length) return;
    setContent((prev) => {
      const copy = [...prev.approach];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      // Re-normalize numbers
      return {
        ...prev,
        approach: copy.map((item, idx) => ({
          ...item,
          number: String(idx + 1).padStart(2, "0"),
        })),
      };
    });
    setActivePillarIdx(targetIdx);
  };

  // --- Brand Logos Handlers ---
  const handleClientChange = (index, field, value) => {
    setContent((prev) => {
      const copy = [...prev.clients];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, clients: copy };
    });
  };

  const handleClientLogoUpload = async (index, file) => {
    if (!file) return;
    setUploadingClientIdx(index);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api("/admin/media/upload", { method: "POST", body: data });
      handleClientChange(index, "logo", res.url);
    } catch (err) {
      alert("Logo upload failed: " + err.message);
    } finally {
      setUploadingClientIdx(null);
    }
  };

  const addClient = () => {
    setContent((prev) => ({
      ...prev,
      clients: [{ name: "New Partner Brand", logo: "" }, ...prev.clients],
    }));
    setBrandSearch("");
    setBrandFilter("all");
  };

  const removeClient = (index) => {
    const clientName = content.clients[index]?.name || "this brand";
    if (!window.confirm(`Are you sure you want to remove "${clientName}" from the brand directory?`)) return;
    setContent((prev) => ({
      ...prev,
      clients: prev.clients.filter((_, i) => i !== index),
    }));
  };

  const moveClient = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= content.clients.length) return;
    setContent((prev) => {
      const copy = [...prev.clients];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return { ...prev, clients: copy };
    });
  };

  const resolveClientLogo = (logo) => {
    if (!logo) return "";
    if (logo.startsWith("http://") || logo.startsWith("https://") || logo.startsWith("data:")) return logo;
    if (logo.startsWith("/api/media") || logo.startsWith("/uploads/") || logo.startsWith("api/media") || logo.startsWith("uploads/")) {
      return resolveBackendMedia(logo);
    }
    return publicAsset(logo);
  };

  // Filtered & Searched Brands
  const filteredBrands = useMemo(() => {
    return content.clients.map((c, originalIdx) => ({ ...c, originalIdx })).filter((c) => {
      const matchesSearch = !brandSearch.trim() || c.name.toLowerCase().includes(brandSearch.trim().toLowerCase());
      if (!matchesSearch) return false;
      if (brandFilter === "has_logo") return Boolean(c.logo);
      if (brandFilter === "no_logo") return !c.logo;
      return true;
    });
  }, [content.clients, brandSearch, brandFilter]);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await api("/admin/site-content", {
        method: "PUT",
        body: content,
      });
      setContent({
        hero: updated.hero && typeof updated.hero === "object" && Object.keys(updated.hero).length > 0
          ? { ...DEFAULT_HERO_STATE, ...updated.hero }
          : DEFAULT_HERO_STATE,
        approach: Array.isArray(updated.approach) ? updated.approach : [],
        clients: Array.isArray(updated.clients) ? updated.clients : [],
      });
      setSuccess("Changes saved successfully to live website!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="od-center">
        <Loader2 size={26} className="od-spin" />
      </div>
    );
  }

  const hero = content.hero || DEFAULT_HERO_STATE;
  const currentPillar = content.approach[activePillarIdx] || content.approach[0];

  return (
    <div className="cm-container" data-testid="site-content-manager">
      {/* Top Header & Breadcrumb */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--od-gold-d)", fontWeight: 700, marginBottom: 4 }}>
            Website Architecture & Brand Control
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, margin: 0 }}>
            Homepage & Brand Assets Directory
          </h2>
          <p style={{ color: "var(--od-muted)", fontSize: 13, margin: "4px 0 0" }}>
            Hierarchical management for homepage hero typography, craft philosophy pillars, and partner client logos.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="od-btn" onClick={fetchContent}>
            <RefreshCw size={14} /> Revert
          </button>
          <button type="button" className="od-btn od-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="od-spin" /> : <Check size={14} />} Save All Changes
          </button>
        </div>
      </div>

      {error && <div className="od-error" role="alert">{error}</div>}
      {success && (
        <div style={{ background: "#e0efe2", color: "var(--od-green)", border: "1px solid #c2e2c6", borderRadius: 12, padding: "12px 18px", marginBottom: 18, fontSize: 13.5 }}>
          {success}
        </div>
      )}

      {/* Segmented Sub-Navigation Bar */}
      <div className="site-nav-pills" role="tablist">
        <button
          type="button"
          className={`site-nav-pill ${activeTab === "hero" ? "is-active" : ""}`}
          onClick={() => setActiveTab("hero")}
        >
          <Sparkles size={16} />
          <span>1. Homepage Hero Banner</span>
        </button>

        <button
          type="button"
          className={`site-nav-pill ${activeTab === "pillars" ? "is-active" : ""}`}
          onClick={() => setActiveTab("pillars")}
        >
          <Layers size={16} />
          <span>2. Craft Story Pillars</span>
          <span className="pill-badge">{content.approach.length}</span>
        </button>

        <button
          type="button"
          className={`site-nav-pill ${activeTab === "brands" ? "is-active" : ""}`}
          onClick={() => setActiveTab("brands")}
        >
          <Award size={16} />
          <span>3. Brand Logos & Clientele</span>
          <span className="pill-badge">{content.clients.length}</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: HOMEPAGE HERO BANNER
         ========================================================================= */}
      {activeTab === "hero" && (
        <div>
          {/* Live Mockup Preview */}
          <div className="hero-live-preview">
            <div className="hero-preview-eyebrow">
              {hero.eyebrow || "BDSM · BDS MARVEL"}
            </div>
            <div className="hero-preview-h1">
              <span>{hero.title_1 || "Architecture."}</span><br />
              <em>{hero.title_2 || "Interiors."}</em><br />
              <span>{(hero.title_3 || "Everything In Between").replace(/\.$/, "")}<span style={{ color: "var(--od-gold)" }}>.</span></span>
            </div>
            <p className="hero-preview-sub">
              {hero.subtitle || "One design and build studio for marble and stone, flooring, turnkey construction and interior design."}
            </p>
            <div className="hero-preview-cta">
              EXPLORE OUR WORK <ArrowDown size={14} />
            </div>
          </div>

          {/* Form Editor Card */}
          <div className="od-card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Sparkles size={18} color="var(--od-gold-d)" />
              <h3 style={{ margin: 0, fontSize: 18 }}>Hero Typography & Tagline Configuration</h3>
            </div>
            <p style={{ color: "var(--od-muted)", fontSize: 13, marginTop: 0, marginBottom: 20 }}>
              Edits made here update the opening typography rendered over the craftsmanship hero video.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <label className="od-field">
                <span>Eyebrow Kicker</span>
                <input
                  type="text"
                  value={hero.eyebrow || ""}
                  onChange={(e) => handleHeroChange("eyebrow", e.target.value)}
                  placeholder="e.g. BDSM · BDS MARVEL"
                />
              </label>

              <label className="od-field">
                <span>Headline Line 1 (Primary Word)</span>
                <input
                  type="text"
                  value={hero.title_1 || ""}
                  onChange={(e) => handleHeroChange("title_1", e.target.value)}
                  placeholder="e.g. Architecture."
                />
              </label>

              <label className="od-field">
                <span>Headline Line 2 (Emphasized Italic Serif)</span>
                <input
                  type="text"
                  value={hero.title_2 || ""}
                  onChange={(e) => handleHeroChange("title_2", e.target.value)}
                  placeholder="e.g. Interiors."
                />
              </label>

              <label className="od-field">
                <span>Headline Line 3 (Closing Punchline)</span>
                <input
                  type="text"
                  value={hero.title_3 || ""}
                  onChange={(e) => handleHeroChange("title_3", e.target.value)}
                  placeholder="e.g. Everything In Between."
                />
              </label>

              <label className="od-field" style={{ gridColumn: "span 2" }}>
                <span>Studio Subtitle & Mission Statement</span>
                <textarea
                  rows={3}
                  value={hero.subtitle || ""}
                  onChange={(e) => handleHeroChange("subtitle", e.target.value)}
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--od-line)", fontFamily: "inherit", fontSize: 13.5 }}
                  placeholder="One design and build studio for marble and stone, flooring, turnkey construction and interior design."
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: CRAFT STORY PILLARS (02 How BDS Marvel Builds)
         ========================================================================= */}
      {activeTab === "pillars" && (
        <div>
          {/* Top Control Bar with Selector Pills */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Layers size={18} color="var(--od-gold-d)" />
              <h3 style={{ margin: 0, fontSize: 18 }}>02 — Material Craft Story Pillars</h3>
              <span style={{ background: "var(--od-line)", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>
                {content.approach.length} Pillars
              </span>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="od-btn"
                onClick={() => setPillarViewMode(pillarViewMode === "focused" ? "all" : "focused")}
                style={{ fontSize: 12, padding: "6px 14px" }}
              >
                <SlidersHorizontal size={12} /> {pillarViewMode === "focused" ? "View All Stacks" : "Focus Single Pillar"}
              </button>
              <button
                type="button"
                className="od-btn od-btn--primary"
                onClick={addApproach}
                style={{ fontSize: 12, padding: "6px 16px" }}
              >
                <Plus size={13} /> Add Story Pillar
              </button>
            </div>
          </div>

          {/* Master Horizontal Pillar Navigator */}
          <div className="pillar-selector-bar">
            {content.approach.map((item, idx) => (
              <button
                key={idx}
                type="button"
                className={`pillar-pill ${activePillarIdx === idx && pillarViewMode === "focused" ? "is-active" : ""}`}
                onClick={() => {
                  setActivePillarIdx(idx);
                  setPillarViewMode("focused");
                }}
              >
                <span style={{ fontWeight: 700, opacity: 0.8 }}>{item.number || `0${idx + 1}`}</span>
                <span>{item.title || "Untitled"}</span>
              </button>
            ))}
          </div>

          {/* Content Rendering: Focused Mode vs All Stack Mode */}
          {pillarViewMode === "focused" && currentPillar ? (
            <div className="od-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--od-line)", paddingBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "var(--od-ink)", color: "#fff", fontWeight: 700, padding: "4px 10px", borderRadius: 8, fontSize: 14 }}>
                    {currentPillar.number}
                  </span>
                  <h4 style={{ margin: 0, fontSize: 18, fontFamily: "'Cormorant Garamond', serif" }}>
                    {currentPillar.title || "Craft Pillar"}
                  </h4>
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    type="button"
                    className="od-btn"
                    onClick={() => moveApproach(activePillarIdx, -1)}
                    disabled={activePillarIdx === 0}
                    style={{ padding: "6px 10px" }}
                    title="Move Earlier"
                  >
                    <ArrowUp size={13} /> Move Up
                  </button>
                  <button
                    type="button"
                    className="od-btn"
                    onClick={() => moveApproach(activePillarIdx, 1)}
                    disabled={activePillarIdx === content.approach.length - 1}
                    style={{ padding: "6px 10px" }}
                    title="Move Later"
                  >
                    <ArrowDown size={13} /> Move Down
                  </button>
                  <button
                    type="button"
                    onClick={() => removeApproach(activePillarIdx)}
                    style={{ border: "1px solid #f6e2df", background: "#fdf7f6", color: "var(--od-red)", borderRadius: 999, padding: "6px 12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24 }} className="cm-form-grid">
                {/* Photo & Upload */}
                <div>
                  <div style={{ width: "100%", height: 160, borderRadius: 14, overflow: "hidden", background: "#e3dbcc", marginBottom: 10, position: "relative" }}>
                    {currentPillar.image ? (
                      <img
                        src={img(currentPillar.image, 500)}
                        alt={currentPillar.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--od-muted)" }}>
                        <ImageIcon size={28} />
                      </div>
                    )}
                  </div>
                  <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleApproachUpload(activePillarIdx, e.target.files?.[0])}
                      style={{ display: "none" }}
                      disabled={uploadingPillarIdx === activePillarIdx}
                    />
                    <UploadCloud size={13} /> {uploadingPillarIdx === activePillarIdx ? "Uploading..." : "Replace Background Photo"}
                  </label>
                </div>

                {/* Text Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <label className="od-field" style={{ width: 90, margin: 0 }}>
                      <span>Number</span>
                      <input
                        type="text"
                        value={currentPillar.number || ""}
                        onChange={(e) => handleApproachChange(activePillarIdx, "number", e.target.value)}
                        style={{ fontWeight: 700, textAlign: "center" }}
                      />
                    </label>
                    <label className="od-field" style={{ flex: 1, margin: 0 }}>
                      <span>Pillar Title</span>
                      <input
                        type="text"
                        value={currentPillar.title || ""}
                        onChange={(e) => handleApproachChange(activePillarIdx, "title", e.target.value)}
                        placeholder="e.g. MATERIAL FIRST"
                        style={{ fontWeight: 700 }}
                      />
                    </label>
                  </div>

                  <label className="od-field" style={{ margin: 0 }}>
                    <span>Craft Philosophy Description</span>
                    <textarea
                      rows={4}
                      value={currentPillar.text || ""}
                      onChange={(e) => handleApproachChange(activePillarIdx, "text", e.target.value)}
                      style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--od-line)", fontFamily: "inherit", fontSize: 13.5, resize: "vertical" }}
                      placeholder="Explain how BDS Marvel builds and specifies materials..."
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            /* All Stacks View */
            <div style={{ display: "grid", gap: 16 }}>
              {content.approach.map((item, idx) => (
                <div key={idx} className="od-card" style={{ padding: 18, display: "grid", gridTemplateColumns: "180px 1fr", gap: 18 }}>
                  <div>
                    <div style={{ width: "100%", height: 110, borderRadius: 10, overflow: "hidden", background: "#e3dbcc", marginBottom: 8 }}>
                      {item.image ? (
                        <img src={img(item.image, 360)} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--od-muted)" }}><ImageIcon size={22} /></div>
                      )}
                    </div>
                    <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "6px 8px", fontSize: 11, cursor: "pointer" }}>
                      <input type="file" accept="image/*" onChange={(e) => handleApproachUpload(idx, e.target.files?.[0])} style={{ display: "none" }} />
                      <UploadCloud size={11} /> Replace
                    </label>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="text"
                        value={item.number}
                        onChange={(e) => handleApproachChange(idx, "number", e.target.value)}
                        style={{ width: 55, padding: 6, borderRadius: 6, border: "1px solid var(--od-line)", fontWeight: 700, textAlign: "center" }}
                      />
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleApproachChange(idx, "title", e.target.value)}
                        style={{ flex: 1, padding: 6, borderRadius: 6, border: "1px solid var(--od-line)", fontWeight: 700 }}
                      />
                      <button type="button" onClick={() => removeApproach(idx)} style={{ border: "none", background: "none", color: "var(--od-red)", cursor: "pointer", padding: 6 }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={item.text}
                      onChange={(e) => handleApproachChange(idx, "text", e.target.value)}
                      style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 13 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: BRAND LOGOS & CLIENTELE DIRECTORY (For Large Directories)
         ========================================================================= */}
      {activeTab === "brands" && (
        <div>
          {/* Top Directory Controls */}
          <div className="brand-dir-toolbar">
            {/* Search Box */}
            <div className="brand-search-box">
              <Search size={16} />
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Search across partner brands (e.g. Taj, L&T, Marriott, Hospital)..."
              />
              {brandSearch && (
                <button
                  type="button"
                  onClick={() => setBrandSearch("")}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", color: "var(--od-muted)", cursor: "pointer" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className={`od-chip ${brandFilter === "all" ? "is-on" : ""}`}
                onClick={() => setBrandFilter("all")}
              >
                All ({content.clients.length})
              </button>
              <button
                type="button"
                className={`od-chip ${brandFilter === "has_logo" ? "is-on" : ""}`}
                onClick={() => setBrandFilter("has_logo")}
              >
                With Logo ({content.clients.filter((c) => Boolean(c.logo)).length})
              </button>
              <button
                type="button"
                className={`od-chip ${brandFilter === "no_logo" ? "is-on" : ""}`}
                onClick={() => setBrandFilter("no_logo")}
              >
                No Logo ({content.clients.filter((c) => !c.logo).length})
              </button>
            </div>

            {/* Add Brand Action */}
            <button
              type="button"
              className="od-btn od-btn--primary"
              onClick={addClient}
              style={{ fontSize: 13, padding: "8px 16px" }}
            >
              <Plus size={14} /> Add Partner Brand
            </button>
          </div>

          {/* Directory Count Status */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, fontSize: 12, color: "var(--od-muted)" }}>
            <span>Showing {filteredBrands.length} of {content.clients.length} brand partners in infinite marquee</span>
            {brandSearch && <span>Filtered by: "{brandSearch}"</span>}
          </div>

          {/* Directory Grid */}
          {filteredBrands.length === 0 ? (
            <div className="od-empty" style={{ padding: 40 }}>
              <Award size={32} style={{ marginBottom: 10, opacity: 0.5 }} />
              <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>No partner brands matched your search.</p>
              <button type="button" className="od-btn" onClick={() => { setBrandSearch(""); setBrandFilter("all"); }}>
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="brand-dir-grid">
              {filteredBrands.map((c) => {
                const idx = c.originalIdx;
                const logoSrc = resolveClientLogo(c.logo);
                return (
                  <div key={idx} className="brand-dir-card">
                    {/* High-Contrast Logo Preview Box */}
                    <div className="brand-logo-preview">
                      {logoSrc ? (
                        <img src={logoSrc} alt={c.name} />
                      ) : (
                        <ImageIcon size={20} color="var(--od-muted)" />
                      )}

                      {/* Floating Upload Pill */}
                      <label className="brand-logo-upload-btn" title="Upload or Replace Logo">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleClientLogoUpload(idx, e.target.files?.[0])}
                          style={{ display: "none" }}
                          disabled={uploadingClientIdx === idx}
                        />
                        {uploadingClientIdx === idx ? <Loader2 size={11} className="od-spin" /> : <UploadCloud size={11} />}
                      </label>
                    </div>

                    {/* Brand Name Input & Controls */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        type="text"
                        value={c.name || ""}
                        onChange={(e) => handleClientChange(idx, "name", e.target.value)}
                        placeholder="Brand / Partner Name"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 13, fontWeight: 600, background: "#fff", color: "var(--od-ink)" }}
                      />
                      <div style={{ display: "flex", gap: 10, marginTop: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 10, letterSpacing: 0.5, color: c.logo ? "var(--od-green)" : "var(--od-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                          {c.logo ? "✓ Logo Attached" : "○ Wordmark Only"}
                        </span>
                      </div>
                    </div>

                    {/* Actions: Reorder & Delete */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => moveClient(idx, -1)}
                        disabled={idx === 0}
                        style={{ border: "none", background: "none", color: idx === 0 ? "#ccc" : "var(--od-muted)", cursor: idx === 0 ? "default" : "pointer", padding: 2 }}
                        title="Move Earlier in Marquee"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveClient(idx, 1)}
                        disabled={idx === content.clients.length - 1}
                        style={{ border: "none", background: "none", color: idx === content.clients.length - 1 ? "#ccc" : "var(--od-muted)", cursor: idx === content.clients.length - 1 ? "default" : "pointer", padding: 2 }}
                        title="Move Later in Marquee"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeClient(idx)}
                        style={{ border: "none", background: "none", color: "var(--od-red)", cursor: "pointer", padding: 2 }}
                        title="Delete Brand"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Floating Bottom Sticky Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, paddingTop: 18, borderTop: "1px solid var(--od-line)" }}>
        <span style={{ fontSize: 12, color: "var(--od-muted)" }}>
          Unsaved changes will be discarded on page refresh unless saved.
        </span>
        <button
          type="button"
          className="od-btn od-btn--primary"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: "12px 32px", fontSize: 14 }}
        >
          {saving ? <Loader2 size={15} className="od-spin" /> : <Check size={15} />} Save All Changes
        </button>
      </div>
    </div>
  );
}

export default SiteContentManager;
