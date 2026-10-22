import { wordpressContent, DynamicFields, formSettings } from "./wordpress-content";
import { apiFetch, apiPath, publicAsset } from "./wordpress";
import { lazy, Suspense, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, createContext } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Facebook, Instagram, Linkedin, Loader2, Search, Twitter, User, X, Youtube } from "lucide-react";
import { BrowserRouter, HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useNavigationType, useParams } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import "@/App.css";
import { initSmoothScroll, smoothScrollTo, startSmoothScroll, stopSmoothScroll } from "@/lib/smoothScroll";
import { AuthProvider, StaysProvider, useAuth } from "./stays/store";
import { registerStaysData } from "./stays/data";
import "@/stays/stays.css";
import { buildMaterialGallery } from "@/catalogueGallery";
import { ContactTrigger, CountUp, SampleTrigger, approach, img, projects, segments, stayTiers, stays, tierSlugOf, useConsultation, useContact, useInquiry, usePageMeta, useSample } from "./App";

const catalogueContent = wordpressContent("catalogueItems", [
  // DrawStones — the signature product range
  { slug: "center-end-tables", name: "Centre & End Tables", brand: "DrawStones", material: "Marble", product: "Tables", application: "Living", image: "photo-1692262089751-7e26b69ad8d1", origin: "Black & white marble" },
  { slug: "marble-inlay-tops", name: "Marble Inlay Table Tops", brand: "DrawStones", material: "Marble", product: "Tables", application: "Living", image: "photo-1506463108611-88834e9f6169", origin: "Pietra dura inlay" },
  { slug: "marble-stone-fireplace", name: "Marble & Stone Fireplace", brand: "DrawStones", material: "Marble", product: "Fireplaces", application: "Interior", image: "photo-1603039531759-1a1bbe4f9f94", origin: "Carved surround" },
  { slug: "marble-home-temple", name: "Marble Home Temple", brand: "DrawStones", material: "Marble", product: "Temples", application: "Interior", image: "photo-1678593628844-6ea49dee8ce3", origin: "Vietnam white marble" },
  { slug: "stone-basins-bathtubs", name: "Stone Basins & Bathtubs", brand: "DrawStones", material: "Stone", product: "Basins", application: "Bathroom", image: "photo-1576698483491-8c43f0862543", origin: "Carved from block" },
  // DrawStones — stone & marble carving portfolio
  { slug: "deity-figure-statues", name: "Deity & Figure Statues", brand: "DrawStones", material: "Marble", product: "Sculptures", application: "Interior", image: "photo-1660140889200-59994b203546", origin: "Hand-carved" },
  { slug: "abstract-sculpture", name: "Spheres & Abstract Sculpture", brand: "DrawStones", material: "Marble", product: "Sculptures", application: "Garden", image: "photo-1662808141421-54240cbfd45f", origin: "Contemporary forms" },
  { slug: "fountains-water-features", name: "Fountains & Water Features", brand: "DrawStones", material: "Sandstone", product: "Fountains", application: "Garden", image: "photo-1761024300156-aff4bec70b6a", origin: "Tiered & wall" },
  { slug: "garden-benches-seating", name: "Garden Benches & Seating", brand: "DrawStones", material: "Sandstone", product: "Garden", application: "Garden", image: "photo-1768700519431-5297f11808a3", origin: "Carved & contemporary" },
  { slug: "planters-urns", name: "Planters & Urns", brand: "DrawStones", material: "Sandstone", product: "Garden", application: "Garden", image: "photo-1787497017406-9f54de5921df", origin: "Carved vases" },
  { slug: "stone-lanterns", name: "Stone Lanterns & Lamp Posts", brand: "DrawStones", material: "Sandstone", product: "Garden", application: "Garden", image: "photo-1786467642735-1342f43034ae", origin: "Garden lighting" },
  { slug: "jali-screens-railings", name: "Jali Screens & Railings", brand: "DrawStones", material: "Sandstone", product: "Screens", application: "Architectural", image: "photo-1763295492544-7850fa8671cf", origin: "Pierced panels" },
  { slug: "jharokhas-windows", name: "Jharokhas & Windows", brand: "DrawStones", material: "Sandstone", product: "Screens", application: "Architectural", image: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Jaisalmer_-_Patwa_Haveli_26.jpg/1280px-Jaisalmer_-_Patwa_Haveli_26.jpg", origin: "Traditional carved" },
  { slug: "pillars-columns", name: "Pillars & Columns", brand: "DrawStones", material: "Sandstone", product: "Pillars", application: "Architectural", image: "photo-1672215053161-5778b0fbb9ea", origin: "Carved capitals" },
  { slug: "temple-carving", name: "Temple Carving", brand: "DrawStones", material: "Marble", product: "Temples", application: "Architectural", image: "photo-1665003725647-3ae0f01140b1", origin: "Architectural carving" },
  { slug: "gazebos-chhatris", name: "Gazebos & Chhatris", brand: "DrawStones", material: "Sandstone", product: "Temples", application: "Architectural", image: "photo-1672215055915-e6143dc70e6a", origin: "Pavilions & domes" },
  { slug: "marble-flooring-inlay", name: "Marble Flooring, Inlay & Mosaic", brand: "DrawStones", material: "Marble", product: "Flooring", application: "Interior", image: "photo-1790501028719-1c18dc4a895d", origin: "Water-jet & pietra dura" },
  { slug: "monuments-projects", name: "Monuments & Projects", brand: "DrawStones", material: "Sandstone", product: "Monuments", application: "Architectural", image: "photo-1586618754080-135516049958", origin: "Large-scale" },
  // Renest — flooring range
  { slug: "spc-flooring", name: "SPC Rigid Flooring", brand: "Renest", category: "Flooring", material: "SPC", product: "Planks", application: "Interior", image: "photo-1548268364-3acee266b695", origin: "Stone-polymer core" },
  { slug: "laminate-wooden-flooring", name: "Laminate & Wooden Flooring", brand: "Renest", category: "Flooring", material: "Engineered wood", product: "Planks", application: "Interior", image: "photo-1519393890420-f28727375fa5", origin: "Oak & walnut tones" },
  { slug: "lvt-flooring", name: "Luxury Vinyl Tile", brand: "Renest", category: "Flooring", material: "Vinyl", product: "Vinyl", application: "Interior", image: "photo-1598718544285-7180f670198b", origin: "Wood & stone looks" },
  { slug: "carpet-tiles", name: "Modular Carpet Tiles", brand: "Renest", category: "Flooring", material: "Carpet", product: "Carpet", application: "Interior", image: "photo-1523350165414-082d792c4bcc", origin: "50 × 50 cm tiles" },
  { slug: "commercial-flooring", name: "Commercial Flooring", brand: "Renest", category: "Flooring", material: "Vinyl", product: "Commercial", application: "Interior", image: "photo-1560185008-b033106af5c3", origin: "Heavy-traffic rated" },
  { slug: "deck-flooring", name: "WPC Deck Flooring", brand: "Renest", category: "Flooring", material: "WPC", product: "Decking", application: "Garden", image: "photo-1656646549633-80ad4bd2ab40", origin: "Outdoor rated" },
  // Grain — furniture range
  { slug: "sofas", name: "Sofas & Lounge Seating", brand: "Grain", category: "Furniture", material: "Hardwood", product: "Seating", application: "Living", image: "photo-1600607687939-ce8a6c25118c", origin: "Solid hardwood frames" },
  { slug: "chairs", name: "Dining & Accent Chairs", brand: "Grain", category: "Furniture", material: "Hardwood", product: "Seating", application: "Living", image: "photo-1631396326646-c06a935ff3a6", origin: "Made to order" },
  { slug: "tables", name: "Tables & Desks", brand: "Grain", category: "Furniture", material: "Stone & timber", product: "Tables", application: "Living", image: "photo-1600585154340-be6161a56a0c", origin: "Stone · timber · cast" },
  { slug: "custom-furniture", name: "Bespoke Joinery", brand: "Grain", category: "Furniture", material: "Mixed", product: "Bespoke", application: "Interior", image: "photo-1737467030068-88ad20e617ca", origin: "Built to brief" },
  // BDS Marvel — interior designing
  { slug: "concept-moodboards", name: "Concept & Moodboards", brand: "BDS Marvel", category: "Interior Designing", material: "Design", product: "Concept", application: "Interior", image: "photo-1631679706909-1844bbd07221", origin: "Direction & references" },
  { slug: "space-planning", name: "Space Planning", brand: "BDS Marvel", category: "Interior Designing", material: "Design", product: "Planning", application: "Interior", image: "photo-1618220179428-22790b461013", origin: "Layouts & flow" },
  { slug: "material-palettes", name: "Material Palettes", brand: "BDS Marvel", category: "Interior Designing", material: "Design", product: "Palettes", application: "Interior", image: "photo-1600585154340-be6161a56a0c", origin: "Samples & combinations" },
  { slug: "3d-visualisation", name: "3D Visualisation", brand: "BDS Marvel", category: "Interior Designing", material: "Design", product: "Visualisation", application: "Interior", image: "photo-1631396326646-c06a935ff3a6", origin: "Photoreal renders" },
  // Formwork — construction
  { slug: "tensile-structures", name: "Tensile Structures", brand: "Formwork", category: "Construction", material: "Membrane", product: "Structures", application: "Architectural", image: "photo-1784637663357-cfbf73b09c0d", origin: "Fabric shade canopies" },
  // Vignette — interior decor
  { slug: "decor-lighting", name: "Lighting", brand: "Vignette", category: "Interior Decor", material: "Lighting", product: "Lighting", application: "Interior", image: "photo-1747258818911-dfde27ecabba", origin: "Ambient · task · feature" },
  { slug: "decor-pieces", name: "Décor Pieces", brand: "Vignette", category: "Interior Decor", material: "Object", product: "Objects", application: "Living", image: "photo-1600585154340-be6161a56a0c", origin: "Sculptural objects" },
  { slug: "decor-accessories", name: "Accessories", brand: "Vignette", category: "Interior Decor", material: "Accent", product: "Accessories", application: "Living", image: "photo-1618221195710-dd6b41faaea6", origin: "Trays · textiles · hardware" },
  { slug: "decor-textures", name: "Textures", brand: "Vignette", category: "Interior Decor", material: "Surface", product: "Textures", application: "Interior", image: "photo-1780399334790-64af9ffb45fc", origin: "Plaster · linen · stone · wood" },
  { slug: "decor-finishing", name: "Finishing Elements", brand: "Vignette", category: "Interior Decor", material: "Trim", product: "Finishing", application: "Interior", image: "photo-1600566753190-17f0baa2a6c3", origin: "Hardware · trims · edges" },
  { slug: "artificial-plants-green-walls", name: "Artificial Plants & Green Walls", brand: "Vignette", category: "Interior Decor", material: "Greenery", product: "Greenery", application: "Interior", image: "photo-1585506774639-5e2f8fda6352", origin: "Vertical gardens" },
  { slug: "decorative-planters", name: "Planters", brand: "Vignette", category: "Interior Decor", material: "Ceramic & stone", product: "Planters", application: "Interior", image: "photo-1588440691140-09155c1be58a", origin: "Pots & urns" },
  { slug: "garden-umbrella-gazebo", name: "Garden Umbrella & Gazebo", brand: "Vignette", category: "Interior Decor", material: "Outdoor", product: "Outdoor", application: "Garden", image: "photo-1784454793008-3d6e632db3d7", origin: "Shade & outdoor living" },
]);

const catalogueItems = (Array.isArray(catalogueContent) ? catalogueContent : [])
  .filter((item) => item && typeof item === "object" && !Array.isArray(item))
  .map((item, index) => {
    const category = typeof item.category === "string" && item.category.trim() ? item.category.trim() : "Marble & Stone";
    return {
      ...item,
      slug: typeof item.slug === "string" && item.slug.trim() ? item.slug.trim() : "catalogue-item-" + (index + 1),
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Untitled material",
      brand: typeof item.brand === "string" && item.brand.trim() ? item.brand.trim() : "BDS Marvel",
      material: typeof item.material === "string" && item.material.trim() ? item.material.trim() : category,
      product: typeof item.product === "string" && item.product.trim() ? item.product.trim() : "Materials",
      category,
      image: typeof item.image === "string" && item.image.trim() ? item.image : "photo-1618221195710-dd6b41faaea6",
      origin: typeof item.origin === "string" ? item.origin : "",
    };
  });

const catalogueDetails = wordpressContent("catalogueDetails", {
  "center-end-tables": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "A collection of marble centre and end tables that redefine sophistication in living spaces — each top showing the timeless allure of carefully chosen black and white marble and its natural patterns.", specs: [["Material", "Black & white marble"], ["Build", "Solid top, crafted base"], ["Lead time", "4 – 6 weeks"]], gallery: ["photo-1692262089751-7e26b69ad8d1", "photo-1649011327045-624a1bd2c3e7", "photo-1614348531934-c338408a46bb"] },
  "marble-inlay-tops": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "A captivating collection of marble inlay table tops where the timeless art of pietra dura meets luxury — florals and geometries cut from coloured stone and set by hand, with full customisation.", specs: [["Craft", "Pietra dura inlay"], ["Customisation", "Pattern & stone"], ["Lead time", "6 – 8 weeks"]], gallery: ["photo-1506463108611-88834e9f6169", "photo-1531165424588-80b93de6f807", "photo-1784937275795-685af009b219"] },
  "marble-stone-fireplace": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Fireplaces that make a statement — elevating a living space with the warmth and natural elegance of marble and stone, hand-finished and built to order.", specs: [["Material", "Marble & stone"], ["Finish", "Natural, hand-finished"], ["Lead time", "6 – 8 weeks"]], gallery: ["photo-1603039531759-1a1bbe4f9f94", "photo-1612031737124-28aeae3f2863", "photo-1648303098204-258fc88bc69f"] },
  "marble-home-temple": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Exquisite works of art that infuse spirituality into your home — carved and detailed temples in Vietnam white marble that create a sacred haven in any living space.", specs: [["Material", "Vietnam white marble"], ["Work", "Carved & detailed"], ["Lead time", "8 – 10 weeks"]], gallery: ["photo-1678593628844-6ea49dee8ce3", "photo-1593739594181-dcd2709bc51d", "photo-1664851451771-2a78ed2b20fe"] },
  "stone-basins-bathtubs": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "A collection of stone basins and bathtubs in a range of styles and finishes — transforming a bathroom into a sanctuary where luxury meets durability, each piece carved from solid block.", specs: [["Build", "Solid block"], ["Range", "Basins & bathtubs"], ["Sample size", "e.g. 70 × 46 × 12 cm"]], gallery: ["photo-1576698483491-8c43f0862543", "photo-1610178167104-488495443e01", "photo-1756079664354-34944e001f6d"] },
  "deity-figure-statues": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Hand-carved statues of deities and figures in sandstone and white marble — devotional and decorative pieces finished by our master carvers.", specs: [["Material", "Marble / sandstone"], ["Work", "Hand-carved"], ["Lead time", "On selection"]], gallery: ["photo-1660140889200-59994b203546", "photo-1662808141421-54240cbfd45f", "photo-1621422747516-240c0f5f987a"] },
  "abstract-sculpture": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Garden spheres and contemporary stone forms — sculptural pieces that anchor a courtyard or lawn without crowding it.", specs: [["Forms", "Spheres & abstract"], ["Setting", "Indoor / garden"], ["Lead time", "On selection"]], gallery: ["photo-1662808141421-54240cbfd45f", "photo-1621422747516-240c0f5f987a", "photo-1660140889200-59994b203546"] },
  "fountains-water-features": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Tiered fountains, wall fountains and sculptural water features hand-carved in sandstone and marble — the sound of water worked over honed and rough-hewn faces.", specs: [["Types", "Tiered · wall · sculptural"], ["Setting", "Garden, outdoor rated"], ["Lead time", "6 – 8 weeks"]], gallery: ["photo-1761024300156-aff4bec70b6a", "photo-1761024300151-eed15857ea31", "photo-1783933676729-de12e55f5546"] },
  "garden-benches-seating": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Carved and contemporary benches in marble and sandstone — seating that weathers gracefully in gardens and courtyards.", specs: [["Material", "Marble & sandstone"], ["Style", "Carved / contemporary"], ["Setting", "Outdoor rated"]], gallery: ["photo-1768700519431-5297f11808a3", "photo-1764444218648-75a52322c489", "photo-1786467642735-1342f43034ae"] },
  "planters-urns": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Carved planters, urns and vases for gardens and entrances — hand-worked sandstone in a range of profiles and scales.", specs: [["Pieces", "Planters · urns · vases"], ["Material", "Carved sandstone"], ["Setting", "Garden & entrance"]], gallery: ["photo-1787497017406-9f54de5921df", "photo-1786467642735-1342f43034ae", "photo-1768700519431-5297f11808a3"] },
  "stone-lanterns": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Garden lanterns and carved lamp posts in sandstone — soft, grounded lighting for paths, courts and entrances.", specs: [["Pieces", "Lanterns & lamp posts"], ["Material", "Carved sandstone"], ["Use", "Garden lighting"]], gallery: ["photo-1786467642735-1342f43034ae", "photo-1787497017406-9f54de5921df", "photo-1764444218648-75a52322c489"] },
  "jali-screens-railings": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Intricately pierced jali panels, railings and balustrades — traditional lattice screens cut from a single stone for light, air and privacy.", specs: [["Work", "Pierced jali"], ["Pieces", "Panels · railings · balustrades"], ["Lead time", "Per project"]], gallery: ["photo-1763295492544-7850fa8671cf", "photo-1763295492872-a4ec4141de92", "photo-1763295492547-53c6c64833e1"] },
  "jharokhas-windows": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Traditional carved jharokhas, balconies and window frames in sandstone — Rajasthani architectural detail made to measure.", specs: [["Pieces", "Jharokhas · balconies · frames"], ["Material", "Carved sandstone"], ["Lead time", "Per project"]], gallery: ["https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Jaisalmer_-_Patwa_Haveli_26.jpg/1280px-Jaisalmer_-_Patwa_Haveli_26.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Jodhpur_Mehrangarh_-_Palast_4a_Jharokha.jpg/1280px-Jodhpur_Mehrangarh_-_Palast_4a_Jharokha.jpg", "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/Jharokhas_in_Meherangarh_Fort_08.jpg/1280px-Jharokhas_in_Meherangarh_Fort_08.jpg"] },
  "pillars-columns": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Carved pillars, columns and capitals for facades, verandahs and temple structures — load-bearing stone detailed by hand.", specs: [["Pieces", "Pillars · columns · capitals"], ["Material", "Sandstone / marble"], ["Lead time", "Per project"]], gallery: ["photo-1672215053161-5778b0fbb9ea", "photo-1665003725647-3ae0f01140b1", "photo-1672215055915-e6143dc70e6a"] },
  "temple-carving": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Detailed architectural carving for temples — shikhara, mandapa and figure work executed in marble and sandstone by our carving teams.", specs: [["Scope", "Architectural temple carving"], ["Material", "Marble & sandstone"], ["Lead time", "Per project"]], gallery: ["photo-1665003725647-3ae0f01140b1", "photo-1672215053161-5778b0fbb9ea", "photo-1763295492872-a4ec4141de92"] },
  "gazebos-chhatris": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Stone pavilions, domes and chhatris in carved sandstone — garden and rooftop structures in a traditional idiom.", specs: [["Pieces", "Gazebos · domes · chhatris"], ["Material", "Carved sandstone"], ["Lead time", "Per project"]], gallery: ["photo-1672215055915-e6143dc70e6a", "photo-1593739594181-dcd2709bc51d", "photo-1664851451771-2a78ed2b20fe"] },
  "marble-flooring-inlay": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Water-jet flooring, pietra dura and mother-of-pearl inlay and mosaic — decorative stone floors cut to your pattern.", specs: [["Techniques", "Water-jet · pietra dura · mosaic"], ["Material", "Marble & coloured stone"], ["Lead time", "Per project"]], gallery: ["photo-1790501028719-1c18dc4a895d", "photo-1506463108611-88834e9f6169", "photo-1531165424588-80b93de6f807"] },
  "monuments-projects": { brand: "DrawStones", consult: "Marble & Stone Consulting", desc: "Large-scale stone projects and public monuments — including the sandstone monuments on the Eastern Peripheral Expressway and the Ambedkar Smarak, Lucknow.", specs: [["Scope", "Monuments & infrastructure"], ["Material", "Sandstone & stone"], ["Notable", "EPE · Ambedkar Smarak"]], gallery: ["photo-1586618754080-135516049958", "photo-1665003725647-3ae0f01140b1", "photo-1672215055915-e6143dc70e6a"] },
  "flooring-materials": { consult: "Flooring Consulting", desc: "SPC, engineered oak and stone composite — a distributed range plus our own proprietary line.", specs: [["Range", "40+ SKUs"], ["Core", "SPC / engineered"], ["Lead time", "Ex-stock to 4 weeks"]], gallery: ["photo-1616486338812-3dadae4b4ace", "photo-1789381500057-2a288d79e9e6", "photo-1618220179428-22790b461013"] },
  "flooring-finishes": { consult: "Flooring Consulting", desc: "Matte, brushed and natural-oil finishes — sampled on the exact plank batch you'll receive.", specs: [["Range", "3 finish families"], ["Samples", "Batch-matched"], ["Lead time", "1 week"]], gallery: ["photo-1600607687939-ce8a6c25118c", "photo-1789381500057-2a288d79e9e6", "photo-1780399334790-64af9ffb45fc"] },
  "flooring-patterns": { consult: "Flooring Consulting", desc: "Herringbone, chevron and straight plank layouts — dry-laid and numbered before installation begins.", specs: [["Patterns", "Herringbone · chevron · plank"], ["Layout", "Dry-laid first"], ["Lead time", "Per project"]], gallery: ["photo-1618220179428-22790b461013", "photo-1616486338812-3dadae4b4ace", "photo-1600566753190-17f0baa2a6c3"] },
  "flooring-applications": { consult: "Flooring Consulting", desc: "Residential, hospitality and contract floors — specified for traffic, acoustics and cleaning cycles.", specs: [["Rating", "Residential to contract"], ["Spec support", "In-house"], ["Lead time", "Per project"]], gallery: ["photo-1600607687939-ce8a6c25118c", "photo-1616486338812-3dadae4b4ace", "photo-1600585154340-be6161a56a0c"] },
  "decor-lighting": { consult: "Interior Décor Consulting", desc: "Ambient, task and feature lighting — from backlit stone panels to a considered picture light.", specs: [["Range", "Ambient · task · feature"], ["Colour temp", "2200 – 3000K"], ["Lead time", "2 – 5 weeks"]], gallery: ["photo-1747258818911-dfde27ecabba", "photo-1618221195710-dd6b41faaea6", "photo-1600566753190-17f0baa2a6c3"] },
  "decor-pieces": { consult: "Interior Décor Consulting", desc: "Sculptural objects and statement pieces that anchor a room without crowding it.", specs: [["Range", "Curated objects"], ["Sourcing", "In-house + studios"], ["Lead time", "Varies"]], gallery: ["photo-1600585154340-be6161a56a0c", "photo-1600607687939-ce8a6c25118c", "photo-1631396326646-c06a935ff3a6"] },
  "decor-accessories": { consult: "Interior Décor Consulting", desc: "Considered accents that finish a room — trays, textiles, hardware and small objects.", specs: [["Range", "Accents & hardware"], ["Styling", "With our designers"], ["Lead time", "Varies"]], gallery: ["photo-1618221195710-dd6b41faaea6", "photo-1747258818911-dfde27ecabba", "photo-1780399334790-64af9ffb45fc"] },
  "decor-textures": { consult: "Interior Décor Consulting", desc: "Lime plaster, linen, stone and wood — a texture palette sampled together before we commit.", specs: [["Samples", "Physical boards"], ["Range", "Plaster · textile · stone · wood"], ["Lead time", "1 – 2 weeks"]], gallery: ["photo-1780399334790-64af9ffb45fc", "photo-1600566753190-17f0baa2a6c3", "photo-1618220179428-22790b461013"] },
  "decor-finishing": { consult: "Interior Décor Consulting", desc: "Hardware, trims and final touches — the last five percent that makes a room feel done.", specs: [["Range", "Hardware · trims · edges"], ["Matching", "To interior palette"], ["Lead time", "Per project"]], gallery: ["photo-1600566753190-17f0baa2a6c3", "photo-1600607687939-ce8a6c25118c", "photo-1747258818911-dfde27ecabba"] },
  sofas: { consult: "Furniture Consulting", desc: "Deep, tailored seating in soft upholstery — hardwood frames built in our own workshop.", specs: [["Frames", "Solid hardwood"], ["Upholstery", "COM or curated"], ["Lead time", "6 – 8 weeks"]], gallery: ["photo-1600607687939-ce8a6c25118c", "photo-1631396326646-c06a935ff3a6", "photo-1600566753190-17f0baa2a6c3"] },
  tables: { consult: "Furniture Consulting", desc: "Stone, timber and cast tops on considered bases — dining, coffee and side tables.", specs: [["Tops", "Stone · timber · cast"], ["Bases", "Steel · wood · stone"], ["Lead time", "5 – 7 weeks"]], gallery: ["photo-1600585154340-be6161a56a0c", "photo-1618221195710-dd6b41faaea6", "photo-1631396326646-c06a935ff3a6"] },
  chairs: { consult: "Furniture Consulting", desc: "Dining, lounge and accent chairs — prototyped, sat in, adjusted, then made to order.", specs: [["Range", "Dining · lounge · accent"], ["Build", "Made to order"], ["Lead time", "5 – 7 weeks"]], gallery: ["photo-1631396326646-c06a935ff3a6", "photo-1737467030068-88ad20e617ca", "photo-1600607687939-ce8a6c25118c"] },
  "custom-furniture": { consult: "Furniture Consulting", desc: "Bespoke joinery built to your brief — from a single headboard to a full suite of casegoods.", specs: [["Scope", "One-off to full suites"], ["Process", "Brief → prototype → build"], ["Lead time", "6 – 10 weeks"]], gallery: ["photo-1737467030068-88ad20e617ca", "photo-1631396326646-c06a935ff3a6", "photo-1600585154340-be6161a56a0c"] },
  "furniture-materials": { consult: "Furniture Consulting", desc: "Solid wood, stone, metal and lacquer — finished samples approved before production begins.", specs: [["Range", "Wood · stone · metal · lacquer"], ["Approval", "Physical samples"], ["Lead time", "1 – 2 weeks"]], gallery: ["photo-1618221195710-dd6b41faaea6", "photo-1737467030068-88ad20e617ca", "photo-1780399334790-64af9ffb45fc"] },
  "broadloom-carpets": { brand: "Renest", consult: "Flooring Consulting", desc: "Wall-to-wall broadloom carpet in wool and synthetic blends — soft underfoot, acoustic, and available in wide rolls for seamless floors.", specs: [["Type", "Broadloom roll"], ["Width", "Up to 4 m"], ["Use", "Residential & contract"]], gallery: ["photo-1660394585016-508f949df960", "photo-1572123979839-3749e9973aba", "photo-1523350165414-082d792c4bcc"] },
  "carpet-tiles": { brand: "Renest", consult: "Flooring Consulting", desc: "Modular carpet tiles for offices, hospitality and contract floors — easy to install, replace and mix into patterns.", specs: [["Format", "Modular tile"], ["Size", "50 × 50 cm"], ["Use", "Office & contract"]], gallery: ["photo-1523350165414-082d792c4bcc", "photo-1613124152913-c180d8c1d740", "photo-1660394585016-508f949df960"] },
  "carpets-rugs": { brand: "Renest", consult: "Flooring Consulting", desc: "Hand-knotted and machine-made carpets and area rugs — a curated range of textures, pile heights and patterns.", specs: [["Make", "Hand-knotted / machine"], ["Range", "Rugs & carpets"], ["Custom", "Size & colour"]], gallery: ["photo-1572123979839-3749e9973aba", "photo-1660394585016-508f949df960", "photo-1613124152913-c180d8c1d740"] },
  "commercial-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "Hard-wearing commercial flooring for offices, retail and hospitality — specified for traffic, acoustics and cleaning cycles.", specs: [["Rating", "Heavy commercial"], ["Range", "Vinyl · wood · carpet"], ["Spec", "In-house support"]], gallery: ["photo-1560185008-b033106af5c3", "photo-1598718544285-7180f670198b", "photo-1548268364-3acee266b695"] },
  "deck-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "WPC and timber decking for balconies, terraces and poolsides — weather-resistant boards with a natural grain.", specs: [["Material", "WPC / timber"], ["Use", "Outdoor rated"], ["Finish", "Natural grain"]], gallery: ["photo-1656646549633-80ad4bd2ab40", "photo-1574120583586-de8847ae992c", "photo-1560185008-b033106af5c3"] },
  "gym-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "Shock-absorbing rubber flooring for gyms and fitness areas — tiles and rolls that protect floors and reduce noise.", specs: [["Material", "Rubber"], ["Format", "Tile & roll"], ["Thickness", "6 – 20 mm"]], gallery: ["photo-1603665409265-bdc00027c217", "photo-1768554630751-6448593749eb", "photo-1610684082661-5d4763eecb39"] },
  "heavy-duty-doormats": { brand: "Renest", consult: "Flooring Consulting", desc: "Entrance and dirt-barrier mats for high-traffic doorways — trap dirt and moisture before it reaches the floor.", specs: [["Type", "Dirt barrier"], ["Use", "Entrance, high traffic"], ["Custom", "Size & logo"]], gallery: ["photo-1574120583586-de8847ae992c", "photo-1656646549633-80ad4bd2ab40", "photo-1603665409265-bdc00027c217"] },
  "hospital-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "Antibacterial homogeneous vinyl for hospitals and clinics — hygienic, seamless and easy to sanitise.", specs: [["Material", "Homogeneous vinyl"], ["Finish", "Antibacterial, seamless"], ["Use", "Healthcare"]], gallery: ["photo-1581858726788-75bc0f6a952d", "photo-1598718544285-7180f670198b", "photo-1560185008-b033106af5c3"] },
  "laminate-wooden-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "Laminate and engineered wood plank floors — warm wood looks with a tough, scratch-resistant wear layer.", specs: [["Core", "HDF / engineered"], ["Install", "Click-lock"], ["Range", "Oak & walnut tones"]], gallery: ["photo-1519393890420-f28727375fa5", "photo-1548268364-3acee266b695", "photo-1560185008-b033106af5c3"] },
  "lvt-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "Luxury vinyl tile in wood and stone looks — resilient, water-resistant and quiet underfoot.", specs: [["Material", "LVT"], ["Finish", "Wood & stone looks"], ["Use", "Residential & contract"]], gallery: ["photo-1598718544285-7180f670198b", "photo-1581858726788-75bc0f6a952d", "photo-1519393890420-f28727375fa5"] },
  "school-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "Durable, safe flooring for schools, play areas and activity rooms — bright, cleanable and slip-resistant.", specs: [["Finish", "Slip-resistant"], ["Range", "Vinyl & rubber"], ["Use", "Education"]], gallery: ["photo-1613124152913-c180d8c1d740", "photo-1523350165414-082d792c4bcc", "photo-1654605305001-8ec64a69c07c"] },
  "spc-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "Rigid stone-polymer core flooring — dimensionally stable click-lock planks that handle moisture and temperature swings.", specs: [["Core", "Stone-polymer (SPC)"], ["Install", "Click-lock"], ["Finish", "Wood & stone looks"]], gallery: ["photo-1548268364-3acee266b695", "photo-1519393890420-f28727375fa5", "photo-1598718544285-7180f670198b"] },
  "sports-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "Indoor court and multi-sport surfaces — cushioned, line-marked systems for badminton, basketball and multipurpose halls.", specs: [["Material", "PVC / vinyl sports"], ["Use", "Indoor courts"], ["System", "Cushioned"]], gallery: ["photo-1610684082661-5d4763eecb39", "photo-1654605305001-8ec64a69c07c", "photo-1603665409265-bdc00027c217"] },
  "transport-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "Anti-slip flooring for buses, trains and transit interiors — lightweight, fire-rated and hard-wearing.", specs: [["Finish", "Anti-slip"], ["Rating", "Fire-rated"], ["Use", "Transport interiors"]], gallery: ["photo-1768554630751-6448593749eb", "photo-1603665409265-bdc00027c217", "photo-1610684082661-5d4763eecb39"] },
  "vibrant-flooring": { brand: "Renest", consult: "Flooring Consulting", desc: "Colourful, patterned flooring for creative, retail and children's spaces — bold tones and graphic layouts.", specs: [["Range", "Colour & pattern"], ["Material", "Vinyl & carpet"], ["Use", "Creative spaces"]], gallery: ["photo-1654605305001-8ec64a69c07c", "photo-1613124152913-c180d8c1d740", "photo-1523350165414-082d792c4bcc"] },
  "artificial-plants-green-walls": { brand: "Vignette", consult: "Interior Décor Consulting", desc: "Artificial plants and green living walls — low-maintenance vertical gardens and foliage that bring greenery indoors.", specs: [["Type", "Green wall & foliage"], ["Maintenance", "Low / none"], ["Custom", "Panel size"]], gallery: ["photo-1585506774639-5e2f8fda6352", "photo-1656500545940-8e37294b69a5", "photo-1588440691140-09155c1be58a"] },
  "decorative-planters": { brand: "Vignette", consult: "Interior Décor Consulting", desc: "Decorative ceramic and stone planters and urns — sculptural pots for interiors, lobbies and entrances.", specs: [["Material", "Ceramic & stone"], ["Range", "Pots & urns"], ["Setting", "Indoor & entrance"]], gallery: ["photo-1588440691140-09155c1be58a", "photo-1585445490582-9872899757b7", "photo-1585506774639-5e2f8fda6352"] },
  "garden-umbrella-gazebo": { brand: "Vignette", consult: "Interior Décor Consulting", desc: "Garden umbrellas and outdoor gazebos — shade and outdoor living structures for gardens, terraces and poolsides.", specs: [["Range", "Umbrellas & gazebos"], ["Use", "Outdoor living"], ["Custom", "Size & finish"]], gallery: ["photo-1784454793008-3d6e632db3d7", "photo-1772093978429-2a553d56face", "photo-1585445490582-9872899757b7"] },
  "tensile-structures": { brand: "Formwork", consult: "Construction Consulting", desc: "Tensile fabric shade structures and canopies — engineered membrane roofs for entrances, courtyards and parking.", specs: [["System", "Tensile membrane"], ["Use", "Canopy & shade"], ["Scope", "Design & install"]], gallery: ["photo-1784637663357-cfbf73b09c0d", "photo-1774579892773-8a21fb9200c9", "photo-1656646549633-80ad4bd2ab40"] },
  "concept-moodboards": { brand: "BDS Marvel", consult: "Interior Design Consulting", desc: "Concept direction and moodboards that set the tone before a single wall moves — references, palettes and the feeling of the finished space, agreed early.", specs: [["Deliverable", "Concept & moodboards"], ["Stage", "Pre-drawings"], ["Lead time", "1 – 2 weeks"]], gallery: ["photo-1631679706909-1844bbd07221", "photo-1618220179428-22790b461013", "photo-1600585154340-be6161a56a0c"] },
  "space-planning": { brand: "BDS Marvel", consult: "Interior Design Consulting", desc: "Spatial planning that resolves flow, storage and daylight — plans drawn around how the space is actually lived in, before build.", specs: [["Deliverable", "Space plans"], ["Focus", "Flow · storage · light"], ["Lead time", "2 – 3 weeks"]], gallery: ["photo-1618220179428-22790b461013", "photo-1631679706909-1844bbd07221", "photo-1616486338812-3dadae4b4ace"] },
  "material-palettes": { brand: "BDS Marvel", consult: "Interior Design Consulting", desc: "Material palettes sampled together — stone, flooring, plaster and timber approved as a set so the finished room reads as one.", specs: [["Deliverable", "Physical palette"], ["Range", "Stone · floor · plaster · wood"], ["Lead time", "1 – 2 weeks"]], gallery: ["photo-1600585154340-be6161a56a0c", "photo-1618221195710-dd6b41faaea6", "photo-1780399334790-64af9ffb45fc"] },
  "3d-visualisation": { brand: "BDS Marvel", consult: "Interior Design Consulting", desc: "Photoreal 3D visualisation so you sign off the space before it is built — every material, light and detail resolved on screen first.", specs: [["Deliverable", "3D renders"], ["Sign-off", "Before build"], ["Lead time", "2 – 4 weeks"]], gallery: ["photo-1631396326646-c06a935ff3a6", "photo-1631679706909-1844bbd07221", "photo-1618220179428-22790b461013"] },
});

