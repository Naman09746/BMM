import { createContext, useContext, useEffect, useState } from "react";
import { publicAsset } from "./wordpress";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");

export const DEFAULT_PROJECTS = [
  { slug: "meridian-residences", title: "Meridian Residences", segment: "MARBLE & STONE", category: "Residential", image: "photo-1600585154340-be6161a56a0c", gallery: ["photo-1600585154340-be6161a56a0c", "photo-1618221195710-dd6b41faaea6", "photo-1616486338812-3dadae4b4ace"], year: "2024", location: "Alibaug, Maharashtra", description: "Twelve seafront villas clad in a custom facade stone quarried, cut and installed end-to-end.", challenge: "The facade needed to weather the salt air without turning grey.", approach: "We specified a dense sandstone with a low porosity and honed it to bring the warm undertones forward.", outcomes: [["12", "villas delivered"], ["18 mo", "site to handover"], ["100%", "material in-house"]], credits: ["Drawstones — Facade & Interior Stone", "Formwork — Civil & Finishing", "Architect — External partner"], is_active: true },
  { slug: "kabbon-lounge", title: "Kabbon Lounge", segment: "INTERIOR DECOR", category: "Hospitality", image: "photo-1600607687939-ce8a6c25118c", gallery: ["photo-1600607687939-ce8a6c25118c", "photo-1600566753190-17f0baa2a6c3", "photo-1616486338812-3dadae4b4ace"], year: "2024", location: "Bengaluru, Karnataka", description: "A 90-cover restaurant designed around a single travertine bar block.", challenge: "The client wanted the room to feel monolithic without becoming cold.", approach: "One stone, three finishes — a polished bar top, honed cladding, split-face walls. Warm oak floors soften everything else.", outcomes: [["1", "material palette"], ["4 mo", "design to open"], ["120 sqm", "of stone specified"]], credits: ["Vignette — Concept & Execution", "Drawstones — Travertine sourcing", "Formwork — Fit-out"], is_active: true },
  { slug: "veda-clubhouse", title: "Veda Clubhouse", segment: "CONSTRUCTION", category: "Amenity", image: "photo-1600566753190-17f0baa2a6c3", gallery: ["photo-1600566753190-17f0baa2a6c3", "photo-1618221195710-dd6b41faaea6", "photo-1600585154340-be6161a56a0c"], year: "2023", location: "Pune, Maharashtra", description: "A residential clubhouse — pool, gym, event spaces — built as one continuous stone ribbon.", challenge: "Every wall inside and out had to read as the same material.", approach: "We wrapped the volume in a Kota-limestone rain screen and continued the same stone through the pool coping and lobby floor.", outcomes: [["2,400 sqm", "built-up"], ["3", "levels"], ["14 mo", "structure to soft launch"]], credits: ["Formwork — Structure & Finishing", "Drawstones — Kota supply", "Renest — Pool decking"], is_active: true },
  { slug: "annex-workspace", title: "Annex Workspace", segment: "FLOORING", category: "Commercial", image: "photo-1616486338812-3dadae4b4ace", gallery: ["photo-1616486338812-3dadae4b4ace", "photo-1600607687939-ce8a6c25118c", "photo-1503387762-592deb58ef4e"], year: "2023", location: "Gurugram, Haryana", description: "40,000 sqft of workspace flooring across three floors, delivered in a six-week window.", challenge: "A hospitality-grade floor that could take a corporate footfall.", approach: "Contract-grade SPC in two warm tones, pre-cut off-site so installation ran cleanly.", outcomes: [["40,000 sqft", "installed"], ["6 wk", "on site"], ["0", "post-handover claims"]], credits: ["Renest — Specification & Installation", "Formwork — Sub-structure"], is_active: true },
  { slug: "atrium-mall", title: "Atrium Mall", segment: "MARBLE & STONE", category: "Commercial", image: "photo-1503387762-592deb58ef4e", gallery: ["photo-1503387762-592deb58ef4e", "photo-1600585154340-be6161a56a0c", "photo-1618221195710-dd6b41faaea6"], year: "2022", location: "Jaipur, Rajasthan", description: "Retail atrium with a book-matched onyx feature wall and a full-marble concourse.", challenge: "Matching stone across 45 running metres of feature wall.", approach: "We sourced two adjacent onyx blocks, cut them ourselves, and book-matched every panel before shipping.", outcomes: [["45 m", "book-matched wall"], ["3,600 sqm", "concourse marble"], ["1", "onyx block, split"]], credits: ["Drawstones — Sourcing, cutting, installation", "Formwork — Substrate & wall build"], is_active: true },
  { slug: "shore-villa", title: "Shore Villa", segment: "INTERIOR DECOR", category: "Residential", image: "photo-1618221195710-dd6b41faaea6", gallery: ["photo-1618221195710-dd6b41faaea6", "photo-1600585154340-be6161a56a0c", "photo-1616486338812-3dadae4b4ace"], year: "2024", location: "Goa", description: "A four-bedroom villa where every fixed surface is stone.", challenge: "Keep a heavy-material palette from feeling like a museum.", approach: "Three warm marbles, natural lime plaster, oak floors and light linen textiles. Nothing else.", outcomes: [["4", "bedrooms"], ["3", "stones"], ["9 mo", "design to move-in"]], credits: ["Vignette — Full scope", "Drawstones — Kitchen, bath, feature wall", "Renest — Oak plank"], is_active: true },
  { slug: "civic-facade", title: "Civic Facade", segment: "MARBLE & STONE", category: "Institutional", image: "photo-1580587771525-78b9dba3b914", gallery: ["photo-1580587771525-78b9dba3b914", "photo-1600585154340-be6161a56a0c", "photo-1618221195710-dd6b41faaea6"], year: "2022", location: "Ahmedabad, Gujarat", description: "A civic building facade in flame-finished granite installed as a dry-cladding system.", challenge: "A facade that would read cleanly at scale and stay clean over the years.", approach: "Self-cleaning flame finish, a 4mm shadow gap and a sub-frame built to hold thermal movement.", outcomes: [["1,850 sqm", "facade"], ["4mm", "reveal, everywhere"], ["7", "elevations resolved"]], credits: ["Drawstones — Supply & installation", "Formwork — Sub-frame & envelope"], is_active: true },
  { slug: "kiln-restaurant", title: "Kiln Restaurant", segment: "CONSTRUCTION", category: "Hospitality", image: "photo-1600566753190-17f0baa2a6c3", gallery: ["photo-1600566753190-17f0baa2a6c3", "photo-1600607687939-ce8a6c25118c", "photo-1503387762-592deb58ef4e"], year: "2023", location: "Mumbai, Maharashtra", description: "A 3,200 sqft restaurant built around an exposed brick and stone kiln.", challenge: "Structural rework to expose the kiln without losing the load path.", approach: "We ran a new steel transfer above the kiln and let the original masonry become the room.", outcomes: [["1", "kiln, exposed"], ["3,200 sqft", "fit-out"], ["5 mo", "shell to open"]], credits: ["Formwork — Structural, shell & core", "Vignette — Design & Fit-out", "Drawstones — Bar & floor stone"], is_active: true },
  { slug: "lumen-apartment", title: "Lumen Apartment", segment: "INTERIOR DESIGNING", category: "Residential", image: "photo-1631679706909-1844bbd07221", gallery: ["photo-1631679706909-1844bbd07221", "photo-1618220179428-22790b461013", "photo-1600585154340-be6161a56a0c"], year: "2024", location: "Bengaluru, Karnataka", description: "A full interior-designing brief for a light-first city apartment, resolved end-to-end before a single wall moved.", challenge: "A dark, compartmentalised flat that needed to feel open without losing storage.", approach: "We redrew the plan around a single daylight axis, set a warm neutral palette and detailed every joinery run in 3D before build.", outcomes: [["1,650 sqft", "reimagined"], ["3D", "sign-off before build"], ["6 wk", "concept to drawings"]], credits: ["BDS Marvel — Concept, planning & detailing", "Renest — Oak flooring", "Formwork — Fit-out"], is_active: true },
  { slug: "sable-studio-office", title: "Sable Studio Office", segment: "INTERIOR DESIGNING", category: "Commercial", image: "photo-1618220179428-22790b461013", gallery: ["photo-1618220179428-22790b461013", "photo-1631679706909-1844bbd07221", "photo-1616486338812-3dadae4b4ace"], year: "2023", location: "Jaipur, Rajasthan", description: "Interior designing for a creative studio — spatial planning, material palette and lighting concept delivered as one scheme.", challenge: "Give a 20-person studio focus zones and social zones inside one open floor.", approach: "Zoning by material and light: honed stone at the core, warm oak at the edges, layered task and ambient lighting throughout.", outcomes: [["20", "person studio"], ["4", "material palette"], ["5 mo", "design to move-in"]], credits: ["BDS Marvel — Full interior-design scope", "Drawstones — Core stone", "Renest — Oak & contract flooring"], is_active: true }
];

