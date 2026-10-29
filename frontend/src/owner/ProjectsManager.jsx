import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Search,
  X,
  UploadCloud,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  Check,
  Calendar,
  MapPin,
  Tag,
} from "lucide-react";
import { api } from "../stays/store";
import { img } from "../App";

const SEGMENTS = ["MARBLE & STONE", "INTERIOR DECOR", "CONSTRUCTION", "FLOORING"];
const CATEGORIES = ["Residential", "Hospitality", "Commercial", "Amenity", "Civic", "Retail"];

export function ProjectsManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("All");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    segment: "MARBLE & STONE",
    category: "Residential",
    year: String(new Date().getFullYear()),
    location: "",
    image: "",
    gallery: [],
    description: "",
    challenge: "",
    approach: "",
    outcomes: [["", ""]],
    credits: [""],
    is_active: true,
  });

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/projects?all=true");
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      title: "",
      slug: "",
      segment: "MARBLE & STONE",
      category: "Residential",
      year: String(new Date().getFullYear()),
      location: "",
      image: "",
      gallery: [],
      description: "",
      challenge: "",
      approach: "",
      outcomes: [["", ""]],
      credits: ["BDS Marvel — Design & Build"],
      is_active: true,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title || "",
      slug: item.slug || "",
      segment: item.segment || "MARBLE & STONE",
      category: item.category || "Residential",
      year: item.year || String(new Date().getFullYear()),
      location: item.location || "",
      image: item.image || "",
      gallery: Array.isArray(item.gallery) ? item.gallery : [],
      description: item.description || "",
      challenge: item.challenge || "",
      approach: item.approach || "",
      outcomes: Array.isArray(item.outcomes) && item.outcomes.length ? item.outcomes : [["", ""]],
      credits: Array.isArray(item.credits) && item.credits.length ? item.credits : [""],
      is_active: item.is_active !== false,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleHeroUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    setFormError("");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api("/admin/media/upload", { method: "POST", body: data });
      setFormData((prev) => ({ ...prev, image: res.url }));
    } catch (err) {
      setFormError("Hero image upload failed: " + err.message);
    } finally {
      setUploadingHero(false);
      e.target.value = "";
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingGallery(true);
    setFormError("");
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const data = new FormData();
        data.append("file", file);
        const res = await api("/admin/media/upload", { method: "POST", body: data });
        uploadedUrls.push(res.url);
      }
      setFormData((prev) => ({
        ...prev,
        gallery: [...(prev.gallery || []), ...uploadedUrls],
      }));
    } catch (err) {
      setFormError("Gallery upload failed: " + err.message);
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  };

  const removeGalleryImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index),
    }));
  };

  const handleOutcomeChange = (index, part, val) => {
    setFormData((prev) => {
      const copy = prev.outcomes.map((row, i) => (i === index ? (part === 0 ? [val, row[1]] : [row[0], val]) : row));
      return { ...prev, outcomes: copy };
    });
  };

  const addOutcomeRow = () => {
    setFormData((prev) => ({ ...prev, outcomes: [...prev.outcomes, ["", ""]] }));
  };

  const removeOutcomeRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      outcomes: prev.outcomes.filter((_, i) => i !== index),
    }));
  };

  const handleCreditChange = (index, val) => {
    setFormData((prev) => {
      const copy = [...prev.credits];
      copy[index] = val;
      return { ...prev, credits: copy };
    });
  };

  const addCreditRow = () => {
    setFormData((prev) => ({ ...prev, credits: [...prev.credits, ""] }));
  };

  const removeCreditRow = (index) => {
    setFormData((prev) => ({ ...prev, credits: prev.credits.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError("Project title is required.");
      return;
    }
    if (!formData.image.trim()) {
      setFormError("Hero cover image is required.");
      return;
    }

    setSaving(true);
    setFormError("");

    const payload = {
      ...formData,
      outcomes: formData.outcomes.filter(([val, label]) => val.trim() || label.trim()),
      credits: formData.credits.filter((c) => c.trim()),
    };

    try {
      if (editingItem) {
        const id = editingItem.id || editingItem.slug;
        const updated = await api(`/admin/projects/${id}`, { method: "PUT", body: payload });
        setItems((prev) => prev.map((item) => (item.id === id || item.slug === id ? updated : item)));
      } else {
        const created = await api("/admin/projects", { method: "POST", body: payload });
        setItems((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || "Failed to save project.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const id = deleteTarget.id || deleteTarget.slug;
      await api(`/admin/projects/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id && item.slug !== id));
      setDeleteTarget(null);
    } catch (err) {
      alert("Delete failed: " + err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggleActive = async (item) => {
    const nextActive = !item.is_active;
    const id = item.id || item.slug;
    try {
      const updated = await api(`/admin/projects/${id}`, {
        method: "PUT",
        body: { ...item, is_active: nextActive },
      });
      setItems((prev) => prev.map((it) => (it.id === id || it.slug === id ? updated : it)));
    } catch (err) {
      alert("Status toggle failed: " + err.message);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSegment = segmentFilter === "All" || item.segment === segmentFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q));
      return matchesSegment && matchesSearch;
    });
  }, [items, segmentFilter, search]);

  return (
    <div className="cm-container" data-testid="projects-manager">
      {/* Metrics Row */}
      <div className="od-stats" style={{ marginBottom: 20 }}>
        <div className="od-stat">
          <b>{items.length}</b>
          <span>Total Case Studies</span>
        </div>
        <div className="od-stat">
          <b>{items.filter((it) => it.is_active !== false).length}</b>
          <span>Active in Portfolio</span>
        </div>
        <div className="od-stat">
          <b>{Array.from(new Set(items.map((it) => it.segment))).length}</b>
          <span>Studio Verticals</span>
        </div>
        <div className="od-stat">
          <b>{Array.from(new Set(items.map((it) => it.category))).length}</b>
          <span>Typologies</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cm-toolbar">
        <div className="cm-search-wrap">
          <Search size={16} className="cm-search-icon" />
          <input
            type="text"
            className="cm-search-input"
            placeholder="Search projects by title, category, location, or brief..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="project-search-input"
          />
          {search && (
            <button type="button" className="cm-clear-btn" onClick={() => setSearch("")} aria-label="Clear">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="cm-filters">
          <div className="cm-select-wrap">
            <span className="cm-select-label">Segment:</span>
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="cm-select"
              data-testid="project-segment-filter"
            >
              <option value="All">All Verticals</option>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="od-btn" onClick={fetchProjects} title="Refresh" data-testid="projects-refresh-btn">
            <RefreshCw size={14} />
          </button>

          <button
            type="button"
            className="od-btn od-btn--primary cm-add-btn"
            onClick={openCreateModal}
            data-testid="project-add-btn"
          >
            <Plus size={15} /> Add Case Study
          </button>
        </div>
      </div>

      {error && <div className="od-error" role="alert">{error}</div>}

      {/* Grid */}
      {loading ? (
        <div className="od-center">
          <Loader2 size={26} className="od-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="od-empty">
          <p>No projects found matching your criteria.</p>
        </div>
      ) : (
        <div className="cm-grid" data-testid="projects-grid">
          {filteredItems.map((item) => (
            <div
              key={item.id || item.slug}
              className={`cm-card ${item.is_active === false ? "is-inactive" : ""}`}
              data-testid={`project-card-${item.slug}`}
            >
              <div className="cm-card__media">
                {item.image ? (
                  <img src={img(item.image, 600)} alt={item.title} className="cm-card__img" loading="lazy" />
                ) : (
                  <div className="cm-card__img-ph">
                    <ImageIcon size={32} />
                  </div>
                )}
                <div className="cm-card__media-badges">
                  <span className="cm-badge cm-badge--brand">{item.segment}</span>
                  <span className={`cm-status-pill ${item.is_active !== false ? "is-active" : "is-hidden"}`}>
                    {item.is_active !== false ? "Active" : "Hidden"}
                  </span>
                </div>
              </div>

              <div className="cm-card__body">
                <div className="cm-card__header">
                  <div>
                    <span className="cm-card__cat">{item.category}</span>
                    <h3 className="cm-card__title">{item.title}</h3>
                    <p className="cm-card__slug">
                      {item.location} · {item.year}
                    </p>
                  </div>
                </div>

                <p className="cm-card__desc">{item.description}</p>

                {item.gallery && item.gallery.length > 0 && (
                  <div className="cm-card__meta-tags">
                    <span className="cm-tag">+{item.gallery.length} gallery images</span>
                  </div>
                )}

                <div className="cm-card__footer">
                  <div className="cm-card__links">
                    <a
                      href={`/projects/${item.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="cm-icon-link"
                      title="Preview case study"
                    >
                      <ExternalLink size={13} /> View Live
                    </a>
                    <button
                      type="button"
                      className="cm-toggle-active-btn"
                      onClick={() => toggleActive(item)}
                      title={item.is_active !== false ? "Hide project" : "Show project"}
                    >
                      {item.is_active !== false ? <EyeOff size={13} /> : <Eye size={13} />}
                      {item.is_active !== false ? "Hide" : "Show"}
                    </button>
                  </div>

                  <div className="cm-card__actions">
                    <button
                      type="button"
                      className="od-btn cm-btn-sm"
                      onClick={() => openEditModal(item)}
                      data-testid={`edit-project-${item.slug}`}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      className="od-btn od-btn--decline cm-btn-sm"
                      onClick={() => setDeleteTarget(item)}
                      data-testid={`delete-project-${item.slug}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="cm-modal-overlay" role="dialog" aria-modal="true">
          <div className="cm-modal cm-modal--lg">
            <div className="cm-modal__head">
              <h2 className="cm-modal__title">{editingItem ? "Edit Case Study" : "Add New Case Study"}</h2>
              <button
                type="button"
                className="cm-modal__close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="cm-form">
              {formError && <div className="od-error" role="alert">{formError}</div>}

              <div className="cm-form-grid">
                <label className="od-field cm-col-2">
                  <span>Project Title *</span>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Meridian Residences"
                  />
                </label>

                <label className="od-field">
                  <span>Studio Vertical *</span>
                  <select
                    className="cm-select"
                    style={{ width: "100%", padding: 12, border: "1px solid var(--od-line)", borderRadius: 12 }}
                    value={formData.segment}
                    onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                  >
                    {SEGMENTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="od-field">
                  <span>Typology *</span>
                  <select
                    className="cm-select"
                    style={{ width: "100%", padding: 12, border: "1px solid var(--od-line)", borderRadius: 12 }}
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="od-field">
                  <span>Location</span>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Alibaug, Maharashtra"
                  />
                </label>

                <label className="od-field">
                  <span>Year</span>
                  <input
                    type="text"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    placeholder="2024"
                  />
                </label>

                {/* Hero Photo Upload */}
                <div className="od-field cm-col-2">
                  <span>Cover Hero Image *</span>
                  <div className="cm-upload-grid">
                    <div className="cm-image-preview-wrap">
                      {formData.image ? (
                        <img src={img(formData.image, 400)} alt="Hero preview" className="cm-image-preview" />
                      ) : (
                        <div className="cm-card__img-ph">
                          <ImageIcon size={30} />
                          <small>No image</small>
                        </div>
                      )}
                    </div>
                    <div className="cm-upload-controls">
                      <label className="od-btn od-btn--primary cm-file-btn">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleHeroUpload}
                          style={{ display: "none" }}
                          disabled={uploadingHero}
                        />
                        <UploadCloud size={14} />
                        <b>{uploadingHero ? "Uploading image..." : "Upload Cover Photo"}</b>
                        {uploadingHero && <Loader2 size={14} className="od-spin" />}
                      </label>
                      <input
                        type="text"
                        value={formData.image}
                        onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                        placeholder="Or paste external image URL / photo ID"
                        style={{ width: "100%", padding: 10, border: "1px solid var(--od-line)", borderRadius: 10 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Multi-Photo Gallery */}
                <div className="od-field cm-col-2">
                  <span>Case Study Gallery Photos</span>
                  <div className="cm-gallery-manager">
                    <div className="cm-gallery-grid">
                      {formData.gallery.map((gImg, idx) => (
                        <div key={idx} className="cm-gallery-thumb">
                          <img src={img(gImg, 200)} alt={`Gallery ${idx + 1}`} />
                          <button
                            type="button"
                            className="cm-gallery-thumb__del"
                            onClick={() => removeGalleryImage(idx)}
                            aria-label="Remove"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <label className="od-btn cm-file-btn" style={{ marginTop: 10 }}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleGalleryUpload}
                        style={{ display: "none" }}
                        disabled={uploadingGallery}
                      />
                      <UploadCloud size={13} /> {uploadingGallery ? "Uploading..." : "Add Gallery Photos"}
                    </label>
                  </div>
                </div>

                <label className="od-field cm-col-2">
                  <span>Project Overview & Description</span>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short architectural summary..."
                    style={{ width: "100%", padding: 12, border: "1px solid var(--od-line)", borderRadius: 12, fontFamily: "inherit" }}
                  />
                </label>

                <label className="od-field cm-col-2">
                  <span>The Challenge (01 — Brief)</span>
                  <textarea
                    rows={2}
                    value={formData.challenge}
                    onChange={(e) => setFormData({ ...formData, challenge: e.target.value })}
                    placeholder="What was the client's material or architectural problem?"
                    style={{ width: "100%", padding: 12, border: "1px solid var(--od-line)", borderRadius: 12, fontFamily: "inherit" }}
                  />
                </label>

                <label className="od-field cm-col-2">
                  <span>The Approach (01 — Brief)</span>
                  <textarea
                    rows={2}
                    value={formData.approach}
                    onChange={(e) => setFormData({ ...formData, approach: e.target.value })}
                    placeholder="How did the in-house studio solve it?"
                    style={{ width: "100%", padding: 12, border: "1px solid var(--od-line)", borderRadius: 12, fontFamily: "inherit" }}
                  />
                </label>

                {/* Outcomes / Stats */}
                <div className="od-field cm-col-2">
                  <span>Outcomes & Proof Numbers</span>
                  {formData.outcomes.map((row, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <input
                        type="text"
                        value={row[0]}
                        onChange={(e) => handleOutcomeChange(idx, 0, e.target.value)}
                        placeholder="Value (e.g. 12)"
                        style={{ width: "30%", padding: "8px 12px", border: "1px solid var(--od-line)", borderRadius: 10 }}
                      />
                      <input
                        type="text"
                        value={row[1]}
                        onChange={(e) => handleOutcomeChange(idx, 1, e.target.value)}
                        placeholder="Label (e.g. villas delivered)"
                        style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--od-line)", borderRadius: 10 }}
                      />
                      <button
                        type="button"
                        onClick={() => removeOutcomeRow(idx)}
                        style={{ border: "none", background: "none", color: "var(--od-muted)", cursor: "pointer" }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="od-btn" onClick={addOutcomeRow} style={{ padding: "6px 14px", fontSize: 12 }}>
                    <Plus size={12} /> Add Metric
                  </button>
                </div>

                {/* Active Toggle */}
                <div className="cm-col-2 cm-active-toggle-wrap">
                  <label className="cm-checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <span>Publish & display in live portfolio and slideshow</span>
                  </label>
                </div>
              </div>

              <div className="cm-modal__footer" style={{ marginTop: 20 }}>
                <button type="button" className="od-btn" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="od-btn od-btn--primary" disabled={saving}>
                  {saving ? <Loader2 size={14} className="od-spin" /> : <Check size={14} />}
                  {editingItem ? "Save Changes" : "Create Case Study"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="cm-modal-overlay" role="dialog" aria-modal="true">
          <div className="cm-modal cm-modal--sm">
            <h2 className="cm-modal__title">Delete Case Study?</h2>
            <p className="cm-delete-msg">
              Are you sure you want to remove <strong>"{deleteTarget.title}"</strong>? This will permanently delete the project from the portfolio.
            </p>
            <div className="cm-modal__footer" style={{ padding: 0, background: "none", border: "none" }}>
              <button type="button" className="od-btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="od-btn od-btn--decline"
                onClick={handleDelete}
                disabled={deleteBusy}
                data-testid="confirm-delete-project"
              >
                {deleteBusy ? <Loader2 size={14} className="od-spin" /> : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsManager;