const categoriesFilter = ["All", ...new Set(catalogueItems.map(i => i.category || "Marble & Stone"))];

const categoryOf = (item) => item.category || "Marble & Stone";

const SEGMENT_SEO = wordpressContent("SEGMENT_SEO", {
  "interior-designing": ["Interior Designing — BDS Marvel | BDSM · BDS Marvel", "BDS Marvel, the interior designing team at BDSM: concept, spatial planning, material palettes and detailing for residential and commercial spaces."],
  "marble-and-stone": ["Marble & Stone Supplier in India — Drawstones | BDSM · BDS Marvel", "Drawstones, the stone team at BDSM · BDS Marvel: marble, granite, kota and travertine sourcing, cutting and installation for facades and interiors."],
  flooring: ["SPC & Wood Flooring — Renest | BDSM · BDS Marvel", "Renest, the flooring team at BDSM · BDS Marvel: SPC, engineered oak and hospitality-grade flooring, specified and installed by one in-house team."],
  construction: ["Turnkey Construction — Formwork | BDSM · BDS Marvel", "Formwork, the construction team at BDSM · BDS Marvel: turnkey structures, fitouts and site execution under one contract."],
  interiors: ["Interior Design & Build — Vignette | BDSM · BDS Marvel", "Vignette, the interior design team at BDSM · BDS Marvel: residential and commercial interiors, bespoke furniture and full execution."],
  furniture: ["Bespoke Furniture — Grain | BDSM · BDS Marvel", "Grain, the furniture studio at BDSM · BDS Marvel: bespoke tables, seating, storage and joinery designed and built in-house."],
});