export const DEFAULT_APPROACH = [
  { number: "01", title: "MATERIAL FIRST", image: "photo-1618221195710-dd6b41faaea6", text: "Every project begins with the stone or the surface. Specification precedes drawings so the material never has to bend to fit the design." },
  { number: "02", title: "ONE TEAM", image: "photo-1600585154340-be6161a56a0c", text: "Materials, flooring, construction and interiors under one roof. One accountable team from the spec sheet to the snag list." },
  { number: "03", title: "EDITORIAL DETAIL", image: "photo-1616486338812-3dadae4b4ace", text: "Architectural minimalism, hospitality warmth. Joints, thresholds and reveals resolved with the same care as the elevation." },
  { number: "04", title: "HERITAGE + CRAFT", image: "photo-1503387762-592deb58ef4e", text: "Traditional cutting and finishing techniques paired with modern engineering. Craftspeople we have worked with for two decades." },
  { number: "05", title: "EXPERIENCE-LED", image: "photo-1600607687939-ce8a6c25118c", text: "Don't just see the materials — live in them. The BDSM Living Studio is our showroom you can actually stay in." }
];

export const DEFAULT_CLIENTS = [
  { name: "L&T — LNT Pvt Ltd", logo: publicAsset("/clients/lnt.webp") },
  { name: "Mangalam Organics", logo: publicAsset("/clients/mangalam.webp") },
  { name: "The Lalit", logo: publicAsset("/clients/lalit.webp") },
  { name: "ITC Hotels", logo: publicAsset("/clients/itc.webp") },
  { name: "Boutique Hotels", logo: publicAsset("/clients/boutique.webp") },
  { name: "Clarks Amer", logo: publicAsset("/clients/clarks-amer.webp") },
  { name: "NHAI", logo: publicAsset("/clients/nhai.webp") },
  { name: "Kshetrapal Hospital Ajmer", logo: publicAsset("/clients/kshetrapal.webp") },
  { name: "Mewar Estate Ajmer", logo: publicAsset("/clients/mewar-estate.webp") },
  { name: "JLN Hospital Ajmer", logo: publicAsset("/clients/jln.webp") },
  { name: "MPS School Ajmer", logo: publicAsset("/clients/mps.webp") },
  { name: "DWPS Ajmer", logo: publicAsset("/clients/dwps.webp") },
  { name: "Mayo College Ajmer", logo: publicAsset("/clients/mayo.webp") },
  { name: "Taj Pratap Mahal Ajmer", logo: publicAsset("/clients/taj.webp") },
  { name: "JSB Kishangarh", logo: publicAsset("/clients/jsb.webp") },
  { name: "AKV Kishangarh", logo: publicAsset("/clients/akv.webp") },
  { name: "Bhutra Marble Kishangarh", logo: publicAsset("/clients/bhutra.webp") },
  { name: "CBSE Ajmer", logo: publicAsset("/clients/cbse.webp") },
  { name: "RBSE Ajmer", logo: publicAsset("/clients/rbse.webp") },
  { name: "Income Tax Department Ajmer", logo: publicAsset("/clients/income-tax.webp") },
  { name: "Army Cantt", logo: publicAsset("/clients/army-cantt.webp") },
  { name: "Ramada Ajmer", logo: publicAsset("/clients/ramada.webp") },
  { name: "Satguru Group Ajmer", logo: publicAsset("/clients/satguru.webp") },
  { name: "Marriott", logo: publicAsset("/clients/marriott.webp") }
];

