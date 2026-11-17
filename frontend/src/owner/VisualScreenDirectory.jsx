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
  Home,
  BedDouble,
  Building,
  Layers,
  Boxes,
  FileText,
  Sparkles,
  Award,
  SlidersHorizontal,
  X,
  Phone,
} from "lucide-react";
import { api, resolveBackendMedia } from "../stays/store";
import { publicAsset } from "../wordpress";
import { img } from "../App";
import SiteContentManager from "./SiteContentManager";

export function VisualScreenDirectory({ initialScreen = "stays" }) {
  // The 7 Core Website Screens
  const [activeScreen, setActiveScreen] = useState(initialScreen); // "home" | "stays" | "projects" | "catalogue" | "businesses" | "about" | "clients"

  // Data collections
  const [stays, setStays] = useState([]);
  const [projects, setProjects] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [uploadingTarget, setUploadingTarget] = useState(null); // { id, field, index }
  const [toast, setToast] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [staysData, projData, catData] = await Promise.all([
        api("/stays?all=true").catch(() => []),
        api("/projects?all=true").catch(() => []),
        api("/catalogue?all=true").catch(() => []),
      ]);
      setStays(Array.isArray(staysData) ? staysData : []);
      setProjects(Array.isArray(projData) ? projData : []);
      setCatalogue(Array.isArray(catData) ? catData : []);
    } catch (err) {
      console.error("Failed to load screens data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Image upload helper
  const handleFileUpload = async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append("file", file);
    const res = await api("/admin/media/upload", { method: "POST", body: formData });
    return res.url;
  };

  // --- STAYS IMAGE HANDLERS ---
  const handleStayHeroUpload = async (stay, file) => {
    if (!file) return;
    setUploadingTarget({ id: stay.id, field: "hero" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const updated = { ...stay, hero: url };
      const res = await api(`/admin/stays/${stay.id || stay.slug}`, {
        method: "PUT",
        body: updated,
      });
      setStays((prev) => prev.map((s) => (s.id === stay.id ? res : s)));
      showToast(`Updated card photo for "${stay.name}"`);
    } catch (err) {
      alert("Failed to upload photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleStayGalleryAdd = async (stay, file) => {
    if (!file) return;
    setUploadingTarget({ id: stay.id, field: "gallery_add" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const updated = { ...stay, gallery: [...(stay.gallery || []), url] };
      const res = await api(`/admin/stays/${stay.id || stay.slug}`, {
        method: "PUT",
        body: updated,
      });
      setStays((prev) => prev.map((s) => (s.id === stay.id ? res : s)));
      showToast(`Added new photo to "${stay.name}" detail gallery`);
    } catch (err) {
      alert("Failed to add gallery photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleStayGalleryDelete = async (stay, photoIdx) => {
    if (!window.confirm("Remove this photo from the detail gallery?")) return;
    try {
      const nextGallery = (stay.gallery || []).filter((_, i) => i !== photoIdx);
      const updated = { ...stay, gallery: nextGallery };
      const res = await api(`/admin/stays/${stay.id || stay.slug}`, {
        method: "PUT",
        body: updated,
      });
      setStays((prev) => prev.map((s) => (s.id === stay.id ? res : s)));
      showToast(`Removed photo from "${stay.name}" detail gallery`);
    } catch (err) {
      alert("Failed to remove photo: " + err.message);
    }
  };

  const handleStayGalleryReplace = async (stay, photoIdx, file) => {
    if (!file) return;
    setUploadingTarget({ id: stay.id, field: `gallery_${photoIdx}` });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextGallery = [...(stay.gallery || [])];
      nextGallery[photoIdx] = url;
      const updated = { ...stay, gallery: nextGallery };
      const res = await api(`/admin/stays/${stay.id || stay.slug}`, {
        method: "PUT",
        body: updated,
      });
      setStays((prev) => prev.map((s) => (s.id === stay.id ? res : s)));
      showToast(`Replaced photo in "${stay.name}" detail gallery`);
    } catch (err) {
      alert("Failed to replace photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  // --- PROJECTS IMAGE HANDLERS ---
  const handleProjectHeroUpload = async (project, file) => {
    if (!file) return;
    setUploadingTarget({ id: project.id, field: "hero" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const updated = { ...project, image: url };
      const res = await api(`/admin/projects/${project.id || project.slug}`, {
        method: "PUT",
        body: updated,
      });
      setProjects((prev) => prev.map((p) => (p.id === project.id ? res : p)));
      showToast(`Updated card photo for "${project.title}"`);
    } catch (err) {
      alert("Failed to upload photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleProjectGalleryAdd = async (project, file) => {
    if (!file) return;
    setUploadingTarget({ id: project.id, field: "gallery_add" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const updated = { ...project, gallery: [...(project.gallery || []), url] };
      const res = await api(`/admin/projects/${project.id || project.slug}`, {
        method: "PUT",
        body: updated,
      });
      setProjects((prev) => prev.map((p) => (p.id === project.id ? res : p)));
      showToast(`Added new photo to "${project.title}" detail gallery`);
    } catch (err) {
      alert("Failed to add gallery photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleProjectGalleryDelete = async (project, photoIdx) => {
    if (!window.confirm("Remove this photo from the project detail gallery?")) return;
    try {
      const nextGallery = (project.gallery || []).filter((_, i) => i !== photoIdx);
      const updated = { ...project, gallery: nextGallery };
      const res = await api(`/admin/projects/${project.id || project.slug}`, {
        method: "PUT",
        body: updated,
      });
      setProjects((prev) => prev.map((p) => (p.id === project.id ? res : p)));
      showToast(`Removed photo from "${project.title}" detail gallery`);
    } catch (err) {
      alert("Failed to remove photo: " + err.message);
    }
  };

  const handleProjectGalleryReplace = async (project, photoIdx, file) => {
    if (!file) return;
    setUploadingTarget({ id: project.id, field: `gallery_${photoIdx}` });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextGallery = [...(project.gallery || [])];
      nextGallery[photoIdx] = url;
      const updated = { ...project, gallery: nextGallery };
      const res = await api(`/admin/projects/${project.id || project.slug}`, {
        method: "PUT",
        body: updated,
      });
      setProjects((prev) => prev.map((p) => (p.id === project.id ? res : p)));
      showToast(`Replaced photo in "${project.title}" detail gallery`);
    } catch (err) {
      alert("Failed to replace photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  // --- CATALOGUE IMAGE HANDLERS ---
  const handleCatalogueHeroUpload = async (item, file) => {
    if (!file) return;
    setUploadingTarget({ id: item.id || item.slug, field: "hero" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const updated = { ...item, image: url };
      const res = await api(`/admin/catalogue/${item.id || item.slug}`, {
        method: "PUT",
        body: updated,
      });
      setCatalogue((prev) => prev.map((c) => (c.slug === item.slug ? res : c)));
      showToast(`Updated card photo for "${item.name}"`);
    } catch (err) {
      alert("Failed to upload photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleCatalogueGalleryAdd = async (item, file) => {
    if (!file) return;
    setUploadingTarget({ id: item.id || item.slug, field: "gallery_add" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const updated = { ...item, gallery: [...(item.gallery || []), url] };
      const res = await api(`/admin/catalogue/${item.id || item.slug}`, {
        method: "PUT",
        body: updated,
      });
      setCatalogue((prev) => prev.map((c) => (c.slug === item.slug ? res : c)));
      showToast(`Added new photo to "${item.name}" product gallery`);
    } catch (err) {
      alert("Failed to add gallery photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleCatalogueGalleryDelete = async (item, photoIdx) => {
    if (!window.confirm("Remove this photo from the product detail gallery?")) return;
    try {
      const nextGallery = (item.gallery || []).filter((_, i) => i !== photoIdx);
      const updated = { ...item, gallery: nextGallery };
      const res = await api(`/admin/catalogue/${item.id || item.slug}`, {
        method: "PUT",
        body: updated,
      });
      setCatalogue((prev) => prev.map((c) => (c.slug === item.slug ? res : c)));
      showToast(`Removed photo from "${item.name}" product gallery`);
    } catch (err) {
      alert("Failed to remove photo: " + err.message);
    }
  };

  const handleCatalogueGalleryReplace = async (item, photoIdx, file) => {
    if (!file) return;
    setUploadingTarget({ id: item.id || item.slug, field: `gallery_${photoIdx}` });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextGallery = [...(item.gallery || [])];
      nextGallery[photoIdx] = url;
      const updated = { ...item, gallery: nextGallery };
      const res = await api(`/admin/catalogue/${item.id || item.slug}`, {
        method: "PUT",
        body: updated,
      });
      setCatalogue((prev) => prev.map((c) => (c.slug === item.slug ? res : c)));
      showToast(`Replaced photo in "${item.name}" product gallery`);
    } catch (err) {
      alert("Failed to replace photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  // Helper to open live website page
  const openLivePage = (path) => {
    window.open(path, "_blank");
  };

  // Screen Definitions (All 7 Screens)
  const screens = [
    {
      id: "home",
      number: "01",
      name: "Homepage",
      path: "/",
      icon: Home,
      tag: "Hero & Opening",
      desc: "Hero craftsmanship video, 5 craft philosophy pillars, and client brand reel.",
    },
    {
      id: "stays",
      number: "02",
      name: "Luxury Stays",
      path: "/stays",
      icon: BedDouble,
      tag: "6 Listings + Detail Galleries",
      desc: "Listing browse cards & full interior photo galleries seen after clicking a stay.",
    },
    {
      id: "projects",
      number: "03",
      name: "Projects & Portfolio",
      path: "/projects",
      icon: Building,
      tag: "Selected Works + Detail Galleries",
      desc: "Project cards shown on /projects & inner detail photo galleries for each build.",
    },
    {
      id: "catalogue",
      number: "04",
      name: "Materials Catalogue",
      path: "/catalogue",
      icon: Boxes,
      tag: "Products + Detail Galleries",
      desc: "Materials & furniture browse cards & finish/spec galleries after clicking an item.",
    },
    {
      id: "businesses",
      number: "05",
      name: "Business Divisions",
      path: "/businesses/marble-and-stone",
      icon: Layers,
      tag: "4 Divisions & Hero Banners",
      desc: "Marble & Stone, Flooring, Turnkey Construction, and Interior Decor division pages.",
    },
    {
      id: "about",
      number: "06",
      name: "About Studio",
      path: "/about",
      icon: FileText,
      tag: "Workshop & Heritage Story",
      desc: "Kishangarh stone workshops, master craftsmen, and studio heritage photos.",
    },
    {
      id: "clients",
      number: "07",
      name: "Brand Logos Marquee",
      path: "/#contact",
      icon: Award,
      tag: "24+ Partner Logos Reel",
      desc: "Searchable directory of institutional clients & hospitality partner brand logos.",
    },
  ];

  return (
    <div className="cm-container" data-testid="visual-screen-directory">
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--od-gold-d)", fontWeight: 700, marginBottom: 4 }}>
            Visual Website Directory · All 7 Screens
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, margin: 0 }}>
            Website Screens & Media Manager
          </h2>
          <p style={{ color: "var(--od-muted)", fontSize: 13, margin: "4px 0 0" }}>
            Select any of the 7 screens below to change its main listing photos, or the full photo galleries that appear after clicking.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="od-btn" onClick={loadAllData}>
            <RefreshCw size={14} /> Refresh Media
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ background: "#e0efe2", color: "var(--od-green)", border: "1px solid #c2e2c6", borderRadius: 12, padding: "12px 18px", marginBottom: 18, fontSize: 13.5 }}>
          {toast}
        </div>
      )}

      {/* =========================================================================
          MASTER VISUAL SCREEN SELECTOR (All 7 Screens)
         ========================================================================= */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
          gap: 10,
          marginBottom: 26,
        }}
        role="tablist"
      >
        {screens.map((s) => {
          const IconComp = s.icon;
          const isActive = activeScreen === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`site-flow-step ${isActive ? "is-active" : ""}`}
              onClick={() => {
                setActiveScreen(s.id);
                setSearchFilter("");
              }}
              style={{
                padding: "12px 14px",
                borderWidth: isActive ? 2 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <span className="site-flow-step__badge" style={{ fontSize: 10 }}>
                  <IconComp size={12} /> {s.number}
                </span>
                <span style={{ fontSize: 10, opacity: 0.6, fontFamily: "monospace" }}>{s.path}</span>
              </div>
              <h4 className="site-flow-step__title" style={{ fontSize: 13, marginTop: 4 }}>
                {s.name}
              </h4>
              <span className="site-flow-step__meta" style={{ fontSize: 10.5, lineHeight: 1.2 }}>
                {s.tag}
              </span>
            </button>
          );
        })}
      </div>

      {/* Screen Overview Banner */}
      {(() => {
        const currentScreenMeta = screens.find((s) => s.id === activeScreen) || screens[0];
        return (
          <div
            style={{
              background: "var(--od-surface)",
              border: "1px solid var(--od-line)",
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "var(--od-gold-d)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>
                  SCREEN {currentScreenMeta.number}
                </span>
                <h3 style={{ margin: 0, fontSize: 18 }}>{currentScreenMeta.name}</h3>
                <span style={{ color: "var(--od-muted)", fontSize: 13, fontFamily: "monospace" }}>({currentScreenMeta.path})</span>
              </div>
              <p style={{ margin: "4px 0 0", color: "var(--od-muted)", fontSize: 13 }}>
                {currentScreenMeta.desc}
              </p>
            </div>

            <button
              type="button"
              className="od-btn"
              onClick={() => openLivePage(currentScreenMeta.path)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
            >
              <Eye size={13} /> Open Live Page <ExternalLink size={12} />
            </button>
          </div>
        );
      })()}

      {/* =========================================================================
          SCREEN 2: LUXURY STAYS (Listing Card Photo + Photo Gallery After Clicking)
         ========================================================================= */}
      {activeScreen === "stays" && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                All 6 Stays: Card Photos & Inner Detail Galleries
              </h4>
              <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                For each stay, the left box is the card photo shown on <code>/stays</code>. The right gallery contains the photos visitors see <strong>after clicking into the stay</strong>.
              </p>
            </div>
            <div style={{ width: 240, position: "relative" }}>
              <input
                type="text"
                placeholder="Filter stays (e.g. Penthouse)..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 12 }}
              />
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--od-muted)" }} />
            </div>
          </div>

          <div style={{ display: "grid", gap: 24 }}>
            {stays
              .filter((s) => !searchFilter || s.name.toLowerCase().includes(searchFilter.toLowerCase()))
              .map((stay) => {
                const galleryList = Array.isArray(stay.gallery) ? stay.gallery : [];
                const isHeroUploading = uploadingTarget?.id === stay.id && uploadingTarget?.field === "hero";
                const isGalleryAdding = uploadingTarget?.id === stay.id && uploadingTarget?.field === "gallery_add";

                return (
                  <div key={stay.slug || stay.id} className="od-card" style={{ padding: 22, borderRadius: 18 }}>
                    {/* Stay Card Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                            {stay.tier || "Premium"} Tier
                          </span>
                          <span style={{ color: "var(--od-muted)", fontSize: 12 }}>·</span>
                          <span style={{ color: "var(--od-muted)", fontSize: 12 }}>{stay.location}</span>
                        </div>
                        <h3 style={{ margin: "2px 0 0", fontSize: 22, fontFamily: "'Cormorant Garamond', serif" }}>
                          {stay.name}
                        </h3>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>₹{stay.nightly?.toLocaleString("en-IN")}/night</span>
                        <button
                          type="button"
                          className="od-btn"
                          onClick={() => openLivePage(`/stays/home/${stay.slug}`)}
                          style={{ padding: "5px 12px", fontSize: 11.5 }}
                        >
                          View Live Stay <ExternalLink size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Dual-Level Image Architecture */}
                    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24 }} className="cm-form-grid">
                      {/* LEVEL 1: LISTING CARD PHOTO */}
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 6 }}>
                          1. Browse Card Photo
                        </div>
                        <div style={{ width: "100%", height: 160, borderRadius: 14, overflow: "hidden", background: "#e3dbcc", marginBottom: 10, position: "relative" }}>
                          {stay.hero ? (
                            <img src={img(stay.hero, 500)} alt={stay.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--od-muted)" }}>
                              <ImageIcon size={28} />
                            </div>
                          )}
                          {isHeroUploading && (
                            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                              <Loader2 size={24} className="od-spin" />
                            </div>
                          )}
                        </div>
                        <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleStayHeroUpload(stay, e.target.files?.[0])}
                            style={{ display: "none" }}
                            disabled={isHeroUploading}
                          />
                          <UploadCloud size={13} /> {isHeroUploading ? "Uploading..." : "Replace Card Photo"}
                        </label>
                        <p style={{ margin: "6px 0 0", color: "var(--od-muted)", fontSize: 11, textAlign: "center" }}>
                          Seen on /stays browse grid
                        </p>
                      </div>

                      {/* LEVEL 2: DETAIL PHOTOS AFTER CLICKING */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                            2. Photos After Clicking (Inner Detail Gallery · {galleryList.length} Photos)
                          </div>
                          <label className="od-btn od-btn--primary" style={{ padding: "5px 12px", fontSize: 11.5, cursor: "pointer" }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleStayGalleryAdd(stay, e.target.files?.[0])}
                              style={{ display: "none" }}
                              disabled={isGalleryAdding}
                            />
                            {isGalleryAdding ? <Loader2 size={11} className="od-spin" /> : <Plus size={12} />} Add Gallery Photo
                          </label>
                        </div>

                        {galleryList.length === 0 ? (
                          <div style={{ background: "var(--od-paper)", border: "1px dashed var(--od-line)", borderRadius: 14, padding: "28px 16px", textAlign: "center", color: "var(--od-muted)" }}>
                            <ImageIcon size={24} style={{ marginBottom: 6, opacity: 0.5 }} />
                            <p style={{ margin: 0, fontSize: 13 }}>No inner gallery photos added yet.</p>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(115px, 1fr))", gap: 10 }}>
                            {galleryList.map((photoUrl, photoIdx) => {
                              const isReplacing = uploadingTarget?.id === stay.id && uploadingTarget?.field === `gallery_${photoIdx}`;
                              return (
                                <div
                                  key={photoIdx}
                                  style={{
                                    borderRadius: 10,
                                    overflow: "hidden",
                                    background: "#e3dbcc",
                                    height: 100,
                                    position: "relative",
                                    border: "1px solid var(--od-line)",
                                  }}
                                >
                                  <img src={img(photoUrl, 300)} alt={`Detail ${photoIdx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                                  {isReplacing && (
                                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                                      <Loader2 size={18} className="od-spin" />
                                    </div>
                                  )}

                                  {/* Quick Overlay Actions */}
                                  <div
                                    style={{
                                      position: "absolute",
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.75))",
                                      padding: "4px 6px",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <label title="Replace this photo" style={{ cursor: "pointer", color: "#fff" }}>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleStayGalleryReplace(stay, photoIdx, e.target.files?.[0])}
                                        style={{ display: "none" }}
                                      />
                                      <UploadCloud size={12} />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleStayGalleryDelete(stay, photoIdx)}
                                      style={{ border: "none", background: "none", color: "#ff8b82", cursor: "pointer", padding: 0 }}
                                      title="Delete photo"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <p style={{ margin: "8px 0 0", color: "var(--od-muted)", fontSize: 11 }}>
                          Visitors see these photos in the high-res gallery modal when they click into {stay.name}.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 3: ARCHITECTURAL PROJECTS (Card Photo + Detail Gallery After Clicking)
         ========================================================================= */}
      {activeScreen === "projects" && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Architectural Projects: Browse Cards & Detail Galleries
              </h4>
              <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                For each project, the left box is the card photo on <code>/projects</code> and homepage slideshow. The right gallery contains the photos visitors see <strong>after clicking into the project</strong>.
              </p>
            </div>
            <div style={{ width: 240, position: "relative" }}>
              <input
                type="text"
                placeholder="Filter projects (e.g. Villa)..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 12 }}
              />
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--od-muted)" }} />
            </div>
          </div>

          <div style={{ display: "grid", gap: 24 }}>
            {projects
              .filter((p) => !searchFilter || p.title.toLowerCase().includes(searchFilter.toLowerCase()))
              .map((proj) => {
                const galleryList = Array.isArray(proj.gallery) ? proj.gallery : [];
                const isHeroUploading = uploadingTarget?.id === proj.id && uploadingTarget?.field === "hero";
                const isGalleryAdding = uploadingTarget?.id === proj.id && uploadingTarget?.field === "gallery_add";

                return (
                  <div key={proj.slug || proj.id} className="od-card" style={{ padding: 22, borderRadius: 18 }}>
                    {/* Project Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                            {proj.segment} · {proj.category}
                          </span>
                          <span style={{ color: "var(--od-muted)", fontSize: 12 }}>·</span>
                          <span style={{ color: "var(--od-muted)", fontSize: 12 }}>{proj.location}</span>
                        </div>
                        <h3 style={{ margin: "2px 0 0", fontSize: 22, fontFamily: "'Cormorant Garamond', serif" }}>
                          {proj.title}
                        </h3>
                      </div>

                      <button
                        type="button"
                        className="od-btn"
                        onClick={() => openLivePage(`/projects/${proj.slug}`)}
                        style={{ padding: "5px 12px", fontSize: 11.5 }}
                      >
                        View Live Project <ExternalLink size={11} />
                      </button>
                    </div>

                    {/* Dual-Level Image Architecture */}
                    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24 }} className="cm-form-grid">
                      {/* LEVEL 1: LISTING CARD PHOTO */}
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 6 }}>
                          1. Browse Card Photo
                        </div>
                        <div style={{ width: "100%", height: 160, borderRadius: 14, overflow: "hidden", background: "#e3dbcc", marginBottom: 10, position: "relative" }}>
                          {proj.image ? (
                            <img src={img(proj.image, 500)} alt={proj.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--od-muted)" }}>
                              <ImageIcon size={28} />
                            </div>
                          )}
                          {isHeroUploading && (
                            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                              <Loader2 size={24} className="od-spin" />
                            </div>
                          )}
                        </div>
                        <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleProjectHeroUpload(proj, e.target.files?.[0])}
                            style={{ display: "none" }}
                            disabled={isHeroUploading}
                          />
                          <UploadCloud size={13} /> {isHeroUploading ? "Uploading..." : "Replace Card Photo"}
                        </label>
                        <p style={{ margin: "6px 0 0", color: "var(--od-muted)", fontSize: 11, textAlign: "center" }}>
                          Seen on /projects & homepage slideshow
                        </p>
                      </div>

                      {/* LEVEL 2: DETAIL PHOTOS AFTER CLICKING */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                            2. Photos After Clicking (Project Detail Page · {galleryList.length} Photos)
                          </div>
                          <label className="od-btn od-btn--primary" style={{ padding: "5px 12px", fontSize: 11.5, cursor: "pointer" }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleProjectGalleryAdd(proj, e.target.files?.[0])}
                              style={{ display: "none" }}
                              disabled={isGalleryAdding}
                            />
                            {isGalleryAdding ? <Loader2 size={11} className="od-spin" /> : <Plus size={12} />} Add Gallery Photo
                          </label>
                        </div>

                        {galleryList.length === 0 ? (
                          <div style={{ background: "var(--od-paper)", border: "1px dashed var(--od-line)", borderRadius: 14, padding: "28px 16px", textAlign: "center", color: "var(--od-muted)" }}>
                            <ImageIcon size={24} style={{ marginBottom: 6, opacity: 0.5 }} />
                            <p style={{ margin: 0, fontSize: 13 }}>No detail gallery photos added yet.</p>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(115px, 1fr))", gap: 10 }}>
                            {galleryList.map((photoUrl, photoIdx) => {
                              const isReplacing = uploadingTarget?.id === proj.id && uploadingTarget?.field === `gallery_${photoIdx}`;
                              return (
                                <div
                                  key={photoIdx}
                                  style={{
                                    borderRadius: 10,
                                    overflow: "hidden",
                                    background: "#e3dbcc",
                                    height: 100,
                                    position: "relative",
                                    border: "1px solid var(--od-line)",
                                  }}
                                >
                                  <img src={img(photoUrl, 300)} alt={`Project ${photoIdx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                                  {isReplacing && (
                                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                                      <Loader2 size={18} className="od-spin" />
                                    </div>
                                  )}

                                  <div
                                    style={{
                                      position: "absolute",
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.75))",
                                      padding: "4px 6px",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <label title="Replace this photo" style={{ cursor: "pointer", color: "#fff" }}>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleProjectGalleryReplace(proj, photoIdx, e.target.files?.[0])}
                                        style={{ display: "none" }}
                                      />
                                      <UploadCloud size={12} />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleProjectGalleryDelete(proj, photoIdx)}
                                      style={{ border: "none", background: "none", color: "#ff8b82", cursor: "pointer", padding: 0 }}
                                      title="Delete photo"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <p style={{ margin: "8px 0 0", color: "var(--od-muted)", fontSize: 11 }}>
                          Visitors see these photos after clicking {proj.title} on the architectural case study page.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 4: MATERIALS CATALOGUE (Browse Cards + Detail Galleries)
         ========================================================================= */}
      {activeScreen === "catalogue" && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Materials Catalogue: Browse Cards & Detail Galleries
              </h4>
              <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                For each material or product, the left box is the card photo on <code>/catalogue</code>. The right gallery contains the photos visitors see <strong>after clicking into the item</strong>.
              </p>
            </div>
            <div style={{ width: 240, position: "relative" }}>
              <input
                type="text"
                placeholder="Filter catalogue (e.g. Marble)..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{ width: "100%", padding: "8px 10px 8px 30px", borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 12 }}
              />
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--od-muted)" }} />
            </div>
          </div>

          <div style={{ display: "grid", gap: 24 }}>
            {catalogue
              .filter((c) => !searchFilter || c.name.toLowerCase().includes(searchFilter.toLowerCase()))
              .map((item) => {
                const galleryList = Array.isArray(item.gallery) ? item.gallery : [];
                const isHeroUploading = uploadingTarget?.id === (item.id || item.slug) && uploadingTarget?.field === "hero";
                const isGalleryAdding = uploadingTarget?.id === (item.id || item.slug) && uploadingTarget?.field === "gallery_add";

                return (
                  <div key={item.slug} className="od-card" style={{ padding: 22, borderRadius: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                            {item.brand} · {item.category}
                          </span>
                          <span style={{ color: "var(--od-muted)", fontSize: 12 }}>·</span>
                          <span style={{ color: "var(--od-muted)", fontSize: 12 }}>{item.material}</span>
                        </div>
                        <h3 style={{ margin: "2px 0 0", fontSize: 22, fontFamily: "'Cormorant Garamond', serif" }}>
                          {item.name}
                        </h3>
                      </div>

                      <button
                        type="button"
                        className="od-btn"
                        onClick={() => openLivePage(`/catalogue/${item.slug}`)}
                        style={{ padding: "5px 12px", fontSize: 11.5 }}
                      >
                        View Live Product <ExternalLink size={11} />
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24 }} className="cm-form-grid">
                      {/* LEVEL 1: CARD PHOTO */}
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 6 }}>
                          1. Browse Card Photo
                        </div>
                        <div style={{ width: "100%", height: 160, borderRadius: 14, overflow: "hidden", background: "#e3dbcc", marginBottom: 10, position: "relative" }}>
                          {item.image ? (
                            <img src={img(item.image, 500)} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--od-muted)" }}>
                              <ImageIcon size={28} />
                            </div>
                          )}
                          {isHeroUploading && (
                            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                              <Loader2 size={24} className="od-spin" />
                            </div>
                          )}
                        </div>
                        <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleCatalogueHeroUpload(item, e.target.files?.[0])}
                            style={{ display: "none" }}
                            disabled={isHeroUploading}
                          />
                          <UploadCloud size={13} /> {isHeroUploading ? "Uploading..." : "Replace Card Photo"}
                        </label>
                        <p style={{ margin: "6px 0 0", color: "var(--od-muted)", fontSize: 11, textAlign: "center" }}>
                          Seen on /catalogue browse grid
                        </p>
                      </div>

                      {/* LEVEL 2: DETAIL GALLERY PHOTOS AFTER CLICKING */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                            2. Photos After Clicking (Product Detail Page · {galleryList.length} Photos)
                          </div>
                          <label className="od-btn od-btn--primary" style={{ padding: "5px 12px", fontSize: 11.5, cursor: "pointer" }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleCatalogueGalleryAdd(item, e.target.files?.[0])}
                              style={{ display: "none" }}
                              disabled={isGalleryAdding}
                            />
                            {isGalleryAdding ? <Loader2 size={11} className="od-spin" /> : <Plus size={12} />} Add Gallery Photo
                          </label>
                        </div>

                        {galleryList.length === 0 ? (
                          <div style={{ background: "var(--od-paper)", border: "1px dashed var(--od-line)", borderRadius: 14, padding: "28px 16px", textAlign: "center", color: "var(--od-muted)" }}>
                            <ImageIcon size={24} style={{ marginBottom: 6, opacity: 0.5 }} />
                            <p style={{ margin: 0, fontSize: 13 }}>No product gallery photos added yet.</p>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(115px, 1fr))", gap: 10 }}>
                            {galleryList.map((photoUrl, photoIdx) => {
                              const isReplacing = uploadingTarget?.id === (item.id || item.slug) && uploadingTarget?.field === `gallery_${photoIdx}`;
                              return (
                                <div
                                  key={photoIdx}
                                  style={{
                                    borderRadius: 10,
                                    overflow: "hidden",
                                    background: "#e3dbcc",
                                    height: 100,
                                    position: "relative",
                                    border: "1px solid var(--od-line)",
                                  }}
                                >
                                  <img src={img(photoUrl, 300)} alt={`Product ${photoIdx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                                  {isReplacing && (
                                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                                      <Loader2 size={18} className="od-spin" />
                                    </div>
                                  )}

                                  <div
                                    style={{
                                      position: "absolute",
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.75))",
                                      padding: "4px 6px",
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <label title="Replace this photo" style={{ cursor: "pointer", color: "#fff" }}>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleCatalogueGalleryReplace(item, photoIdx, e.target.files?.[0])}
                                        style={{ display: "none" }}
                                      />
                                      <UploadCloud size={12} />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleCatalogueGalleryDelete(item, photoIdx)}
                                      style={{ border: "none", background: "none", color: "#ff8b82", cursor: "pointer", padding: 0 }}
                                      title="Delete photo"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <p style={{ margin: "8px 0 0", color: "var(--od-muted)", fontSize: 11 }}>
                          Visitors see these photos after clicking {item.name} in the materials specification view.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 1, 6 & 7: HOMEPAGE, ABOUT & BRAND LOGOS
         ========================================================================= */}
      {(activeScreen === "home" || activeScreen === "clients") && (
        <SiteContentManager />
      )}

      {/* =========================================================================
          SCREEN 5: BUSINESS DIVISIONS (The 4 Segments)
         ========================================================================= */}
      {activeScreen === "businesses" && (
        <div className="od-card" style={{ padding: 24, borderRadius: 18 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>05 — Business Division Screens</h3>
          <p style={{ margin: "0 0 20px", color: "var(--od-muted)", fontSize: 13 }}>
            BDS Marvel is structured into 4 foundational trade businesses. Click any division to view its live showcase:
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {[
              { slug: "marble-and-stone", name: "Marble & Stone (Drawstones)", kicker: "Quarried & Cut in Kishangarh", hero: "photo-1618221195710-dd6b41faaea6" },
              { slug: "flooring", name: "Flooring (Renest)", kicker: "Wooden Plank & Stone Composite", hero: "photo-1616486338812-3dadae4b4ace" },
              { slug: "construction", name: "Turnkey Construction (Formwork)", kicker: "Civil, Structure & MEP", hero: "photo-1503387762-592deb58ef4e" },
              { slug: "interior-designing", name: "Interior Designing & Decor", kicker: "3D Spatial Planning & Detailing", hero: "photo-1631679706909-1844bbd07221" },
            ].map((b) => (
              <div key={b.slug} style={{ background: "var(--od-paper)", border: "1px solid var(--od-line)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ height: 120, background: "#e3dbcc" }}>
                  <img src={img(b.hero, 400)} alt={b.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--od-gold-d)", fontWeight: 700 }}>{b.kicker}</span>
                  <h4 style={{ margin: "4px 0 10px", fontSize: 16 }}>{b.name}</h4>
                  <button
                    type="button"
                    className="od-btn"
                    onClick={() => openLivePage(`/businesses/${b.slug}`)}
                    style={{ width: "100%", justifyContent: "center", fontSize: 11.5, padding: "6px" }}
                  >
                    View Live Division <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 6: ABOUT US & WORKSHOP
         ========================================================================= */}
      {activeScreen === "about" && (
        <div className="od-card" style={{ padding: 24, borderRadius: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 20 }}>06 — About Studio & Kishangarh Workshops</h3>
              <p style={{ margin: "4px 0 0", color: "var(--od-muted)", fontSize: 13 }}>
                Live screen: <code>/about</code> · Showcases the studio story, materials philosophy, and two decades of stonecraft heritage.
              </p>
            </div>
            <button
              type="button"
              className="od-btn"
              onClick={() => openLivePage("/about")}
              style={{ fontSize: 12 }}
            >
              Open Live About Screen <ExternalLink size={12} />
            </button>
          </div>

          <div style={{ background: "var(--od-paper)", border: "1px solid var(--od-line)", borderRadius: 14, padding: 20 }}>
            <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.6 }}>
              The About Page automatically syncs with the <strong>Material Craft Story Pillars</strong> and <strong>Brand Logos</strong> managed in the Homepage editor.
            </p>
            <button
              type="button"
              className="od-btn od-btn--primary"
              onClick={() => setActiveScreen("home")}
              style={{ fontSize: 12.5 }}
            >
              Edit Material Craft Story & Philosophy Pillars →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisualScreenDirectory;
