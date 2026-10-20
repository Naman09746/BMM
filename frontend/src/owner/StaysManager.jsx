import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bath,
  Bed,
  Check,
  DollarSign,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Home,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X,
  Zap,
} from "lucide-react";
import { api } from "../stays/store";
import { stopSmoothScroll, startSmoothScroll } from "../lib/smoothScroll";

const TIERS = ["Premium", "Mid", "Budget-friendly"];
const BOOKING_MODES = ["request", "instant"];
const PROPERTY_TYPES = ["Villa", "Pavilion", "Apartment", "Penthouse", "Loft", "Room", "Home"];

const PRESET_AMENITIES = [
  "Three ensuite suites",
  "Hosted materials walkthrough",
  "Private garden + sunken lounge",
  "Full breakfast & chef on request",
  "Sample library access",
  "Airport transfer on request",
  "Private sauna & plunge",
  "Chef-led dinners",
  "Bonfire court",
  "Book-matched marble baths",
  "Sunset terrace",
  "Butler pantry",
  "Laterite verandah",
  "Plunge pool",
  "Outdoor kitchen",
  "Screening lounge",
  "Work nook with fibre wifi",
  "Dedicated work table",
  "Full kitchen",
  "Self check-in",
  "Planted dining terrace",
  "Lime plaster & handloom",
  "Studio chai & breakfast",
  "Workshop viewing on request",
  "Hot rain shower",
  "Air conditioning",
  "High-speed wifi",
];