export const DEFAULT_HERO = {
  eyebrow: "BDSM · BDS MARVEL",
  title_1: "Architecture.",
  title_2: "Interiors.",
  title_3: "Everything In Between.",
  subtitle: "One design and build studio for marble and stone, flooring, turnkey construction and interior design."
};

export const DEFAULT_DIVISIONS = [
  {
    slug: "marble-and-stone",
    name: "MARBLE & STONE",
    parent: "Drawstones",
    kicker: "Quarried & Cut in Kishangarh",
    hero: "photo-1618221195710-dd6b41faaea6",
    tagline: "Stone that carries the building's silhouette.",
    body: "Facade and face stone for structures that need to age well. Interior stone — tables, fountains, decorative work — cut and finished in our own workshops.",
    services: ["Facade Stone", "Face Stone", "Marble Slabs", "Decorative Stone"]
  },
  {
    slug: "flooring",
    name: "FLOORING",
    parent: "Renest",
    kicker: "Wooden Plank & Stone Composite",
    hero: "photo-1616486338812-3dadae4b4ace",
    tagline: "Flooring, specified for how a space is actually lived in.",
    body: "Residential, hospitality and commercial projects — a distributed range and a proprietary line built for high-traffic floors.",
    services: ["Wooden Plank", "Vinyl / SPC", "Stone Composite", "Sports & Contract"]
  },
  {
    slug: "construction",
    name: "CONSTRUCTION",
    parent: "Formwork",
    kicker: "Civil, Structure & MEP",
    hero: "photo-1503387762-592deb58ef4e",
    tagline: "Buildings built the way the material wants to be used.",
    body: "Foundation, structure, finishes and site management for residential, hospitality and commercial builds — with a material-first sensibility.",
    services: ["Civil Structure", "Finishing", "MEP Coordination", "Site Management"]
  },
  {
    slug: "interior-designing",
    name: "INTERIOR DESIGNING",
    parent: "BDS Marvel",
    kicker: "3D Spatial Planning & Detailing",
    hero: "photo-1631679706909-1844bbd07221",
    tagline: "Design that decides before the build begins.",
    body: "Concept, spatial planning, material palettes and detailing — resolved with our own stone, flooring and construction teams before a single wall is touched.",
    services: ["Concept & Moodboards", "Space Planning", "Material Palettes", "3D Visualisation"]
  }
];

