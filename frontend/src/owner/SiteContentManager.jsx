import React, { useState, useEffect, useCallback } from "react";
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
  const [uploadingIdx, setUploadingIdx] = useState(null);
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

  const handleHeroChange = (field, value) => {
    setContent((prev) => ({
      ...prev,
      hero: { ...(prev.hero || DEFAULT_HERO_STATE), [field]: value },
    }));
  };

  const handleApproachChange = (index, field, value) => {
    setContent((prev) => {
      const copy = [...prev.approach];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, approach: copy };
    });
  };

  const handleApproachUpload = async (index, file) => {
    if (!file) return;
    setUploadingIdx(index);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api("/admin/media/upload", { method: "POST", body: data });
      handleApproachChange(index, "image", res.url);
    } catch (err) {
      alert("Image upload failed: " + err.message);
    } finally {
      setUploadingIdx(null);
    }
  };

  const addApproach = () => {
    setContent((prev) => {
      const nextNum = String(prev.approach.length + 1).padStart(2, "0");
      return {
        ...prev,
        approach: [
          ...prev.approach,
          {
            number: nextNum,
            title: "NEW CRAFT PILLAR",
            text: "Description of your workshop craft and specification process.",
            image: "photo-1618221195710-dd6b41faaea6",
          },
        ],
      };
    });
  };

  const removeApproach = (index) => {
    setContent((prev) => ({
      ...prev,
      approach: prev.approach.filter((_, i) => i !== index),
    }));
  };

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
      clients: [...prev.clients, { name: "", logo: "" }],
    }));
  };

  const removeClient = (index) => {
    setContent((prev) => ({
      ...prev,
      clients: prev.clients.filter((_, i) => i !== index),
    }));
  };

  const resolveClientLogo = (logo) => {
    if (!logo) return "";
    if (logo.startsWith("http://") || logo.startsWith("https://") || logo.startsWith("data:")) return logo;
    if (logo.startsWith("/api/media") || logo.startsWith("/uploads/") || logo.startsWith("api/media") || logo.startsWith("uploads/")) {
      return resolveBackendMedia(logo);
    }
    return publicAsset(logo);
  };

  const handleSave = async (e) => {
    e.preventDefault();
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
      setSuccess("Homepage content, craft story, and brand assets saved successfully!");
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

  return (
    <form onSubmit={handleSave} className="cm-container" data-testid="site-content-manager">
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, margin: 0 }}>
            Homepage & Story Manager
          </h2>
          <p style={{ color: "var(--od-muted)", fontSize: 13, margin: "4px 0 0" }}>
            Live control over the homepage hero banner, material craft story pillars, and partner client logos.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="od-btn" onClick={fetchContent}>
            <RefreshCw size={14} /> Revert
          </button>
          <button type="submit" className="od-btn od-btn--primary" disabled={saving}>
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

      {/* SECTION 1: HOMEPAGE HERO BANNER */}
      <div className="od-card" style={{ marginBottom: 24, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Sparkles size={20} color="var(--od-gold-d)" />
          <h3 style={{ margin: 0, fontSize: 18 }}>01 — Homepage Hero Headlines</h3>
        </div>
        <p style={{ color: "var(--od-muted)", fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Customize the main opening headlines and tagline rendered over the craftsmanship hero.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <label className="od-field">
            <span>Eyebrow Tag</span>
            <input
              type="text"
              value={hero.eyebrow || ""}
              onChange={(e) => handleHeroChange("eyebrow", e.target.value)}
              placeholder="e.g. BDSM · BDS MARVEL"
            />
          </label>
          <label className="od-field">
            <span>Headline Line 1</span>
            <input
              type="text"
              value={hero.title_1 || ""}
              onChange={(e) => handleHeroChange("title_1", e.target.value)}
              placeholder="e.g. Architecture."
            />
          </label>
          <label className="od-field">
            <span>Headline Line 2 (Emphasized)</span>
            <input
              type="text"
              value={hero.title_2 || ""}
              onChange={(e) => handleHeroChange("title_2", e.target.value)}
              placeholder="e.g. Interiors."
            />
          </label>
          <label className="od-field">
            <span>Headline Line 3</span>
            <input
              type="text"
              value={hero.title_3 || ""}
              onChange={(e) => handleHeroChange("title_3", e.target.value)}
              placeholder="e.g. Everything In Between."
            />
          </label>
          <label className="od-field" style={{ gridColumn: "span 2" }}>
            <span>Studio Subtitle / Tagline</span>
            <input
              type="text"
              value={hero.subtitle || ""}
              onChange={(e) => handleHeroChange("subtitle", e.target.value)}
              placeholder="One design and build studio for marble and stone, flooring, turnkey construction and interior design."
            />
          </label>
        </div>
      </div>

      {/* SECTION 2: 02 - MATERIAL CRAFT STORY & PHILOSOPHY */}
      <div className="od-card" style={{ marginBottom: 24, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Layers size={20} color="var(--od-gold-d)" />
            <h3 style={{ margin: 0, fontSize: 18 }}>02 — Material Craft Story & Philosophy</h3>
          </div>
          <button type="button" className="od-btn" onClick={addApproach} style={{ padding: "6px 14px", fontSize: 12 }}>
            <Plus size={13} /> Add Story Pillar
          </button>
        </div>
        <p style={{ color: "var(--od-muted)", fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          These pillar cards showcase full-bleed background images with craft philosophy steps on the homepage.
        </p>

        <div style={{ display: "grid", gap: 18 }}>
          {content.approach.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: "var(--od-paper)",
                borderRadius: 16,
                padding: 18,
                border: "1px solid var(--od-line)",
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: 16,
                position: "relative",
              }}
              className="cm-form-grid"
            >
              {/* Image Preview & Upload */}
              <div>
                <div
                  style={{
                    width: "100%",
                    height: 120,
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#e3dbcc",
                    marginBottom: 8,
                    position: "relative",
                  }}
                >
                  {item.image ? (
                    <img
                      src={img(item.image, 360)}
                      alt={item.title || "Pillar"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--od-muted)" }}>
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>
                <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "6px 10px", fontSize: 11.5, cursor: "pointer" }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleApproachUpload(idx, e.target.files?.[0])}
                    style={{ display: "none" }}
                    disabled={uploadingIdx === idx}
                  />
                  <UploadCloud size={12} /> {uploadingIdx === idx ? "Uploading..." : "Replace Photo"}
                </label>
              </div>

              {/* Text Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="text"
                    value={item.number || `0${idx + 1}`}
                    onChange={(e) => handleApproachChange(idx, "number", e.target.value)}
                    style={{ width: 65, padding: 8, borderRadius: 8, border: "1px solid var(--od-line)", fontWeight: 700, textAlign: "center" }}
                    title="Pillar Number"
                  />
                  <input
                    type="text"
                    value={item.title || ""}
                    onChange={(e) => handleApproachChange(idx, "title", e.target.value)}
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--od-line)", fontWeight: 700 }}
                    placeholder="Pillar Title (e.g. MATERIAL FIRST)"
                  />
                  <button
                    type="button"
                    onClick={() => removeApproach(idx)}
                    style={{ border: "none", background: "none", color: "var(--od-red)", cursor: "pointer", padding: 6 }}
                    title="Delete this pillar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={item.text || ""}
                  onChange={(e) => handleApproachChange(idx, "text", e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--od-line)", fontFamily: "inherit", fontSize: 13, resize: "vertical" }}
                  placeholder="Descriptive craft story text..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 3: PARTNER BRANDS & CLIENTELE */}
      <div className="od-card" style={{ marginBottom: 24, padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Award size={20} color="var(--od-gold-d)" />
            <h3 style={{ margin: 0, fontSize: 18 }}>03 — Partner Brands & Institutional Clients</h3>
          </div>
          <button type="button" className="od-btn" onClick={addClient} style={{ padding: "6px 14px", fontSize: 12 }}>
            <Plus size={13} /> Add Partner Brand
          </button>
        </div>
        <p style={{ color: "var(--od-muted)", fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Logos and client names showcased on the homepage infinite marquee track.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {content.clients.map((c, idx) => {
            const logoSrc = resolveClientLogo(c.logo);
            return (
              <div
                key={idx}
                style={{
                  background: "var(--od-paper)",
                  borderRadius: 14,
                  padding: 12,
                  border: "1px solid var(--od-line)",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                {/* Logo Preview & File Upload */}
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 8,
                      background: "#fff",
                      border: "1px solid var(--od-line)",
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                    }}
                  >
                    {logoSrc ? (
                      <img src={logoSrc} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                    ) : (
                      <ImageIcon size={18} color="var(--od-muted)" />
                    )}
                  </div>
                  <label
                    title="Upload Logo Image"
                    style={{
                      position: "absolute",
                      bottom: -4,
                      right: -4,
                      background: "var(--od-ink)",
                      color: "#fff",
                      borderRadius: "50%",
                      width: 20,
                      height: 20,
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleClientLogoUpload(idx, e.target.files?.[0])}
                      style={{ display: "none" }}
                      disabled={uploadingClientIdx === idx}
                    />
                    {uploadingClientIdx === idx ? <Loader2 size={10} className="od-spin" /> : <UploadCloud size={10} />}
                  </label>
                </div>

                {/* Partner Name Input */}
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={c.name || ""}
                    onChange={(e) => handleClientChange(idx, "name", e.target.value)}
                    placeholder="Brand / Partner Name"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 13, background: "#fff" }}
                  />
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => removeClient(idx)}
                  style={{ border: "none", background: "none", color: "var(--od-muted)", cursor: "pointer", padding: 4 }}
                  title="Remove Brand"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
        <button type="submit" className="od-btn od-btn--primary" disabled={saving} style={{ padding: "12px 32px" }}>
          {saving ? <Loader2 size={14} className="od-spin" /> : <Check size={14} />} Save All Changes
        </button>
      </div>
    </form>
  );
}

export default SiteContentManager;
