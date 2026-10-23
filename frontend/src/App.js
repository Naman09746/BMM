import { wordpressContent, DynamicFields, formSettings } from "./wordpress-content";
import { apiFetch, apiPath, publicAsset } from "./wordpress";
import { Component, lazy, Suspense, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, createContext } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Facebook, Instagram, Linkedin, Loader2, Search, Twitter, User, X, Youtube } from "lucide-react";
import { BrowserRouter, HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useNavigationType, useParams } from "react-router-dom";
import { loadRouteStyles } from "./lib/routeStyles";
function lazyStyled(importer, group) {
  return lazy(async () => {
    const [module] = await Promise.all([importer(), loadRouteStyles(group)]);
    return module;
  });
}
const OwnerDashboard = lazyStyled(() => import("./owner/OwnerDashboard"), "owner");
const OwnerLogin = lazy(() => import("./owner/OwnerDashboard").then(module => ({default:module.OwnerLogin})));
import "@/App.css";
import { initSmoothScroll, smoothScrollTo, startSmoothScroll, stopSmoothScroll } from "@/lib/smoothScroll";
import { AuthProvider, StaysProvider, useAuth } from "./stays/store";
import { registerStaysData } from "./stays/data";
import "@/stays/stays.css";
import { buildMaterialGallery } from "@/catalogueGallery";

const AuthCallback = lazyStyled(() => import("./stays/Auth").then((module) => ({ default: module.AuthCallback })), "stays");
const StaysHome = lazyStyled(() => import("./stays/StaysHome"), "stays");
const StaysSearch = lazyStyled(() => import("./stays/StaysSearch"), "stays");
const StayDetail = lazyStyled(() => import("./stays/StayDetail"), "stays");
const Checkout = lazyStyled(() => import("./stays/Checkout"), "stays");
const StayPayment = lazyStyled(() => import("./stays/Payment"), "stays");
const TripStatus = lazyStyled(() => import("./stays/TripStatus"), "stays");
const MyTrips = lazyStyled(() => import("./stays/MyTrips"), "stays");
const Account = lazyStyled(() => import("./stays/Account"), "stays");

const IMG = "https://images.unsplash.com/";
const formatDriveImg = (url) => {
  if (!url || typeof url !== "string") return url;
  if (url.includes("drive.google.com")) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return `https://lh3.googleusercontent.com/d/${m[1]}`;
  }
  return url;
};
const img = (id, w = 1600) => {
  if (!id) return "";
  const cleaned = formatDriveImg(id);
  return (cleaned.startsWith("http") || cleaned.startsWith("/") || cleaned.startsWith("data:"))
    ? cleaned
    : `${IMG}${cleaned}?auto=format&fit=crop&w=${w}&q=80`;
};
const Router = (window.BDS_WORDPRESS?.routerMode || (process.env.REACT_APP_WORDPRESS_MODE === "true" ? "hash" : "browser")) === "hash" ? HashRouter : BrowserRouter;

// Scroll position per history entry (for back/forward scroll restoration)
const scrollPositions = new Map();
// Scroll position per pathname (for in-app "back" links that push a new entry)
const scrollByPath = new Map();

const segments = wordpressContent("segments", [
  { slug: "interior-designing", name: "INTERIOR DESIGNING", parent: "BDS Marvel", kicker: "Concept to detail", tone: "sage", tagline: "Design that decides before the build begins.", body: "Concept, spatial planning, material palettes and detailing — resolved with our own stone, flooring and construction teams before a single wall is touched.", hero: "photo-1631679706909-1844bbd07221", services: ["Concept & Moodboards", "Space Planning", "Material Palettes", "3D Visualisation"], team: ["Principal designers", "Visualisation studio", "Procurement desk"] },
  { slug: "construction", name: "CONSTRUCTION", parent: "Formwork", kicker: "Turnkey execution", tone: "charcoal", tagline: "Buildings built the way the material wants to be used.", body: "Foundation, structure, finishes and site management for residential, hospitality and commercial builds — with a material-first sensibility.", hero: "photo-1503387762-592deb58ef4e", services: ["Civil Structure", "Finishing", "MEP Coordination", "Site Management"], team: ["Project directors", "Site engineers", "MEP consultants"] },
  { slug: "marble-and-stone", name: "MARBLE & STONE", parent: "Drawstones", kicker: "Interior stone", tone: "sand", tagline: "Stone that carries the building's silhouette.", body: "Facade and face stone for structures that need to age well. Interior stone — tables, fountains, decorative work — cut and finished in our own workshops.", hero: "photo-1618221195710-dd6b41faaea6", services: ["Facade Stone", "Face Stone", "Marble Slabs", "Decorative Stone"], team: ["Sourcing — Western India quarries", "Fabrication — Kishangarh workshop", "Installation — In-house crew"] },
  { slug: "flooring", name: "FLOORING", parent: "Renest", kicker: "Distribution + Proprietary", tone: "bronze", tagline: "Flooring, specified for how a space is actually lived in.", body: "Residential, hospitality and commercial projects — a distributed range and a proprietary line built for high-traffic floors.", hero: "photo-1616486338812-3dadae4b4ace", services: ["Wooden Plank", "Vinyl / SPC", "Stone Composite", "Sports & Contract"], team: ["Specification support", "Warehousing — Delhi NCR", "Installation partners"] },
  { slug: "furniture", name: "FURNITURE", parent: "Grain", kicker: "Bespoke & crafted", tone: "pink", tagline: "Furniture built the way architecture is.", body: "Tables, seating, storage and joinery in solid wood, stone and metal — designed and built in our own workshops to outlast daily use.", hero: "photo-1631396326646-c06a935ff3a6", services: ["Bespoke Furniture", "Tables & Desks", "Seating", "Storage & Joinery"], team: ["Furniture designers", "Master carpenters", "Finishing studio"] },
  { slug: "interiors", name: "INTERIOR DECOR", parent: "Vignette", kicker: "Design + Build", tone: "terracotta", tagline: "Interiors that don't stop at the finishes.", body: "Spatial planning, custom furniture, materials, lighting and installation — designed and executed for residential and commercial spaces.", hero: "photo-1600585154340-be6161a56a0c", services: ["Residential", "Hospitality", "Retail", "Bespoke Furniture"], team: ["Design leads", "Project executioners", "Craft partners"] },
]);

const livingStudio = wordpressContent("livingStudio", {
  name: "Air BnB Living Studio",
  kicker: "Stayable showroom",
  tagline: "Not a showroom — a home we built ourselves.",
  body: "A guesthouse we built ourselves — our own stone, flooring, finishes and furniture throughout. Stay the night, live with every surface and plan your project from inside a working home.",
  hero: "photo-1600607687939-ce8a6c25118c",
  details: ["Three suites", "Material library", "Hosted walkthroughs"],
});