function SegmentPage() {
  const { slug } = useParams();
  const segment = segments.find((item) => item.slug === slug) || segments[0];
  const related = projects.filter((item) => item.segment === segment.name);
  const extra = serviceExtras[segment.slug];
  const { openConsult } = useConsultation();
  const { openInquiry } = useInquiry();
  usePageMeta(...(SEGMENT_SEO[segment.slug] || SEGMENT_SEO["marble-and-stone"]));
  // BDS Marvel (interior-designing) shows Selected Projects before Consulting; all other brand pages keep Consulting first.
  const projectsFirst = segment.slug === "interior-designing";
  const workSection = <section className="detail-work">
    <div className="detail-intro"><span className="section-index">{projectsFirst ? "01" : extra?.catalogue ? "03" : "02"} — SELECTED PROJECTS</span><h2>Work in the<br /><em>material.</em></h2></div>
    <div className="mini-work-grid">{(related.length ? related : projects.slice(0, 2)).map((work) => <Link to={`/projects/${work.slug}`} className="mini-work" key={work.title} data-testid={`agency-work-${work.slug}`}><img src={img(work.image, 1200)} alt="" /><div><div className="mini-work__text"><span>{work.category} · {work.year}</span><h3>{work.title}</h3></div><ArrowUpRight size={18} /></div></Link>)}</div>
  </section>;
  return <main className={`detail-page detail-page--${segment.tone}`} data-testid="agency-detail-page">
    <section className="detail-hero" style={{ backgroundImage: `linear-gradient(160deg, rgba(10,8,6,.78), rgba(10,8,6,.42)), url(${img(segment.hero)})` }}>
      <div className="detail-kicker"><span>{segment.parent.toUpperCase()} · {String(segments.indexOf(segment) + 1).padStart(2, "0")} / {String(segments.length).padStart(2, "0")}</span><Link to="/" state={{ restore: true }} data-testid="agency-detail-back-link">BACK TO NETWORK</Link></div>
      <div className="detail-hero-grid">
        <div>
          <p className="eyebrow">{segment.parent.toUpperCase()}</p>
          <h1>{segment.name}<span className="hero-dot">.</span></h1>
          <p className="detail-lede">{segment.body}</p>
          <div className="detail-services">{segment.services.map((service) => <span key={service}>{service}</span>)}</div>
        </div>
      </div>
    </section>
    {extra?.catalogue && <section className="svc-catalogue" data-testid="service-catalogue">
      <div className="detail-intro"><span className="section-index">01 — CATALOGUE</span><h2>Browse the<br /><em>{segment.name.toLowerCase()}.</em></h2></div>
      <div className="svc-catalogue__grid">{extra.catalogue.map((item, index) => <Link className="svc-cat-card" to={`/catalogue/${item.slug}`} state={{ from: `/businesses/${segment.slug}`, fromLabel: segment.name }} key={item.name} data-testid={`catalogue-card-${index + 1}`}>
        <div className="svc-cat-card__media"><img src={img(item.image, 900)} alt={item.name} loading="lazy" /></div>
        <div className="svc-cat-card__body"><span className="svc-cat-card__meta">{item.meta}</span><h3>{item.name}</h3><p>{item.desc}</p></div>
      </Link>)}</div>
    </section>}
    {projectsFirst && workSection}
    {extra && <section className="svc-consult" data-testid="service-consulting">
      <div className="svc-consult__inner">
        <span className="section-index">{projectsFirst ? "02" : extra.catalogue ? "02" : "01"} — CONSULTING</span>
        <h2>Get expert<br /><em>guidance.</em></h2>
        <p className="svc-consult__line">{extra.consultLine}</p>
        <ul className="svc-consult__cover">{extra.consultCover.map((c) => <li key={c}>{c}</li>)}</ul>
        <div className="svc-consult__actions">
          <button type="button" className="np-btn np-btn--solid" onClick={() => openConsult(extra.consultService)} data-testid="get-consultation-btn">GET CONSULTATION <ArrowUpRight size={16} /></button>
          {extra.catalogue && <button type="button" className="np-btn np-btn--ghost" onClick={() => openInquiry(segment.parent || segment.name, "", extra.catalogue.map((entry) => entry.name))} data-testid="make-inquiry-btn">MAKE AN INQUIRY <ArrowUpRight size={16} /></button>}
        </div>
      </div>
    </section>}
    {!projectsFirst && workSection}
  </main>;
}

