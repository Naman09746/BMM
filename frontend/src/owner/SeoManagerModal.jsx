import React, { useState } from "react";
import { X, Search, Globe, Image as ImageIcon, Check, Sparkles, ExternalLink } from "lucide-react";

const PAGES = [
  { id: "home", name: "Homepage", path: "/" },
  { id: "stays", name: "02. Luxury Stays", path: "/stays" },
  { id: "projects", name: "03. Projects & Work", path: "/projects" },
  { id: "catalogue", name: "04. Materials Catalogue", path: "/catalogue" },
  { id: "divisions", name: "05. Business Divisions", path: "/businesses/marble-and-stone" },
  { id: "about", name: "06. About Studio", path: "/about" },
  { id: "contact", name: "07. Clientele & Contact", path: "/contact" },
];

const DEFAULT_PAGE_SEO = {
  home: {
    title: "BDS Marvel · Architecture, Interiors & Everything In Between",
    description: "One integrated design and build company — luxury stays, natural stone & marble, flooring, and turnkey architecture.",
    keywords: "marble, stone craft, luxury stays, flooring, architecture, turnkey interior design",
    canonical: "https://bdsmarvel.com/",
    og_image: "photo-1600585154340-be6161a56a0c",
  },
  stays: {
    title: "Luxury Stays · Stay Inside What We Built | BDS Marvel",
    description: "Experience our architecture and stone craft first-hand. Stay in private villas, pavilions, and lofts built end-to-end with our own materials.",
    keywords: "luxury villas, architectural stays, stone pavilion, living studio, vacation rental",
    canonical: "https://bdsmarvel.com/stays",
    og_image: "photo-1600607687939-ce8a6c25118c",
  },
  projects: {
    title: "Selected Projects & Architectural Portfolio | BDS Marvel",
    description: "Editorial stone facades, hospitality interiors, and commercial developments across India.",
    keywords: "architectural portfolio, stone facade, hospitality design, residential architecture",
    canonical: "https://bdsmarvel.com/projects",
    og_image: "photo-1600566753190-17f0baa2a6c3",
  },
  catalogue: {
    title: "Stone, Marble & Surface Catalogue | BDS Marvel",
    description: "Explore our signature collection of hand-carved marble tables, fireplaces, fountains, SPC flooring, and bespoke joinery.",
    keywords: "marble catalogue, pietra dura, stone temple, spc flooring, bespoke joinery",
    canonical: "https://bdsmarvel.com/catalogue",
    og_image: "photo-1692262089751-7e26b69ad8d1",
  },
  divisions: {
    title: "Trade Divisions: Drawstones, Renest, Formwork, Vignette | BDS Marvel",
    description: "Four specialized in-house divisions delivering stone, flooring, structural civil works, and interior styling under one contract.",
    keywords: "Drawstones, Renest, Formwork, Vignette, turnkey construction",
    canonical: "https://bdsmarvel.com/businesses/marble-and-stone",
    og_image: "photo-1618221195710-dd6b41faaea6",
  },
  about: {
    title: "About BDS Marvel · Twenty Years of Stone & Structure",
    description: "One accountable design and build team from facade to floor to furniture. Our philosophy, craftspeople, and studio manifesto.",
    keywords: "BDS Marvel founders, architectural studio, stonecraft heritage",
    canonical: "https://bdsmarvel.com/about",
    og_image: "photo-1503387762-592deb58ef4e",
  },
  contact: {
    title: "Contact & Institutional Clientele | BDS Marvel",
    description: "Get in touch with our studio for architectural inquiries, material specifications, and stays reservations.",
    keywords: "BDS Marvel contact, architectural enquiry, institutional clients",
    canonical: "https://bdsmarvel.com/contact",
    og_image: "photo-1616486338812-3dadae4b4ace",
  },
};