const PRESET_RULES = [
  "No parties or events",
  "No smoking indoors",
  "Quiet hours 10 PM – 7 AM",
  "Pets on request — host confirms",
  "Self check-in after 2 PM",
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

const DEFAULT_STAY = {
  name: "",
  slug: "",
  tier: "Premium",
  location: "Alibaug, Maharashtra",
  city: "Alibaug",
  state: "Maharashtra",
  nightly: 25000,
  guests: 4,
  bedrooms: 2,
  beds: 2,
  baths: 2,
  type: "Villa",
  lat: 18.6414,
  lng: 72.8722,
  hero: "",
  gallery: [],
  blurb: "",
  description: "",
  amenities: [
    "Three ensuite suites",
    "Hosted materials walkthrough",
    "Self check-in",
    "High-speed wifi",
  ],
  rules: ["No parties or events", "No smoking indoors", "Quiet hours 10 PM – 7 AM"],
  booking_mode: "request",
  min_nights: 1,
  is_active: true,
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-");
}

export default function StaysManager() {
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");

  // Modal form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStay, setEditingStay] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_STAY);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [customAmenity, setCustomAmenity] = useState("");
  const [customRule, setCustomRule] = useState("");

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const fetchStays = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/stays?all=true");
      setStays(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load stays listings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStays();
  }, [fetchStays]);

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

  const filteredStays = useMemo(() => {
    return stays.filter((stay) => {
      if (tierFilter !== "All" && stay.tier !== tierFilter) return false;
      if (modeFilter !== "All" && stay.booking_mode !== modeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (stay.name || "").toLowerCase().includes(q);
        const matchesSlug = (stay.slug || "").toLowerCase().includes(q);
        const matchesLoc = (stay.location || "").toLowerCase().includes(q);
        const matchesCity = (stay.city || "").toLowerCase().includes(q);
        const matchesDesc = (stay.description || "").toLowerCase().includes(q);
        if (!matchesName && !matchesSlug && !matchesLoc && !matchesCity && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [stays, tierFilter, modeFilter, search]);

  const stats = useMemo(() => {
    const total = stays.length;
    const premium = stays.filter((s) => s.tier === "Premium").length;
    const mid = stays.filter((s) => s.tier === "Mid").length;
    const budget = stays.filter((s) => s.tier === "Budget-friendly").length;
    const instant = stays.filter((s) => s.booking_mode === "instant").length;
    const avgNightly = total
      ? Math.round(stays.reduce((acc, s) => acc + (Number(s.nightly) || 0), 0) / total)
      : 0;
    return { total, premium, mid, budget, instant, avgNightly };
  }, [stays]);

  const openCreateModal = () => {
    setEditingStay(null);
    setFormData(DEFAULT_STAY);
    setFormError("");
    setCustomAmenity("");
    setCustomRule("");
    setIsModalOpen(true);
  };

  const openEditModal = (stay) => {
    setEditingStay(stay);
    setFormData({
      name: stay.name || "",
      slug: stay.slug || "",
      tier: stay.tier || "Premium",
      location: stay.location || "",
      city: stay.city || "",
      state: stay.state || "",
      nightly: Number(stay.nightly) || 20000,
      guests: Number(stay.guests) || 4,
      bedrooms: Number(stay.bedrooms) || 1,
      beds: Number(stay.beds) || 1,
      baths: Number(stay.baths) || 1,
      type: stay.type || "Villa",
      lat: Number(stay.lat) || 20.5937,
      lng: Number(stay.lng) || 78.9629,
      hero: stay.hero || "",
      gallery: Array.isArray(stay.gallery) ? stay.gallery : [],
      blurb: stay.blurb || "",
      description: stay.description || "",
      amenities: Array.isArray(stay.amenities) ? stay.amenities : [],
      rules: Array.isArray(stay.rules) ? stay.rules : [],
      booking_mode: stay.booking_mode === "instant" ? "instant" : "request",
      min_nights: Number(stay.min_nights) || 1,
      is_active: stay.is_active !== false,
    });
    setFormError("");
    setCustomAmenity("");
    setCustomRule("");
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
      setFormData((prev) => ({ ...prev, hero: res.url }));
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

  const toggleAmenity = (amenity) => {
    setFormData((prev) => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists
          ? prev.amenities.filter((a) => a !== amenity)
          : [...prev.amenities, amenity],
      };
    });
  };

  const addCustomAmenity = () => {
    const val = customAmenity.trim();
    if (val && !formData.amenities.includes(val)) {
      setFormData((prev) => ({ ...prev, amenities: [...prev.amenities, val] }));
      setCustomAmenity("");
    }
  };

  const toggleRule = (rule) => {
    setFormData((prev) => {
      const exists = prev.rules.includes(rule);
      return {
        ...prev,
        rules: exists ? prev.rules.filter((r) => r !== rule) : [...prev.rules, rule],
      };
    });
  };

  const addCustomRule = () => {
    const val = customRule.trim();
    if (val && !formData.rules.includes(val)) {
      setFormData((prev) => ({ ...prev, rules: [...prev.rules, val] }));
      setCustomRule("");
    }
  };

  const removeGalleryImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index),
    }));
  };

  const saveStay = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Stay name is required.");
      return;
    }
    if (!formData.hero.trim()) {
      setFormError("Hero photo is required (upload or provide URL/ID).");
      return;
    }
    if (formData.nightly <= 0) {
      setFormError("Nightly rate must be greater than 0.");
      return;
    }
    setFormBusy(true);
    setFormError("");
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        slug: formData.slug.trim() || slugify(formData.name),
        nightly: Number(formData.nightly),
        guests: Number(formData.guests),
        bedrooms: Number(formData.bedrooms),
        beds: Number(formData.beds),
        baths: Number(formData.baths),
        min_nights: Number(formData.min_nights) || 1,
      };

      if (editingStay) {
        const id = editingStay.id || editingStay.slug;
        const updated = await api(`/admin/stays/${id}`, {
          method: "PUT",
          body: payload,
        });
        setStays((prev) =>
          prev.map((s) => (s.id === editingStay.id || s.slug === editingStay.slug ? updated : s))
        );
      } else {
        const created = await api("/admin/stays", {
          method: "POST",
          body: payload,
        });
        setStays((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || "Failed to save stay listing.");
    } finally {
      setFormBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const id = deleteTarget.id || deleteTarget.slug;
      await api(`/admin/stays/${id}`, { method: "DELETE" });
      setStays((prev) => prev.filter((s) => s.id !== deleteTarget.id && s.slug !== deleteTarget.slug));
      setDeleteTarget(null);
    } catch (err) {
      alert("Failed to delete stay: " + err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggleBookingMode = async (stay) => {
    const nextMode = stay.booking_mode === "instant" ? "request" : "instant";
    try {
      const id = stay.id || stay.slug;
      const updated = await api(`/admin/stays/${id}`, {
        method: "PUT",
        body: { ...stay, booking_mode: nextMode },
      });
      setStays((prev) =>
        prev.map((s) => (s.id === stay.id || s.slug === stay.slug ? updated : s))
      );
    } catch (err) {
      alert("Failed to toggle booking mode: " + err.message);
    }
  };

  const toggleStayActive = async (stay) => {
    const newStatus = !(stay.is_active !== false);
    try {
      const id = stay.id || stay.slug;
      const updated = await api(`/admin/stays/${id}`, {
        method: "PUT",
        body: { ...stay, is_active: newStatus },
      });
      setStays((prev) =>
        prev.map((s) => (s.id === stay.id || s.slug === stay.slug ? updated : s))
      );
    } catch (err) {
      alert("Failed to toggle visibility: " + err.message);
    }
  };

  return (
    <div className="cm-container" data-testid="stays-manager">
      {/* Top statistics */}
      <div className="od-stats sm-stats">
        <div className="od-stat">
          <b>{stats.total}</b>
          <span>Total Stays</span>
        </div>
        <div className="od-stat">
          <b>{stats.premium}</b>
          <span>Premium Showcase</span>
        </div>
        <div className="od-stat">
          <b>{stats.mid}</b>
          <span>Mid Comfort</span>
        </div>
        <div className="od-stat">
          <b>{stats.budget}</b>
          <span>Budget-friendly</span>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="cm-toolbar">
        <div className="cm-search-wrap">
          <Search size={16} className="cm-search-icon" />
          <input
            type="text"
            className="cm-search-input"
            placeholder="Search stays by name, location, city, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="stays-search-input"
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
            <span className="cm-select-label">Tier:</span>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="cm-select"
              data-testid="stays-tier-filter"
            >
              <option value="All">All Tiers</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="cm-select-wrap">
            <span className="cm-select-label">Mode:</span>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="cm-select"
              data-testid="stays-mode-filter"
            >
              <option value="All">All Modes</option>
              <option value="instant">Instant Book</option>
              <option value="request">Request a Night</option>
            </select>
          </div>

          <button
            type="button"
            className="od-btn"
            onClick={fetchStays}
            title="Refresh stays list"
            data-testid="stays-refresh-btn"
          >
            <RefreshCw size={14} />
          </button>

          <button
            type="button"
            className="od-btn od-btn--primary cm-add-btn"
            onClick={openCreateModal}
            data-testid="stays-add-btn"
          >
            <Plus size={15} /> Add New Stay Listing
          </button>
        </div>
      </div>

      {error && (
        <div className="od-error" role="alert" data-testid="stays-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Stays List */}
      {loading ? (
        <div className="od-center">
          <Loader2 size={28} className="od-spin" />
        </div>
      ) : filteredStays.length === 0 ? (
        <div className="od-empty" data-testid="stays-empty">
          No Airbnb stays found. Click “Add New Stay Listing” to publish your first property.
        </div>
      ) : (
        <div className="cm-grid sm-grid" data-testid="stays-grid">
          {filteredStays.map((stay) => {
            const id = stay.id || stay.slug;
            const imgSrc = resolveImg(stay.hero);
            const isInstant = stay.booking_mode === "instant";
            const isActive = stay.is_active !== false;
            const nightlyFmt = `₹${Number(stay.nightly || 0).toLocaleString("en-IN")}`;

            return (
              <article
                key={id}
                className={`cm-card sm-card ${!isActive ? "is-inactive" : ""}`}
                data-testid={`stay-card-${stay.slug}`}
              >
                <div className="cm-card__media sm-card__media">
                  {imgSrc ? (
                    <img src={imgSrc} alt={stay.name} className="cm-card__img" loading="lazy" />
                  ) : (
                    <div className="cm-card__img-ph">
                      <ImageIcon size={28} opacity={0.4} />
                    </div>
                  )}
                  <div className="cm-card__media-badges">
                    <span className={`sm-badge sm-badge--${(stay.tier || "").toLowerCase()}`}>
                      {stay.tier}
                    </span>
                    <span
                      className={`sm-mode-pill ${isInstant ? "is-instant" : "is-request"}`}
                      onClick={() => toggleBookingMode(stay)}
                      title="Click to toggle booking mode"
                    >
                      {isInstant ? <Zap size={11} /> : null}
                      {isInstant ? "Instant" : "Request"}
                    </span>
                  </div>
                </div>

                <div className="cm-card__body">
                  <div className="cm-card__header">
                    <div>
                      <div className="sm-loc-row">
                        <MapPin size={13} className="sm-loc-icon" />
                        <span>{stay.location}</span>
                      </div>
                      <h3 className="cm-card__title">{stay.name}</h3>
                      <p className="cm-card__slug">slug: {stay.slug}</p>
                    </div>
                    <div className="sm-price-tag">
                      <b>{nightlyFmt}</b>
                      <span>/ night</span>
                    </div>
                  </div>

                  <p className="cm-card__desc sm-card__desc">
                    {stay.blurb || stay.description || "No description provided."}
                  </p>

                  <div className="sm-specs-bar">
                    <span title="Max Guests">
                      <Users size={14} /> {stay.guests} guests
                    </span>
                    <span title="Bedrooms">
                      <Home size={14} /> {stay.bedrooms || 1} bedrm
                    </span>
                    <span title="Beds">
                      <Bed size={14} /> {stay.beds || 1} bed{stay.beds > 1 ? "s" : ""}
                    </span>
                    <span title="Bathrooms">
                      <Bath size={14} /> {stay.baths || 1} bath
                    </span>
                  </div>

                  {Array.isArray(stay.amenities) && stay.amenities.length > 0 && (
                    <div className="sm-amenities-tags">
                      {stay.amenities.slice(0, 4).map((a, idx) => (
                        <span key={idx} className="sm-amenity-chip">
                          {a}
                        </span>
                      ))}
                      {stay.amenities.length > 4 && (
                        <span className="sm-amenity-more">+{stay.amenities.length - 4} more</span>
                      )}
                    </div>
                  )}

                  <div className="cm-card__footer">
                    <div className="cm-card__links">
                      <a
                        href={`/stays/home/${stay.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="cm-icon-link"
                        title="View live stay page"
                      >
                        <ExternalLink size={14} /> Preview
                      </a>
                      <button
                        type="button"
                        className="cm-toggle-active-btn"
                        onClick={() => toggleStayActive(stay)}
                        title={isActive ? "Hide listing" : "Publish listing"}
                      >
                        {isActive ? <Eye size={14} /> : <EyeOff size={14} />}
                        {isActive ? "Active" : "Hidden"}
                      </button>
                    </div>

                    <div className="cm-card__actions">
                      <button
                        type="button"
                        className="od-btn cm-btn-sm"
                        onClick={() => openEditModal(stay)}
                        data-testid={`edit-stay-${stay.slug}`}
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                      <button
                        type="button"
                        className="od-btn od-btn--decline cm-btn-sm"
                        onClick={() => setDeleteTarget(stay)}
                        data-testid={`delete-stay-${stay.slug}`}
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
            data-testid="stay-form-modal"
            data-lenis-prevent="true"
            onWheel={(e) => e.stopPropagation()}
          >
            <div className="cm-modal__head">
              <div>
                <p className="od-kicker">Stay Listing Manager</p>
                <h2 className="cm-modal__title">
                  {editingStay ? `Edit: ${editingStay.name}` : "Create New Airbnb Stay"}
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
              onSubmit={saveStay}
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
                {/* Stay Name */}
                <label className="od-field cm-col-2">
                  <span>Stay Title / Name *</span>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    placeholder="e.g. The Living Studio"
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        name,
                        slug: !editingStay && !prev.slugTouched ? slugify(name) : prev.slug,
                      }));
                    }}
                    data-testid="stay-form-name"
                  />
                </label>

                {/* Slug */}
                <label className="od-field">
                  <span>Slug (URL identifier) *</span>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    placeholder="e.g. living-studio"
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, slug: e.target.value, slugTouched: true }))
                    }
                    data-testid="stay-form-slug"
                  />
                </label>

                {/* Tier */}
                <label className="od-field">
                  <span>Showcase Tier</span>
                  <select
                    value={formData.tier}
                    onChange={(e) => setFormData((prev) => ({ ...prev, tier: e.target.value }))}
                    data-testid="stay-form-tier"
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Property Type */}
                <label className="od-field">
                  <span>Property Type</span>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Nightly Price */}
                <label className="od-field">
                  <span>Nightly Rate (INR ₹) *</span>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    required
                    value={formData.nightly}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, nightly: Number(e.target.value) }))
                    }
                    data-testid="stay-form-nightly"
                  />
                </label>

                {/* Booking Mode */}
                <label className="od-field">
                  <span>Booking Mode</span>
                  <select
                    value={formData.booking_mode}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, booking_mode: e.target.value }))
                    }
                    data-testid="stay-form-mode"
                  >
                    <option value="request">Request a Night (Host Confirms)</option>
                    <option value="instant">Instant Book (Immediate Payment)</option>
                  </select>
                </label>

                {/* Capacity: Guests */}
                <label className="od-field">
                  <span>Max Guests</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formData.guests}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, guests: Number(e.target.value) }))
                    }
                    data-testid="stay-form-guests"
                  />
                </label>

                {/* Bedrooms */}
                <label className="od-field">
                  <span>Bedrooms</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.bedrooms}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, bedrooms: Number(e.target.value) }))
                    }
                  />
                </label>

                {/* Beds */}
                <label className="od-field">
                  <span>Beds</span>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={formData.beds}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, beds: Number(e.target.value) }))
                    }
                  />
                </label>

                {/* Baths */}
                <label className="od-field">
                  <span>Bathrooms</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.baths}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, baths: Number(e.target.value) }))
                    }
                  />
                </label>

                {/* Min Nights */}
                <label className="od-field">
                  <span>Min Nights</span>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={formData.min_nights}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, min_nights: Number(e.target.value) }))
                    }
                  />
                </label>

                {/* Location String */}
                <label className="od-field cm-col-2">
                  <span>Location (e.g. City, State) *</span>
                  <input
                    type="text"
                    required
                    value={formData.location}
                    placeholder="e.g. Alibaug, Maharashtra"
                    onChange={(e) => {
                      const loc = e.target.value;
                      const parts = loc.split(",").map((s) => s.trim());
                      setFormData((prev) => ({
                        ...prev,
                        location: loc,
                        city: parts[0] || prev.city,
                        state: parts[1] || prev.state,
                      }));
                    }}
                    data-testid="stay-form-location"
                  />
                </label>

                {/* City & State */}
                <label className="od-field">
                  <span>City</span>
                  <input
                    type="text"
                    value={formData.city}
                    placeholder="e.g. Alibaug"
                    onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </label>
                <label className="od-field">
                  <span>State</span>
                  <input
                    type="text"
                    value={formData.state}
                    placeholder="e.g. Maharashtra"
                    onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                  />
                </label>

                {/* Coordinates */}
                <label className="od-field">
                  <span>Latitude</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lat}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </label>
                <label className="od-field">
                  <span>Longitude</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lng}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))
                    }
                  />
                </label>

                {/* Short Blurb */}
                <label className="od-field cm-col-2">
                  <span>Short Blurb (Card Subtitle)</span>
                  <input
                    type="text"
                    value={formData.blurb}
                    placeholder="e.g. Our flagship stayable showroom — every surface is our own work."
                    onChange={(e) => setFormData((prev) => ({ ...prev, blurb: e.target.value }))}
                  />
                </label>

                {/* Full Description */}
                <label className="od-field cm-col-2">
                  <span>Full Stay Narrative & Description</span>
                  <textarea
                    rows={4}
                    value={formData.description}
                    placeholder="Complete architectural overview, materiality, spaces and experience..."
                    className="cm-textarea"
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    data-testid="stay-form-description"
                  />
                </label>
              </div>

              {/* Hero Image Section */}
              <div className="cm-section">
                <h4 className="cm-section__title">Cover / Hero Photo *</h4>
                <div className="cm-upload-grid">
                  <div className="cm-image-preview-wrap">
                    {formData.hero ? (
                      <img
                        src={resolveImg(formData.hero)}
                        alt="Stay hero preview"
                        className="cm-image-preview"
                      />
                    ) : (
                      <div className="cm-image-preview-placeholder">
                        <ImageIcon size={32} opacity={0.3} />
                        <span>No cover image selected</span>
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
                        data-testid="stay-hero-file-input"
                      />
                      <UploadCloud size={24} className="cm-dropzone-icon" />
                      <b>{uploadingHero ? "Uploading image..." : "Click or drag photo to upload"}</b>
                      <span>Supports high-resolution JPG, PNG, WEBP</span>
                      {uploadingHero && <Loader2 size={16} className="od-spin" />}
                    </label>

                    <div className="cm-or-divider">
                      <span>OR PASTE URL / UNSPLASH ID</span>
                    </div>

                    <input
                      type="text"
                      className="cm-text-input"
                      value={formData.hero}
                      placeholder="e.g. photo-1600607687939-ce8a6c25118c or https://..."
                      onChange={(e) => setFormData((prev) => ({ ...prev, hero: e.target.value }))}
                      data-testid="stay-form-hero-url"
                    />
                  </div>
                </div>
              </div>

              {/* Amenities Manager */}
              <div className="cm-section">
                <h4 className="cm-section__title">
                  Amenities & Inclusions ({formData.amenities.length})
                </h4>

                <div className="sm-preset-chips">
                  {PRESET_AMENITIES.map((amenity) => {
                    const isSelected = formData.amenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        className={`sm-chip ${isSelected ? "is-selected" : ""}`}
                        onClick={() => toggleAmenity(amenity)}
                      >
                        {isSelected && <Check size={12} />}
                        {amenity}
                      </button>
                    );
                  })}
                </div>

                <div className="sm-add-custom-row">
                  <input
                    type="text"
                    placeholder="Add custom amenity (e.g. Private plunge pool)..."
                    value={customAmenity}
                    onChange={(e) => setCustomAmenity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomAmenity();
                      }
                    }}
                  />
                  <button type="button" className="od-btn cm-btn-sm" onClick={addCustomAmenity}>
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>

              {/* House Rules */}
              <div className="cm-section">
                <h4 className="cm-section__title">House Rules ({formData.rules.length})</h4>

                <div className="sm-preset-chips">
                  {PRESET_RULES.map((rule) => {
                    const isSelected = formData.rules.includes(rule);
                    return (
                      <button
                        key={rule}
                        type="button"
                        className={`sm-chip ${isSelected ? "is-selected" : ""}`}
                        onClick={() => toggleRule(rule)}
                      >
                        {isSelected && <Check size={12} />}
                        {rule}
                      </button>
                    );
                  })}
                </div>

                <div className="sm-add-custom-row">
                  <input
                    type="text"
                    placeholder="Add house rule..."
                    value={customRule}
                    onChange={(e) => setCustomRule(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomRule();
                      }
                    }}
                  />
                  <button type="button" className="od-btn cm-btn-sm" onClick={addCustomRule}>
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>

              {/* Gallery Photos */}
              <div className="cm-section">
                <div className="cm-section__header">
                  <h4 className="cm-section__title">
                    Detail Gallery Photos ({formData.gallery?.length || 0})
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
                      <img src={resolveImg(gId)} alt={`Stay Gallery ${idx + 1}`} />
                      <button
                        type="button"
                        className="cm-gallery-thumb__del"
                        onClick={() => removeGalleryImage(idx)}
                        aria-label="Remove photo"
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
                  <span>Active & Bookable on BDS Marvel Stays</span>
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
                  data-testid="stay-form-submit"
                >
                  {formBusy ? (
                    <>
                      <Loader2 size={15} className="od-spin" /> Saving...
                    </>
                  ) : editingStay ? (
                    "Save Stay Listing"
                  ) : (
                    "Publish Stay Listing"
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
            data-testid="delete-stay-modal"
            data-lenis-prevent="true"
            onWheel={(e) => e.stopPropagation()}
          >
            <h3 className="cm-modal__title">Delete Stay Listing?</h3>
            <p className="cm-delete-msg">
              Are you sure you want to permanently remove <strong>{deleteTarget.name}</strong> (slug:{" "}
              <code>{deleteTarget.slug}</code>) located at {deleteTarget.location}? Existing confirmed
              bookings will remain recorded.
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
                data-testid="delete-stay-confirm-btn"
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