const stays = wordpressContent("stays", [
  // Premium — experience our work first-hand
  { slug: "living-studio", tier: "Premium", name: "The Living Studio", location: "Alibaug, Maharashtra", price: "₹28,000", guests: 6, bedrooms: 3, hero: "photo-1600607687939-ce8a6c25118c", blurb: "Our flagship stayable showroom — every surface is our own work.", description: "The premium way to experience BDS Marvel: a full guesthouse built end-to-end with our own stone, flooring, finishes and furniture. Stay the night, host your architect over breakfast, walk the materials library with our consultant and specify your project from inside a working reference.", amenities: ["Three ensuite suites", "Hosted materials walkthrough", "Private garden + sunken lounge", "Full breakfast & chef on request", "Sample library access", "Airport transfer on request"] },
  { slug: "stone-pavilion", tier: "Premium", name: "The Stone Pavilion", location: "Lonavala, Maharashtra", price: "₹32,000", guests: 8, bedrooms: 4, hero: "photo-1747258818911-dfde27ecabba", blurb: "A pavilion of glass and our own basalt, wrapped around a reflecting pool.", description: "Four suites arranged around a still reflecting pool, every wall in basalt we cut ourselves. Evenings on the water court, mornings in the sauna — the full BDS Marvel material palette at its most resolved.", amenities: ["Four pool-facing suites", "Private sauna & plunge", "Chef-led dinners", "Materials walkthrough", "Bonfire court", "Driver on call"] },
  { slug: "marble-house", tier: "Premium", name: "The Marble House", location: "Udaipur, Rajasthan", price: "₹30,000", guests: 6, bedrooms: 3, hero: "photo-1729605412224-147d072d3667", blurb: "Lake-facing suites in book-matched marble, ten minutes from the old city.", description: "A lake-facing residence where every bathroom is book-matched marble from our Kishangarh workshop. Sunset terraces, a butler pantry and quiet, cool rooms that show what stone does to light.", amenities: ["Three lake-view suites", "Book-matched marble baths", "Sunset terrace", "Butler pantry", "City walkthroughs on request"] },
  { slug: "verandah-suite", tier: "Premium", name: "The Verandah Suite", location: "Assagao, Goa", price: "₹24,000", guests: 4, bedrooms: 2, hero: "photo-1663811396672-83dd3f32f312", blurb: "A shaded laterite verandah, a plunge pool and nothing to prove.", description: "Our Goan outpost: laterite walls, a deep shaded verandah and a plunge pool under the trees. Two suites, an outdoor kitchen and the quietest version of our material palette.", amenities: ["Two garden suites", "Laterite verandah", "Plunge pool", "Outdoor kitchen", "Scooter on request"] },
  { slug: "atelier-penthouse", tier: "Premium", name: "The BDS Penthouse", location: "Bandra, Mumbai", price: "₹36,000", guests: 6, bedrooms: 3, hero: "photo-1756906838752-0b514ab37479", blurb: "Our city showcase — a split-level penthouse over the sea link skyline.", description: "The city flagship: a split-level penthouse with a double-height stone wall, terrazzo stair and a screening lounge. Host your project team, walk the flat with our designers and leave with a spec sheet.", amenities: ["Three skyline suites", "Double-height stone wall", "Screening lounge", "Design consult included", "Valet & chef on request"] },
  // Mid — design comfort, city ease
  { slug: "material-loft", tier: "Mid", name: "The Material Loft", location: "Jaipur, Rajasthan", price: "₹12,500", guests: 4, bedrooms: 2, hero: "photo-1737467030068-88ad20e617ca", blurb: "A warm city loft finished in our stone and oak — design comfort without the ceremony.", description: "A two-bedroom city loft for travellers who want to live with good material without the full showroom programme. Oak plank floors, honed stone counters and hand-finished lime walls — the same spec we install for clients, at an easy nightly rate.", amenities: ["Two queen bedrooms", "Full kitchen in honed stone", "Work nook with fibre wifi", "Self check-in", "Breakfast basket on request"] },
  { slug: "oak-apartment", tier: "Mid", name: "The Oak Apartment", location: "Pune, Maharashtra", price: "₹10,500", guests: 4, bedrooms: 2, hero: "photo-1789381500057-2a288d79e9e6", blurb: "Wall-to-wall oak, soft light and a proper work table.", description: "A calm two-bedroom apartment panelled in our engineered oak, with a long work table for travelling teams and a kitchen that invites slow mornings.", amenities: ["Two bedrooms", "Engineered oak throughout", "Dedicated work table", "Full kitchen", "Self check-in"] },
  { slug: "kota-flat", tier: "Mid", name: "The Kota Flat", location: "New Delhi", price: "₹9,800", guests: 3, bedrooms: 1, hero: "photo-1661796428175-55423b19409f", blurb: "A sunlit one-bed on Kota stone floors, minutes from the metro.", description: "A bright one-bedroom flat that shows off what humble Kota stone can do — cool floors, warm textiles, a reading corner and an easy commute to anywhere in the city.", amenities: ["One sunny bedroom", "Kota stone floors", "Reading corner", "Kitchenette", "Metro 5 min walk"] },
  { slug: "terrace-rooms", tier: "Mid", name: "The Terrace Rooms", location: "Bengaluru, Karnataka", price: "₹11,200", guests: 4, bedrooms: 2, hero: "photo-1781249144129-4ba0869707f5", blurb: "Two rooms, one big planted terrace, evening breeze included.", description: "A two-bedroom stay built around its planted terrace — outdoor dining for six, warm wood interiors and blackout shutters for proper sleep after long site days.", amenities: ["Two bedrooms", "Planted dining terrace", "Outdoor seating for six", "Blackout shutters", "Self check-in"] },
  { slug: "weavers-stay", tier: "Mid", name: "The Weaver's Stay", location: "Ahmedabad, Gujarat", price: "₹9,500", guests: 3, bedrooms: 1, hero: "photo-1781249144056-ec397e444dfa", blurb: "Textiles, lime plaster and a courtyard cafe downstairs.", description: "A one-bedroom stay above a courtyard cafe in the old textile district — lime plaster walls, handloom throws and our stone in the bath. Quiet, central, easy.", amenities: ["One bedroom + daybed", "Lime plaster & handloom", "Courtyard cafe below", "Stone-clad bath", "Self check-in"] },
  // Budget-friendly — honest rooms, honest prices
  { slug: "courtyard-room", tier: "Budget-friendly", name: "The Courtyard Room", location: "Kishangarh, Rajasthan", price: "₹5,800", guests: 2, bedrooms: 1, hero: "photo-1576354302919-96748cb8299e", blurb: "A simple, honest room beside our workshop — stone underfoot, sun in the courtyard.", description: "Our budget-friendly stay: a quiet, light-filled room next to the Kishangarh workshop. Honest materials, a proper bed, a shaded courtyard and chai from the studio kitchen. Perfect for a night between site visits — or your first look at what we make.", amenities: ["Queen bed, ensuite bath", "Shaded shared courtyard", "Studio chai & breakfast", "Workshop viewing on request", "Self check-in"] },
  { slug: "studio-nook", tier: "Budget-friendly", name: "The Studio Nook", location: "Ajmer, Rajasthan", price: "₹3,900", guests: 2, bedrooms: 1, hero: "photo-1759264244726-adde4e4318fc", blurb: "A neat little room five minutes from the dargah road.", description: "The simplest stay we make: a crisp bed, a writing desk, a hot shower and morning sun. Everything you need between trains, site visits and long drives.", amenities: ["Queen bed", "Writing desk", "Hot rain shower", "Morning chai", "Self check-in"] },
  { slug: "workshop-room", tier: "Budget-friendly", name: "The Workshop Room", location: "Kishangarh, Rajasthan", price: "₹4,200", guests: 2, bedrooms: 1, hero: "photo-1759264244746-140bbbc54e1b", blurb: "Fall asleep to the smell of cut stone — a room inside our workshop compound.", description: "A snug room inside the workshop compound for people who want to wake up where the material is made. Early morning cutting demos if you ask nicely.", amenities: ["Queen bed, ensuite", "Inside the workshop compound", "Cutting demos on request", "Studio breakfast", "Self check-in"] },
  { slug: "sunroom", tier: "Budget-friendly", name: "The Sunroom", location: "Pushkar, Rajasthan", price: "₹4,600", guests: 2, bedrooms: 1, hero: "photo-1781004667187-d1f862f8fa0b", blurb: "A glass-cornered room that catches the desert morning.", description: "A corner room wrapped in glass on two sides, five minutes from the lake ghats. Sunrise does the decorating; we did the stone floor and the very good mattress.", amenities: ["Glass corner room", "Stone floor", "Lake ghats 5 min", "Rooftop chai", "Self check-in"] },
  { slug: "lime-wash-room", tier: "Budget-friendly", name: "The Lime Wash Room", location: "Jaipur, Rajasthan", price: "₹4,900", guests: 2, bedrooms: 1, hero: "photo-1780399334790-64af9ffb45fc", blurb: "Hand-trowelled lime walls and a deep, dark night's sleep.", description: "A cocoon of hand-trowelled lime plaster in the old city — cool in summer, warm at night, with a tiny balcony for evening chai. Our cheapest night, and many guests' favourite.", amenities: ["Queen bed", "Hand-trowelled lime walls", "Chai balcony", "Old-city location", "Self check-in"] },
]);

const stayTiers = wordpressContent("stayTiers", [
  { slug: "premium", name: "Premium", headline: "Experience our work, first-hand.", copy: "Full homes built end-to-end with our own stone, floors and furniture — hosted walkthroughs, chef breakfasts and the materials library. Live in the reference before you specify it." },
  { slug: "mid", name: "Mid", headline: "Design comfort, city ease.", copy: "Finished apartments wearing our oak, stone and lime — work tables, good kitchens, self check-in and easy nightly rates." },
  { slug: "budget-friendly", name: "Budget-friendly", headline: "Honest rooms, honest prices.", copy: "Simple, light-filled rooms near our workshops and the old cities — the essentials done properly, from ₹3,900 a night." },
]);

registerStaysData({ stays, stayTiers, img });

const tierSlugOf = (tierName) => stayTiers.find((tier) => tier.name === tierName)?.slug || "premium";

const approach = wordpressContent("approach", [
  { number: "01", title: "MATERIAL FIRST", image: "photo-1618221195710-dd6b41faaea6", text: "Every project begins with the stone or the surface. Specification precedes drawings so the material never has to bend to fit the design." },
  { number: "02", title: "ONE TEAM", image: "photo-1600585154340-be6161a56a0c", text: "Materials, flooring, construction and interiors under one roof. One accountable team from the spec sheet to the snag list." },
  { number: "03", title: "EDITORIAL DETAIL", image: "photo-1616486338812-3dadae4b4ace", text: "Architectural minimalism, hospitality warmth. Joints, thresholds and reveals resolved with the same care as the elevation." },
  { number: "04", title: "HERITAGE + CRAFT", image: "photo-1503387762-592deb58ef4e", text: "Traditional cutting and finishing techniques paired with modern engineering. Craftspeople we have worked with for two decades." },
  { number: "05", title: "EXPERIENCE-LED", image: "photo-1600607687939-ce8a6c25118c", text: "Don't just see the materials — live in them. The BDSM Living Studio is our showroom you can actually stay in." },
]);

