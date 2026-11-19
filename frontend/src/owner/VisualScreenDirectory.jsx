import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Award,
  Sparkles,
  Info,
  CheckCircle2,
  Grid as GridIcon,
  Film,
} from "lucide-react";
import { api, resolveBackendMedia } from "../stays/store";
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
import HorizontalScrollArea from "./HorizontalScrollArea";

export function VisualScreenDirectory({ initialScreen = "home" }) {
  // Master sequence of all 7 core website screens
  const [activeScreen, setActiveScreen] = useState(initialScreen);

  // Gallery view mode toggle: "grid" or "filmstrip"
  const [galleryViewMode, setGalleryViewMode] = useState("grid");

  // Collections state
  const [stays, setStays] = useState([]);
  const [projects, setProjects] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [siteContent, setSiteContent] = useState({
    hero: DEFAULT_HERO,
    approach: DEFAULT_APPROACH,
    clients: DEFAULT_CLIENTS,
    divisions: DEFAULT_DIVISIONS,
    about: DEFAULT_ABOUT,
    living_studio: DEFAULT_LIVING_STUDIO,
  });

  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState(null);
  const [uploadingTarget, setUploadingTarget] = useState(null); // { id, field, index }
  const [toast, setToast] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // Helper to open live website pages in a new tab
  const openLivePage = (path) => {
    window.open(path, "_blank");
  };

  // Load all website data across all 7 screens
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [staysData, projData, catData, contentData] = await Promise.all([
        api("/stays?all=true").catch(() => []),
        api("/projects?all=true").catch(() => []),
        api("/catalogue?all=true").catch(() => []),
        api("/site-content").catch(() => null),
      ]);
      setStays(Array.isArray(staysData) ? staysData : []);
      setProjects(Array.isArray(projData) ? projData : []);
      setCatalogue(Array.isArray(catData) ? catData : []);

      if (contentData && typeof contentData === "object") {
        setSiteContent({
          hero: { ...DEFAULT_HERO, ...(contentData.hero || {}) },
          approach: Array.isArray(contentData.approach) && contentData.approach.length > 0 ? contentData.approach : DEFAULT_APPROACH,
          clients: Array.isArray(contentData.clients) && contentData.clients.length > 0 ? contentData.clients : DEFAULT_CLIENTS,
          divisions: Array.isArray(contentData.divisions) && contentData.divisions.length > 0 ? contentData.divisions : DEFAULT_DIVISIONS,
          about: { ...DEFAULT_ABOUT, ...(contentData.about || {}) },
          living_studio: { ...DEFAULT_LIVING_STUDIO, ...(contentData.living_studio || {}) },
        });
      }
    } catch (err) {
      console.error("Failed to load screens data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Universal Media Upload Helper
  const handleFileUpload = async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append("file", file);
    const res = await api("/admin/media/upload", { method: "POST", body: formData });
    return res.url;
  };

  // Dynamic Auto-Detection & Auto-Save engine
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const isInitialMount = useRef(true);
  const autoSaveTimer = useRef(null);
  const lastSavedJson = useRef("");

  // Auto-detect changes and save dynamically without needing button clicks
  useEffect(() => {
    if (isInitialMount.current) {
      if (siteContent && siteContent.hero) {
        lastSavedJson.current = JSON.stringify(siteContent);
        isInitialMount.current = false;
      }
      return;
    }

    const currentJson = JSON.stringify(siteContent);
    if (!currentJson || currentJson === lastSavedJson.current) return;

    setAutoSaveStatus("saving");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(async () => {
      try {
        await api("/admin/site-content", {
          method: "PUT",
          body: siteContent,
        });
        lastSavedJson.current = currentJson;
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2500);
      } catch (err) {
        console.error("Dynamic auto-save error:", err);
        setAutoSaveStatus("error");
      }
    }, 700);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [siteContent]);

  // Save Site Content to backend
  const persistSiteContent = async (updatedContent, sectionName) => {
    setSavingSection(sectionName);
    try {
      const res = await api("/admin/site-content", {
        method: "PUT",
        body: updatedContent,
      });
      setSiteContent((prev) => ({
        ...prev,
        ...res,
      }));
      lastSavedJson.current = JSON.stringify(updatedContent);
      setAutoSaveStatus("saved");
      showToast(`Saved changes for ${sectionName}`);
    } catch (err) {
      alert(`Failed to save ${sectionName}: ${err.message}`);
    } finally {
      setSavingSection(null);
    }
  };

  // =========================================================================
  // SCREEN 2: STAYS IMAGE HANDLERS
  // =========================================================================
  const handleStayHeroUpload = async (stay, file) => {
    if (!file) return;
    setUploadingTarget({ id: stay.id || stay.slug, field: "hero" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const updated = { ...stay, hero: url };
      const res = await api(`/admin/stays/${stay.id || stay.slug}`, {
        method: "PUT",
        body: updated,
      });
      setStays((prev) => prev.map((s) => ((s.id === stay.id || s.slug === stay.slug) ? res : s)));
      showToast(`Updated card photo for "${stay.name}"`);
    } catch (err) {
      alert("Failed to upload photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleStayGalleryAdd = async (stay, file) => {
    if (!file) return;
    setUploadingTarget({ id: stay.id || stay.slug, field: "gallery_add" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const updated = { ...stay, gallery: [...(stay.gallery || []), url] };
      const res = await api(`/admin/stays/${stay.id || stay.slug}`, {
        method: "PUT",
        body: updated,
      });
      setStays((prev) => prev.map((s) => ((s.id === stay.id || s.slug === stay.slug) ? res : s)));
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
      setStays((prev) => prev.map((s) => ((s.id === stay.id || s.slug === stay.slug) ? res : s)));
      showToast(`Removed photo from "${stay.name}" detail gallery`);
    } catch (err) {
      alert("Failed to remove photo: " + err.message);
    }
  };

  const handleStayGalleryReplace = async (stay, photoIdx, file) => {
    if (!file) return;
    setUploadingTarget({ id: stay.id || stay.slug, field: `gallery_${photoIdx}` });
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
      setStays((prev) => prev.map((s) => ((s.id === stay.id || s.slug === stay.slug) ? res : s)));
      showToast(`Replaced photo in "${stay.name}" detail gallery`);
    } catch (err) {
      alert("Failed to replace photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  // =========================================================================
  // SCREEN 3: PROJECTS IMAGE HANDLERS
  // =========================================================================
  const handleProjectHeroUpload = async (project, file) => {
    if (!file) return;
    setUploadingTarget({ id: project.id || project.slug, field: "hero" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const updated = { ...project, image: url };
      const res = await api(`/admin/projects/${project.id || project.slug}`, {
        method: "PUT",
        body: updated,
      });
      setProjects((prev) => prev.map((p) => ((p.id === project.id || p.slug === project.slug) ? res : p)));
      showToast(`Updated card photo for "${project.title}"`);
    } catch (err) {
      alert("Failed to upload photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleProjectGalleryAdd = async (project, file) => {
    if (!file) return;
    setUploadingTarget({ id: project.id || project.slug, field: "gallery_add" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const updated = { ...project, gallery: [...(project.gallery || []), url] };
      const res = await api(`/admin/projects/${project.id || project.slug}`, {
        method: "PUT",
        body: updated,
      });
      setProjects((prev) => prev.map((p) => ((p.id === project.id || p.slug === project.slug) ? res : p)));
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
      setProjects((prev) => prev.map((p) => ((p.id === project.id || p.slug === project.slug) ? res : p)));
      showToast(`Removed photo from "${project.title}" detail gallery`);
    } catch (err) {
      alert("Failed to remove photo: " + err.message);
    }
  };

  const handleProjectGalleryReplace = async (project, photoIdx, file) => {
    if (!file) return;
    setUploadingTarget({ id: project.id || project.slug, field: `gallery_${photoIdx}` });
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
      setProjects((prev) => prev.map((p) => ((p.id === project.id || p.slug === project.slug) ? res : p)));
      showToast(`Replaced photo in "${project.title}" detail gallery`);
    } catch (err) {
      alert("Failed to replace photo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  // =========================================================================
  // SCREEN 4: CATALOGUE IMAGE HANDLERS
  // =========================================================================
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

  // =========================================================================
  // SCREEN 1: HOMEPAGE IMAGE & COPY HANDLERS
  // =========================================================================
  const handleHeroPosterUpload = async (file) => {
    if (!file) return;
    setUploadingTarget({ id: "hero", field: "poster" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextHero = { ...siteContent.hero, poster: url };
      const updated = { ...siteContent, hero: nextHero };
      await persistSiteContent(updated, "Homepage Hero Media");
    } catch (err) {
      alert("Failed to upload hero media: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleHeroVideoUpload = async (file) => {
    if (!file) return;
    setUploadingTarget({ id: "hero_video", field: "video" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextHero = { ...siteContent.hero, video: url };
      const updated = { ...siteContent, hero: nextHero };
      await persistSiteContent(updated, "Homepage Hero Video");
    } catch (err) {
      alert("Failed to upload hero video: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handlePillarImageUpload = async (index, file) => {
    if (!file) return;
    setUploadingTarget({ id: "approach", field: `pillar_${index}` });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextApproach = [...siteContent.approach];
      nextApproach[index] = { ...nextApproach[index], image: url };
      const updated = { ...siteContent, approach: nextApproach };
      await persistSiteContent(updated, `Pillar ${index + 1} Image`);
    } catch (err) {
      alert("Failed to upload pillar image: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleLivingStudioHeroUpload = async (file) => {
    if (!file) return;
    setUploadingTarget({ id: "living_studio", field: "hero" });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextLS = { ...siteContent.living_studio, hero: url };
      const updated = { ...siteContent, living_studio: nextLS };
      await persistSiteContent(updated, "Living Studio Spotlight Hero");
    } catch (err) {
      alert("Failed to upload living studio image: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  // =========================================================================
  // SCREEN 5: BUSINESS DIVISIONS HANDLERS
  // =========================================================================
  const handleDivisionHeroUpload = async (divIndex, file) => {
    if (!file) return;
    setUploadingTarget({ id: "division", field: `hero_${divIndex}` });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextDivs = [...siteContent.divisions];
      nextDivs[divIndex] = { ...nextDivs[divIndex], hero: url };
      const updated = { ...siteContent, divisions: nextDivs };
      await persistSiteContent(updated, `Division "${nextDivs[divIndex].name}" Hero Banner`);
    } catch (err) {
      alert("Failed to upload division banner: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  // =========================================================================
  // SCREEN 6: ABOUT STUDIO & TEAM PORTRAITS HANDLERS
  // =========================================================================
  const handleTeamPortraitUpload = async (memberIndex, file) => {
    if (!file) return;
    setUploadingTarget({ id: "about_team", field: `portrait_${memberIndex}` });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextTeam = [...(siteContent.about?.team || DEFAULT_ABOUT.team)];
      nextTeam[memberIndex] = { ...nextTeam[memberIndex], image: url };
      const nextAbout = { ...siteContent.about, team: nextTeam };
      const updated = { ...siteContent, about: nextAbout };
      await persistSiteContent(updated, `Team Portrait for "${nextTeam[memberIndex].name}"`);
    } catch (err) {
      alert("Failed to upload team portrait: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  // =========================================================================
  // SCREEN 7: CLIENTELE & BRAND LOGOS HANDLERS
  // =========================================================================
  const handleClientLogoUpload = async (clientIndex, file) => {
    if (!file) return;
    setUploadingTarget({ id: "client_logo", field: `logo_${clientIndex}` });
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextClients = [...siteContent.clients];
      nextClients[clientIndex] = { ...nextClients[clientIndex], logo: url };
      const updated = { ...siteContent, clients: nextClients };
      await persistSiteContent(updated, `Brand Logo for "${nextClients[clientIndex].name}"`);
    } catch (err) {
      alert("Failed to upload brand logo: " + err.message);
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleAddClientLogo = async (file, name) => {
    if (!file || !name.trim()) return;
    try {
      const url = await handleFileUpload(file);
      if (!url) return;
      const nextClients = [{ name: name.trim(), logo: url }, ...siteContent.clients];
      const updated = { ...siteContent, clients: nextClients };
      await persistSiteContent(updated, `New Brand Logo: "${name.trim()}"`);
    } catch (err) {
      alert("Failed to add brand logo: " + err.message);
    }
  };

  const handleDeleteClientLogo = async (clientIndex) => {
    const client = siteContent.clients[clientIndex];
    if (!window.confirm(`Delete client brand logo "${client?.name}"?`)) return;
    try {
      const nextClients = siteContent.clients.filter((_, i) => i !== clientIndex);
      const updated = { ...siteContent, clients: nextClients };
      await persistSiteContent(updated, `Removed "${client?.name}"`);
    } catch (err) {
      alert("Failed to delete client logo: " + err.message);
    }
  };

  // The 7 Master Website Screens
  const screens = [
    {
      id: "home",
      number: "01",
      name: "Homepage",
      path: "/",
      icon: Home,
      tag: "Hero & Opening",
      desc: "Hero craftsmanship video/poster, 5 craft philosophy pillars, living studio banner, and client brand reel.",
      whereIsIt: "Primary landing screen at https://bdsmarvel.com/ (top hero, craft story, and featured showcases)",
      level1Name: "Homepage Hero & Banners",
      level2Name: "Sections & Downstream Click Destinations",
    },
    {
      id: "stays",
      number: "02",
      name: "Luxury Stays",
      path: "/stays",
      icon: BedDouble,
      tag: "6 Listings + Detail Galleries",
      desc: "Listing browse cards & full interior photo galleries seen after clicking a stay.",
      whereIsIt: "Screen at /stays (the collection grid) ➔ Click any stay ➔ opens /stays/home/:slug (detail screen)",
      level1Name: "Browse Listing Card Photo",
      level2Name: "Photos After Clicking (Detail Gallery Modal)",
    },
    {
      id: "projects",
      number: "03",
      name: "Projects & Portfolio",
      path: "/projects",
      icon: Building,
      tag: "Selected Works + Detail Galleries",
      desc: "Project cards shown on /projects & inner detail photo galleries for each build.",
      whereIsIt: "Screen at /projects (portfolio grid & homepage slideshow) ➔ Click any build ➔ opens /projects/:slug",
      level1Name: "Portfolio Card Photo",
      level2Name: "Photos After Clicking (In-Place Case Study Gallery)",
    },
    {
      id: "catalogue",
      number: "04",
      name: "Materials Catalogue",
      path: "/catalogue",
      icon: Boxes,
      tag: "Products + Detail Galleries",
      desc: "Materials & furniture browse cards & finish/spec galleries after clicking an item.",
      whereIsIt: "Screen at /catalogue (materials library) ➔ Click any material ➔ opens /catalogue/:slug (specifications)",
      level1Name: "Material Card Photo",
      level2Name: "Photos After Clicking (Finish & Texture Gallery)",
    },
    {
      id: "businesses",
      number: "05",
      name: "Business Divisions",
      path: "/businesses/marble-and-stone",
      icon: Layers,
      tag: "4 Divisions & Hero Banners",
      desc: "Marble & Stone, Flooring, Turnkey Construction, and Interior Decor division pages.",
      whereIsIt: "Screen at /businesses/:slug (Drawstones, Renest, Formwork, Vignette) & homepage interactive rail",
      level1Name: "Division Hero Banner Image",
      level2Name: "Showcase & Content Seen After Clicking",
    },
    {
      id: "about",
      number: "06",
      name: "About Studio",
      path: "/about",
      icon: FileText,
      tag: "Workshop & Heritage Story",
      desc: "Kishangarh stone workshops, master craftsmen, and studio heritage photos.",
      whereIsIt: "Screen at /about (story, milestone statistics, and team/workshop portraits)",
      level1Name: "Studio Story & Heritage Stats",
      level2Name: "The 6 Workshop & Leadership Portraits",
    },
    {
      id: "clients",
      number: "07",
      name: "Brand Logos Marquee",
      path: "/#contact",
      icon: Award,
      tag: "24+ Partner Logos Reel",
      desc: "Searchable directory of institutional clients & hospitality partner brand logos.",
      whereIsIt: "Screen at bottom of homepage (/#contact) and global footer in continuous motion",
      level1Name: "Live Marquee Reel Preview",
      level2Name: "All 24+ Brand Logos Directory",
    },
  ];

  const currentScreenMeta = screens.find((s) => s.id === activeScreen) || screens[0];

  return (
    <div className="cm-container" data-testid="visual-screen-directory">
      {/* =========================================================================
          TOP BANNER: Master Title & Screen Sequence
         ========================================================================= */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ background: "var(--od-gold-d)", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Visual Website Hierarchy
            </span>
            <span style={{ color: "var(--od-muted)", fontSize: 12 }}>
              · 7 Complete Screens · Card View & After-Click View
            </span>
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, margin: 0 }}>
            Website Screens & Media Hierarchy
          </h2>
          <p style={{ color: "var(--od-muted)", fontSize: 13, margin: "4px 0 0" }}>
            Every screen on the public website is ordered below exactly as visitors see it. Select any screen to change its browse card photos, or the full photo galleries that appear <strong>after clicking it</strong>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="od-btn" onClick={loadAllData} disabled={loading}>
            <RefreshCw size={14} className={loading ? "od-spin" : ""} /> Refresh Media
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ background: "#e0efe2", color: "var(--od-green)", border: "1px solid #c2e2c6", borderRadius: 12, padding: "12px 18px", marginBottom: 18, fontSize: 13.5, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      {/* =========================================================================
          MASTER VISUAL SCREEN SELECTOR: Smooth Horizontal Scroll Rail with Gradient Fades
         ========================================================================= */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
              Select Website Screen (01 — 07)
            </span>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                background: autoSaveStatus === "saving" ? "rgba(201, 162, 98, 0.15)" : autoSaveStatus === "saved" ? "rgba(46, 107, 63, 0.12)" : "var(--od-surface-subtle)",
                color: autoSaveStatus === "saving" ? "var(--od-gold-d)" : autoSaveStatus === "saved" ? "var(--od-green)" : "var(--od-muted)",
                border: "1px solid var(--od-line)",
                transition: "all 0.25s ease",
              }}
              data-testid="vsd-autosave-status"
            >
              {autoSaveStatus === "saving" && (
                <><Loader2 size={12} className="od-spin" /> Auto-saving changes dynamically...</>
              )}
              {autoSaveStatus === "saved" && (
                <><CheckCircle2 size={12} /> Auto-saved dynamically</>
              )}
              {autoSaveStatus === "idle" && (
                <><Sparkles size={11} style={{ color: "var(--od-gold)" }} /> Dynamic Auto-Save Active</>
              )}
              {autoSaveStatus === "error" && (
                <span style={{ color: "var(--od-red)" }}>Auto-save failed · Will retry</span>
              )}
            </div>
          </div>

          <span className="vsd-scroll-cue">
            ✦ Horizontal Scroll / Swipe to browse all 7 screens ➔
          </span>
        </div>

        <HorizontalScrollArea scrollAmount={220}>
          {screens.map((s) => {
            const IconComp = s.icon;
            const isActive = activeScreen === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`vsd-screen-step ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  setActiveScreen(s.id);
                  setSearchFilter("");
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 4 }}>
                  <span className="site-flow-step__badge" style={{ fontSize: 11, fontWeight: 700 }}>
                    <IconComp size={12} style={{ display: "inline-block", marginRight: 3, verticalAlign: "middle" }} /> {s.number}
                  </span>
                  <span style={{ fontSize: 10, opacity: 0.6, fontFamily: "monospace" }}>{s.path}</span>
                </div>
                <h4 className="site-flow-step__title" style={{ fontSize: 13.5, margin: "0 0 2px", fontWeight: 700 }}>
                  {s.name}
                </h4>
                <span className="site-flow-step__meta" style={{ fontSize: 10.5, lineHeight: 1.2, color: "var(--od-muted)", display: "block" }}>
                  {s.tag}
                </span>
              </button>
            );
          })}
        </HorizontalScrollArea>
      </div>

      {/* =========================================================================
          LOCATION & LEVEL GUIDE: Explicitly Shows Where This Screen Is on the Website
         ========================================================================= */}
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
          gap: 14,
        }}
      >
        <div style={{ maxWidth: 750 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ background: "var(--od-gold-d)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>
              SCREEN {currentScreenMeta.number}
            </span>
            <h3 style={{ margin: 0, fontSize: 18 }}>{currentScreenMeta.name}</h3>
            <span style={{ color: "var(--od-muted)", fontSize: 13, fontFamily: "monospace" }}>({currentScreenMeta.path})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--od-gold-d)", fontWeight: 600, marginTop: 4 }}>
            <Info size={13} />
            <span>WHERE IS THIS ON WEBSITE: {currentScreenMeta.whereIsIt}</span>
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: "var(--od-muted)", flexWrap: "wrap" }}>
            <div>
              <strong style={{ color: "var(--od-ink)" }}>1. {currentScreenMeta.level1Name}</strong> = What visitors see browsing this screen
            </div>
            <div>·</div>
            <div>
              <strong style={{ color: "var(--od-gold-d)" }}>2. {currentScreenMeta.level2Name}</strong> = What opens when visitors click an item
            </div>
          </div>
        </div>

        <button
          type="button"
          className="od-btn od-btn--primary"
          onClick={() => openLivePage(currentScreenMeta.path)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "8px 14px" }}
        >
          <Eye size={13} /> Open Live Screen <ExternalLink size={12} />
        </button>
      </div>

      {/* =========================================================================
          SCREEN 01: HOMEPAGE (Hero Video/Poster, 5 Craft Pillars, Living Studio)
         ========================================================================= */}
      {activeScreen === "home" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Section 1: Hero Video / Poster Image & Headline */}
          <div className="od-card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                  01.1 Top Screen Banner
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 20 }}>Hero Video Poster & Headline</h3>
              </div>
              <button
                type="button"
                className="od-btn"
                onClick={() => openLivePage("/")}
                style={{ padding: "5px 12px", fontSize: 11.5 }}
              >
                View Live Hero <ExternalLink size={11} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginBottom: 18 }}>
              {/* Box 1: Hero Video Background */}
              <div style={{ background: "var(--od-paper)", border: "1px solid var(--od-line)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 6 }}>
                  1. Hero Background Video (MP4)
                </div>
                <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", marginBottom: 10, aspectRatio: "16/9" }}>
                  <video
                    src={siteContent.hero?.video ? resolveBackendMedia(siteContent.hero.video) : publicAsset("/videos/hero.mp4")}
                    poster={siteContent.hero?.poster ? resolveBackendMedia(siteContent.hero.poster) : publicAsset("/hero/craftsmanship-poster.webp")}
                    controls
                    muted
                    loop
                    playsInline
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  {uploadingTarget?.id === "hero_video" && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", display: "grid", placeItems: "center", color: "#fff" }}>
                      <Loader2 size={24} className="od-spin" />
                      <span style={{ fontSize: 11, marginTop: 6 }}>Uploading MP4 Video...</span>
                    </div>
                  )}
                </div>
                <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "8px 12px", fontSize: 12, cursor: "pointer", marginBottom: 8 }}>
                  <input
                    type="file"
                    accept="video/mp4"
                    onChange={(e) => handleHeroVideoUpload(e.target.files?.[0])}
                    style={{ display: "none" }}
                    disabled={uploadingTarget?.id === "hero_video"}
                  />
                  <Film size={13} /> {uploadingTarget?.id === "hero_video" ? "Uploading..." : "Upload & Replace Hero Video (MP4)"}
                </label>
                <label className="od-field" style={{ margin: 0 }}>
                  <span style={{ fontSize: 10.5 }}>Video URL / Path</span>
                  <input
                    type="text"
                    value={siteContent.hero?.video || ""}
                    onChange={(e) => setSiteContent((prev) => ({ ...prev, hero: { ...prev.hero, video: e.target.value } }))}
                    placeholder="/videos/hero.mp4"
                    style={{ fontSize: 12, padding: "6px 10px" }}
                  />
                </label>
              </div>

              {/* Box 2: Hero Poster / Fallback Image */}
              <div style={{ background: "var(--od-paper)", border: "1px solid var(--od-line)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 6 }}>
                  2. Hero Poster Image (Fallback & Mobile)
                </div>
                <div className="vsd-aspect-banner" style={{ marginBottom: 10, aspectRatio: "16/9" }}>
                  <img
                    src={siteContent.hero?.poster ? resolveBackendMedia(siteContent.hero.poster) : publicAsset("/hero/craftsmanship-poster.webp")}
                    alt="Homepage Hero Poster"
                  />
                  {uploadingTarget?.id === "hero" && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                      <Loader2 size={24} className="od-spin" />
                    </div>
                  )}
                </div>
                <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "8px 12px", fontSize: 12, cursor: "pointer", marginBottom: 8 }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleHeroPosterUpload(e.target.files?.[0])}
                    style={{ display: "none" }}
                    disabled={uploadingTarget?.id === "hero"}
                  />
                  <UploadCloud size={13} /> {uploadingTarget?.id === "hero" ? "Uploading..." : "Replace Hero Poster Image"}
                </label>
                <label className="od-field" style={{ margin: 0 }}>
                  <span style={{ fontSize: 10.5 }}>Poster Image URL / Key</span>
                  <input
                    type="text"
                    value={siteContent.hero?.poster || ""}
                    onChange={(e) => setSiteContent((prev) => ({ ...prev, hero: { ...prev.hero, poster: e.target.value } }))}
                    placeholder="/hero/craftsmanship-poster.webp"
                    style={{ fontSize: 12, padding: "6px 10px" }}
                  />
                </label>
              </div>
            </div>

              {/* Hero Headline Copy Editor */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 10 }}>
                  2. Hero Text Lines & Eyebrow
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  <label className="od-field">
                    <span>Eyebrow Tagline</span>
                    <input
                      type="text"
                      value={siteContent.hero?.eyebrow || ""}
                      onChange={(e) => setSiteContent((prev) => ({ ...prev, hero: { ...prev.hero, eyebrow: e.target.value } }))}
                      placeholder="BDSM · BDS MARVEL"
                    />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                    <label className="od-field">
                      <span>Title Line 1</span>
                      <input
                        type="text"
                        value={siteContent.hero?.title_1 || ""}
                        onChange={(e) => setSiteContent((prev) => ({ ...prev, hero: { ...prev.hero, title_1: e.target.value } }))}
                        placeholder="Architecture."
                      />
                    </label>
                    <label className="od-field">
                      <span>Title Line 2 (Italicized)</span>
                      <input
                        type="text"
                        value={siteContent.hero?.title_2 || ""}
                        onChange={(e) => setSiteContent((prev) => ({ ...prev, hero: { ...prev.hero, title_2: e.target.value } }))}
                        placeholder="Interiors."
                      />
                    </label>
                    <label className="od-field">
                      <span>Title Line 3</span>
                      <input
                        type="text"
                        value={siteContent.hero?.title_3 || ""}
                        onChange={(e) => setSiteContent((prev) => ({ ...prev, hero: { ...prev.hero, title_3: e.target.value } }))}
                        placeholder="Everything In Between."
                      />
                    </label>
                  </div>
                  <label className="od-field">
                    <span>Subtitle / Supporting Lede</span>
                    <textarea
                      rows={2}
                      value={siteContent.hero?.subtitle || ""}
                      onChange={(e) => setSiteContent((prev) => ({ ...prev, hero: { ...prev.hero, subtitle: e.target.value } }))}
                      placeholder="One design and build studio for marble and stone, flooring, turnkey construction and interior design."
                    />
                  </label>
                  <button
                    type="button"
                    className="od-btn od-btn--primary"
                    onClick={() => persistSiteContent(siteContent, "Homepage Hero Headline")}
                    disabled={savingSection === "Homepage Hero Headline"}
                    style={{ width: "fit-content", padding: "8px 18px", fontSize: 12 }}
                  >
                    {savingSection === "Homepage Hero Headline" && <Loader2 size={13} className="od-spin" />} Save Hero Content
                  </button>
                </div>
              </div>
            </div>

          {/* Section 2: "How We Build" Craft Philosophy (All 5 Pillars) */}
          <div className="od-card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                  01.2 How BDS Marvel Builds Section
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 20 }}>The 5 Craft Philosophy Pillars (Images & Philosophy)</h3>
                <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                  Section 02 on the homepage: features the stonecraft artisan workshop photos and design approach.
                </p>
              </div>
              <button
                type="button"
                className="od-btn od-btn--primary"
                onClick={() => persistSiteContent(siteContent, "Craft Philosophy Pillars")}
                disabled={savingSection === "Craft Philosophy Pillars"}
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                {savingSection === "Craft Philosophy Pillars" && <Loader2 size={13} className="od-spin" />} Save All 5 Pillars
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(clamp(240px, 28vw, 320px), 1fr))", gap: 18 }}>
              {siteContent.approach.map((pillar, idx) => {
                const isUploading = uploadingTarget?.id === "approach" && uploadingTarget?.field === `pillar_${idx}`;
                return (
                  <div key={pillar.number || idx} style={{ background: "var(--od-paper)", border: "1px solid var(--od-line)", borderRadius: 14, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--od-gold-d)" }}>PILLAR {pillar.number || `0${idx + 1}`}</span>
                      <span style={{ fontSize: 11, color: "var(--od-muted)" }}>Homepage Section 02</span>
                    </div>

                    <div className="vsd-aspect-card">
                      <img src={img(pillar.image, 500)} alt={pillar.title} />
                      {isUploading && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                          <Loader2 size={20} className="od-spin" />
                        </div>
                      )}
                    </div>

                    <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "6px 10px", fontSize: 11.5, cursor: "pointer", marginBottom: 10 }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePillarImageUpload(idx, e.target.files?.[0])}
                        style={{ display: "none" }}
                        disabled={isUploading}
                      />
                      <UploadCloud size={12} /> {isUploading ? "Uploading..." : "Replace Pillar Photo"}
                    </label>

                    <input
                      type="text"
                      value={pillar.title || ""}
                      onChange={(e) => {
                        const next = [...siteContent.approach];
                        next[idx] = { ...next[idx], title: e.target.value };
                        setSiteContent((prev) => ({ ...prev, approach: next }));
                      }}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 12, fontWeight: 700, marginBottom: 6, background: "var(--od-surface-subtle)", color: "var(--od-ink)" }}
                    />
                    <textarea
                      rows={2}
                      value={pillar.text || ""}
                      onChange={(e) => {
                        const next = [...siteContent.approach];
                        next[idx] = { ...next[idx], text: e.target.value };
                        setSiteContent((prev) => ({ ...prev, approach: next }));
                      }}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 12, background: "var(--od-surface-subtle)", color: "var(--od-ink)", resize: "vertical" }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Living Studio Spotlight Banner */}
          <div className="od-card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                  01.3 Experience Our Craft Section
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 20 }}>Living Studio Spotlight ("Stay Inside What We Built")</h3>
                <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                  Featured banner on the homepage inviting visitors to book and experience the stays collection.
                </p>
              </div>
              <button
                type="button"
                className="od-btn od-btn--primary"
                onClick={() => persistSiteContent(siteContent, "Living Studio Spotlight")}
                disabled={savingSection === "Living Studio Spotlight"}
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                {savingSection === "Living Studio Spotlight" && <Loader2 size={13} className="od-spin" />} Save Living Studio
              </button>
            </div>

            <div className="vsd-card-grid">
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 6 }}>
                  Spotlight Hero Banner
                </div>
                <div className="vsd-aspect-banner">
                  <img src={img(siteContent.living_studio?.hero, 500)} alt="Living Studio" />
                  {uploadingTarget?.id === "living_studio" && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                      <Loader2 size={24} className="od-spin" />
                    </div>
                  )}
                </div>
                <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleLivingStudioHeroUpload(e.target.files?.[0])}
                    style={{ display: "none" }}
                    disabled={uploadingTarget?.id === "living_studio"}
                  />
                  <UploadCloud size={13} /> Replace Spotlight Photo
                </label>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <label className="od-field">
                  <span>Headline Tagline</span>
                  <input
                    type="text"
                    value={siteContent.living_studio?.tagline || ""}
                    onChange={(e) => setSiteContent((prev) => ({ ...prev, living_studio: { ...prev.living_studio, tagline: e.target.value } }))}
                  />
                </label>
                <label className="od-field">
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={siteContent.living_studio?.body || ""}
                    onChange={(e) => setSiteContent((prev) => ({ ...prev, living_studio: { ...prev.living_studio, body: e.target.value } }))}
                  />
                </label>
                <div style={{ background: "var(--od-paper)", border: "1px solid var(--od-line)", borderRadius: 10, padding: 12, fontSize: 12, color: "var(--od-muted)" }}>
                  📍 <strong>Where this links on the website:</strong> When visitors click "Explore the Stay" on this banner, they navigate to <strong>Screen 02 (Luxury Stays)</strong>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 02: LUXURY STAYS (Listing Cards + Detail Galleries Seen After Clicking)
         ========================================================================= */}
      {activeScreen === "stays" && (
        <div>
          <div className="vsd-toolbar">
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                All 6 Stays: Browse Cards & Inner Detail Galleries
              </h4>
              <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                For each stay: the left box is the card photo on <code>/stays</code>. The right gallery contains the high-res photos visitors see <strong>after clicking into the stay</strong>.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div className="vsd-search-box">
                <input
                  type="text"
                  placeholder="Filter stays (e.g. Living Studio)..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--od-muted)" }} />
              </div>
              <div style={{ display: "flex", gap: 4, background: "var(--od-surface)", border: "1px solid var(--od-line)", borderRadius: 8, padding: 3 }}>
                <button
                  type="button"
                  onClick={() => setGalleryViewMode("grid")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "none",
                    background: galleryViewMode === "grid" ? "var(--od-ink)" : "transparent",
                    color: galleryViewMode === "grid" ? "#fff" : "var(--od-muted)",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Grid View"
                >
                  <GridIcon size={12} /> Grid
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryViewMode("filmstrip")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "none",
                    background: galleryViewMode === "filmstrip" ? "var(--od-ink)" : "transparent",
                    color: galleryViewMode === "filmstrip" ? "#fff" : "var(--od-muted)",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Filmstrip Carousel View"
                >
                  <Film size={12} /> Filmstrip
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 24 }}>
            {stays
              .filter((s) => !searchFilter || s.name.toLowerCase().includes(searchFilter.toLowerCase()))
              .map((stay) => {
                const galleryList = Array.isArray(stay.gallery) ? stay.gallery : [];
                const isHeroUploading = uploadingTarget?.id === (stay.id || stay.slug) && uploadingTarget?.field === "hero";
                const isGalleryAdding = uploadingTarget?.id === (stay.id || stay.slug) && uploadingTarget?.field === "gallery_add";

                return (
                  <div key={stay.slug || stay.id} className="od-card" style={{ padding: 22, borderRadius: 18 }}>
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
                          View Live Stay Page <ExternalLink size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="vsd-card-grid">
                      {/* LEVEL 1: LISTING CARD PHOTO */}
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 6 }}>
                          1. Browse Card Photo
                        </div>
                        <div className="vsd-aspect-card">
                          {stay.hero ? (
                            <img src={img(stay.hero, 500)} alt={stay.name} />
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
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
                        ) : galleryViewMode === "filmstrip" ? (
                          /* Filmstrip View: Smooth Horizontal Scroll with Gradient Fades */
                          <HorizontalScrollArea scrollAmount={220}>
                            {galleryList.map((photoUrl, photoIdx) => {
                              const isReplacing = uploadingTarget?.id === (stay.id || stay.slug) && uploadingTarget?.field === `gallery_${photoIdx}`;
                              return (
                                <div
                                  key={photoIdx}
                                  className="vsd-gallery-thumb"
                                  style={{ flex: "0 0 140px", scrollSnapAlign: "start" }}
                                >
                                  <img src={img(photoUrl, 300)} alt={`Detail ${photoIdx + 1}`} />

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
                          </HorizontalScrollArea>
                        ) : (
                          /* Grid View: Flexible Auto-Fill Grid */
                          <div className="vsd-gallery-grid">
                            {galleryList.map((photoUrl, photoIdx) => {
                              const isReplacing = uploadingTarget?.id === (stay.id || stay.slug) && uploadingTarget?.field === `gallery_${photoIdx}`;
                              return (
                                <div key={photoIdx} className="vsd-gallery-thumb">
                                  <img src={img(photoUrl, 300)} alt={`Detail ${photoIdx + 1}`} />

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
          SCREEN 03: ARCHITECTURAL PROJECTS (Browse Cards + Detail Galleries)
         ========================================================================= */}
      {activeScreen === "projects" && (
        <div>
          <div className="vsd-toolbar">
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Architectural Projects: Browse Cards & In-Place Detail Galleries
              </h4>
              <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                For each project: the left box is the card photo on <code>/projects</code> and the homepage slideshow. The right gallery contains the photos visitors see <strong>after clicking into the project</strong>.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div className="vsd-search-box">
                <input
                  type="text"
                  placeholder="Filter projects (e.g. Meridian)..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--od-muted)" }} />
              </div>
              <div style={{ display: "flex", gap: 4, background: "var(--od-surface)", border: "1px solid var(--od-line)", borderRadius: 8, padding: 3 }}>
                <button
                  type="button"
                  onClick={() => setGalleryViewMode("grid")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "none",
                    background: galleryViewMode === "grid" ? "var(--od-ink)" : "transparent",
                    color: galleryViewMode === "grid" ? "#fff" : "var(--od-muted)",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Grid View"
                >
                  <GridIcon size={12} /> Grid
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryViewMode("filmstrip")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "none",
                    background: galleryViewMode === "filmstrip" ? "var(--od-ink)" : "transparent",
                    color: galleryViewMode === "filmstrip" ? "#fff" : "var(--od-muted)",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Filmstrip Carousel View"
                >
                  <Film size={12} /> Filmstrip
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 24 }}>
            {projects
              .filter((p) => !searchFilter || p.title.toLowerCase().includes(searchFilter.toLowerCase()))
              .map((proj) => {
                const galleryList = Array.isArray(proj.gallery) ? proj.gallery : [];
                const isHeroUploading = uploadingTarget?.id === (proj.id || proj.slug) && uploadingTarget?.field === "hero";
                const isGalleryAdding = uploadingTarget?.id === (proj.id || proj.slug) && uploadingTarget?.field === "gallery_add";

                return (
                  <div key={proj.slug || proj.id} className="od-card" style={{ padding: 22, borderRadius: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                            {proj.segment} · {proj.category}
                          </span>
                          <span style={{ color: "var(--od-muted)", fontSize: 12 }}>·</span>
                          <span style={{ color: "var(--od-muted)", fontSize: 12 }}>{proj.location} ({proj.year})</span>
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

                    <div className="vsd-card-grid">
                      {/* LEVEL 1: LISTING CARD PHOTO */}
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 6 }}>
                          1. Browse Card Photo
                        </div>
                        <div className="vsd-aspect-card">
                          {proj.image ? (
                            <img src={img(proj.image, 500)} alt={proj.title} />
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
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
                        ) : galleryViewMode === "filmstrip" ? (
                          <HorizontalScrollArea scrollAmount={220}>
                            {galleryList.map((photoUrl, photoIdx) => {
                              const isReplacing = uploadingTarget?.id === (proj.id || proj.slug) && uploadingTarget?.field === `gallery_${photoIdx}`;
                              return (
                                <div
                                  key={photoIdx}
                                  className="vsd-gallery-thumb"
                                  style={{ flex: "0 0 140px", scrollSnapAlign: "start" }}
                                >
                                  <img src={img(photoUrl, 300)} alt={`Project ${photoIdx + 1}`} />

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
                          </HorizontalScrollArea>
                        ) : (
                          <div className="vsd-gallery-grid">
                            {galleryList.map((photoUrl, photoIdx) => {
                              const isReplacing = uploadingTarget?.id === (proj.id || proj.slug) && uploadingTarget?.field === `gallery_${photoIdx}`;
                              return (
                                <div key={photoIdx} className="vsd-gallery-thumb">
                                  <img src={img(photoUrl, 300)} alt={`Project ${photoIdx + 1}`} />

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
          SCREEN 04: MATERIALS CATALOGUE (Browse Cards + Detail Galleries)
         ========================================================================= */}
      {activeScreen === "catalogue" && (
        <div>
          <div className="vsd-toolbar">
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Materials Catalogue: Browse Cards & Detail Galleries
              </h4>
              <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                For each material: the left box is the card photo on <code>/catalogue</code>. The right gallery contains the slab swatches and finish photos visitors see <strong>after clicking into the item</strong>.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div className="vsd-search-box">
                <input
                  type="text"
                  placeholder="Filter catalogue (e.g. Marble)..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--od-muted)" }} />
              </div>
              <div style={{ display: "flex", gap: 4, background: "var(--od-surface)", border: "1px solid var(--od-line)", borderRadius: 8, padding: 3 }}>
                <button
                  type="button"
                  onClick={() => setGalleryViewMode("grid")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "none",
                    background: galleryViewMode === "grid" ? "var(--od-ink)" : "transparent",
                    color: galleryViewMode === "grid" ? "#fff" : "var(--od-muted)",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Grid View"
                >
                  <GridIcon size={12} /> Grid
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryViewMode("filmstrip")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "none",
                    background: galleryViewMode === "filmstrip" ? "var(--od-ink)" : "transparent",
                    color: galleryViewMode === "filmstrip" ? "#fff" : "var(--od-muted)",
                    fontSize: 11,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Filmstrip Carousel View"
                >
                  <Film size={12} /> Filmstrip
                </button>
              </div>
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

                    <div className="vsd-card-grid">
                      {/* LEVEL 1: CARD PHOTO */}
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 6 }}>
                          1. Browse Card Photo
                        </div>
                        <div className="vsd-aspect-card">
                          {item.image ? (
                            <img src={img(item.image, 500)} alt={item.name} />
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
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
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
                        ) : galleryViewMode === "filmstrip" ? (
                          <HorizontalScrollArea scrollAmount={220}>
                            {galleryList.map((photoUrl, photoIdx) => {
                              const isReplacing = uploadingTarget?.id === (item.id || item.slug) && uploadingTarget?.field === `gallery_${photoIdx}`;
                              return (
                                <div
                                  key={photoIdx}
                                  className="vsd-gallery-thumb"
                                  style={{ flex: "0 0 140px", scrollSnapAlign: "start" }}
                                >
                                  <img src={img(photoUrl, 300)} alt={`Product ${photoIdx + 1}`} />

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
                          </HorizontalScrollArea>
                        ) : (
                          <div className="vsd-gallery-grid">
                            {galleryList.map((photoUrl, photoIdx) => {
                              const isReplacing = uploadingTarget?.id === (item.id || item.slug) && uploadingTarget?.field === `gallery_${photoIdx}`;
                              return (
                                <div key={photoIdx} className="vsd-gallery-thumb">
                                  <img src={img(photoUrl, 300)} alt={`Product ${photoIdx + 1}`} />

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
          SCREEN 05: BUSINESS DIVISIONS (The 4 Divisions: Banners & Showcase)
         ========================================================================= */}
      {activeScreen === "businesses" && (
        <div style={{ display: "grid", gap: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                The 4 Business Divisions: Hero Banners & Live Pages
              </h4>
              <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                BDS Marvel is powered by 4 foundational trade businesses. Replace any division's hero banner, update its copy, or preview its live screen.
              </p>
            </div>
            <button
              type="button"
              className="od-btn od-btn--primary"
              onClick={() => persistSiteContent(siteContent, "Business Divisions")}
              disabled={savingSection === "Business Divisions"}
              style={{ padding: "6px 14px", fontSize: 12 }}
            >
              {savingSection === "Business Divisions" && <Loader2 size={13} className="od-spin" />} Save All Divisions
            </button>
          </div>

          <div style={{ display: "grid", gap: 20 }}>
            {siteContent.divisions.map((div, divIdx) => {
              const isUploading = uploadingTarget?.id === "division" && uploadingTarget?.field === `hero_${divIdx}`;
              return (
                <div key={div.slug} className="od-card" style={{ padding: 22, borderRadius: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                        {div.parent} · {div.kicker}
                      </span>
                      <h3 style={{ margin: "2px 0 0", fontSize: 22, fontFamily: "'Cormorant Garamond', serif" }}>
                        {div.name}
                      </h3>
                      <span style={{ fontSize: 12, color: "var(--od-muted)", fontFamily: "monospace" }}>
                        URL: /businesses/{div.slug}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="od-btn"
                      onClick={() => openLivePage(`/businesses/${div.slug}`)}
                      style={{ padding: "5px 12px", fontSize: 11.5 }}
                    >
                      View Live Division <ExternalLink size={11} />
                    </button>
                  </div>

                  <div className="vsd-card-grid">
                    {/* LEVEL 1: DIVISION HERO BANNER */}
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)", marginBottom: 6 }}>
                        1. Division Hero Banner
                      </div>
                      <div className="vsd-aspect-banner">
                        <img src={img(div.hero, 600)} alt={div.name} />
                        {isUploading && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                            <Loader2 size={24} className="od-spin" />
                          </div>
                        )}
                      </div>
                      <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "8px 12px", fontSize: 12, cursor: "pointer" }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleDivisionHeroUpload(divIdx, e.target.files?.[0])}
                          style={{ display: "none" }}
                          disabled={isUploading}
                        />
                        <UploadCloud size={13} /> {isUploading ? "Uploading..." : "Replace Hero Banner"}
                      </label>
                      <p style={{ margin: "6px 0 0", color: "var(--od-muted)", fontSize: 11, textAlign: "center" }}>
                        Seen at top of /businesses/{div.slug}
                      </p>
                    </div>

                    {/* LEVEL 2: DIVISION COPY & SHOWCASE */}
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                        2. Tagline & Division Description
                      </div>
                      <label className="od-field">
                        <span>Tagline</span>
                        <input
                          type="text"
                          value={div.tagline || ""}
                          onChange={(e) => {
                            const next = [...siteContent.divisions];
                            next[divIdx] = { ...next[divIdx], tagline: e.target.value };
                            setSiteContent((prev) => ({ ...prev, divisions: next }));
                          }}
                        />
                      </label>
                      <label className="od-field">
                        <span>Body Description</span>
                        <textarea
                          rows={3}
                          value={div.body || ""}
                          onChange={(e) => {
                            const next = [...siteContent.divisions];
                            next[divIdx] = { ...next[divIdx], body: e.target.value };
                            setSiteContent((prev) => ({ ...prev, divisions: next }));
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 06: ABOUT STUDIO & WORKSHOPS (Heritage Story & 6 Team Portraits)
         ========================================================================= */}
      {activeScreen === "about" && (
        <div style={{ display: "grid", gap: 24 }}>
          <div className="od-card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                  06.1 Studio Story & Heritage
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 20 }}>Studio Story & Two Decades of Heritage</h3>
              </div>
              <button
                type="button"
                className="od-btn"
                onClick={() => openLivePage("/about")}
                style={{ padding: "5px 12px", fontSize: 11.5 }}
              >
                View Live About Page <ExternalLink size={11} />
              </button>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <label className="od-field">
                <span>Story Paragraph 1 (Lead Intro)</span>
                <textarea
                  rows={2}
                  value={siteContent.about?.lede_1 || ""}
                  onChange={(e) => setSiteContent((prev) => ({ ...prev, about: { ...prev.about, lede_1: e.target.value } }))}
                  placeholder="BDSM · BDS Marvel is one design and build company..."
                />
              </label>
              <label className="od-field">
                <span>Story Paragraph 2 (Heritage Track Record)</span>
                <textarea
                  rows={2}
                  value={siteContent.about?.lede_2 || ""}
                  onChange={(e) => setSiteContent((prev) => ({ ...prev, about: { ...prev.about, lede_2: e.target.value } }))}
                  placeholder="The names are new — our people have built for the country's most demanding..."
                />
              </label>
              <button
                type="button"
                className="od-btn od-btn--primary"
                onClick={() => persistSiteContent(siteContent, "About Studio Story")}
                disabled={savingSection === "About Studio Story"}
                style={{ width: "fit-content", padding: "8px 18px", fontSize: 12 }}
              >
                {savingSection === "About Studio Story" && <Loader2 size={13} className="od-spin" />} Save Studio Story
              </button>
            </div>
          </div>

          {/* Section 2: The 6 Leadership & Craft Workshop Team Portraits */}
          <div className="od-card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                  06.2 The People Behind The Work
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 20 }}>The 6 Workshop & Leadership Craft Portraits</h3>
                <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                  The portraits shown in "People Behind The Work" grid on the <code>/about</code> screen.
                </p>
              </div>
              <button
                type="button"
                className="od-btn od-btn--primary"
                onClick={() => persistSiteContent(siteContent, "About Team Portraits")}
                disabled={savingSection === "About Team Portraits"}
                style={{ padding: "6px 14px", fontSize: 12 }}
              >
                {savingSection === "About Team Portraits" && <Loader2 size={13} className="od-spin" />} Save All 6 Portraits
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(clamp(200px, 22vw, 260px), 1fr))", gap: 18 }}>
              {(siteContent.about?.team || DEFAULT_ABOUT.team).map((member, idx) => {
                const isUploading = uploadingTarget?.id === "about_team" && uploadingTarget?.field === `portrait_${idx}`;
                return (
                  <div key={member.name || idx} style={{ background: "var(--od-paper)", border: "1px solid var(--od-line)", borderRadius: 14, padding: 14 }}>
                    <div className="vsd-aspect-portrait">
                      <img src={img(member.image, 500)} alt={member.name} />
                      {isUploading && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff" }}>
                          <Loader2 size={24} className="od-spin" />
                        </div>
                      )}
                    </div>

                    <label className="od-btn" style={{ width: "100%", justifyContent: "center", padding: "6px 10px", fontSize: 11.5, cursor: "pointer", marginBottom: 10 }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleTeamPortraitUpload(idx, e.target.files?.[0])}
                        style={{ display: "none" }}
                        disabled={isUploading}
                      />
                      <UploadCloud size={12} /> {isUploading ? "Uploading..." : "Replace Portrait Photo"}
                    </label>

                    <input
                      type="text"
                      value={member.name || ""}
                      onChange={(e) => {
                        const nextTeam = [...(siteContent.about?.team || DEFAULT_ABOUT.team)];
                        nextTeam[idx] = { ...nextTeam[idx], name: e.target.value };
                        setSiteContent((prev) => ({ ...prev, about: { ...prev.about, team: nextTeam } }));
                      }}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 12, fontWeight: 700, marginBottom: 6, background: "var(--od-surface-subtle)", color: "var(--od-ink)" }}
                    />
                    <input
                      type="text"
                      value={member.role || ""}
                      onChange={(e) => {
                        const nextTeam = [...(siteContent.about?.team || DEFAULT_ABOUT.team)];
                        nextTeam[idx] = { ...nextTeam[idx], role: e.target.value };
                        setSiteContent((prev) => ({ ...prev, about: { ...prev.about, team: nextTeam } }));
                      }}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--od-line)", fontSize: 12, background: "var(--od-surface-subtle)", color: "var(--od-muted)" }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCREEN 07: CLIENTELE & BRAND LOGOS MARQUEE (Live Reel + 24+ Brand Directory)
         ========================================================================= */}
      {activeScreen === "clients" && (
        <div style={{ display: "grid", gap: 24 }}>
          {/* Section 1: Live Animated Marquee Reel with Smooth Horizontal Scroll & Dark Edge Fades */}
          <div className="od-card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                  07.1 Live Reel Preview
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 20 }}>Continuous Partner Brand Marquee</h3>
                <p style={{ margin: "2px 0 0", color: "var(--od-muted)", fontSize: 12.5 }}>
                  This is the exact animated marquee reel prospective clients see at the bottom of the homepage (<code>/#contact</code>).
                </p>
              </div>
              <button
                type="button"
                className="od-btn"
                onClick={() => openLivePage("/#contact")}
                style={{ padding: "5px 12px", fontSize: 11.5 }}
              >
                View Live Marquee <ExternalLink size={11} />
              </button>
            </div>

            <div style={{ background: "#0a0806", padding: "20px 16px", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "monospace", textTransform: "uppercase" }}>
                  Interactive Reel Preview · {siteContent.clients.length} Partner Brands
                </span>
                <span style={{ fontSize: 11, color: "var(--od-gold)" }}>
                  ✦ Drag / Scroll to inspect logos ➔
                </span>
              </div>

              <HorizontalScrollArea dark={true} scrollAmount={300}>
                {siteContent.clients.map((c, i) => {
                  const logoUrl = c.logo?.startsWith("http") || c.logo?.startsWith("/") ? resolveBackendMedia(c.logo) : publicAsset(c.logo);
                  return (
                    <div
                      key={i}
                      style={{
                        flex: "0 0 130px",
                        height: 54,
                        background: "#fff",
                        borderRadius: 8,
                        display: "grid",
                        placeItems: "center",
                        padding: "4px 10px",
                        scrollSnapAlign: "start",
                      }}
                    >
                      {logoUrl ? (
                        <img src={logoUrl} alt={c.name} style={{ maxHeight: 38, maxWidth: "100%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#111", textAlign: "center" }}>{c.name}</span>
                      )}
                    </div>
                  );
                })}
              </HorizontalScrollArea>
            </div>
          </div>

          {/* Section 2: Searchable & Editable Directory of all 24+ Brand Logos */}
          <div className="od-card" style={{ padding: 24, borderRadius: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid var(--od-line)", paddingBottom: 10, flexWrap: "wrap", gap: 12 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--od-gold-d)" }}>
                  07.2 Brand Directory
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 20 }}>
                  Manage All 24+ Client Brand Logos ({siteContent.clients.length} Total)
                </h3>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div className="vsd-search-box">
                  <input
                    type="text"
                    placeholder="Search logo (e.g. Taj)..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                  <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--od-muted)" }} />
                </div>

                <label className="od-btn od-btn--primary" style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const name = window.prompt("Enter company or brand name for this logo:");
                      if (name) handleAddClientLogo(file, name);
                    }}
                    style={{ display: "none" }}
                  />
                  <Plus size={13} /> Add Brand Logo
                </label>

                <button
                  type="button"
                  className="od-btn"
                  onClick={() => persistSiteContent(siteContent, "Brand Logos")}
                  disabled={savingSection === "Brand Logos"}
                  style={{ padding: "6px 14px", fontSize: 12 }}
                >
                  {savingSection === "Brand Logos" && <Loader2 size={13} className="od-spin" />} Save Brand Directory
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(clamp(150px, 18vw, 210px), 1fr))", gap: 14 }}>
              {siteContent.clients
                .map((client, originalIdx) => ({ client, originalIdx }))
                .filter(({ client }) => !searchFilter || client.name.toLowerCase().includes(searchFilter.toLowerCase()))
                .map(({ client, originalIdx }) => {
                  const logoUrl = client.logo?.startsWith("http") || client.logo?.startsWith("/") ? resolveBackendMedia(client.logo) : publicAsset(client.logo);
                  const isUploading = uploadingTarget?.id === "client_logo" && uploadingTarget?.field === `logo_${originalIdx}`;

                  return (
                    <div
                      key={originalIdx}
                      style={{
                        background: "var(--od-paper)",
                        border: "1px solid var(--od-line)",
                        borderRadius: 12,
                        padding: 12,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div className="vsd-brand-logo-tile">
                        {logoUrl ? (
                          <img src={logoUrl} alt={client.name} style={{ maxHeight: 44, maxWidth: "100%", objectFit: "contain" }} />
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>{client.name}</span>
                        )}
                        {isUploading && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "grid", placeItems: "center", color: "#fff", borderRadius: 8 }}>
                            <Loader2 size={18} className="od-spin" />
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {client.name}
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <label className="od-btn" style={{ flex: 1, justifyContent: "center", fontSize: 11, padding: "5px", cursor: "pointer" }} title="Replace Logo">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleClientLogoUpload(originalIdx, e.target.files?.[0])}
                            style={{ display: "none" }}
                            disabled={isUploading}
                          />
                          <UploadCloud size={11} /> Replace
                        </label>
                        <button
                          type="button"
                          className="od-btn"
                          onClick={() => handleDeleteClientLogo(originalIdx)}
                          style={{ color: "#d9534f", padding: "5px 8px" }}
                          title="Delete Logo"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisualScreenDirectory;