function ProjectPage() {
  const { slug } = useParams();
  const project = projects.find((item) => item.slug === slug);
  const segment = segments.find((item) => item.name === project?.segment);
  const nextProject = projects[(projects.indexOf(project) + 1) % projects.length];
  usePageMeta(project ? `${project.title} | BDSM · BDS Marvel Projects` : "Projects", project?.description || "Projects");
  if (!project) return <Navigate to="/projects" replace />;
  return <main className={`case-study-page case-study-page--${segment?.tone || "sand"}`} data-testid="case-study-page">
    <section className="case-study-hero"><div className="detail-kicker"><span>{project.segment.toUpperCase()} · {project.year}</span><Link to="/projects" state={{ restore: true }} data-testid="case-study-back-link">BACK TO PROJECTS</Link></div><div className="case-study-hero-copy"><span className="section-index">{project.category.toUpperCase()} · {project.location}</span><h1>{project.title}<span className="hero-dot">.</span></h1><p>{project.description}</p></div><div className="case-study-hero-image"><img src={img(project.image)} alt="" data-testid="case-study-hero-image" /></div></section>
    <section className="case-study-overview"><div className="case-study-overview-label"><span className="section-index">01 — THE BRIEF</span><Link to={`/businesses/${segment?.slug || "marble-and-stone"}`} data-testid="case-study-agency-link">VIEW {project.segment.toUpperCase()} <ArrowUpRight size={15} /></Link></div><div className="case-study-story"><div><span className="story-label">THE CHALLENGE</span><h2>{project.challenge}</h2></div><div><span className="story-label">THE APPROACH</span><p>{project.approach}</p></div></div></section>
    <section className="case-study-gallery"><div className="case-study-gallery-heading"><span className="section-index">02 — IN PLACE</span><h2>Detail in<br /><em>the material.</em></h2></div><div className="case-study-images">{project.gallery.map((image, index) => <figure className={`case-study-image case-study-image--${index + 1}`} key={image}><img src={img(image, 1200)} alt={`${project.title} view ${index + 1}`} data-testid={`case-study-gallery-image-${index + 1}`} /><figcaption>0{index + 1} / {project.category.toUpperCase()}</figcaption></figure>)}</div></section>
    <section className="case-study-results"><div><span className="section-index">03 — OUTCOMES</span><h2>Proof in<br /><em>the numbers.</em></h2></div><div className="result-grid">{project.outcomes.map(([value, label]) => <div className="result-stat" key={label}><CountUp value={value} /><span>{label}</span></div>)}</div></section>
    <section className="case-study-credits"><div><span className="section-index">04 — CREDITS</span><h2>Built by<br /><em>one team.</em></h2></div><div className="credits-list">{project.credits.map((credit, index) => <div key={credit}><span>0{index + 1}</span><p>{credit}</p></div>)}</div></section>
    <section className="case-study-next"><span className="section-index">UP NEXT</span><Link to={`/projects/${nextProject.slug}`} data-testid="next-case-study-link"><span>{nextProject.segment} · {nextProject.category}</span><h2>{nextProject.title}<ArrowUpRight size={27} /></h2></Link></section>
  </main>;
}

function ProjectsArchive() {
  usePageMeta("Projects | BDSM · BDS Marvel", "Residential, hospitality, commercial and civic projects in stone, flooring, construction and interiors — delivered across India by one in-house team.");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All work");
  const filterOptions = ["All work", ...segments.map((s) => s.name)];
  const filtered = useMemo(() => projects.filter((item) => (filter === "All work" || item.segment === filter) && `${item.title} ${item.category} ${item.segment} ${item.location}`.toLowerCase().includes(query.toLowerCase())), [filter, query]);
  return <main className="work-page" data-testid="work-archive-page">
    <section className="work-hero"><div className="detail-kicker"><span>BDSM · PROJECTS {new Date().getFullYear()}</span><Link to="/" state={{ restore: true }} data-testid="work-back-home-link">BACK HOME</Link></div><p className="eyebrow">THE WORK</p><h1>Projects across<br /><em>materials & scale.</em></h1></section>
    <section className="work-library">
      <div className="work-controls">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" aria-label="Search projects" data-testid="work-search-input" /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by business" data-testid="work-agency-filter">{filterOptions.map((option) => <option key={option}>{option}</option>)}</select>
        <span className="work-count" data-testid="work-result-count">{filtered.length.toString().padStart(2, "0")} PROJECTS</span>
      </div>
      <div className="work-grid">{filtered.map((work, index) => <Link to={`/projects/${work.slug}`} className="work-card" key={work.title} data-testid={`work-card-${index + 1}`}><div className="work-image-wrap"><img src={img(work.image, 1200)} alt="" /><span>{work.year}</span></div><div className="work-card-copy"><div><span>{work.segment} · {work.category} · {work.location}</span><h2>{work.title}</h2><p>{work.description}</p></div><ArrowUpRight size={21} /></div></Link>)}{filtered.length === 0 && <div className="empty-work" data-testid="work-empty-state">No projects match. Try a different search.</div>}</div>
    </section>
  </main>;
}

function CataloguePage() {
  usePageMeta("Catalogue — BDSM · BDS Marvel", "Browse the BDSM material library — marble & stone, flooring and furniture, filterable by category and product.");
  const [category, setCategory] = useState("All");
  const [product, setProduct] = useState("All");
  const [query, setQuery] = useState("");
  const inCategory = useMemo(() => catalogueItems.filter((item) => category === "All" || categoryOf(item) === category), [category]);
  const productsFilter = useMemo(() => ["All", ...Array.from(new Set(inCategory.map((item) => item.product)))], [inCategory]);
  const chooseCategory = (option) => { setCategory(option); setProduct("All"); };
  const filtered = useMemo(() => inCategory.filter((item) => (product === "All" || item.product === product) && `${item.name} ${item.brand} ${item.material} ${item.product} ${categoryOf(item)} ${item.origin}`.toLowerCase().includes(query.toLowerCase())), [inCategory, product, query]);
  return <main className="catalogue-page" data-testid="catalogue-page">
    <section className="catalogue-hero">
      <div className="detail-kicker"><span>BDSM · CATALOGUE</span><Link to="/" state={{ restore: true }} data-testid="catalogue-back-link">BACK HOME</Link></div>
      <p className="eyebrow">BDS MARVEL · MATERIAL LIBRARY</p>
      <h1>The stone &<br /><em>marble catalogue.</em></h1>
    </section>
    <section className="catalogue-controls">
      <div className="catalogue-filter">
        <span className="filter-label">Category</span>
        <div className="filter-pills">{categoriesFilter.map((option) => <button key={option} className={`filter-pill ${category === option ? "filter-pill--active" : ""}`} onClick={() => chooseCategory(option)} data-testid={`catalogue-category-${option.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{option}</button>)}</div>
      </div>
      <div className="catalogue-filter">
        <span className="filter-label">Product</span>
        <div className="filter-pills">{productsFilter.map((option) => <button key={option} className={`filter-pill ${product === option ? "filter-pill--active" : ""}`} onClick={() => setProduct(option)} data-testid={`catalogue-product-${option.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{option}</button>)}</div>
      </div>
      <div className="catalogue-searchbox">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the library" aria-label="Search catalogue" data-testid="catalogue-search-input" /></label>
        <span className="work-count" data-testid="catalogue-result-count">{filtered.length.toString().padStart(2, "0")} ITEMS</span>
      </div>
    </section>
    <section className="catalogue-grid" data-testid="catalogue-grid">
      {filtered.map((item, index) => <article className="catalogue-card" key={item.slug} data-testid={`catalogue-card-${index + 1}`}>
        <Link to={`/catalogue/${item.slug}`} className="catalogue-card__link" data-testid={`catalogue-card-link-${index + 1}`}>
          <div className="catalogue-card__image"><img src={img(item.image, 900)} alt={item.name} /></div>
          <div className="catalogue-card__body">
            <div className="catalogue-card__meta"><span>{item.brand}</span><span>{categoryOf(item)} · {item.product}</span></div>
            <h3>{item.name}</h3>
            <p>{item.origin}</p>
          </div>
        </Link>
        <div className="catalogue-card__cta"><SampleTrigger className="contact-cta-btn" product={item.name} brand={item.brand} testId={`catalogue-request-${index + 1}`}>REQUEST QUOTE</SampleTrigger></div>
      </article>)}
      {filtered.length === 0 && <div className="empty-work">No items match those filters — try loosening one.</div>}
    </section>
  </main>;
}

const findCatalogueItem = (slug) => catalogueItems.find((entry) => entry.slug === slug)
  || Object.values(serviceExtras).flatMap((extra) => extra.catalogue || []).find((entry) => entry.slug === slug);

function ProductGallery({ images, name }) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [images]);
  const go = (step) => setActive((current) => (current + step + images.length) % images.length);
  return <div className="pdp-gallery" data-testid="product-gallery">
    <div className="pdp-thumbs">{images.map((src, index) => <button type="button" key={src} className={`pdp-thumb ${index === active ? "pdp-thumb--active" : ""}`} onClick={() => setActive(index)} data-testid={`product-thumb-${index + 1}`}><img src={src} alt={`${name} view ${index + 1}`} /></button>)}</div>
    <div className="pdp-main">
      <img key={images[active]} src={images[active]} alt={name} data-testid="product-main-image" />
      <button type="button" className="pdp-arrow pdp-arrow--prev" onClick={() => go(-1)} aria-label="Previous image" data-testid="product-image-prev"><ChevronLeft size={20} /></button>
      <button type="button" className="pdp-arrow pdp-arrow--next" onClick={() => go(1)} aria-label="Next image" data-testid="product-image-next"><ChevronRight size={20} /></button>
      <span className="pdp-counter" data-testid="product-image-counter">{active + 1} / {images.length}</span>
    </div>
  </div>;
}

function ProductAccordion({ title, children, open = false, testId }) {
  const [isOpen, setIsOpen] = useState(open);
  return <div className={`pdp-acc ${isOpen ? "pdp-acc--open" : ""}`}>
    <button type="button" className="pdp-acc__head" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} data-testid={testId}>{title}<ChevronDown size={18} /></button>
    {isOpen && <div className="pdp-acc__body">{children}</div>}
  </div>;
}

function ProductQuoteModal({ open, onClose, details }) {
  const empty = { name: "", email: "", phone: "", city: "", quantity: "", timeline: "", wantSample: false, message: "" };
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState({ state: "idle", error: "" });
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setStatus({ state: "idle", error: "" });
    setForm(empty);
    window.setTimeout(() => firstFieldRef.current?.focus(), 80);
    document.body.style.overflow = "hidden";
    stopSmoothScroll();
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; startSmoothScroll(); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ state: "sending", error: "" });
    try {
      const response = await apiFetch(apiPath(`/quote-requests`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form,
          product: details.product, collection: details.collection, brand: details.brand, material: details.material,
          finish: details.finish, use: details.use, product_url: window.location.href, image: details.image,
          name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), city: form.city.trim() || null,
          quantity: form.quantity.trim() || null, timeline: form.timeline || null, want_sample: form.wantSample, message: form.message.trim() || null,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.detail?.[0]?.msg || detail?.detail || detail?.message || "Please double-check your details and try again.");
      }
      setStatus({ state: "sent", error: "" });
    } catch (error) {
      setStatus({ state: "error", error: error.message || "Something went wrong. Please try again." });
    }
  };

  if (!open) return null;
  const specs = [["Collection", details.collection], ["Brand", details.brand], ["Material", details.material], ["Finish", details.finish], ["Best for", details.use]];
  return <div className="contact-modal" role="dialog" aria-modal="true" aria-label="Request a product quote" data-testid="product-quote-modal">
    <button className="contact-modal__scrim" onClick={onClose} aria-label="Close" data-testid="product-quote-scrim" />
    <div className="contact-modal__panel">
      <button className="contact-modal__close" onClick={onClose} aria-label="Close" data-testid="product-quote-close"><X size={22} /></button>
      <div className="contact-modal__intro pq-intro">
        <span className="section-index">REQUEST A QUOTE</span>
        <div className="pq-product" data-testid="product-quote-summary">
          <img src={details.image} alt={details.product} />
          <div><h3 data-testid="product-quote-name">{details.product}</h3><dl>{specs.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
        </div>
        <p>These product details are attached to your request automatically. We reply with pricing and lead times within one working day.</p>
      </div>
      {status.state === "sent" ? <div className="contact-modal__success" data-testid="product-quote-success"><Check size={40} /><h3>Quote request received.</h3><p>{formSettings("quote-requests")?.success_message || "Your request has been received."}</p><button onClick={onClose} data-testid="product-quote-done">CLOSE</button></div> : <form className="contact-modal__form" onSubmit={submit} data-testid="product-quote-form">
        <DynamicFields slug="quote-requests" form={form} setForm={setForm} firstFieldRef={firstFieldRef}  />
        {status.state === "error" && <div className="cm-error" data-testid="product-quote-error">{status.error}</div>}
        <button type="submit" className="cm-submit" disabled={status.state === "sending" || !formSettings("quote-requests")?.enabled} data-testid="product-quote-submit">{status.state === "sending" ? <><Loader2 size={16} className="cm-spin" /> Sending…</> : <>{formSettings("quote-requests")?.submit_label || "REQUEST QUOTE"} <ArrowUpRight size={16} /></>}</button>
      </form>}
    </div>
  </div>;
}

