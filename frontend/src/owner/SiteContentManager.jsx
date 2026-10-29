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
} from "lucide-react";
import { api } from "../stays/store";
import { img } from "../App";

export function SiteContentManager() {
  const [content, setContent] = useState({ approach: [], clients: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadingIdx, setUploadingIdx] = useState(null);

  const fetchContent = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/site-content");
      setContent({
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

  const handleClientChange = (index, field, value) => {
    setContent((prev) => {
      const copy = [...prev.clients];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, clients: copy };
    });
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
        approach: Array.isArray(updated.approach) ? updated.approach : [],
        clients: Array.isArray(updated.clients) ? updated.clients : [],
      });
      setSuccess("Site story & brand content saved successfully!");
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

  return (
    <form onSubmit={handleSave} className="cm-container" data-testid="site-content-manager">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, margin: 0 }}>
            Story & Brand Assets
          </h2>
          <p style={{ color: "var(--od-muted)", fontSize: 13, margin: "4px 0 0" }}>
            Customize the Material Craft story backgrounds and Client brand partners.
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

      {/* Section 1: 02 - How BDS Marvel Builds (Approach Accordion) */}
      <div className="od-sec-box">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Layers size={20} color="var(--od-gold-d)" />
          <h3 style={{ margin: 0 }}>02 — Material Craft Story & Philosophy</h3>
        </div>
        <p>These 4 pillar steps display full-bleed photo backgrounds on the homepage and about page.</p>

        <div style={{ display: "grid", gap: 20 }}>
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
                  }}
                >
                  {item.image ? (
                    <img src={img(item.image, 300)} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--od-muted)" }}>
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>
                <label className="od-btn cm-file-btn" style={{ width: "100%", justifyContent: "center", padding: "6px 10px", fontSize: 11.5 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleApproachUpload(idx, e.target.files?.[0])}
                    style={{ display: "none" }}
                    disabled={uploadingIdx === idx}
                  />
                  <UploadCloud size={12} /> {uploadingIdx === idx ? "Uploading..." : "Replace Image"}
                </label>
              </div>

              {/* Text Fields */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    value={item.number || `0${idx + 1}`}
                    onChange={(e) => handleApproachChange(idx, "number", e.target.value)}
                    style={{ width: 60, padding: 8, borderRadius: 8, border: "1px solid var(--od-line)", fontWeight: 700 }}
                  />
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => handleApproachChange(idx, "title", e.target.value)}
                    style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--od-line)", fontWeight: 700 }}
                    placeholder="Pillar Title"
                  />
                </div>
                <textarea
                  rows={3}
                  value={item.text}
                  onChange={(e) => handleApproachChange(idx, "text", e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--od-line)", fontFamily: "inherit", fontSize: 13 }}
                  placeholder="Descriptive craft text..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Clients & Brand Partners */}
      <div className="od-sec-box">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Award size={20} color="var(--od-gold-d)" />
          <h3 style={{ margin: 0 }}>Partner Brands & Institutional Clients</h3>
        </div>
        <p>Logos and client names showcased on the homepage reel.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {content.clients.map((c, idx) => (
            <div
              key={idx}
              style={{
                background: "var(--od-paper)",
                borderRadius: 12,
                padding: 12,
                border: "1px solid var(--od-line)",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={c.name}
                onChange={(e) => handleClientChange(idx, "name", e.target.value)}
                placeholder="Partner Name"
                style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 12.5 }}
              />
              <button
                type="button"
                onClick={() => removeClient(idx)}
                style={{ border: "none", background: "none", color: "var(--od-muted)", cursor: "pointer", padding: 4 }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="od-btn" onClick={addClient} style={{ marginTop: 14 }}>
          <Plus size={13} /> Add Partner Brand
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button type="submit" className="od-btn od-btn--primary" disabled={saving} style={{ padding: "12px 28px" }}>
          {saving ? <Loader2 size={14} className="od-spin" /> : <Check size={14} />} Save All Changes
        </button>
      </div>
    </form>
  );
}

export default SiteContentManager;
