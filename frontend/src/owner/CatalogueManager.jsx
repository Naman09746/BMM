import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { api } from "../stays/store";
import { stopSmoothScroll, startSmoothScroll } from "../lib/smoothScroll";

const DEFAULT_BRANDS = ["DrawStones", "Renest", "Grain", "BDS Marvel", "Vignette", "Formwork"];
const DEFAULT_CATEGORIES = [
  "Marble & Stone",
  "Flooring",
  "Furniture",
  "Interior Designing",
  "Construction",
  "Interior Decor",
];

const IMG_PREFIX = "https://images.unsplash.com/";
const resolveImg = (id) => {
  if (!id) return "";
  if (typeof id === "string" && id.includes("drive.google.com")) {
    const m = id.match(/\/d\/([a-zA-Z0-9_-]+)/) || id.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  }
  if (id.startsWith("http") || id.startsWith("/") || id.startsWith("data:")) return id;
  return `${IMG_PREFIX}${id}?auto=format&fit=crop&w=600&q=80`;
};

const DEFAULT_ITEM = {
  name: "",
  slug: "",
  brand: "DrawStones",
  category: "Marble & Stone",
  material: "Marble",
  product: "Tables",
  application: "Living",
  origin: "",
  image: "",
  desc: "",
  specs: [["Material", "Marble"], ["Lead time", "4 – 6 weeks"]],
  gallery: [],
  is_active: true,
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-");
}