function CatalogueProductPage() {
  const { slug, piece } = useParams();
  const location = useLocation();
  const item = findCatalogueItem(slug);
  const detail = item ? catalogueDetails[item.slug] : null;
  const gallery = useMemo(() => (item && detail ? buildMaterialGallery(item, detail, img) : []), [item, detail]);
  const index = Number(piece) - 1;
  const product = gallery[index];
  const [quoteOpen, setQuoteOpen] = useState(false);
  usePageMeta(
    product ? `${product.title} | ${item.name} | BDSM · BDS Marvel` : "Catalogue | BDSM · BDS Marvel",
    product ? `${product.title} — ${product.material}, ${product.finish.toLowerCase()} finish. Request a quote from BDSM · BDS Marvel.` : "Browse the BDSM · BDS Marvel material library."
  );
  const images = useMemo(() => gallery.map((_, offset) => gallery[(index + offset) % gallery.length].src), [gallery, index]);
  if (!item || !detail) return <Navigate to="/catalogue" replace />;
  if (!product) return <Navigate to={`/catalogue/${item.slug}`} replace />;
  const brand = item.brand || detail.brand || "BDS Marvel";
  const related = gallery.map((entry, i) => ({ ...entry, n: i + 1 })).filter((entry) => entry.n !== index + 1).slice(0, 4);
  const highlights = [["Made to order", "Cut, finished and sized for your project"], ["Samples available", "See the real material before you commit"], ["Installed in-house", "Our own crews fit what we supply"]];
  return <main className="pdp" data-testid="catalogue-product-page">
    <Link to={`/catalogue/${item.slug}`} state={location.state} className="pdp-back" data-testid="product-back-link"><ChevronLeft size={16} /> BACK TO {item.name.toUpperCase()}</Link>
    <nav className="pdp-crumbs" data-testid="product-breadcrumbs">
      <Link to="/catalogue" data-testid="product-crumb-catalogue">Catalogue</Link><ChevronRight size={12} />
      <Link to={`/catalogue/${item.slug}`} state={location.state} data-testid="product-crumb-collection">{item.name}</Link><ChevronRight size={12} />
      <span>{product.title}</span>
    </nav>
    <section className="pdp-top">
      <ProductGallery images={images} name={product.title} />
      <aside className="pdp-info">
        <p className="pdp-brand" data-testid="product-brand">{brand.toUpperCase()} · {item.name.toUpperCase()}</p>
        <h1 data-testid="product-name">{product.title}</h1>
        <p className="pdp-sub">{product.material} · {product.finish}</p>
        <div className="pdp-actions">
          <button type="button" className="pdp-btn pdp-btn--solid" onClick={() => setQuoteOpen(true)} data-testid="product-request-quote-btn">REQUEST QUOTE <ArrowUpRight size={16} /></button>
        </div>
        <ul className="pdp-highlights">{highlights.map(([title, text]) => <li key={title}><Check size={16} /><div><strong>{title}</strong><span>{text}</span></div></li>)}</ul>
        <ProductAccordion title="Item details" open testId="product-details-toggle">
          <dl className="pdp-dl" data-testid="product-details">
            <div><dt>Material</dt><dd>{product.material}</dd></div>
            <div><dt>Finish</dt><dd>{product.finish}</dd></div>
            <div><dt>Best for</dt><dd>{product.use}</dd></div>
            <div><dt>Collection</dt><dd>{item.name}</dd></div>
            {item.origin && <div><dt>Origin</dt><dd>{item.origin}</dd></div>}
          </dl>
        </ProductAccordion>
        <ProductAccordion title="Description" open testId="product-description-toggle">
          <p data-testid="product-description">{product.title} in {product.material.toLowerCase()}, with a {product.finish.toLowerCase()} finish — specified for {product.use.toLowerCase()}. Part of the {item.name} collection by {brand}. {detail.desc}</p>
        </ProductAccordion>
        <ProductAccordion title="Specification" testId="product-spec-toggle">
          <dl className="pdp-dl">{detail.specs.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </ProductAccordion>
        <ProductAccordion title="Samples, delivery & installation" testId="product-delivery-toggle">
          <p>Request a quote and we'll confirm sizes, quantities and lead time for your site. Physical samples can be couriered or viewed at our studio, and our in-house team handles delivery and installation across India.</p>
        </ProductAccordion>
      </aside>
    </section>
    <section className="pdp-related">
      <div className="pdp-related__head"><h2>More from <em>{item.name.toLowerCase()}</em></h2><Link to={`/catalogue/${item.slug}`} state={location.state} data-testid="product-view-collection">VIEW COLLECTION <ArrowUpRight size={14} /></Link></div>
      <div className="pdp-related__grid">{related.map((entry) => <Link key={entry.src} to={`/catalogue/${item.slug}/${entry.n}`} state={location.state} className="pdp-rel" data-testid={`product-related-${entry.n}`}>
        <div className="pdp-rel__img"><img src={entry.src} alt={entry.title} loading="lazy" /></div>
        <h3>{entry.title}</h3><span>{entry.material} · {entry.finish}</span>
      </Link>)}</div>
    </section>
    <ProductQuoteModal open={quoteOpen} onClose={() => setQuoteOpen(false)} details={{ product: product.title, collection: item.name, brand, material: product.material, finish: product.finish, use: product.use, image: product.src }} />
  </main>;
}

function CatalogueItemPage() {
  const { slug } = useParams();
  const location = useLocation();
  const backTo = location.state?.from || "/catalogue";
  const backLabel = location.state?.fromLabel ? `BACK TO ${location.state.fromLabel.toUpperCase()}` : "BACK TO CATALOGUE";
  const item = findCatalogueItem(slug);
  const detail = item ? catalogueDetails[item.slug] : null;
  const { openConsult } = useConsultation();
  usePageMeta(
    item ? `${item.name} | BDSM · BDS Marvel Catalogue` : "Catalogue | BDSM · BDS Marvel",
    item ? `${item.name} — sampled, finished and supplied by BDSM · BDS Marvel.` : "Browse the BDSM · BDS Marvel material library."
  );
  if (!item || !detail) return <Navigate to="/catalogue" replace />;
  const meta = item.meta || [item.material, item.product].filter(Boolean).join(" · ");
  const brand = item.brand || detail.brand;
  const chips = [item.material, item.product, item.origin, item.application].filter(Boolean);
  return <main className="cat-detail" data-testid="catalogue-detail-page">
    <section className="cat-detail-hero" style={{ backgroundImage: `linear-gradient(160deg, rgba(10,8,6,.86), rgba(10,8,6,.55)), url(${img(item.image)})` }}>
      <div className="detail-kicker"><span>BDSM · CATALOGUE</span><Link to={backTo} data-testid="detail-back-link">{backLabel}</Link></div>
      <div className="cat-detail-hero__copy">
        {brand && <p className="eyebrow" data-testid="detail-brand">{brand.toUpperCase()}</p>}
        <h1>{item.name}<span className="hero-dot">.</span></h1>
        <p className="detail-lede" data-testid="detail-description">{detail.desc}</p>
        <div className="detail-services">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
      </div>
    </section>
    <section className="cat-detail-gallery">
      <div className="detail-intro"><span className="section-index">01 — IN DETAIL</span><h2>Closer to<br /><em>the material.</em></h2></div>
      <div className="mat-gallery" data-testid="detail-material-gallery">{buildMaterialGallery(item, detail, img).map((m, index) => <figure key={m.src} className="mat-card" data-testid={`detail-gallery-card-${index + 1}`}>
        <Link to={`/catalogue/${item.slug}/${index + 1}`} state={location.state} className="mat-card__link" data-testid={`detail-gallery-link-${index + 1}`}>
          <div className="mat-card__img"><img src={m.src} alt={`${m.title} — ${m.material}`} loading="lazy" data-testid={`detail-gallery-image-${index + 1}`} /><span className="mat-card__view">VIEW <ArrowUpRight size={13} /></span></div>
          <figcaption><h3>{m.title}</h3></figcaption>
        </Link>
      </figure>)}</div>
    </section>
    <section className="cat-detail-specs">
      <div className="detail-intro"><span className="section-index">02 — SPECIFICATION</span><h2>Made to<br /><em>spec.</em></h2></div>
      <ul className="cat-spec-list" data-testid="detail-spec-list">{detail.specs.map(([label, value]) => <li key={label}><span>{label}</span>{value}</li>)}</ul>
    </section>
    <section className="detail-cta detail-cta--dark">
      <span className="section-index">READY WHEN YOU ARE</span>
      <h2>See it in<br /><em>your project.</em></h2>
      <div className="cat-detail-cta__actions">
        <SampleTrigger className="contact-cta-btn" product={item.name} brand={brand} testId="detail-request-sample-btn">REQUEST QUOTE</SampleTrigger>
        <button type="button" className="np-btn cat-detail-cta__consult" onClick={() => openConsult(detail.consult)} data-testid="detail-consult-btn">GET CONSULTATION <ArrowUpRight size={16} /></button>
      </div>
    </section>
  </main>;
}

function ExperiencePage() {
  usePageMeta("The BDSM Living Studio | Design Stay", "Stay inside a working BDSM · BDS Marvel home — three suites built with our own stone, floors, finishes and furniture.");
  return <main className="experience-page" data-testid="experience-page">
    <section className="experience-hero" style={{ backgroundImage: `linear-gradient(160deg, rgba(10,8,6,.55), rgba(10,8,6,.32)), url(${img("photo-1600585154340-be6161a56a0c")})` }}>
      <div className="detail-kicker"><span>BDSM · LIVING STUDIO</span><Link to="/" state={{ restore: true }} data-testid="experience-back-link">BACK HOME</Link></div>
      <div className="experience-hero__copy"><p className="eyebrow">BnB · LIVING STUDIO</p><h1>Don't just see,<br /><em>Stay in it.</em></h1><Link to="/stays?start=where" className="np-btn np-btn--paper" data-testid="experience-book-cta">REQUEST A NIGHT <ArrowUpRight size={16} /></Link></div>
    </section>
    <section className="experience-tiers" data-testid="experience-tiers">
      <div className="experience-tiers__heading"><span className="section-index">THREE WAYS TO STAY</span><h2>Three BnBs,<br /><em>three kinds of night.</em></h2></div>
      <div className="experience-tiers__grid">
        {stayTiers.map((tier) => {
          const first = stays.find((stay) => stay.tier === tier.name);
          return <Link to={`/stays/${tier.slug}`} className="stay-tier-card" key={tier.slug} data-testid={`experience-tier-${tier.slug}`}>
            <div className="stay-tier-card__media"><img src={img(first.hero, 900)} alt={`${tier.name} stays`} loading="lazy" /></div>
            <div className="stay-tier-card__body">
              <h3>{tier.headline}</h3>
              <span className="stay-tier-card__meta">{stays.filter((stay) => stay.tier === tier.name).length} stays · from {stays.filter((stay) => stay.tier === tier.name).map((stay) => stay.price).sort()[0]}/night</span>
              <span className="stay-tier-card__cta">EXPLORE &amp; BOOK <ArrowUpRight size={15} /></span>
            </div>
          </Link>;
        })}
      </div>
    </section>
    <section className="experience-gallery">
      <div className="experience-gallery__heading"><span className="section-index">02 — INSIDE</span><h2>Every surface,<br /><em>made by us.</em></h2></div>
      <div className="experience-gallery__grid">
        {["photo-1600585154340-be6161a56a0c", "photo-1600566753190-17f0baa2a6c3", "photo-1618221195710-dd6b41faaea6", "photo-1600607687939-ce8a6c25118c", "photo-1616486338812-3dadae4b4ace", "photo-1580587771525-78b9dba3b914"].map((imageId, index) => <figure className={`experience-gallery__tile experience-gallery__tile--${index + 1}`} key={imageId}><img src={img(imageId, 1200)} alt="" data-testid={`experience-image-${index + 1}`} /></figure>)}
      </div>
    </section>
    <section className="experience-cta">
      <div><span className="section-index">READY WHEN YOU ARE</span><h2>Book a night at<br /><em>the Living Studio.</em></h2><p>Availability is limited — we host a handful of stays each month between site visits.</p></div>
      <Link to="/stays?start=where" className="np-btn np-btn--solid experience-cta__btn" data-testid="experience-book-second">REQUEST A NIGHT <ArrowUpRight size={16} /></Link>
    </section>
  </main>;
}

function BookingModal({ stay, onClose }) {
  const [form, setForm] = useState({ name: "", email: "", checkIn: "", checkOut: "", guests: "2", message: "" });
  const [status, setStatus] = useState({ state: "idle", error: "" });
  const [booked, setBooked] = useState([]);
  const [pending, setPending] = useState([]);
  const firstFieldRef = useRef(null);
  const scrollResumeRef = useRef(null);
  const open = Boolean(stay);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    window.clearTimeout(scrollResumeRef.current);
    if (open) {
      setStatus({ state: "idle", error: "" });
      setForm({ name: "", email: "", checkIn: "", checkOut: "", guests: "2", message: "" });
      apiFetch(apiPath(`/stays/availability?stay=${encodeURIComponent(stay.name)}`))
        .then((res) => (res.ok ? res.json() : { booked: [], requested: [] }))
        .then((data) => { setBooked(data.booked || []); setPending(data.requested || []); })
        .catch(() => { setBooked([]); setPending([]); });
      window.setTimeout(() => firstFieldRef.current?.focus(), 80);
      document.body.style.overflow = "hidden";
      stopSmoothScroll();
      return () => { document.body.style.overflow = ""; };
    }
    document.body.style.overflow = "";
    scrollResumeRef.current = window.setTimeout(() => startSmoothScroll(), 60);
    return () => window.clearTimeout(scrollResumeRef.current);
  }, [open]);
  useEffect(() => { const onKey = (event) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const overlapping = booked.find((range) => form.checkIn && form.checkOut && form.checkIn < range.check_out && form.checkOut > range.check_in);

  const submit = async (event) => {
    event.preventDefault();
    if (form.checkOut && form.checkIn && form.checkOut <= form.checkIn) {
      setStatus({ state: "error", error: "Check-out must be after check-in." });
      return;
    }
    if (overlapping) {
      setStatus({ state: "error", error: `Those nights are already booked (${overlapping.check_in} to ${overlapping.check_out}). Please pick different dates.` });
      return;
    }
    setStatus({ state: "sending", error: "" });
    try {
      const response = await apiFetch(apiPath(`/bookings`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stay: stay.name, name: form.name.trim(), email: form.email.trim(), check_in: form.checkIn, check_out: form.checkOut, guests: Number(form.guests), message: form.message.trim() || null }) });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        const message = typeof detail?.detail === "string" ? detail.detail : detail?.detail?.[0]?.msg;
        throw new Error(message || "Please double-check your details and try again.");
      }
      setStatus({ state: "sent", error: "" });
    } catch (error) {
      setStatus({ state: "error", error: error.message || "Something went wrong. Please try again." });
    }
  };

  if (!open) return null;
  return <div className="contact-modal" role="dialog" aria-modal="true" aria-label="Book a stay" data-testid="booking-modal">
    <button className="contact-modal__scrim" onClick={onClose} aria-label="Close" data-testid="booking-modal-scrim" />
    <div className="contact-modal__panel">
      <button className="contact-modal__close" onClick={onClose} aria-label="Close" data-testid="booking-modal-close"><X size={22} /></button>
      <div className="contact-modal__intro">
        <span className="section-index">BOOK A STAY</span>
        <h2>{stay.name}</h2>
        <p>{stay.location} · from {stay.price}/night · sleeps {stay.guests}. Send your dates — we confirm availability within one working day.</p>
        <div className="contact-modal__meta"><span>info@bdsmarvel.com</span><span>{stay.location}</span></div>
      </div>
      {status.state === "sent" ? <div className="contact-modal__success" data-testid="booking-modal-success"><Check size={40} /><h3>Request received.</h3><p>Thanks — we'll confirm availability for {stay.name} within one working day and hold your dates in the meantime.</p><button onClick={onClose} data-testid="booking-modal-done">CLOSE</button></div> : <form className="contact-modal__form" onSubmit={submit} data-testid="booking-modal-form">
        <label className="cm-field"><span>Your name</span><input ref={firstFieldRef} required value={form.name} onChange={update("name")} placeholder="Riya Kapoor" data-testid="booking-name-input" /></label>
        <label className="cm-field"><span>Email</span><input required type="email" value={form.email} onChange={update("email")} placeholder="you@email.com" data-testid="booking-email-input" /></label>
        <label className="cm-field"><span>Check-in</span><input required type="date" min={today} value={form.checkIn} onChange={update("checkIn")} data-testid="booking-checkin-input" /></label>
        <label className="cm-field"><span>Check-out</span><input required type="date" min={form.checkIn || today} value={form.checkOut} onChange={update("checkOut")} data-testid="booking-checkout-input" /></label>
        {booked.length > 0 && <div className="cm-booked" data-testid="booking-booked-ranges"><span>Already booked:</span>{booked.map((range) => <em key={`${range.check_in}-${range.check_out}`}>{range.check_in} → {range.check_out}</em>)}</div>}
        {pending.length > 0 && <div className="cm-booked cm-booked--pending" data-testid="booking-pending-ranges"><span>Awaiting confirmation:</span>{pending.map((range) => <em key={`${range.check_in}-${range.check_out}`}>{range.check_in} → {range.check_out}</em>)}</div>}
        <label className="cm-field cm-field--full"><span>Guests</span><select value={form.guests} onChange={update("guests")} data-testid="booking-guests-select">{Array.from({ length: stay.guests }, (_, i) => i + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "guest" : "guests"}</option>)}</select></label>
        <label className="cm-field cm-field--full"><span>Anything we should know? (optional)</span><textarea rows={3} value={form.message} onChange={update("message")} placeholder="Arrival time, occasions, material walkthrough requests…" data-testid="booking-message-input" /></label>
        {status.state === "error" && <div className="cm-error" data-testid="booking-modal-error">{status.error}</div>}
        <button type="submit" className="cm-submit" disabled={status.state === "sending"} data-testid="booking-modal-submit">{status.state === "sending" ? <><Loader2 size={16} className="cm-spin" /> Sending…</> : <>REQUEST BOOKING <ArrowUpRight size={16} /></>}</button>
      </form>}
    </div>
  </div>;
}