export const DEFAULT_ABOUT = {
  lede_1: "BDSM · BDS Marvel is one design and build company — stone, flooring, construction and interiors, handled in-house by our own teams: Drawstones, Renest, Formwork and Vignette. One contract, one accountable team, from facade to floor to furniture.",
  lede_2: "The names are new — our people have built for the country's most demanding hotels, developers and civic projects for over twenty years.",
  team: [
    { name: "Drawstones", role: "Materials & Sourcing", image: "photo-1618221195710-dd6b41faaea6" },
    { name: "Renest", role: "Specification & Distribution", image: "photo-1616486338812-3dadae4b4ace" },
    { name: "Formwork", role: "Structure & Site Management", image: "photo-1503387762-592deb58ef4e" },
    { name: "Vignette", role: "Design & Execution", image: "photo-1600585154340-be6161a56a0c" },
    { name: "Head of Craft", role: "Workshop & Fabrication", image: "photo-1600607687939-ce8a6c25118c" },
    { name: "Head of Living Studio", role: "B&B & Client Experience", image: "photo-1600566753190-17f0baa2a6c3" }
  ]
};

export const DEFAULT_LIVING_STUDIO = {
  name: "Air BnB Living Studio",
  kicker: "Stayable showroom",
  tagline: "Not a showroom — a home we built ourselves.",
  body: "A guesthouse we built ourselves — our own stone, flooring, finishes and furniture throughout. Stay the night, live with every surface and plan your project from inside a working home.",
  hero: "photo-1600607687939-ce8a6c25118c",
  details: ["Three suites", "Material library", "Hosted walkthroughs"]
};

export const liveContentState = {
  hero: DEFAULT_HERO,
  projects: DEFAULT_PROJECTS,
  approach: DEFAULT_APPROACH,
  clients: DEFAULT_CLIENTS,
  divisions: DEFAULT_DIVISIONS,
  about: DEFAULT_ABOUT,
  livingStudio: DEFAULT_LIVING_STUDIO
};