// Four stone tones shared with the network segments — purposes rotate through them
const purposeTones = ["sand", "bronze", "charcoal", "terracotta"];

const clients = wordpressContent("clients", [
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
  { name: "Marriott", logo: publicAsset("/clients/marriott.webp") },
]);

const projects = wordpressContent("projects", [
  { slug: "meridian-residences", title: "Meridian Residences", segment: "MARBLE & STONE", category: "Residential", image: "photo-1600585154340-be6161a56a0c", gallery: ["photo-1600585154340-be6161a56a0c", "photo-1618221195710-dd6b41faaea6", "photo-1616486338812-3dadae4b4ace"], year: "2024", location: "Alibaug, Maharashtra", description: "Twelve seafront villas clad in a custom facade stone quarried, cut and installed end-to-end.", challenge: "The facade needed to weather the salt air without turning grey.", approach: "We specified a dense sandstone with a low porosity and honed it to bring the warm undertones forward.", outcomes: [["12", "villas delivered"], ["18 mo", "site to handover"], ["100%", "material in-house"]], credits: ["Drawstones — Facade & Interior Stone", "Formwork — Civil & Finishing", "Architect — External partner"] },
  { slug: "kabbon-lounge", title: "Kabbon Lounge", segment: "INTERIOR DECOR", category: "Hospitality", image: "photo-1600607687939-ce8a6c25118c", gallery: ["photo-1600607687939-ce8a6c25118c", "photo-1600566753190-17f0baa2a6c3", "photo-1616486338812-3dadae4b4ace"], year: "2024", location: "Bengaluru, Karnataka", description: "A 90-cover restaurant designed around a single travertine bar block.", challenge: "The client wanted the room to feel monolithic without becoming cold.", approach: "One stone, three finishes — a polished bar top, honed cladding, split-face walls. Warm oak floors soften everything else.", outcomes: [["1", "material palette"], ["4 mo", "design to open"], ["120 sqm", "of stone specified"]], credits: ["Vignette — Concept & Execution", "Drawstones — Travertine sourcing", "Formwork — Fit-out"] },
  { slug: "veda-clubhouse", title: "Veda Clubhouse", segment: "CONSTRUCTION", category: "Amenity", image: "photo-1600566753190-17f0baa2a6c3", gallery: ["photo-1600566753190-17f0baa2a6c3", "photo-1618221195710-dd6b41faaea6", "photo-1600585154340-be6161a56a0c"], year: "2023", location: "Pune, Maharashtra", description: "A residential clubhouse — pool, gym, event spaces — built as one continuous stone ribbon.", challenge: "Every wall inside and out had to read as the same material.", approach: "We wrapped the volume in a Kota-limestone rain screen and continued the same stone through the pool coping and lobby floor.", outcomes: [["2,400 sqm", "built-up"], ["3", "levels"], ["14 mo", "structure to soft launch"]], credits: ["Formwork — Structure & Finishing", "Drawstones — Kota supply", "Renest — Pool decking"] },
  { slug: "annex-workspace", title: "Annex Workspace", segment: "FLOORING", category: "Commercial", image: "photo-1616486338812-3dadae4b4ace", gallery: ["photo-1616486338812-3dadae4b4ace", "photo-1600607687939-ce8a6c25118c", "photo-1503387762-592deb58ef4e"], year: "2023", location: "Gurugram, Haryana", description: "40,000 sqft of workspace flooring across three floors, delivered in a six-week window.", challenge: "A hospitality-grade floor that could take a corporate footfall.", approach: "Contract-grade SPC in two warm tones, pre-cut off-site so installation ran cleanly.", outcomes: [["40,000 sqft", "installed"], ["6 wk", "on site"], ["0", "post-handover claims"]], credits: ["Renest — Specification & Installation", "Formwork — Sub-structure"] },
  { slug: "atrium-mall", title: "Atrium Mall", segment: "MARBLE & STONE", category: "Commercial", image: "photo-1503387762-592deb58ef4e", gallery: ["photo-1503387762-592deb58ef4e", "photo-1600585154340-be6161a56a0c", "photo-1618221195710-dd6b41faaea6"], year: "2022", location: "Jaipur, Rajasthan", description: "Retail atrium with a book-matched onyx feature wall and a full-marble concourse.", challenge: "Matching stone across 45 running metres of feature wall.", approach: "We sourced two adjacent onyx blocks, cut them ourselves, and book-matched every panel before shipping.", outcomes: [["45 m", "book-matched wall"], ["3,600 sqm", "concourse marble"], ["1", "onyx block, split"]], credits: ["Drawstones — Sourcing, cutting, installation", "Formwork — Substrate & wall build"] },
  { slug: "shore-villa", title: "Shore Villa", segment: "INTERIOR DECOR", category: "Residential", image: "photo-1618221195710-dd6b41faaea6", gallery: ["photo-1618221195710-dd6b41faaea6", "photo-1600585154340-be6161a56a0c", "photo-1616486338812-3dadae4b4ace"], year: "2024", location: "Goa", description: "A four-bedroom villa where every fixed surface is stone.", challenge: "Keep a heavy-material palette from feeling like a museum.", approach: "Three warm marbles, natural lime plaster, oak floors and light linen textiles. Nothing else.", outcomes: [["4", "bedrooms"], ["3", "stones"], ["9 mo", "design to move-in"]], credits: ["Vignette — Full scope", "Drawstones — Kitchen, bath, feature wall", "Renest — Oak plank"] },
  { slug: "civic-facade", title: "Civic Facade", segment: "MARBLE & STONE", category: "Institutional", image: "photo-1580587771525-78b9dba3b914", gallery: ["photo-1580587771525-78b9dba3b914", "photo-1600585154340-be6161a56a0c", "photo-1618221195710-dd6b41faaea6"], year: "2022", location: "Ahmedabad, Gujarat", description: "A civic building facade in flame-finished granite installed as a dry-cladding system.", challenge: "A facade that would read cleanly at scale and stay clean over the years.", approach: "Self-cleaning flame finish, a 4mm shadow gap and a sub-frame built to hold thermal movement.", outcomes: [["1,850 sqm", "facade"], ["4mm", "reveal, everywhere"], ["7", "elevations resolved"]], credits: ["Drawstones — Supply & installation", "Formwork — Sub-frame & envelope"] },
  { slug: "kiln-restaurant", title: "Kiln Restaurant", segment: "CONSTRUCTION", category: "Hospitality", image: "photo-1600566753190-17f0baa2a6c3", gallery: ["photo-1600566753190-17f0baa2a6c3", "photo-1600607687939-ce8a6c25118c", "photo-1503387762-592deb58ef4e"], year: "2023", location: "Mumbai, Maharashtra", description: "A 3,200 sqft restaurant built around an exposed brick and stone kiln.", challenge: "Structural rework to expose the kiln without losing the load path.", approach: "We ran a new steel transfer above the kiln and let the original masonry become the room.", outcomes: [["1", "kiln, exposed"], ["3,200 sqft", "fit-out"], ["5 mo", "shell to open"]], credits: ["Formwork — Structural, shell & core", "Vignette — Design & Fit-out", "Drawstones — Bar & floor stone"] },
  { slug: "lumen-apartment", title: "Lumen Apartment", segment: "INTERIOR DESIGNING", category: "Residential", image: "photo-1631679706909-1844bbd07221", gallery: ["photo-1631679706909-1844bbd07221", "photo-1618220179428-22790b461013", "photo-1600585154340-be6161a56a0c"], year: "2024", location: "Bengaluru, Karnataka", description: "A full interior-designing brief for a light-first city apartment, resolved end-to-end before a single wall moved.", challenge: "A dark, compartmentalised flat that needed to feel open without losing storage.", approach: "We redrew the plan around a single daylight axis, set a warm neutral palette and detailed every joinery run in 3D before build.", outcomes: [["1,650 sqft", "reimagined"], ["3D", "sign-off before build"], ["6 wk", "concept to drawings"]], credits: ["BDS Marvel — Concept, planning & detailing", "Renest — Oak flooring", "Formwork — Fit-out"] },
  { slug: "sable-studio-office", title: "Sable Studio Office", segment: "INTERIOR DESIGNING", category: "Commercial", image: "photo-1618220179428-22790b461013", gallery: ["photo-1618220179428-22790b461013", "photo-1631679706909-1844bbd07221", "photo-1616486338812-3dadae4b4ace"], year: "2023", location: "Jaipur, Rajasthan", description: "Interior designing for a creative studio — spatial planning, material palette and lighting concept delivered as one scheme.", challenge: "Give a 20-person studio focus zones and social zones inside one open floor.", approach: "Zoning by material and light: honed stone at the core, warm oak at the edges, layered task and ambient lighting throughout.", outcomes: [["20", "person studio"], ["4", "material palette"], ["5 mo", "design to move-in"]], credits: ["BDS Marvel — Full interior-design scope", "Drawstones — Core stone", "Renest — Oak & contract flooring"] },
]);


// WordPress records can be created or edited with optional catalogue fields left
// blank. Normalize those fields once so filters and cards remain safe to render.