function StayCard({ stay, index, onBook }) {
  return <article className={`stay-card ${index % 2 === 1 ? "stay-card--flip" : ""}`} data-testid={`stay-card-${stay.slug}`}>
    <div className="stay-card__media"><img src={img(stay.hero, 1200)} alt={stay.name} loading="lazy" /></div>
    <div className="stay-card__body">
      <span className="section-index">{String(index + 1).padStart(2, "0")}</span>
      <h2>{stay.name}</h2>
      <p className="stay-card__location">{stay.location} · {stay.bedrooms} {stay.bedrooms === 1 ? "bedroom" : "bedrooms"} · sleeps {stay.guests}</p>
      <p className="stay-card__description">{stay.description}</p>
      <ul className="stay-card__amenities">{stay.amenities.map((amenity) => <li key={amenity}>{amenity}</li>)}</ul>
      <div className="stay-card__footer">
        <span className="stay-card__price" data-testid={`stay-price-${stay.slug}`}>from <strong>{stay.price}</strong> / night</span>
        <button type="button" className="np-btn np-btn--solid" onClick={() => onBook(stay)} data-testid={`stay-book-${stay.slug}`}>BOOK THIS STAY <ArrowUpRight size={16} /></button>
      </div>
    </div>
  </article>;
}

function StaysPage() {
  usePageMeta("Stays & BnBs | BDSM · BDS Marvel", "Explore BDSM · BDS Marvel stays — premium, mid and budget-friendly BnBs across India. Book a night with secure online payment.");
  return <main className="stays-page" data-testid="stays-page">
    <section className="stays-hero">
      <div className="detail-kicker"><span>BDSM · STAYS</span><Link to="/experience" state={{ restore: true }} data-testid="stays-back-link">THE LIVING STUDIO</Link></div>
      <div className="stays-hero__copy"><p className="eyebrow">AIR BNB · THREE CATEGORIES</p><h1>Explore our BnBs.<br /><em>Book your night.</em></h1><p>Fifteen stays across three categories — premium homes where you experience our work first-hand, easy mid-range city apartments, and honest budget-friendly rooms. Pick your dates and guests, then pay securely online.</p></div>
    </section>
    <section className="experience-tiers" data-testid="stays-tier-index">
      <div className="experience-tiers__grid">
        {stayTiers.map((tier) => {
          const tierStays = stays.filter((stay) => stay.tier === tier.name);
          const lowest = tierStays.map((stay) => stay.price).sort()[0];
          return <Link to={`/stays/${tier.slug}`} className="stay-tier-card" key={tier.slug} data-testid={`stays-tier-${tier.slug}`}>
            <div className="stay-tier-card__media"><img src={img(tierStays[0].hero, 900)} alt={`${tier.name} stays`} /></div>
            <div className="stay-tier-card__body">
              <h3>{tier.headline}</h3>
              <p>{tier.copy}</p>
              <span className="stay-tier-card__meta">{tierStays.length} stays · from {lowest}/night</span>
              <span className="stay-tier-card__cta">EXPLORE STAYS <ArrowUpRight size={15} /></span>
            </div>
          </Link>;
        })}
      </div>
    </section>
  </main>;
}

function StaysCategoryPage() {
  const { tier } = useParams();
  const navigate = useNavigate();
  const meta = stayTiers.find((item) => item.slug === tier);
  const tierStays = stays.filter((stay) => tierSlugOf(stay.tier) === tier);
  usePageMeta(meta ? `${meta.name} Stays | BDSM · BDS Marvel` : "Stays | BDSM · BDS Marvel", meta ? `${meta.headline} ${meta.copy}` : "Explore BDSM · BDS Marvel stays.");
  if (!meta) return <Navigate to="/stays" replace />;
  return <main className="stays-page" data-testid="stays-category-page">
    <section className="stays-hero">
      <div className="detail-kicker"><span>BDSM · STAYS</span><Link to="/stays" state={{ restore: true }} data-testid="stays-category-back-link">ALL CATEGORIES</Link></div>
      <div className="stays-hero__copy"><p className="eyebrow">{tierStays.length} STAYS</p><h1>{meta.headline.replace(/\.$/, "")}<br /><em>Pick your stay.</em></h1></div>
    </section>
    <section className="stays-list" data-testid="stays-list">
      {tierStays.map((stay, index) => <StayCard key={stay.slug} stay={stay} index={index} onBook={(selected) => navigate(`/stays/home/${selected.slug}`)} />)}
    </section>
  </main>;
}

function ContactPage() {
  usePageMeta("Contact Us | BDSM · BDS Marvel", "Talk to BDSM · BDS Marvel about your project — studios in Mumbai, Kishangarh, Gurugram, Pune, New Delhi and Goa. We reply within one working day.");
  const { setOpen } = useContact();
  const cities = wordpressContent("cities", [
    { code: "MUM", brand: "BDSM", city: "Mumbai", address: "Sales & Design Studio · Kalina, Santacruz East, Mumbai, Maharashtra 400098" },
    { code: "KSN", brand: "DRAWSTONES", city: "Kishangarh", address: "Marble Workshop · RIICO Marble Zone, Kishangarh, Ajmer, Rajasthan 305801" },
    { code: "GGN", brand: "RENEST", city: "Gurugram", address: "Flooring Warehouse · Sector 49, Sohna Road, Gurugram, Haryana 122018" },
    { code: "PNE", brand: "FORMWORK", city: "Pune", address: "Construction Office · Baner-Pashan Link Road, Pune, Maharashtra 411045" },
    { code: "DEL", brand: "VIGNETTE", city: "New Delhi", address: "Interior Design Studio · Shahpur Jat, New Delhi 110049" },
    { code: "GOA", brand: "LIVING STUDIO", city: "Goa", address: "BDSM Living Studio · Assagao, Bardez, North Goa 403507" },
  ]);
  const [active, setActive] = useState(0);
  return <main className="contact-page" data-testid="contact-page">
    <section className="contact-page__hero"><h1>Come see<br /><em>the material.</em></h1></section>
    <section className="contact-page__body">
      <div className="contact-cities" data-testid="contact-cities">
        {cities.map((city, index) => <div className={`contact-accordion-item ${index === active ? "contact-accordion-item--active" : ""}`} key={city.code} data-testid={`contact-accordion-item-${city.code}`}>
          <button className={`contact-city ${index === active ? "contact-city--active" : ""}`} onClick={() => setActive(index)} aria-expanded={index === active} aria-controls={`contact-panel-${city.code}`} data-testid={`contact-city-${city.code}`}>
            <span className="contact-city__code">{city.brand}</span>
            <ChevronDown size={18} />
          </button>
          <div className="contact-accordion-panel" id={`contact-panel-${city.code}`} aria-hidden={index !== active} data-testid={`contact-panel-${city.code}`}>
            <div className="contact-accordion-panel__inner">
              <p className="contact-detail__location" data-testid={`active-city-name-${city.code}`}>{city.city}</p>
              <p className="contact-detail__address" data-testid={`active-city-address-${city.code}`}>{city.address}</p>
              <button className="contact-detail__cta" onClick={() => setOpen(true)} data-testid={`contact-get-in-touch-${city.code}`}>Get in Touch <ArrowUpRight size={16} /></button>
            </div>
          </div>
        </div>)}
        <div className="contact-page__info">
          <a href="mailto:info@bdsmarvel.com" data-testid="press-email">info@bdsmarvel.com</a>
          <a href="mailto:info.bdsmarvel@gmail.com" data-testid="bd-email">info.bdsmarvel@gmail.com</a>
          <p>Phone : <a href="tel:+911140000000" data-testid="contact-phone">+91 11 4000 0000</a></p>
          <div className="contact-page__socials">
            <a href="https://www.instagram.com/bds.marvel" target="_blank" rel="noreferrer" aria-label="Instagram" data-testid="social-instagram"><Instagram size={18} /></a>
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" data-testid="social-facebook"><Facebook size={18} /></a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter" data-testid="social-twitter"><Twitter size={18} /></a>
            <a href="https://www.linkedin.com/company/bdsm" target="_blank" rel="noreferrer" aria-label="LinkedIn" data-testid="social-linkedin"><Linkedin size={18} /></a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube" data-testid="social-youtube"><Youtube size={18} /></a>
          </div>
        </div>
      </div>
      <div className="contact-detail">
        <div className="contact-monument" aria-hidden="true">
          <svg viewBox="0 0 620 320" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            <g fill="none" stroke="#2b2b2b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 300 L600 300" />
              <path d="M120 300 L120 200 Q120 170 160 170 L200 170 Q240 170 240 200 L240 300" />
              <path d="M170 300 L170 200 Q170 180 185 180 Q200 180 200 200 L200 300" />
              <path d="M120 220 L240 220" />
              <path d="M380 300 L380 200 Q380 170 420 170 L460 170 Q500 170 500 200 L500 300" />
              <path d="M430 300 L430 200 Q430 180 445 180 Q460 180 460 200 L460 300" />
              <path d="M380 220 L500 220" />
              <path d="M250 300 L250 130 L370 130 L370 300" />
              <path d="M260 300 L260 145 L360 145 L360 300" />
              <path d="M280 300 L280 165 Q280 150 300 150 Q320 150 320 165 L320 300" />
              <path d="M300 150 L300 300" />
              <path d="M250 200 L370 200" />
              <path d="M250 250 L370 250" />
              <path d="M170 170 L170 140 L210 140 L210 170" />
              <path d="M175 140 L175 115 L205 115 L205 140" />
              <path d="M190 115 L190 95" />
              <path d="M186 95 L194 95 L190 82 Z" />
              <path d="M430 170 L430 140 L470 140 L470 170" />
              <path d="M435 140 L435 115 L465 115 L465 140" />
              <path d="M450 115 L450 95" />
              <path d="M446 95 L454 95 L450 82 Z" />
              <path d="M305 130 L305 100 L315 100 L315 130" />
              <path d="M310 100 L310 80" />
              <path d="M306 80 L314 80 L310 65 Z" />
              <circle cx="310" cy="180" r="6" />
            </g>
          </svg>
        </div>
      </div>
    </section>
  </main>;
}