export default function CatalogueManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("All");
  const [catFilter, setCatFilter] = useState("All");

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_ITEM);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [customBrandMode, setCustomBrandMode] = useState(false);
  const [customBrandInput, setCustomBrandInput] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchCatalogue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/catalogue?all=true");
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load catalogue items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogue();
  }, [fetchCatalogue]);

  useEffect(() => {
    if (isModalOpen || deleteTarget) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      stopSmoothScroll();
      return () => {
        document.body.style.overflow = prevOverflow;
        startSmoothScroll();
      };
    }
  }, [isModalOpen, deleteTarget]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (brandFilter !== "All" && item.brand !== brandFilter) return false;
      if (catFilter !== "All" && item.category !== catFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (item.name || "").toLowerCase().includes(q);
        const matchesSlug = (item.slug || "").toLowerCase().includes(q);
        const matchesMaterial = (item.material || "").toLowerCase().includes(q);
        const matchesBrand = (item.brand || "").toLowerCase().includes(q);
        const matchesProduct = (item.product || "").toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesMaterial && !matchesBrand && !matchesProduct) {
          return false;
        }
      }
      return true;
    });
  }, [items, brandFilter, catFilter, search]);

  const availableBrands = useMemo(() => {
    const list = [...DEFAULT_BRANDS];
    items.forEach((it) => {
      const b = (it.brand || "").trim();
      if (b && !list.includes(b)) list.push(b);
    });
    return list;
  }, [items]);

  const availableCategories = useMemo(() => {
    const list = [...DEFAULT_CATEGORIES];
    items.forEach((it) => {
      const c = (it.category || "").trim();
      if (c && !list.includes(c)) list.push(c);
    });
    return list;
  }, [items]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((i) => i.is_active !== false).length;
    const brands = new Set(items.map((i) => i.brand).filter(Boolean)).size;
    const categories = new Set(items.map((i) => i.category).filter(Boolean)).size;
    return { total, active, brands, categories };
  }, [items]);

  const openCreateModal = () => {
    setEditingItem(null);
    setCustomBrandMode(false);
    setCustomBrandInput("");
    setFormData({ ...DEFAULT_ITEM, specs: [["Material", "Marble"], ["Lead time", "4 – 6 weeks"]], gallery: [] });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setCustomBrandMode(false);
    setCustomBrandInput("");
    setFormData({
      name: item.name || "",
      slug: item.slug || "",
      brand: item.brand || "DrawStones",
      category: item.category || "Marble & Stone",
      material: item.material || "",
      product: item.product || "",
      application: item.application || "Living",
      origin: item.origin || "",
      image: item.image || "",
      desc: item.desc || item.description || "",
      specs: Array.isArray(item.specs) && item.specs.length ? item.specs : [["Material", "Marble"]],
      gallery: Array.isArray(item.gallery) ? item.gallery : [],
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
      setFormError("Hero upload failed: " + err.message);
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

  const handleSpecChange = (index, keyOrVal, value) => {
    setFormData((prev) => {
      const nextSpecs = [...prev.specs];
      const current = nextSpecs[index] || ["", ""];
      if (keyOrVal === 0) nextSpecs[index] = [value, current[1]];
      else nextSpecs[index] = [current[0], value];
      return { ...prev, specs: nextSpecs };
    });
  };

  const addSpecRow = () => {
    setFormData((prev) => ({ ...prev, specs: [...prev.specs, ["", ""]] }));
  };

  const removeSpecRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      specs: prev.specs.filter((_, i) => i !== index),
    }));
  };

  const removeGalleryImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index),
    }));
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (!formData.image.trim()) {
      setFormError("Hero image is required (upload or provide URL/ID).");
      return;
    }
    setFormBusy(true);
    setFormError("");
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        slug: formData.slug.trim() || slugify(formData.name),
        specs: formData.specs.filter(([k, v]) => k && k.trim() && v && v.trim()),
      };

      if (editingItem) {
        const id = editingItem.id || editingItem.slug;
        const updated = await api(`/admin/catalogue/${id}`, {
          method: "PUT",
          body: payload,
        });
        setItems((prev) =>
          prev.map((i) => (i.id === editingItem.id || i.slug === editingItem.slug ? updated : i))
        );
      } else {
        const created = await api("/admin/catalogue", {
          method: "POST",
          body: payload,
        });
        setItems((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || "Failed to save product.");
    } finally {
      setFormBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const id = deleteTarget.id || deleteTarget.slug;
      await api(`/admin/catalogue/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id && i.slug !== deleteTarget.slug));
      setDeleteTarget(null);
    } catch (err) {
      alert("Failed to delete: " + err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggleItemActive = async (item) => {
    const newStatus = !(item.is_active !== false);
    try {
      const id = item.id || item.slug;
      const updated = await api(`/admin/catalogue/${id}`, {
        method: "PUT",
        body: { ...item, is_active: newStatus },
      });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id || i.slug === item.slug ? updated : i))
      );
    } catch (err) {
      alert("Status update failed: " + err.message);
    }
  };

  return (
    <div className="cm-container" data-testid="catalogue-manager">
      {/* Top statistics */}
      <div className="od-stats cm-stats">
        <div className="od-stat">
          <b>{stats.total}</b>
          <span>Total Products</span>
        </div>
        <div className="od-stat">
          <b>{stats.active}</b>
          <span>Active In Catalogue</span>
        </div>
        <div className="od-stat">
          <b>{stats.brands}</b>
          <span>Brands / Lines</span>
        </div>
        <div className="od-stat">
          <b>{stats.categories}</b>
          <span>Categories</span>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="cm-toolbar">
        <div className="cm-search-wrap">
          <Search size={16} className="cm-search-icon" />
          <input
            type="text"
            className="cm-search-input"
            placeholder="Search catalogue by name, slug, material, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="catalogue-search-input"
          />
          {search && (
            <button
              type="button"
              className="cm-clear-btn"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="cm-filters">
          <div className="cm-select-wrap">
            <span className="cm-select-label">Brand:</span>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="cm-select"
              data-testid="catalogue-brand-filter"
            >
              <option value="All">All Brands</option>
              {availableBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="cm-select-wrap">
            <span className="cm-select-label">Category:</span>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="cm-select"
              data-testid="catalogue-cat-filter"
            >
              <option value="All">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="od-btn"
            onClick={fetchCatalogue}
            title="Refresh catalogue"
            data-testid="catalogue-refresh-btn"
          >
            <RefreshCw size={14} />
          </button>

          <button
            type="button"
            className="od-btn od-btn--primary cm-add-btn"
            onClick={openCreateModal}
            data-testid="catalogue-add-btn"
          >
            <Plus size={15} /> Add New Product
          </button>
        </div>
      </div>

      {error && (
        <div className="od-error" role="alert" data-testid="catalogue-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Product List */}
      {loading ? (
        <div className="od-center">
          <Loader2 size={28} className="od-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="od-empty" data-testid="catalogue-empty">
          No catalogue items found. Click “Add New Product” to add your first inventory piece.
        </div>
      ) : (
        <div className="cm-grid" data-testid="catalogue-grid">
          {filteredItems.map((item) => {
            const id = item.id || item.slug;
            const imgSrc = resolveImg(item.image);
            const specs = Array.isArray(item.specs) ? item.specs : [];
            const isActive = item.is_active !== false;

            return (
              <article
                key={id}
                className={`cm-card ${!isActive ? "is-inactive" : ""}`}
                data-testid={`catalogue-card-${item.slug}`}
              >
                <div className="cm-card__media">
                  {imgSrc ? (
                    <img src={imgSrc} alt={item.name} className="cm-card__img" loading="lazy" />
                  ) : (
                    <div className="cm-card__img-ph">
                      <ImageIcon size={28} opacity={0.4} />
                    </div>
                  )}
                  <div className="cm-card__media-badges">
                    <span className="cm-badge cm-badge--brand">{item.brand}</span>
                    <span className={`cm-status-pill ${isActive ? "is-active" : "is-hidden"}`}>
                      {isActive ? "Active" : "Hidden"}
                    </span>
                  </div>
                </div>

                <div className="cm-card__body">
                  <div className="cm-card__header">
                    <div>
                      <span className="cm-card__cat">{item.category}</span>
                      <h3 className="cm-card__title">{item.name}</h3>
                      <p className="cm-card__slug">slug: {item.slug}</p>
                    </div>
                  </div>

                  <p className="cm-card__desc">
                    {item.desc || item.description || "No description provided."}
                  </p>

                  <div className="cm-card__meta-tags">
                    {item.material && <span className="cm-tag">Mat: {item.material}</span>}
                    {item.product && <span className="cm-tag">{item.product}</span>}
                    {item.application && <span className="cm-tag">{item.application}</span>}
                    {item.origin && <span className="cm-tag">{item.origin}</span>}
                  </div>

                  {specs.length > 0 && (
                    <div className="cm-card__specs">
                      {specs.slice(0, 3).map(([k, v], idx) => (
                        <div key={idx} className="cm-spec-item">
                          <span className="cm-spec-k">{k}:</span>{" "}
                          <span className="cm-spec-v">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="cm-card__footer">
                    <div className="cm-card__links">
                      <a
                        href={`/catalogue/${item.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="cm-icon-link"
                        title="View live product page"
                      >
                        <ExternalLink size={14} /> Preview
                      </a>
                      <button
                        type="button"
                        className="cm-toggle-active-btn"
                        onClick={() => toggleItemActive(item)}
                        title={isActive ? "Hide from website" : "Show on website"}
                      >
                        {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                        {isActive ? "Active" : "Hidden"}
                      </button>
                    </div>

                    <div className="cm-card__actions">
                      <button
                        type="button"
                        className="od-btn cm-btn-sm"
                        onClick={() => openEditModal(item)}
                        data-testid={`edit-catalogue-${item.slug}`}
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                      <button
                        type="button"
                        className="od-btn od-btn--decline cm-btn-sm"
                        onClick={() => setDeleteTarget(item)}
                        data-testid={`delete-catalogue-${item.slug}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Add / Edit Slide-over Modal */}
      {isModalOpen && (
        <div
          className="cm-modal-overlay"
          role="dialog"
          aria-modal="true"
          data-lenis-prevent="true"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div
            className="cm-modal cm-modal--lg"
            data-testid="catalogue-form-modal"
            data-lenis-prevent="true"
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="cm-modal__head">
              <div>
                <p className="od-kicker">Inventory Editor</p>
                <h2 className="cm-modal__title">
                  {editingItem ? `Edit: ${editingItem.name}` : "Add New Catalogue Product"}
                </h2>
              </div>
              <button
                type="button"
                className="cm-modal__close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={saveProduct}
              className="cm-form"
              data-lenis-prevent="true"
              onWheel={(e) => e.stopPropagation()}
            >
              {formError && (
                <div className="od-error" role="alert">
                  <AlertCircle size={15} /> {formError}
                </div>
              )}

              <div className="cm-form-grid">
                {/* Product Name */}
                <label className="od-field cm-col-2">
                  <span>Product Name *</span>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    placeholder="e.g. Centre & End Tables"
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name,
                        slug: !editingItem && !prev.slugTouched ? slugify(name) : prev.slug,
                      }));
                    }}
                    data-testid="catalogue-form-name"
                  />
                </label>

                {/* Slug */}
                <label className="od-field">
                  <span>Unique Slug *</span>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    placeholder="e.g. center-end-tables"
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, slug: e.target.value, slugTouched: true }))
                    }
                    data-testid="catalogue-form-slug"
                  />
                </label>

                {/* Brand */}
                <label className="od-field">
                  <span>Brand / Line</span>
                  <div className="cm-inline-input" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <select
                      value={customBrandMode ? "__custom__" : formData.brand}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setCustomBrandMode(true);
                          setFormData((prev) => ({ ...prev, brand: customBrandInput.trim() || "" }));
                        } else {
                          setCustomBrandMode(false);
                          setFormData((prev) => ({ ...prev, brand: e.target.value }));
                        }
                      }}
                      data-testid="catalogue-form-brand"
                    >
                      {availableBrands.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                      <option value="__custom__">+ Add Custom Brand...</option>
                    </select>
                    {customBrandMode && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="Type new brand name (e.g. Royal Marbles)"
                          value={customBrandInput}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomBrandInput(val);
                            setFormData((prev) => ({ ...prev, brand: val }));
                          }}
                          className="cm-text-input"
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          className="od-btn cm-btn-sm"
                          onClick={() => {
                            setCustomBrandMode(false);
                            setFormData((prev) => ({ ...prev, brand: availableBrands[0] || "DrawStones" }));
                          }}
                          title="Cancel custom brand"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </label>

                {/* Category */}
                <label className="od-field">
                  <span>Category</span>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    data-testid="catalogue-form-category"
                  >
                    {availableCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Material */}
                <label className="od-field">
                  <span>Material</span>
                  <input
                    type="text"
                    value={formData.material}
                    placeholder="e.g. Marble, Sandstone, Oak"
                    onChange={(e) => setFormData((prev) => ({ ...prev, material: e.target.value }))}
                  />
                </label>

                {/* Product Type */}
                <label className="od-field">
                  <span>Product Type</span>
                  <input
                    type="text"
                    value={formData.product}
                    placeholder="e.g. Tables, Fireplaces, Basins"
                    onChange={(e) => setFormData((prev) => ({ ...prev, product: e.target.value }))}
                  />
                </label>

                {/* Application */}
                <label className="od-field">
                  <span>Application</span>
                  <input
                    type="text"
                    value={formData.application}
                    placeholder="e.g. Living, Garden, Bathroom"
                    onChange={(e) => setFormData((prev) => ({ ...prev, application: e.target.value }))}
                  />
                </label>

                {/* Origin / Craft */}
                <label className="od-field cm-col-2">
                  <span>Origin / Craft / Stone Details</span>
                  <input
                    type="text"
                    value={formData.origin}
                    placeholder="e.g. Hand-carved Vietnam white marble, Pietra dura inlay"
                    onChange={(e) => setFormData((prev) => ({ ...prev, origin: e.target.value }))}
                  />
                </label>

                {/* Description */}
                <label className="od-field cm-col-2">
                  <span>Description / Story</span>
                  <textarea
                    rows={4}
                    value={formData.desc}
                    placeholder="Craftsmanship narrative, design aesthetic and usage overview..."
                    className="cm-textarea"
                    onChange={(e) => setFormData((prev) => ({ ...prev, desc: e.target.value }))}
                    data-testid="catalogue-form-desc"
                  />
                </label>
              </div>

              {/* Hero Image Section */}
              <div className="cm-section">
                <h4 className="cm-section__title">Hero Image</h4>
                <div className="cm-upload-grid">
                  <div className="cm-image-preview-wrap">
                    {formData.image ? (
                      <img
                        src={resolveImg(formData.image)}
                        alt="Hero preview"
                        className="cm-image-preview"
                      />
                    ) : (
                      <div className="cm-image-preview-placeholder">
                        <ImageIcon size={32} opacity={0.3} />
                        <span>No hero image selected</span>
                      </div>
                    )}
                  </div>

                  <div className="cm-upload-controls">
                    <label className="cm-dropzone">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleHeroUpload}
                        disabled={uploadingHero}
                        className="cm-file-input"
                        data-testid="catalogue-hero-file-input"
                      />
                      <UploadCloud size={24} className="cm-dropzone-icon" />
                      <b>{uploadingHero ? "Uploading image..." : "Click or drag image to upload"}</b>
                      <span>Supports JPG, PNG, WEBP up to 15MB</span>
                      {uploadingHero && <Loader2 size={16} className="od-spin" />}
                    </label>

                    <div className="cm-or-divider">
                      <span>OR PASTE URL / UNSPLASH ID</span>
                    </div>

                    <input
                      type="text"
                      className="cm-text-input"
                      value={formData.image}
                      placeholder="e.g. photo-1692262089751-7e26b69ad8d1 or https://..."
                      onChange={(e) => setFormData((prev) => ({ ...prev, image: e.target.value }))}
                      data-testid="catalogue-form-image-url"
                    />
                  </div>
                </div>
              </div>

              {/* Specifications Editor */}
              <div className="cm-section">
                <div className="cm-section__header">
                  <h4 className="cm-section__title">Specifications (Key-Value)</h4>
                  <button type="button" className="od-btn cm-btn-sm" onClick={addSpecRow}>
                    <Plus size={13} /> Add Spec
                  </button>
                </div>

                <div className="cm-specs-editor">
                  {formData.specs.map(([k, v], idx) => (
                    <div key={idx} className="cm-spec-row">
                      <input
                        type="text"
                        placeholder="Spec (e.g. Lead time)"
                        value={k}
                        onChange={(e) => handleSpecChange(idx, 0, e.target.value)}
                        className="cm-spec-k-input"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. 4 – 6 weeks)"
                        value={v}
                        onChange={(e) => handleSpecChange(idx, 1, e.target.value)}
                        className="cm-spec-v-input"
                      />
                      <button
                        type="button"
                        className="cm-spec-del"
                        onClick={() => removeSpecRow(idx)}
                        aria-label="Remove spec"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gallery Images Section */}
              <div className="cm-section">
                <div className="cm-section__header">
                  <h4 className="cm-section__title">
                    Gallery Images ({formData.gallery?.length || 0})
                  </h4>
                  <label className="od-btn cm-btn-sm cm-file-btn">
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleGalleryUpload}
                      disabled={uploadingGallery}
                      className="cm-file-input"
                    />
                    <UploadCloud size={13} /> {uploadingGallery ? "Uploading..." : "Upload Photos"}
                  </label>
                </div>

                <div className="cm-gallery-preview-grid">
                  {formData.gallery?.map((gId, idx) => (
                    <div key={idx} className="cm-gallery-thumb">
                      <img src={resolveImg(gId)} alt={`Gallery ${idx + 1}`} />
                      <button
                        type="button"
                        className="cm-gallery-thumb__del"
                        onClick={() => removeGalleryImage(idx)}
                        aria-label="Remove gallery photo"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  {(!formData.gallery || formData.gallery.length === 0) && (
                    <p className="cm-muted-note">No additional gallery photos yet.</p>
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="cm-active-toggle-wrap">
                <label className="cm-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                  />
                  <span>Active & Visible in Public Catalogue</span>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="cm-modal__footer">
                <button
                  type="button"
                  className="od-btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="od-btn od-btn--primary"
                  disabled={formBusy}
                  data-testid="catalogue-form-submit"
                >
                  {formBusy ? (
                    <>
                      <Loader2 size={15} className="od-spin" /> Saving...
                    </>
                  ) : editingItem ? (
                    "Save Changes"
                  ) : (
                    "Create Product"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="cm-modal-overlay"
          role="dialog"
          aria-modal="true"
          data-lenis-prevent="true"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div
            className="cm-modal cm-modal--sm"
            data-testid="delete-confirm-modal"
            data-lenis-prevent="true"
            onWheel={(e) => e.stopPropagation()}
          >
            <h3 className="cm-modal__title">Delete Catalogue Product?</h3>
            <p className="cm-delete-msg">
              Are you sure you want to permanently remove <strong>{deleteTarget.name}</strong> (slug:{" "}
              <code>{deleteTarget.slug}</code>) from the inventory catalogue? This action cannot be
              undone.
            </p>
            <div className="cm-modal__footer">
              <button
                type="button"
                className="od-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="od-btn od-btn--decline"
                onClick={confirmDelete}
                disabled={deleteBusy}
                data-testid="delete-confirm-btn"
              >
                {deleteBusy ? <Loader2 size={14} className="od-spin" /> : <Trash2 size={14} />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