// Extended detail content for catalogue items and per-service catalogue cards, keyed by slug.





function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { node.classList.add("is-visible"); observer.disconnect(); } }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = "" }) { return <div ref={useReveal()} className={`reveal ${className}`}>{children}</div>; }

function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title;
    const set = (selector, value) => { const tag = document.querySelector(selector); if (tag) tag.setAttribute("content", value); };
    set('meta[name="description"]', description);
    set('meta[property="og:title"]', title);
    set('meta[property="og:description"]', description);
  }, [title, description]);
}



// Per-service consulting coverage + optional visual catalogue, keyed by segment slug.





function useOrbitScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let raf;
    let current = 0;
    const loop = () => {
      // Scroll-linked rotation only — no continuous drift; lerped per frame for smoothness
      const target = window.scrollY * 0.08;
      current += (target - current) * 0.12;
      document.documentElement.style.setProperty("--orbit-rot", `${current.toFixed(2)}deg`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

function highlightSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("section-arrived");
  void el.offsetWidth;
  el.classList.add("section-arrived");
  window.setTimeout(() => el.classList.remove("section-arrived"), 1600);
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 40); window.addEventListener("scroll", onScroll); return () => window.removeEventListener("scroll", onScroll); }, []);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    const onKeyDown = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);
  const goHomeSection = (id) => { setMenuOpen(false); navigate("/"); window.setTimeout(() => smoothScrollTo(document.getElementById(id)), 80); };
  const location = useLocation();
  const onStays = location.pathname.startsWith("/stays") || location.pathname === "/experience";
  const accountName = user && user.name ? user.name : user && user.email ? user.email : "";
  const accountInitials = accountName.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return <>
    <header className={`site-header ${scrolled ? "site-header--scrolled" : ""} ${menuOpen ? "site-header--menu-open" : ""}`} data-testid="site-header">
      <button type="button" className="wordmark" onClick={() => goHomeSection("top")} data-testid="home-logo-button" aria-label="Go to top">BDSM</button>
      <div className="header-right">
        <Link className="header-work-link" to="/projects" data-testid="header-work-link">PROJECTS</Link>
        <Link className="header-work-link" to="/catalogue" data-testid="header-catalogue-link">CATALOGUE</Link>
        <Link className="header-work-link" to="/contact" data-testid="header-contact-link">CONTACT</Link>
        {onStays && <Link className="header-profile" to="/stays/account" aria-label={user && user !== false ? "My account" : "Sign in"} data-testid="header-profile">
          {user && user !== false ? (user.picture ? <img src={user.picture} alt="" /> : <span className="header-profile__initials">{accountInitials}</span>) : <User size={18} strokeWidth={1.75} />}
        </Link>}
        <button type="button" className={`menu-button ${menuOpen ? "menu-button--open" : ""}`} onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="site-navigation-drawer" aria-label={menuOpen ? "Close menu" : "Open menu"} data-testid="open-menu-button"><span className="menu-icon" aria-hidden="true"><span></span><span></span></span></button>
      </div>
    </header>
    <div id="site-navigation-drawer" className={`menu-drawer ${menuOpen ? "menu-drawer--open" : ""}`} role="dialog" aria-modal="true" aria-label="Site navigation" data-testid="navigation-drawer" aria-hidden={!menuOpen}>
      <button type="button" className="drawer-close" onClick={() => setMenuOpen(false)} data-testid="close-menu-button" aria-label="Close menu"><X size={28} /></button>
      <div className="drawer-copy"><span className="eyebrow">BDSM · BDS MARVEL</span><h2>Materials, structures<br /><em>and the space between.</em></h2></div>
      <nav className="drawer-nav" data-testid="navigation-menu">
        <button onClick={() => goHomeSection("top")} data-testid="nav-home-link">HOME</button>
        <Link to="/about" onClick={() => setMenuOpen(false)} data-testid="nav-about-link">ABOUT</Link>
        <button onClick={() => goHomeSection("network")} data-testid="nav-network-link">WHAT WE DO</button>
        <Link to="/projects" onClick={() => setMenuOpen(false)} data-testid="nav-work-link">PROJECTS</Link>
        <Link to="/catalogue" onClick={() => setMenuOpen(false)} data-testid="nav-catalogue-link">CATALOGUE</Link>
        <Link to="/stays" onClick={() => setMenuOpen(false)} data-testid="nav-experience-link">AIR BNB</Link>
        <Link to="/contact" onClick={() => setMenuOpen(false)} data-testid="nav-contact-link">CONTACT</Link>
        {user?.role === "admin" && <Link to="/owner" onClick={() => setMenuOpen(false)} style={{ color: "var(--acid)" }} data-testid="nav-owner-link">OWNER DASHBOARD</Link>}
      </nav>
      {(onStays || user === false) && <div className="drawer-account" data-testid="drawer-account">
        {user === false && <>
          <Link to="/stays/account" state={(location.pathname.startsWith("/stays/home") || location.pathname.startsWith("/stays/book")) ? { from: location.pathname + location.search } : undefined} onClick={() => setMenuOpen(false)} data-testid="drawer-signin-link">BnB SIGN IN</Link>
          {onStays && <>
            <span className="drawer-account__dot">·</span>
            <Link to="/stays" onClick={() => setMenuOpen(false)} data-testid="drawer-stays-link">STAYS</Link>
          </>}
        </>}
        {onStays && user && user !== false && <>
          <span className="drawer-account__who" data-testid="drawer-account-name">{accountName}</span>
          <Link to="/stays/trips" onClick={() => setMenuOpen(false)} data-testid="drawer-trips-link">YOUR TRIPS</Link>
          <span className="drawer-account__dot">·</span>
          <button type="button" onClick={async () => { setMenuOpen(false); await logout(); navigate("/"); }} data-testid="drawer-logout">LOG OUT</button>
        </>}
      </div>}
      <div className="drawer-footer" data-testid="navigation-drawer-footer">INFO@BDSMARVEL.COM <span>© BDSM · BDS MARVEL</span></div>
    </div>
  </>;
}