function AboutPage() {
  usePageMeta("About Us | BDSM · BDS Marvel", "One design and build company for stone, flooring, construction and interiors — 20+ years, 200+ projects, studios across India.");
  const principles = wordpressContent("principles", [
    { number: "01", title: "Material comes first", text: "Before the drawing, we specify the stone or the surface. The rest of the project is designed around what the material actually wants to do." },
    { number: "02", title: "One accountable team", text: "Materials, flooring, construction and interiors all report into a single project lead. Fewer handovers, fewer things lost in translation." },
    { number: "03", title: "Detail is a discipline", text: "Every joint, threshold and reveal is drawn before it's built. Nothing is decided on site that could have been decided at the desk." },
    { number: "04", title: "Craft is not decorative", text: "Traditional cutting and finishing techniques are part of the engineering — not a nostalgia bolted on at the end." },
    { number: "05", title: "Experience over pitch", text: "Instead of a moodboard, we invite clients to stay in a space that uses our full palette. Specify from inside the reference." },
    { number: "06", title: "Long horizons", text: "We build for how a space looks in year ten, not the day it opens." },
  ]);
  const timeline = wordpressContent("timeline", [
    { year: "2003", event: "First quarry allocation in Kishangarh; workshop begins cutting and polishing." },
    { year: "2008", event: "Facade stone supply for the first hotel group project in Rajasthan." },
    { year: "2013", event: "Flooring line launched — contract SPC and hospitality-grade oak plank." },
    { year: "2017", event: "Construction team formed to close the loop from material to structure." },
    { year: "2020", event: "Interiors studio established for full design + execution." },
    { year: "2023", event: "BDSM · BDS Marvel brings stone, flooring, construction and interior decor under one roof — the Drawstones, Renest, Formwork and Vignette teams." },
    { year: "2024", event: "BDSM Living Studio opens in Goa as our public reference and stayable showroom." },
  ]);
  const team = wordpressContent("team", [
    { name: "Drawstones", role: "Materials & Sourcing", image: "photo-1618221195710-dd6b41faaea6" },
    { name: "Renest", role: "Specification & Distribution", image: "photo-1616486338812-3dadae4b4ace" },
    { name: "Formwork", role: "Structure & Site Management", image: "photo-1503387762-592deb58ef4e" },
    { name: "Vignette", role: "Design & Execution", image: "photo-1600585154340-be6161a56a0c" },
    { name: "Head of Craft", role: "Workshop & Fabrication", image: "photo-1600607687939-ce8a6c25118c" },
    { name: "Head of Living Studio", role: "B&B & Client Experience", image: "photo-1600566753190-17f0baa2a6c3" },
  ]);
  return <main className="about-page" data-testid="about-page">
    <section className="about-hero">
      <div className="detail-kicker"><span>BDSM · ABOUT</span><Link to="/" state={{ restore: true }} data-testid="about-back-link">BACK HOME</Link></div>
      <p className="eyebrow">THE STUDIO</p>
      <h1>One team, from<br /><em>quarry to keys.</em></h1>
      <div className="about-hero__lede">
        <p><strong>BDSM · BDS Marvel</strong> is one design and build company — stone, flooring, construction and interiors, handled in-house by our own teams: Drawstones, Renest, Formwork and Vignette. One contract, one accountable team, from facade to floor to furniture.</p>
        <p>The names are new — our people have built for the country's most demanding hotels, developers and civic projects for over twenty years.</p>
      </div>
    </section>

    <section className="about-strip">
      <div className="about-strip__stat"><CountUp value="20+" /><span>years of building</span></div>
      <div className="about-strip__stat"><CountUp value="04" /><span>in-house divisions</span></div>
      <div className="about-strip__stat"><CountUp value="05" /><span>cities operated from</span></div>
      <div className="about-strip__stat"><CountUp value="200+" /><span>projects delivered</span></div>
    </section>

    <section className="about-principles">
      <div className="about-section-heading"><span className="section-index">01 — HOW WE WORK</span><h2>Principles we<br /><em>run through everything.</em></h2></div>
      <div className="principles-grid">
        {principles.map((principle) => <article key={principle.number} className="principle-card" data-testid={`principle-${principle.number}`}>
          <span className="principle-card__number">{principle.number}</span>
          <h3>{principle.title}</h3>
          <p>{principle.text}</p>
        </article>)}
      </div>
    </section>

    <section className="about-timeline">
      <div className="about-section-heading"><span className="section-index">02 — HOW WE GOT HERE</span><h2>Twenty years,<br /><em>told briefly.</em></h2></div>
      <ol className="timeline-list">
        {timeline.map((item, index) => <li key={item.year} className="timeline-item" data-testid={`timeline-${item.year}`}>
          <div className="timeline-year"><span>{String(index + 1).padStart(2, "0")}</span><strong>{item.year}</strong></div>
          <p>{item.event}</p>
        </li>)}
      </ol>
    </section>

    <section className="about-team">
      <div className="about-section-heading"><span className="section-index">03 — THE PEOPLE</span><h2>People behind<br /><em>the work.</em></h2></div>
      <div className="team-grid">
        {team.map((member, index) => <article key={member.name} className="team-card" data-testid={`team-${index + 1}`}>
          <div className="team-card__image"><img src={img(member.image, 900)} alt="" /></div>
          <div className="team-card__body"><span>{member.role}</span><h3>{member.name}</h3></div>
        </article>)}
      </div>
      <p className="about-team__note">Team names and portraits are being finalised — reach out via <Link to="/contact">the contact page</Link> for direct leadership introductions.</p>
    </section>

    <section className="about-cta">
      <div><span className="section-index">READY WHEN YOU ARE</span><h2>Let's build<br /><em>something together.</em></h2><p>Bring us a site, a brief, or just a stone you'd like to use. We'll take it from there.</p></div>
      <ContactTrigger className="np-btn np-btn--paper" testId="about-cta-button">START A PROJECT</ContactTrigger>
    </section>
  </main>;
}

export { SegmentPage, ProjectPage, ProjectsArchive, CataloguePage, CatalogueProductPage, CatalogueItemPage, ExperiencePage, ContactPage, AboutPage };

const serviceExtras = wordpressContent("serviceExtras", {
  "interior-designing": {
    consultService: "Interior Design Consulting",
    consultLine: "Professional interior design consulting — from first concept to resolved detail.",
    consultCover: ["Concept & moodboards", "Space planning", "Material selection", "Finishes", "3D visualization", "Design detailing"],
  },
  construction: {
    consultService: "Construction Consulting",
    consultLine: "Construction consulting across planning, materials and on-site execution.",
    consultCover: ["Construction planning", "Material decisions", "Execution guidance", "Coordination", "Finishes", "Build-related decisions"],
    catalogue: [
      { slug: "tensile-structures", brand: "Formwork", name: "Tensile Structures", image: "photo-1784637663357-cfbf73b09c0d", desc: "Fabric shade canopies and membrane roofs.", meta: "Formwork · Shade" },
    ],
  },
  "marble-and-stone": {
    consultService: "Marble & Stone Consulting",
    consultLine: "Guidance on material selection, finishes, applications, combinations and suitability for your project.",
    consultCover: ["Material selection", "Finishes", "Applications", "Combinations", "Project suitability"],
    // Full DrawStones range — derived from the main catalogue so both pages stay in sync.
    catalogue: catalogueItems.filter((item) => item.brand === "DrawStones").map((item) => ({
      slug: item.slug,
      brand: item.brand,
      name: item.name,
      image: item.image,
      desc: (catalogueDetails[item.slug]?.desc || "").split(" — ")[0] || item.origin,
      meta: `${item.brand} · ${item.product}`,
    })),
  },
  flooring: {
    consultService: "Flooring Consulting",
    consultLine: "Flooring selection, finish, durability, application and coordination with the overall interior.",
    consultCover: ["Flooring selection", "Finish", "Durability", "Application", "Interior coordination"],
    catalogue: [
      { slug: "broadloom-carpets", brand: "Renest", name: "Broadloom Carpets", image: "photo-1660394585016-508f949df960", desc: "Wall-to-wall broadloom in wool and synthetic blends.", meta: "Renest · Carpet" },
      { slug: "carpet-tiles", brand: "Renest", name: "Carpet Tiles", image: "photo-1523350165414-082d792c4bcc", desc: "Modular carpet tiles for offices and contract floors.", meta: "Renest · Modular" },
      { slug: "carpets-rugs", brand: "Renest", name: "Carpets & Rugs", image: "photo-1572123979839-3749e9973aba", desc: "Hand-knotted and machine-made carpets and area rugs.", meta: "Renest · Rugs" },
      { slug: "commercial-flooring", brand: "Renest", name: "Commercial Flooring", image: "photo-1560185008-b033106af5c3", desc: "Hard-wearing floors for offices and retail.", meta: "Renest · Contract" },
      { slug: "deck-flooring", brand: "Renest", name: "Deck Flooring", image: "photo-1656646549633-80ad4bd2ab40", desc: "WPC and timber decking for outdoor areas.", meta: "Renest · Outdoor" },
      { slug: "gym-flooring", brand: "Renest", name: "Gym Flooring", image: "photo-1603665409265-bdc00027c217", desc: "Shock-absorbing rubber flooring for gyms.", meta: "Renest · Rubber" },
      { slug: "heavy-duty-doormats", brand: "Renest", name: "Heavy Duty Doormats", image: "photo-1574120583586-de8847ae992c", desc: "Entrance and dirt-barrier mats for high traffic.", meta: "Renest · Entrance" },
      { slug: "hospital-flooring", brand: "Renest", name: "Hospital Flooring", image: "photo-1581858726788-75bc0f6a952d", desc: "Antibacterial homogeneous vinyl for healthcare.", meta: "Renest · Healthcare" },
      { slug: "laminate-wooden-flooring", brand: "Renest", name: "Laminate / Wooden Flooring", image: "photo-1519393890420-f28727375fa5", desc: "Laminate and engineered wood plank floors.", meta: "Renest · Plank" },
      { slug: "lvt-flooring", brand: "Renest", name: "LVT Flooring", image: "photo-1598718544285-7180f670198b", desc: "Luxury vinyl tile in wood and stone looks.", meta: "Renest · Vinyl" },
      { slug: "school-flooring", brand: "Renest", name: "School Flooring", image: "photo-1613124152913-c180d8c1d740", desc: "Durable, safe flooring for schools and play areas.", meta: "Renest · Education" },
      { slug: "spc-flooring", brand: "Renest", name: "SPC Flooring", image: "photo-1548268364-3acee266b695", desc: "Rigid stone-polymer core click-lock floors.", meta: "Renest · Rigid" },
      { slug: "sports-flooring", brand: "Renest", name: "Sports Flooring", image: "photo-1610684082661-5d4763eecb39", desc: "Indoor court and multi-sport surfaces.", meta: "Renest · Sports" },
      { slug: "transport-flooring", brand: "Renest", name: "Transport Flooring", image: "photo-1768554630751-6448593749eb", desc: "Anti-slip flooring for buses, trains and transit.", meta: "Renest · Transit" },
      { slug: "vibrant-flooring", brand: "Renest", name: "Vibrant", image: "photo-1654605305001-8ec64a69c07c", desc: "Colourful, patterned flooring for creative spaces.", meta: "Renest · Colour" },
    ],
  },
  interiors: {
    consultService: "Interior Décor Consulting",
    consultLine: "Décor selection, lighting, accessories, textures, colours and finishing details.",
    consultCover: ["Décor selection", "Lighting", "Accessories", "Textures", "Colours", "Finishing details"],
    catalogue: [
      { slug: "decor-lighting", name: "Lighting", image: "photo-1747258818911-dfde27ecabba", desc: "Ambient, task and feature lighting.", meta: "Lighting · Mood" },
      { slug: "decor-pieces", name: "Décor Pieces", image: "photo-1600585154340-be6161a56a0c", desc: "Sculptural objects and statement pieces.", meta: "Décor · Object" },
      { slug: "decor-accessories", name: "Accessories", image: "photo-1618221195710-dd6b41faaea6", desc: "Considered accents that finish a room.", meta: "Accessory · Detail" },
      { slug: "decor-textures", name: "Textures", image: "photo-1780399334790-64af9ffb45fc", desc: "Lime plaster, linen, stone and wood.", meta: "Texture · Surface" },
      { slug: "decor-finishing", name: "Finishing Elements", image: "photo-1600566753190-17f0baa2a6c3", desc: "Hardware, trims and final touches.", meta: "Finish · Trim" },
      { slug: "artificial-plants-green-walls", brand: "Vignette", name: "Artificial Plants & Green Walls", image: "photo-1585506774639-5e2f8fda6352", desc: "Low-maintenance greenery and vertical gardens.", meta: "Vignette · Greenery" },
      { slug: "decorative-planters", brand: "Vignette", name: "Planters", image: "photo-1588440691140-09155c1be58a", desc: "Ceramic and stone planters and urns.", meta: "Vignette · Planters" },
      { slug: "garden-umbrella-gazebo", brand: "Vignette", name: "Garden Umbrella & Gazebo", image: "photo-1784454793008-3d6e632db3d7", desc: "Shade and outdoor living structures.", meta: "Vignette · Outdoor" },
    ],
  },
  furniture: {
    consultService: "Furniture Consulting",
    consultLine: "Furniture selection, sizing, materials, finishes, placement and custom furniture guidance.",
    consultCover: ["Furniture selection", "Sizing", "Materials & finishes", "Placement", "Custom furniture"],
    catalogue: [
      { slug: "sofas", name: "Sofas", image: "photo-1600607687939-ce8a6c25118c", desc: "Deep, tailored seating in soft upholstery.", meta: "Seating · Upholstery" },
      { slug: "tables", name: "Tables", image: "photo-1600585154340-be6161a56a0c", desc: "Stone, timber and cast tops.", meta: "Table · Surface" },
      { slug: "chairs", name: "Chairs", image: "photo-1631396326646-c06a935ff3a6", desc: "Dining, lounge and accent chairs.", meta: "Chair · Craft" },
      { slug: "custom-furniture", name: "Custom Furniture", image: "photo-1737467030068-88ad20e617ca", desc: "Bespoke joinery built to your brief.", meta: "Bespoke · Joinery" },
      { slug: "furniture-materials", name: "Materials & Finishes", image: "photo-1618221195710-dd6b41faaea6", desc: "Solid wood, stone, metal and lacquer.", meta: "Material · Finish" },
    ],
  },
});