const ContentContext = createContext({
  hero: DEFAULT_HERO,
  projects: DEFAULT_PROJECTS,
  approach: DEFAULT_APPROACH,
  clients: DEFAULT_CLIENTS,
  divisions: DEFAULT_DIVISIONS,
  about: DEFAULT_ABOUT,
  livingStudio: DEFAULT_LIVING_STUDIO,
  loading: false
});

export function ContentProvider({ children }) {
  const [projects, setProjects] = useState(DEFAULT_PROJECTS);
  const [siteContent, setSiteContent] = useState({
    hero: DEFAULT_HERO,
    approach: DEFAULT_APPROACH,
    clients: DEFAULT_CLIENTS,
    divisions: DEFAULT_DIVISIONS,
    about: DEFAULT_ABOUT,
    livingStudio: DEFAULT_LIVING_STUDIO
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function syncContent() {
      try {
        const [projRes, contentRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/projects`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(`${BACKEND_URL}/api/site-content`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        ]);

        if (cancelled) return;

        if (Array.isArray(projRes) && projRes.length > 0) {
          setProjects(projRes);
          liveContentState.projects = projRes;
        }

        if (contentRes && typeof contentRes === "object") {
          const nextHero = contentRes.hero && typeof contentRes.hero === "object" && Object.keys(contentRes.hero).length > 0 ? { ...DEFAULT_HERO, ...contentRes.hero } : DEFAULT_HERO;
          const nextApproach = Array.isArray(contentRes.approach) && contentRes.approach.length > 0 ? contentRes.approach : DEFAULT_APPROACH;
          const nextClients = Array.isArray(contentRes.clients) && contentRes.clients.length > 0 ? contentRes.clients : DEFAULT_CLIENTS;
          const nextDivisions = Array.isArray(contentRes.divisions) && contentRes.divisions.length > 0 ? contentRes.divisions : DEFAULT_DIVISIONS;
          const nextAbout = contentRes.about && typeof contentRes.about === "object" && Object.keys(contentRes.about).length > 0 ? { ...DEFAULT_ABOUT, ...contentRes.about } : DEFAULT_ABOUT;
          const nextLivingStudio = contentRes.living_studio && typeof contentRes.living_studio === "object" && Object.keys(contentRes.living_studio).length > 0 ? { ...DEFAULT_LIVING_STUDIO, ...contentRes.living_studio } : DEFAULT_LIVING_STUDIO;

          const updatedState = {
            hero: nextHero,
            approach: nextApproach,
            clients: nextClients,
            divisions: nextDivisions,
            about: nextAbout,
            livingStudio: nextLivingStudio
          };
          setSiteContent(updatedState);
          liveContentState.hero = nextHero;
          liveContentState.approach = nextApproach;
          liveContentState.clients = nextClients;
          liveContentState.divisions = nextDivisions;
          liveContentState.about = nextAbout;
          liveContentState.livingStudio = nextLivingStudio;
        }
      } catch (err) {
        // Fallback to defaults seamlessly
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    syncContent();
    return () => { cancelled = true; };
  }, []);

  return (
    <ContentContext.Provider
      value={{
        hero: siteContent.hero,
        projects,
        approach: siteContent.approach,
        clients: siteContent.clients,
        divisions: siteContent.divisions,
        about: siteContent.about,
        livingStudio: siteContent.livingStudio,
        loading
      }}
    >
      {children}
    </ContentContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ContentContext);
  return ctx?.projects || DEFAULT_PROJECTS;
}

export function useSiteContent() {
  const ctx = useContext(ContentContext);
  return {
    hero: ctx?.hero || DEFAULT_HERO,
    approach: ctx?.approach || DEFAULT_APPROACH,
    clients: ctx?.clients || DEFAULT_CLIENTS,
    divisions: ctx?.divisions || DEFAULT_DIVISIONS,
    about: ctx?.about || DEFAULT_ABOUT,
    livingStudio: ctx?.livingStudio || DEFAULT_LIVING_STUDIO,
    loading: ctx?.loading ?? false
  };
}