function DeferredBackground({ style, watchId, ...props }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const target = (watchId && document.getElementById(watchId)) || ref.current;
    if (!target) return;
    if (!('IntersectionObserver' in window)) { setReady(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setReady(true); observer.disconnect(); }
    }, { rootMargin: '2000px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);
  const backgroundImage = ready ? style.backgroundImage : style.backgroundImage.replace(/,\s*url\(.*\)$/, '');
  return <div {...props} ref={ref} style={{ ...style, backgroundImage }} />;
}

function Home() {
  usePageMeta("BDSM · BDS Marvel | Marble & Stone, Flooring, Construction & Interiors", "One design and build studio for marble and stone, flooring, turnkey construction and interior design — workshops and studios across India: Kishangarh, Mumbai, Gurugram, Pune, New Delhi and Goa.");
  const [activeApproach, setActiveApproach] = useState(0);
  useOrbitScroll();
  const heroRef = useRef(null);
  const headlineRef = useRef(null);
  const ringsRef = useRef(null);
  useLayoutEffect(() => {
    const hero = heroRef.current;
    const headline = headlineRef.current;
    const rings = ringsRef.current;
    if (!hero || !headline || !rings) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = hero.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / rect.height));
      headline.style.transform = progress ? `translateY(${progress * 110}px)` : 'none';
      rings.style.transform = progress ? `translateY(${progress * -90}px) scale(${1 + progress * 0.12}) rotate(${progress * 40}deg)` : 'none';
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  const onHeroTilt = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    event.currentTarget.style.setProperty("--tilt-x", `${(-y * 6).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${(x * 8).toFixed(2)}deg`);
  };
  const resetHeroTilt = (event) => {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  };
  const scrollTo = (id) => smoothScrollTo(document.getElementById(id));
  return <main className="zoo-site">
    <section className="hero" id="top" data-testid="hero-section" ref={heroRef} onMouseMove={onHeroTilt} onMouseLeave={resetHeroTilt}>      <div className="hero-headline-parallax" ref={headlineRef} style={{ transform: "none" }}>
        <div className="hero-heading"><p className="eyebrow">BDSM · BDS MARVEL</p><h1><span className="hero-line"><span className="hero-line__inner">Architecture.</span></span><span className="hero-line"><span className="hero-line__inner"><em>Interiors.</em></span></span><span className="hero-line"><span className="hero-line__inner">Everything In Between<span className="hero-dot">.</span></span></span></h1></div>
      </div>
      <div className="hero-footer"><button onClick={() => scrollTo("network")} data-testid="hero-explore-button">EXPLORE OUR WORK <ArrowDown size={16} /></button></div>
      <div className="hero-rings-parallax" ref={ringsRef} style={{ transform: "none" }} aria-hidden="true" data-testid="hero-rings-parallax">
        <div className="hero-rings-tilt">
          <div className="hero-rings" aria-hidden="true"><span /><span /><span /></div>
        </div>
      </div>
    </section>
    <NetworkExperience />
    <ExperienceSpotlight />
    <section className="purpose-section" id="purpose" data-testid="purpose-section">
      <Reveal className="purpose-header"><span className="section-index">02 — HOW BDS MARVEL BUILDS</span><h2>Built around<br /><em>the material.</em></h2></Reveal>
      <div className="purpose-layout">
        <div className="purpose-list">{approach.map((purpose, index) => <div className={`purpose-accordion-item ${activeApproach === index ? "purpose-accordion-item--active" : ""}`} key={purpose.title} data-testid={`purpose-accordion-item-${index + 1}`}>
          <button className={`purpose-tab purpose-tab--tone-${purposeTones[index % 4]} ${activeApproach === index ? "purpose-tab--active" : ""}`} onClick={() => setActiveApproach(index)} aria-expanded={activeApproach === index} aria-controls={`purpose-mobile-panel-${index + 1}`} data-testid={`purpose-tab-${index + 1}`}><span>{purpose.number}</span><strong>{purpose.title}</strong><ChevronDown size={19} /></button>
          <div className="purpose-accordion-panel" id={`purpose-mobile-panel-${index + 1}`} aria-hidden={activeApproach !== index} data-testid={`purpose-mobile-panel-${index + 1}`}>
            <div className="purpose-accordion-panel__inner">
              <DeferredBackground watchId="purpose" className={`purpose-feature purpose-feature--mobile purpose-feature--tone-${purposeTones[index % 4]}`} style={{ backgroundImage: `linear-gradient(90deg, rgba(8,8,8,.82), rgba(8,8,8,.08)), url(${img(purpose.image)})` }}>
                <div><span>{purpose.number} / 05</span><h3>{purpose.title}</h3><p>{purpose.text}</p></div>
                <div className="purpose-arrows"><button onClick={() => setActiveApproach((index + approach.length - 1) % approach.length)} aria-label="Previous purpose" data-testid={`purpose-mobile-previous-${index + 1}`}><ArrowUpRight size={20} /></button><button onClick={() => setActiveApproach((index + 1) % approach.length)} aria-label="Next purpose" data-testid={`purpose-mobile-next-${index + 1}`}><ArrowUpRight size={20} /></button></div>
              </DeferredBackground>
            </div>
          </div>
        </div>)}</div>
        {approach.length > 0 && <DeferredBackground watchId="purpose" key={activeApproach} className={`purpose-feature purpose-feature--desktop purpose-feature--tone-${purposeTones[activeApproach % 4]}`} style={{ backgroundImage: `linear-gradient(90deg, rgba(8,8,8,.82), rgba(8,8,8,.08)), url(${img(approach[activeApproach].image)})` }} data-testid="active-purpose-panel">
          <div><span>{approach[activeApproach].number} / 05</span><h3>{approach[activeApproach].title}</h3><p>{approach[activeApproach].text}</p></div>
          <div className="purpose-arrows"><button onClick={() => setActiveApproach((activeApproach + approach.length - 1) % approach.length)} data-testid="purpose-previous-button"><ArrowUpRight size={20} /></button><button onClick={() => setActiveApproach((activeApproach + 1) % approach.length)} data-testid="purpose-next-button"><ArrowUpRight size={20} /></button></div>
        </DeferredBackground>}
      </div>
    </section>
    <ProjectsSlideshow />
    <section className="contact-section" id="contact" data-testid="contact-section">
      <div className="contact-orbit" aria-hidden="true"><span>LET'S BUILD<br />SOMETHING<br /><em>TOGETHER</em></span></div>
      <Reveal className="contact-copy"><span className="section-index">04 — START A PROJECT</span><h2>One Dream.<br /><em>One studio.</em></h2><ContactTrigger className="contact-cta-btn" testId="contact-section-cta">START A PROJECT</ContactTrigger></Reveal>
      <Clientele />
    </section>
  </main>;
}

function ProjectsSlideshow() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);
  useEffect(() => {
    if (paused || !projects.length) return undefined;
    const id = setInterval(() => setActive((index) => (index + 1) % projects.length), 5000);
    return () => clearInterval(id);
  }, [paused]);
  const project = projects[active % projects.length];
  const showNext = () => setActive((index) => (index + 1) % projects.length);
  const showPrev = () => setActive((index) => (index + projects.length - 1) % projects.length);
  const onTouchStart = (event) => { touchStartX.current = event.touches[0].clientX; };
  const onTouchEnd = (event) => {
    if (touchStartX.current == null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) showNext(); else showPrev();
  };
  if (!project) return null;
  return <section className="work-slideshow" id="work" data-testid="work-slideshow" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    <Reveal className="work-slideshow__head">
      <span className="section-index">03 — PROJECT CATALOGUE</span>
      <h2>Selected work,<br /><em>frame by frame.</em></h2>
      <Link to="/projects" className="work-slideshow__all" data-testid="work-slideshow-all">ALL PROJECTS <ArrowUpRight size={15} /></Link>
    </Reveal>
    <div className="work-slideshow__stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} data-testid="work-slideshow-stage">
      <Link to={`/projects/${project.slug}`} key={project.slug} className="work-slideshow__frame" data-testid="work-slideshow-frame">
        <img src={img(project.image, 1600)} alt={project.title} />
        <span className="work-slideshow__meta">{project.category} · {project.location}</span>
      </Link>
      <div className="work-slideshow__bar">
        <div className="work-slideshow__info" key={project.slug}>
          <span className="work-slideshow__count">{String(active + 1).padStart(2, "0")} / {String(projects.length).padStart(2, "0")}</span>
          <h3>{project.title}</h3>
          <span className="work-slideshow__segment">{project.segment}</span>
        </div>
        <div className="work-slideshow__arrows">
          <button type="button" onClick={showPrev} aria-label="Previous project" data-testid="work-slideshow-prev"><ChevronLeft size={20} /></button>
          <button type="button" onClick={showNext} aria-label="Next project" data-testid="work-slideshow-next"><ChevronRight size={20} /></button>
        </div>
      </div>
      <div className="work-slideshow__dots">{projects.map((item, index) => <button type="button" key={item.slug} className={index === active ? "is-active" : ""} onClick={() => setActive(index)} aria-label={`Show ${item.title}`} data-testid={`work-slideshow-dot-${index + 1}`} />)}</div>
    </div>
  </section>;
}