const consultServices = Object.values(serviceExtras).map((extra) => extra.consultService);

function ConsultationModal() {
  const { open, service, closeConsult } = useConsultation();
  const empty = { name: "", phone: "", email: "", city: "", projectType: "", service: "", requirements: "", projectSize: "", budget: "" };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ state: "idle", error: "" });
  const firstFieldRef = useRef(null);
  const scrollResumeRef = useRef(null);

  useEffect(() => {
    window.clearTimeout(scrollResumeRef.current);
    if (open) {
      setStatus({ state: "idle", error: "" });
      setForm({ ...empty, service: service || "" });
      setFile(null);
      window.setTimeout(() => firstFieldRef.current?.focus(), 80);
      document.body.style.overflow = "hidden";
      stopSmoothScroll();
      return () => { document.body.style.overflow = ""; };
    }
    document.body.style.overflow = "";
    scrollResumeRef.current = window.setTimeout(() => startSmoothScroll(), 60);
    return () => window.clearTimeout(scrollResumeRef.current);
  }, [open, service]);
  useEffect(() => { const onKey = (event) => { if (event.key === "Escape") closeConsult(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [closeConsult]);

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ state: "sending", error: "" });
    try {
      let fileId = null;
      let fileName = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await apiFetch(apiPath(`/consultations/upload`), { method: "POST", body: fd });
        if (!up.ok) throw new Error("We couldn't upload that file. Try a smaller image or remove it.");
        const upData = await up.json();
        fileId = upData.id; fileName = upData.filename;
      }
      const response = await apiFetch(apiPath(`/consultations`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form,
          name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(),
          city: form.city.trim() || null, project_type: form.projectType || null,
          service: form.service, requirements: form.requirements.trim(),
          project_size: form.projectSize.trim() || null, budget: form.budget || null,
          file_id: fileId, file_name: fileName,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.detail?.[0]?.msg || detail?.detail || detail?.message || "Please double-check your details and try again.");
      }
      setStatus({ state: "sent", error: "" });
      setForm(empty); setFile(null);
    } catch (error) {
      setStatus({ state: "error", error: error.message || "Something went wrong. Please try again." });
    }
  };

  if (!open) return null;
  return <div className="contact-modal" role="dialog" aria-modal="true" aria-label="Request a consultation" data-testid="consultation-modal">
    <button className="contact-modal__scrim" onClick={closeConsult} aria-label="Close" data-testid="consultation-modal-scrim" />
    <div className="contact-modal__panel">
      <button className="contact-modal__close" onClick={closeConsult} aria-label="Close" data-testid="consultation-modal-close"><X size={22} /></button>
      <div className="contact-modal__intro">
        <span className="section-index">REQUEST A CONSULTATION</span>
        <h2>Let's plan it<br /><em>together.</em></h2>
        <p>Tell us about your project and pick the service you need guidance on. Our specialist will reply within one working day.</p>
        <div className="contact-modal__meta"><span>info@bdsmarvel.com</span><span>Mumbai · Kishangarh · Gurugram</span></div>
      </div>
      {status.state === "sent" ? <div className="contact-modal__success" data-testid="consultation-modal-success"><Check size={40} /><h3>Thanks — we've got it.</h3><p>{formSettings("consultations")?.success_message || "Your request has been received."}</p><button onClick={closeConsult} data-testid="consultation-modal-done">CLOSE</button></div> : <form className="contact-modal__form" onSubmit={submit} data-testid="consultation-modal-form">
        <DynamicFields slug="consultations" form={form} setForm={setForm} firstFieldRef={firstFieldRef} options={{ service: [{value:"",label:"Select a service"}, ...consultServices], projectType: [] }} file={file} setFile={setFile} />
        {status.state === "error" && <div className="cm-error" data-testid="consultation-modal-error">{status.error}</div>}
        <button type="submit" className="cm-submit" disabled={status.state === "sending" || !formSettings("consultations")?.enabled} data-testid="consultation-modal-submit">{status.state === "sending" ? <><Loader2 size={16} className="cm-spin" /> Sending…</> : <>{formSettings("consultations")?.submit_label || "REQUEST CONSULTATION"} <ArrowUpRight size={16} /></>}</button>
      </form>}
    </div>
  </div>;
}

function SampleModal() {
  const { open, product, brand, closeSample } = useSample();
  const empty = { name: "", email: "", phone: "", address: "", city: "", pincode: "", notes: "" };
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState({ state: "idle", error: "" });
  const firstFieldRef = useRef(null);
  const scrollResumeRef = useRef(null);

  useEffect(() => {
    window.clearTimeout(scrollResumeRef.current);
    if (open) {
      setStatus({ state: "idle", error: "" });
      setForm(empty);
      window.setTimeout(() => firstFieldRef.current?.focus(), 80);
      document.body.style.overflow = "hidden";
      stopSmoothScroll();
      return () => { document.body.style.overflow = ""; };
    }
    document.body.style.overflow = "";
    scrollResumeRef.current = window.setTimeout(() => startSmoothScroll(), 60);
    return () => window.clearTimeout(scrollResumeRef.current);
  }, [open]);
  useEffect(() => { const onKey = (event) => { if (event.key === "Escape") closeSample(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [closeSample]);

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ state: "sending", error: "" });
    try {
      const response = await apiFetch(apiPath(`/sample-requests`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form,
          product, brand: brand || null,
          name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
          address: form.address.trim(), city: form.city.trim() || null,
          pincode: form.pincode.trim() || null, notes: form.notes.trim() || null,
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.detail?.[0]?.msg || detail?.detail || detail?.message || "Please double-check your details and try again.");
      }
      setStatus({ state: "sent", error: "" });
      setForm(empty);
    } catch (error) {
      setStatus({ state: "error", error: error.message || "Something went wrong. Please try again." });
    }
  };

  if (!open) return null;
  return <div className="contact-modal" role="dialog" aria-modal="true" aria-label="Request a material sample" data-testid="sample-modal">
    <button className="contact-modal__scrim" onClick={closeSample} aria-label="Close" data-testid="sample-modal-scrim" />
    <div className="contact-modal__panel">
      <button className="contact-modal__close" onClick={closeSample} aria-label="Close" data-testid="sample-modal-close"><X size={22} /></button>
      <div className="contact-modal__intro">
        <span className="section-index">REQUEST A QUOTE</span>
        <h2>Get a price for<br /><em>your project.</em></h2>
        <p data-testid="sample-modal-product">{product}{brand ? ` · ${brand}` : ""} — tell us a little about your project and we will come back with pricing and lead times within one working day. Add a delivery or site address if you would also like physical samples.</p>
        <div className="contact-modal__meta"><span>info@bdsmarvel.com</span><span>Mumbai · Kishangarh · Gurugram</span></div>
      </div>
      {status.state === "sent" ? <div className="contact-modal__success" data-testid="sample-modal-success"><Check size={40} /><h3>Quote request received.</h3><p>{formSettings("sample-requests")?.success_message || "Your request has been received."}</p><button onClick={closeSample} data-testid="sample-modal-done">CLOSE</button></div> : <form className="contact-modal__form" onSubmit={submit} data-testid="sample-modal-form">
        <DynamicFields slug="sample-requests" form={form} setForm={setForm} firstFieldRef={firstFieldRef}  />
        {status.state === "error" && <div className="cm-error" data-testid="sample-modal-error">{status.error}</div>}
        <button type="submit" className="cm-submit" disabled={status.state === "sending" || !formSettings("sample-requests")?.enabled} data-testid="sample-modal-submit">{status.state === "sending" ? <><Loader2 size={16} className="cm-spin" /> Sending…</> : <>{formSettings("sample-requests")?.submit_label || "REQUEST QUOTE"} <ArrowUpRight size={16} /></>}</button>
      </form>}
    </div>
  </div>;
}

function InquiryModal() {
  const { open, brand, product, options, closeInquiry } = useInquiry();
  const empty = { name: "", email: "", phone: "", product: "", quantity: "", message: "" };
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState({ state: "idle", error: "" });
  const firstFieldRef = useRef(null);
  const scrollResumeRef = useRef(null);

  const derived = [...catalogueItems, ...Object.values(serviceExtras).flatMap((extra) => extra.catalogue || [])]
    .filter((entry) => (entry.brand || "").toLowerCase() === (brand || "").toLowerCase())
    .map((entry) => entry.name);
  const productOptions = options.length ? options : [...new Set(derived)];

  useEffect(() => {
    window.clearTimeout(scrollResumeRef.current);
    if (open) {
      setStatus({ state: "idle", error: "" });
      setForm({ ...empty, product: product || "" });
      window.setTimeout(() => firstFieldRef.current?.focus(), 80);
      document.body.style.overflow = "hidden";
      stopSmoothScroll();
      return () => { document.body.style.overflow = ""; };
    }
    document.body.style.overflow = "";
    scrollResumeRef.current = window.setTimeout(() => startSmoothScroll(), 60);
    return () => window.clearTimeout(scrollResumeRef.current);
  }, [open, product]);
  useEffect(() => { const onKey = (event) => { if (event.key === "Escape") closeInquiry(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [closeInquiry]);

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ state: "sending", error: "" });
    try {
      const response = await apiFetch(apiPath(`/product-inquiries`), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form,
          name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null,
          brand, product: form.product || null,
          quantity: form.quantity.trim() || null, message: form.message.trim(),
        }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.detail?.[0]?.msg || detail?.detail || detail?.message || "Please double-check your details and try again.");
      }
      setStatus({ state: "sent", error: "" });
      setForm(empty);
    } catch (error) {
      setStatus({ state: "error", error: error.message || "Something went wrong. Please try again." });
    }
  };

  if (!open) return null;
  return <div className="contact-modal" role="dialog" aria-modal="true" aria-label="Make a product inquiry" data-testid="inquiry-modal">
    <button className="contact-modal__scrim" onClick={closeInquiry} aria-label="Close" data-testid="inquiry-modal-scrim" />
    <div className="contact-modal__panel">
      <button className="contact-modal__close" onClick={closeInquiry} aria-label="Close" data-testid="inquiry-modal-close"><X size={22} /></button>
      <div className="contact-modal__intro">
        <span className="section-index">MAKE AN INQUIRY</span>
        <h2>Pricing, stock<br /><em>and lead times.</em></h2>
        <p data-testid="inquiry-modal-brand">Enquiring under {brand}. Tell us what you need and roughly how much — the {brand} desk replies within one working day.</p>
        <div className="contact-modal__meta"><span>info@bdsmarvel.com</span><span>Mumbai · Kishangarh · Gurugram</span></div>
      </div>
      {status.state === "sent" ? <div className="contact-modal__success" data-testid="inquiry-modal-success"><Check size={40} /><h3>Inquiry sent.</h3><p>{formSettings("product-inquiries")?.success_message || "Your request has been received."}</p><button onClick={closeInquiry} data-testid="inquiry-modal-done">CLOSE</button></div> : <form className="contact-modal__form" onSubmit={submit} data-testid="inquiry-modal-form">
        <DynamicFields slug="product-inquiries" form={form} setForm={setForm} firstFieldRef={firstFieldRef} options={{ product: [{value:"",label:"Multiple / not sure yet"}, ...productOptions] }} />
        {status.state === "error" && <div className="cm-error" data-testid="inquiry-modal-error">{status.error}</div>}
        <button type="submit" className="cm-submit" disabled={status.state === "sending" || !formSettings("product-inquiries")?.enabled} data-testid="inquiry-modal-submit">{status.state === "sending" ? <><Loader2 size={16} className="cm-spin" /> Sending…</> : <>{formSettings("product-inquiries")?.submit_label || "SEND INQUIRY"} <ArrowUpRight size={16} /></>}</button>
      </form>}
    </div>
  </div>;
}
export { ConsultationModal, SampleModal, InquiryModal };