export function SeoManagerModal({ isOpen, onClose, seoData = {}, onSaveSeo, onOpenMediaLibrary }) {
  const [activeTab, setActiveTab] = useState("home");
  const [localSeo, setLocalSeo] = useState(() => {
    const merged = {};
    PAGES.forEach((p) => {
      merged[p.id] = {
        ...DEFAULT_PAGE_SEO[p.id],
        ...(seoData[p.id] || {}),
      };
    });
    return merged;
  });
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const current = localSeo[activeTab] || DEFAULT_PAGE_SEO[activeTab];

  const updateField = (field, value) => {
    setLocalSeo((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    onSaveSeo(localSeo);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 900);
  };

  // Character recommendation meters
  const titleLen = (current.title || "").length;
  const descLen = (current.description || "").length;

  return (
    <div className="ws-modal-backdrop" data-testid="seo-manager-modal">
      <div className="ws-modal-card ws-seo-modal">
        {/* Header */}
        <div className="ws-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="ws-modal-icon-badge"><Globe size={18} /></div>
            <div>
              <h2 className="ws-modal-title">Page SEO & Social Metadata</h2>
              <p className="ws-modal-subtitle">Configure search engine titles, social sharing previews, and indexing tags per screen.</p>
            </div>
          </div>
          <button type="button" className="ws-modal-close" onClick={onClose} data-testid="close-seo-modal">
            <X size={18} />
          </button>
        </div>

        {/* Page Switcher Tabs */}
        <div className="ws-seo-page-tabs">
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ws-seo-tab ${activeTab === p.id ? "is-active" : ""}`}
              onClick={() => setActiveTab(p.id)}
              data-testid={`seo-tab-${p.id}`}
            >
              <span>{p.name}</span>
              <code>{p.path}</code>
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="ws-seo-body">
          {/* Form Fields */}
          <div className="ws-seo-form">
            <label className="od-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span>Page Meta Title</span>
                <span className={`ws-len-tag ${titleLen > 65 ? "is-warn" : titleLen >= 40 ? "is-good" : ""}`}>
                  {titleLen} / 60 chars (optimal 50-60)
                </span>
              </div>
              <input
                type="text"
                value={current.title || ""}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Page Title · BDS Marvel"
                data-testid="seo-title-input"
              />
            </label>

            <label className="od-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span>Meta Description</span>
                <span className={`ws-len-tag ${descLen > 165 ? "is-warn" : descLen >= 120 ? "is-good" : ""}`}>
                  {descLen} / 160 chars (optimal 140-160)
                </span>
              </div>
              <textarea
                rows={3}
                value={current.description || ""}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Concise summary for search engine results..."
                data-testid="seo-description-input"
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label className="od-field">
                <span>Canonical URL</span>
                <input
                  type="text"
                  value={current.canonical || ""}
                  onChange={(e) => updateField("canonical", e.target.value)}
                  placeholder="https://bdsmarvel.com/..."
                  data-testid="seo-canonical-input"
                />
              </label>

              <label className="od-field">
                <span>Keywords (Comma-separated)</span>
                <input
                  type="text"
                  value={current.keywords || ""}
                  onChange={(e) => updateField("keywords", e.target.value)}
                  placeholder="marble, stays, architecture"
                  data-testid="seo-keywords-input"
                />
              </label>
            </div>

            <label className="od-field">
              <span>OpenGraph Social Share Image (URL or Media Key)</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={current.og_image || ""}
                  onChange={(e) => updateField("og_image", e.target.value)}
                  placeholder="photo-... or /api/media/..."
                  data-testid="seo-ogimage-input"
                />
                {onOpenMediaLibrary && (
                  <button
                    type="button"
                    className="ws-btn ws-btn--secondary"
                    onClick={() => onOpenMediaLibrary((url) => updateField("og_image", url))}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    <ImageIcon size={14} /> Browse Library
                  </button>
                )}
              </div>
            </label>
          </div>

          {/* Google Search Engine Result Preview */}
          <div className="ws-seo-preview-pane">
            <span className="ws-preview-tag">
              <Search size={12} /> Google Search Result Preview
            </span>
            <div className="ws-google-serp-card" data-testid="google-serp-preview">
              <div className="ws-serp-site">
                <span className="ws-serp-favicon">B</span>
                <div>
                  <span className="ws-serp-domain">bdsmarvel.com</span>
                  <span className="ws-serp-breadcrumb">
                    {current.canonical ? current.canonical.replace("https://bdsmarvel.com", "") || " › home" : " › home"}
                  </span>
                </div>
              </div>
              <h3 className="ws-serp-title">{current.title || "Page Title"}</h3>
              <p className="ws-serp-desc">
                {current.description || "Meta description of the page will appear here on Google search results."}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="ws-modal-footer">
          <button type="button" className="ws-btn ws-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="ws-btn ws-btn--primary"
            onClick={handleSave}
            data-testid="save-seo-btn"
          >
            {saved ? <Check size={14} /> : null}
            <span>{saved ? "Saved SEO!" : "Save SEO Settings"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SeoManagerModal;