function CountUp({ value }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const node = ref.current;
    const match = value.match(/^(\d[\d,]*)(.*)$/);
    if (!node || !match) return undefined;
    const target = parseInt(match[1].replace(/,/g, ""), 10);
    const suffix = match[2];
    const grouped = match[1].includes(",");
    const pad = grouped ? 0 : match[1].length;
    const fmt = (n) => (grouped ? n.toLocaleString("en-IN") : String(n).padStart(pad, "0")) + suffix;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = null;
    const animate = () => {
      if (reduced) { setDisplay(fmt(target)); return; }
      const start = performance.now();
      const duration = 1400;
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        setDisplay(fmt(Math.round((1 - Math.pow(1 - t, 3)) * target)));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (raf) cancelAnimationFrame(raf);
      if (entry.isIntersecting) { setDisplay(fmt(0)); animate(); } else setDisplay(fmt(0));
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => { observer.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [value]);
  return <strong ref={ref}>{display}</strong>;
}

function BdsmMark() {
  const tiles = ["tl","d","tr","tl","d","tr","tl","d","tr","tl","d","tr","tl","d","tr","tl","d","tr","tl","d","tr","tl","d","tr"];
  return <div className="zm-mark" aria-hidden="true">{tiles.map((t, i) => <span key={i} className={`zm-tile zm-tile--${t}`} />)}</div>;
}

function ScrollUpButton() {
  return <button className="footer-top" onClick={() => smoothScrollTo(0)} aria-label="Scroll to top" data-testid="footer-scroll-top"><span className="footer-top__label">To the Top</span><ArrowUp size={15.75} /></button>;
}

function NetworkExperience() {
  const { setOpen } = useContact();
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState(() => segments.map(() => false));
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef(null);
  const panelRefs = useRef([]);
  const copyRefs = useRef([]);
  const total = segments.length;

  useEffect(() => {
    // One geometric pass per scroll frame — cannot miss fast smooth-scroll glides:
    // rail follows the panel nearest the viewport centre, and each panel's copy reveals
    // the moment the copy block itself enters the viewport band (works in both scroll directions)
    let ticking = false;
    const run = () => {
      ticking = false;
      const vh = window.innerHeight;
      const mid = vh / 2;
      let best = 0;
      let bestDist = Infinity;
      panelRefs.current.forEach((node, i) => {
        if (!node) return;
        const rect = node.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= vh) return;
        const dist = Math.abs(rect.top + rect.height / 2 - mid);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      setActive(best);
      setRevealed((prev) => {
        let changed = false;
        const next = prev.map((was, i) => {
          const node = copyRefs.current[i];
          if (!node) return was;
          const rect = node.getBoundingClientRect();
          const now = rect.top < vh * 0.92 && rect.bottom > vh * 0.02;
          if (now !== was) changed = true;
          return now;
        });
        return changed ? next : prev;
      });
    };
    // rAF-throttle: multiple scroll events can fire within one frame during a
    // Lenis glide — run the geometric pass at most once per frame (mobile jank fix)
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(run);
    };
    run();
    const settle = window.setTimeout(run, 900); // re-check once images/layout settle (catches copy already in view on load)
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    const onScroll = () => {
      const rect = section.getBoundingClientRect();
      const insideTop = rect.top <= 0;
      const insideBottom = rect.bottom >= window.innerHeight;
      setVisible(insideTop && insideBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Register panels as snap points for the smooth scroller (replaces CSS scroll-snap)
  useEffect(() => {
    const { snap } = initSmoothScroll();
    const nodes = panelRefs.current.filter(Boolean);
    if (!snap || nodes.length === 0) return undefined;
    snap.addElements(nodes, { align: ["start"] });
    return () => nodes.forEach((node) => { if (typeof snap.removeElement === "function") snap.removeElement(node); });
  }, []);

  const goTo = (index) => {
    const node = panelRefs.current[index];
    if (node) smoothScrollTo(node);
  };

  return <section id="network" ref={sectionRef} className={`network-experience ${visible ? "network-experience--in-view" : ""}`} data-testid="network-section">
    <aside className="network-rail" aria-label="Segment navigation">
      <ol className="network-rail__list" data-testid="network-rail-list">
        {segments.map((segment, index) => <li key={segment.slug} className={index === active ? "network-rail__item--active" : ""}>
          <button onClick={() => goTo(index)} data-testid={`network-rail-${index + 1}`}>
            <span className="network-rail__label">{index + 1} {segment.name.toUpperCase()}</span>
            {index === active && <ChevronLeft className="network-rail__caret" size={20} aria-hidden="true" />}
          </button>
        </li>)}
      </ol>
    </aside>
    <div className="network-panels">
      {segments.map((segment, index) => <article key={segment.slug} ref={(node) => (panelRefs.current[index] = node)} data-index={index} className={`network-panel network-panel--${segment.tone} ${index === active ? "network-panel--active" : ""} ${revealed[index] ? "network-panel--revealed" : ""}`} data-testid={`network-panel-${index + 1}`}>
        <div className="network-panel__meta"><span>0{index + 1} / {String(total).padStart(2, "0")}</span><span>{segment.parent.toUpperCase()} · {segment.kicker.toUpperCase()}</span></div>
        <div className="network-panel__stage">
          <span className="network-panel__mascot-wrap"><img src={img(segment.hero)} alt={`${segment.name} sample`} className="network-panel__mascot" /></span>
        </div>
        <div className="network-panel__copy" ref={(node) => (copyRefs.current[index] = node)} data-copy-index={index}>
          <div className="network-panel__brand"><span className="np-brand-parent">{segment.parent}</span><span className="np-brand-name">{segment.name}</span></div>
          <h3>{segment.tagline}</h3>
          <p>{segment.body}</p>
          <ul className="network-panel__tags">{segment.services.map((service, tagIndex) => <li key={service} style={{ "--i": tagIndex }}>{service}</li>)}</ul>
          <div className="network-panel__actions">
            <Link to={segment.link || `/businesses/${segment.slug}`} className="np-btn np-btn--ghost" data-testid={`network-panel-${index + 1}-explore`}>EXPLORE <ArrowUpRight size={16} /></Link>
            <button type="button" onClick={() => setOpen(true)} className="np-btn np-btn--solid" data-testid={`network-panel-${index + 1}-contact`}>GET IN TOUCH <ArrowUpRight size={16} /></button>
          </div>
        </div>
      </article>)}
    </div>
  </section>;
}

function ExperienceSpotlight() {
  const { setOpen } = useContact();
  const copyRef = useRef(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const node = copyRef.current;
    if (!node) return undefined;
    // Reveal when the COPY block itself is meaningfully in view — replays in both
    // scroll directions (section-level isIntersecting fired at 1px, so scrolling up
    // the animation ran and finished before the copy ever reached the viewport).
    const observer = new IntersectionObserver(([entry]) => setRevealed(entry.intersectionRatio >= 0.25), { threshold: [0, 0.25] });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <section className={`experience-spotlight ${revealed ? "experience-spotlight--revealed" : ""}`} data-testid="experience-spotlight">
    <div className="experience-spotlight__header">
      <span className="section-index" data-testid="experience-spotlight-label">EXPERIENCE OUR CRAFT</span>
      <p data-testid="experience-spotlight-status">A stayable home by BDSM · BDS Marvel</p>
    </div>
    <div className="experience-spotlight__layout">
      <DeferredBackground className="experience-spotlight__visual" style={{ backgroundImage: `linear-gradient(180deg, rgba(8,8,8,.08), rgba(8,8,8,.68)), url(${img(livingStudio.hero)})` }} data-testid="experience-spotlight-image">
        <span data-testid="experience-spotlight-location">{livingStudio.kicker}</span>
        <strong data-testid="experience-spotlight-image-title">STAY INSIDE<br />WHAT WE BUILT.</strong>
      </DeferredBackground>
      <div className="experience-spotlight__copy" ref={copyRef}>
        <span className="experience-spotlight__badge" data-testid="experience-spotlight-badge">STAY OVER</span>
        <h2 data-testid="experience-spotlight-title">Air BnB<br /><em>Living Studio.</em></h2>
        <h3 data-testid="experience-spotlight-tagline">{livingStudio.tagline}</h3>
        <p data-testid="experience-spotlight-description">{livingStudio.body}</p>
        <ul data-testid="experience-spotlight-details">{livingStudio.details.map((detail, index) => <li key={detail} style={{ "--i": index }}>{detail}</li>)}</ul>
        <div className="experience-spotlight__actions">
          <Link to="/stays?start=where" className="np-btn np-btn--solid" data-testid="experience-spotlight-explore">EXPLORE THE STAY <ArrowUpRight size={16} /></Link>
          <Link to="/experience" className="np-btn np-btn--ghost" data-testid="experience-spotlight-request">REQUEST A NIGHT <ArrowUpRight size={16} /></Link>
        </div>
      </div>
    </div>
  </section>;
}

function Clientele() {
  const rows = [clients.slice(0, 12), clients.slice(12)];
  const tile = (client, testId) => <div className="client-logo" role="img" aria-label={`${client.name} logo`} key={client.name} data-testid={testId}>
    {client.logo ? <img src={client.logo} alt={client.name} loading="lazy" /> : <span className="client-logo__word">{client.name}</span>}
  </div>;
  return <section className="clients-section" id="clients" data-testid="clients-section">
    <Reveal className="clients-title">
      <div><span className="section-index" data-testid="clientele-label">Clientele</span><h2 data-testid="clientele-title">Trusted by leaders in hospitality, infrastructure, education and public institutions.</h2></div>
    </Reveal>
    <div className="client-marquee" data-testid="client-logo-marquee">
      {rows.map((row, rowIndex) => <div className={`client-logo-row client-logo-row--${rowIndex + 1}`} key={rowIndex} data-testid={`client-logo-row-${rowIndex + 1}`}>
        <div className="client-logo-track">
          <div className="client-logo-set">{row.map((client, index) => tile(client, `client-logo-${rowIndex * 12 + index + 1}`))}</div>
          <div className="client-logo-set" aria-hidden="true">{row.map((client, index) => tile(client, `client-logo-duplicate-${rowIndex * 12 + index + 1}`))}</div>
        </div>
      </div>)}
    </div>
  </section>;
}

function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  const tapCount = useRef(0);
  const tapTimeout = useRef(null);

  const onSecretTap = () => {
    tapCount.current += 1;
    clearTimeout(tapTimeout.current);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      window.dispatchEvent(new CustomEvent("open-admin-gate"));
    } else {
      tapTimeout.current = setTimeout(() => { tapCount.current = 0; }, 600);
    }
  };

  const jump = (id) => {
    if (id === "top") {
      if (location.pathname === "/") smoothScrollTo(0);
      else navigate("/");
      return;
    }
    if (location.pathname === "/") {
      smoothScrollTo(document.getElementById(id));
      window.setTimeout(() => highlightSection(id), 650);
    } else {
      navigate(`/#${id}`);
    }
  };
  return <footer className="site-footer" data-testid="site-footer">
    <div className="site-footer__top">
      <div className="site-footer__brand"><span className="zm-name">BDSM<sup>®</sup></span></div>
      <BdsmMark />
    </div>
    <div className="site-footer__middle">
      <nav className="site-footer__nav" aria-label="Footer navigation">
        <button onClick={() => jump("top")} data-testid="footer-link-home">home</button>
        <button onClick={() => { navigate("/about"); }} data-testid="footer-link-about">about</button>
        <button onClick={() => jump("network")} data-testid="footer-link-agencies">what we do</button>
        <button onClick={() => { navigate("/projects"); }} data-testid="footer-link-projects">projects</button>
        <button onClick={() => { navigate("/catalogue"); }} data-testid="footer-link-catalogue">catalogue</button>
        <button onClick={() => { navigate("/stays"); }} data-testid="footer-link-bnb">air bnb</button>
        <button onClick={() => { navigate("/contact"); }} data-testid="footer-link-contact">contact</button>
      </nav>
      <div className="site-footer__socials">
        <a href="https://www.instagram.com/bds.marvel" target="_blank" rel="noreferrer" aria-label="Instagram" data-testid="footer-instagram-link"><Instagram size={17} /></a>
      </div>
    </div>
    <div className="site-footer__bottom"><span data-testid="footer-copyright" onClick={onSecretTap} style={{ cursor: "default", WebkitTapHighlightColor: "transparent" }}>© BDSM · BDS Marvel {new Date().getFullYear()}</span><ScrollUpButton /></div>
  </footer>;
}

function PageShell({ children }) {
  const location = useLocation();
  const navType = useNavigationType();
  const currentKey = useRef(location.key);
  const currentPath = useRef(location.pathname);
  const lastY = useRef(0);
  const navLock = useRef(0);
  useEffect(() => { initSmoothScroll(); }, []);
  // Persistent listener. lastY lags the synchronous scroll-clamp that happens when a
  // shorter page mounts, so it still holds the real pre-navigation position. During a
  // brief lock after each route change we ignore nav-induced reset scrolls.
  useEffect(() => {
    const onScroll = () => {
      lastY.current = window.scrollY;
      if (performance.now() - navLock.current < 1200) return;
      scrollPositions.set(currentKey.current, window.scrollY);
      scrollByPath.set(currentPath.current, window.scrollY);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // On route change: snapshot the outgoing entry (pre-clamp value), switch key, start lock
  useLayoutEffect(() => {
    if (currentKey.current !== location.key) {
      scrollPositions.set(currentKey.current, lastY.current);
      scrollByPath.set(currentPath.current, lastY.current);
      currentKey.current = location.key;
      currentPath.current = location.pathname;
      navLock.current = performance.now();
    }
  }, [location.key, location.pathname]);
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      const settle = () => {
        const target = document.getElementById(id);
        if (target) {
          smoothScrollTo(target);
          window.setTimeout(() => highlightSection(id), 650);
        }
      };
      window.requestAnimationFrame(() => window.setTimeout(settle, 40));
      return;
    }
    // Restore scroll on browser back/forward (POP) or via an in-app "back" link
    // (which pushes a new entry but carries state.restore). Airbnb-style.
    const byKey = scrollPositions.get(location.key);
    const byPath = scrollByPath.get(location.pathname);
    const saved = navType === "POP" ? byKey : (location.state?.restore ? byPath : undefined);
    if (saved > 0) {
      let tries = 0;
      let cancelled = false;
      const stop = () => { cancelled = true; window.removeEventListener("wheel", stop); window.removeEventListener("touchstart", stop); };
      const restore = () => {
        if (cancelled) return;
        const maxY = document.documentElement.scrollHeight - window.innerHeight;
        if (window.__smoothScroll?.lenis) window.__smoothScroll.lenis.resize();
        smoothScrollTo(Math.min(saved, Math.max(0, maxY)), { immediate: true });
        tries += 1;
        if (maxY < saved - 4 && tries < 40) window.setTimeout(restore, 50);
        else window.setTimeout(stop, 250);
      };
      window.addEventListener("wheel", stop, { passive: true, once: true });
      window.addEventListener("touchstart", stop, { passive: true, once: true });
      window.requestAnimationFrame(() => window.requestAnimationFrame(restore));
      startSmoothScroll();
      return;
    }
    smoothScrollTo(0, { immediate: true });
    startSmoothScroll();
  }, [location.pathname, location.hash, location.key, location.state, navType]);
  return <div className="route-shell" key={location.pathname}><Header />{children}<Footer /><ContactModal /><ConsultationModal /><SampleModal /><InquiryModal /><AdminGateModal /></div>;
}

const ContactCtx = createContext({ open: false, setOpen: () => {} });
function ContactProvider({ children }) {
  const [open, setOpen] = useState(false);
  return <ContactCtx.Provider value={{ open, setOpen }}>{children}</ContactCtx.Provider>;
}
function useContact() { return useContext(ContactCtx); }

const ConsultationCtx = createContext({ open: false, service: "", openConsult: () => {}, closeConsult: () => {} });
function ConsultationProvider({ children }) {
  const [state, setState] = useState({ open: false, service: "" });
  const openConsult = (service = "") => setState({ open: true, service });
  const closeConsult = () => setState((prev) => ({ ...prev, open: false }));
  return <ConsultationCtx.Provider value={{ ...state, openConsult, closeConsult }}>{children}</ConsultationCtx.Provider>;
}
function useConsultation() { return useContext(ConsultationCtx); }

const SampleCtx = createContext({ open: false, product: "", brand: "", openSample: () => {}, closeSample: () => {} });
function SampleProvider({ children }) {
  const [state, setState] = useState({ open: false, product: "", brand: "" });
  const openSample = (product = "", brand = "") => setState({ open: true, product, brand });
  const closeSample = () => setState((prev) => ({ ...prev, open: false }));
  return <SampleCtx.Provider value={{ ...state, openSample, closeSample }}>{children}</SampleCtx.Provider>;
}
function useSample() { return useContext(SampleCtx); }

const InquiryCtx = createContext({ open: false, brand: "", product: "", options: [], openInquiry: () => {}, closeInquiry: () => {} });
function InquiryProvider({ children }) {
  const [state, setState] = useState({ open: false, brand: "", product: "", options: [] });
  const openInquiry = (brand = "", product = "", options = []) => setState({ open: true, brand, product, options });
  const closeInquiry = () => setState((prev) => ({ ...prev, open: false }));
  return <InquiryCtx.Provider value={{ ...state, openInquiry, closeInquiry }}>{children}</InquiryCtx.Provider>;
}
function useInquiry() { return useContext(InquiryCtx); }








function AdminGateModal() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e) => {
      // 1. Guard: Ignore if user is currently typing in an input, textarea, select, or contenteditable element
      const target = e.target;
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) {
        return;
      }

      // 2. Secret Command Combinations:
      // Primary: (Ctrl OR Cmd) + Shift + A
      // Alternate: (Ctrl OR Cmd) + Shift + O
      // Option: (Ctrl OR Cmd) + Alt + A  (or Alt + Shift + A)
      const hasPrimaryMod = e.ctrlKey || e.metaKey;
      const isShiftA = hasPrimaryMod && e.shiftKey && (e.key === "a" || e.key === "A" || e.code === "KeyA");
      const isShiftO = hasPrimaryMod && e.shiftKey && (e.key === "o" || e.key === "O" || e.code === "KeyO");
      const isAltA = hasPrimaryMod && e.altKey && (e.key === "a" || e.key === "A" || e.code === "KeyA");
      const isPlainAltShiftA = e.altKey && e.shiftKey && (e.key === "a" || e.key === "A" || e.code === "KeyA");

      if (isShiftA || isShiftO || isAltA || isPlainAltShiftA) {
        e.preventDefault();
        e.stopPropagation();

        if (user && user.role === "admin") {
          navigate("/owner");
        } else {
          setOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [user, navigate]);

  useEffect(() => {
    const onOpenGate = () => {
      if (user && user.role === "admin") navigate("/owner");
      else setOpen(true);
    };
    window.addEventListener("open-admin-gate", onOpenGate);
    return () => window.removeEventListener("open-admin-gate", onOpenGate);
  }, [user, navigate]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open]);

  if (!open) return null;

  return (
    <div className="contact-modal admin-gate-modal" role="dialog" aria-modal="true" aria-label="Admin Security Gate" data-testid="admin-gate-modal">
      <button className="contact-modal__scrim" onClick={() => setOpen(false)} aria-label="Close" data-testid="admin-gate-scrim" />
      <div className="contact-modal__panel admin-gate-panel">
        <button className="contact-modal__close" onClick={() => setOpen(false)} aria-label="Close" data-testid="admin-gate-close">
          <X size={22} />
        </button>
        <Suspense fallback={<span role="status">Loading sign in…</span>}><OwnerLogin onSuccess={() => { setOpen(false); navigate("/owner"); }} /></Suspense>
      </div>
    </div>
  );
}

function ContactModal() {
  const { open, setOpen } = useContact();
  const [form, setForm] = useState({ name: "", email: "", company: "", segment: "", budget: "", message: "" });
  const [status, setStatus] = useState({ state: "idle", error: "" });
  const firstFieldRef = useRef(null);
  const scrollResumeRef = useRef(null);

  useEffect(() => {
    window.clearTimeout(scrollResumeRef.current);
    if (open) {
      setStatus({ state: "idle", error: "" });
      window.setTimeout(() => firstFieldRef.current?.focus(), 80);
      document.body.style.overflow = "hidden";
      stopSmoothScroll();
      return () => { document.body.style.overflow = ""; };
    }
    document.body.style.overflow = "";
    scrollResumeRef.current = window.setTimeout(() => startSmoothScroll(), 60);
    return () => window.clearTimeout(scrollResumeRef.current);
  }, [open]);
  useEffect(() => { const onKey = (event) => { if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [setOpen]);

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ state: "sending", error: "" });
    try {
      const response = await apiFetch(apiPath(`/inquiries`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form,  name: form.name.trim(), email: form.email.trim(), company: form.company.trim() || null, agency: form.segment || null, budget: form.budget || null, message: form.message.trim() }) });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.detail?.[0]?.msg || detail?.detail || detail?.message || "Please double-check your details and try again.");
      }
      setStatus({ state: "sent", error: "" });
      setForm({ name: "", email: "", company: "", segment: "", budget: "", message: "" });
    } catch (error) {
      setStatus({ state: "error", error: error.message || "Something went wrong. Please try again." });
    }
  };

  if (!open) return null;
  return <div className="contact-modal" role="dialog" aria-modal="true" aria-label="Start a project" data-testid="contact-modal">
    <button className="contact-modal__scrim" onClick={() => setOpen(false)} aria-label="Close" data-testid="contact-modal-scrim" />
    <div className="contact-modal__panel">
      <button className="contact-modal__close" onClick={() => setOpen(false)} aria-label="Close" data-testid="contact-modal-close"><X size={22} /></button>
      <div className="contact-modal__intro">
        <span className="section-index">START A PROJECT</span>
        <h2>Let's build<br /><em>something together.</em></h2>
        <p>Tell us about your project — stone, flooring, construction or interiors. One team handles all of it, and we reply within one working day.</p>
        <div className="contact-modal__meta"><span>info@bdsmarvel.com</span><span>Mumbai · Kishangarh · Gurugram</span></div>
      </div>
      {status.state === "sent" ? <div className="contact-modal__success" data-testid="contact-modal-success"><Check size={40} /><h3>Thanks — we've got it.</h3><p>{formSettings("inquiries")?.success_message || "Your request has been received."}</p><button onClick={() => setOpen(false)} data-testid="contact-modal-done">CLOSE</button></div> : <form className="contact-modal__form" onSubmit={submit} data-testid="contact-modal-form">
        <DynamicFields slug="inquiries" form={form} setForm={setForm} firstFieldRef={firstFieldRef} options={{ segment: [{value:"",label:"Not sure yet"}, ...segments.map(s => s.name)] }} />
        {status.state === "error" && <div className="cm-error" data-testid="contact-modal-error">{status.error}</div>}
        <button type="submit" className="cm-submit" disabled={status.state === "sending" || !formSettings("inquiries")?.enabled} data-testid="contact-modal-submit">{status.state === "sending" ? <><Loader2 size={16} className="cm-spin" /> Sending…</> : <>{formSettings("inquiries")?.submit_label || "SEND INQUIRY"} <ArrowUpRight size={16} /></>}</button>
      </form>}
    </div>
  </div>;
}

function ContactTrigger({ className = "", children = "START A PROJECT", testId = "open-contact-modal" }) {
  const { setOpen } = useContact();
  return <button type="button" className={className} onClick={() => setOpen(true)} data-testid={testId}>{children} <ArrowUpRight size={16} /></button>;
}

function SampleTrigger({ className = "", product = "", brand = "", children = "REQUEST QUOTE", testId = "open-sample-modal" }) {
  const { openSample } = useSample();
  return <button type="button" className={className} onClick={() => openSample(product, brand)} data-testid={testId}>{children} <ArrowUpRight size={16} /></button>;
}



































function StaysTierRoute() {
  const { tier } = useParams();
  return <StaysHome key={tier} initialTier={stayTiers.some((t) => t.slug === tier) ? tier : "all"} />;
}

function RouteLoading() {
  return <main className="sx-page sx-center" role="status" aria-live="polite">Loading page…</main>;
}

function AppRoutes() {
  const location = useLocation();
  // Google sign-in returns with #session_id=...; exchange it before rendering routes
  if (location.hash?.includes("session_id=")) return <Suspense fallback={<RouteLoading />}><AuthCallback /></Suspense>;
  return <PageShell>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/projects" element={<ProjectsArchive />} />
          <Route path="/projects/:slug" element={<ProjectPage />} />
          <Route path="/businesses/:slug" element={<SegmentPage />} />
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/catalogue/:slug" element={<CatalogueItemPage />} />
          <Route path="/catalogue/:slug/:piece" element={<CatalogueProductPage />} />
          <Route path="/experience" element={<ExperiencePage />} />
          <Route path="/stays" element={<StaysHome />} />
          <Route path="/stays/search" element={<StaysSearch />} />
          <Route path="/stays/home/:slug" element={<StayDetail />} />
          <Route path="/stays/book/:slug" element={<Checkout />} />
          <Route path="/stays/payment/:slug" element={<StayPayment />} />
          <Route path="/stays/trips" element={<MyTrips />} />
          <Route path="/stays/account" element={<Account />} />
          <Route path="/stays/trips/:id" element={<TripStatus />} />
          <Route path="/stays/:tier" element={<StaysTierRoute />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/owner" element={<OwnerDashboard />} />
          <Route path="/work" element={<ProjectsArchive />} />
          <Route path="/work/:slug" element={<ProjectPage />} />
          <Route path="/agency/:slug" element={<SegmentPage />} />
        </Routes>
      </Suspense>
      </PageShell>;
}

function App() {
  useEffect(() => {
    const backendUrl = (process.env.REACT_APP_BACKEND_URL || (typeof window !== "undefined" ? window.location.origin : "")).replace(/\/$/, "");
    fetch(`${backendUrl}/api/stays`)
      .then((r) => (r.ok ? r.json() : null))
      .then((liveStays) => {
        if (Array.isArray(liveStays) && liveStays.length > 0) {
          registerStaysData({ stays: liveStays, stayTiers, img });
        }
      })
      .catch(() => {});
  }, []);

  return <Router basename={window.BDS_WORDPRESS?.routerMode === "browser" ? window.BDS_WORDPRESS.basename : undefined}>
    <AuthProvider>
    <StaysProvider>
    <ContactProvider>
      <ConsultationProvider>
      <SampleProvider>
      <InquiryProvider>
      <SecondaryLoadBoundary><AppRoutes /></SecondaryLoadBoundary>
      </InquiryProvider>
      </SampleProvider>
      </ConsultationProvider>
    </ContactProvider>
    </StaysProvider>
    </AuthProvider>
  </Router>;
}

export default App;


// WordPress can omit catalogue data from the homepage's critical HTML. Resolve
// it before evaluating secondary pages so their module-level data stays current.
let secondaryPagePromise;
function loadSecondaryPages() {
  if (!secondaryPagePromise) {
    secondaryPagePromise = (async () => {
      const config = window.BDS_WORDPRESS;
      if (config?.deferredContent) {
        const response = await apiFetch(apiPath('/content'));
        if (!response.ok) throw new Error('Unable to load website content');
        const content = await response.json();
        config.content = { ...config.content, ...content };
        config.deferredContent = false;
      }
      return import('./SecondaryPages');
    })().catch(error => { secondaryPagePromise = undefined; throw error; });
  }
  return secondaryPagePromise;
}

// Secondary pages download only when their route is visited.
const SegmentPage = lazy(() => loadSecondaryPages().then(module => ({ default: module.SegmentPage })));
const ProjectPage = lazy(() => loadSecondaryPages().then(module => ({ default: module.ProjectPage })));
const ProjectsArchive = lazy(() => loadSecondaryPages().then(module => ({ default: module.ProjectsArchive })));
const CataloguePage = lazy(() => loadSecondaryPages().then(module => ({ default: module.CataloguePage })));
const CatalogueProductPage = lazy(() => loadSecondaryPages().then(module => ({ default: module.CatalogueProductPage })));
const CatalogueItemPage = lazy(() => loadSecondaryPages().then(module => ({ default: module.CatalogueItemPage })));
const ExperiencePage = lazy(() => loadSecondaryPages().then(module => ({ default: module.ExperiencePage })));
const ContactPage = lazy(() => loadSecondaryPages().then(module => ({ default: module.ContactPage })));
const AboutPage = lazy(() => loadSecondaryPages().then(module => ({ default: module.AboutPage })));

export { ContactTrigger, CountUp, SampleTrigger, approach, img, projects, segments, stayTiers, stays, tierSlugOf, useConsultation, useContact, useInquiry, usePageMeta, useSample };

const DeferredConsultationModal = lazy(() => loadSecondaryPages().then(module => ({default:module.ConsultationModal})));
function ConsultationModal() { const {open} = useConsultation(); return open ? <Suspense fallback={null}><DeferredConsultationModal /></Suspense> : null; }

const DeferredSampleModal = lazy(() => loadSecondaryPages().then(module => ({default:module.SampleModal})));
function SampleModal() { const {open} = useSample(); return open ? <Suspense fallback={null}><DeferredSampleModal /></Suspense> : null; }

const DeferredInquiryModal = lazy(() => loadSecondaryPages().then(module => ({default:module.InquiryModal})));
function InquiryModal() { const {open} = useInquiry(); return open ? <Suspense fallback={null}><DeferredInquiryModal /></Suspense> : null; }

class SecondaryLoadBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="sx-page sx-center" role="alert"><div><p>This page could not be loaded. Please try again.</p><button type="button" onClick={() => window.location.reload()}>Reload page</button></div></main>;
    return this.props.children;
  }
}
