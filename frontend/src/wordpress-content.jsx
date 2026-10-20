import React from "react";

const DEFAULT_FORMS = {
  consultations: [
    { name: "name", label: "Your name", type: "text", required: true, placeholder: "Riya Kapoor" },
    { name: "phone", label: "Phone", type: "text", required: true, placeholder: "+91 98xxxxxxxx" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "you@brand.com" },
    { name: "city", label: "City", type: "text", required: false, placeholder: "Jaipur" },
    {
      name: "projectType",
      label: "Project type",
      type: "select",
      required: false,
      options: [
        { value: "", label: "Select" },
        { value: "Residential", label: "Residential" },
        { value: "Hospitality", label: "Hospitality" },
        { value: "Commercial", label: "Commercial" },
        { value: "Retail", label: "Retail" },
        { value: "Institutional", label: "Institutional" },
      ],
    },
    { name: "service", label: "Service", type: "select", required: true, options: [{ value: "", label: "Select a service" }] },
    { name: "projectSize", label: "Project size", type: "text", required: false, placeholder: "e.g. 1800 sqft / 3BHK" },
    {
      name: "budget",
      label: "Budget range",
      type: "select",
      required: false,
      options: [
        { value: "", label: "Prefer not to say" },
        { value: "under-25L", label: "Under ₹25L" },
        { value: "25L-1Cr", label: "₹25L – ₹1Cr" },
        { value: "1-5Cr", label: "₹1Cr – ₹5Cr" },
        { value: "5Cr-plus", label: "₹5Cr +" },
      ],
    },
    { name: "requirements", label: "Requirements", type: "textarea", required: true, placeholder: "Brief, materials in mind, timelines — anything helps." },
    { name: "file", label: "Reference image / file (optional)", type: "file", required: false },
  ],
  "sample-requests": [
    { name: "name", label: "Your name", type: "text", required: true, placeholder: "Riya Kapoor" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "you@brand.com" },
    { name: "phone", label: "Phone", type: "text", required: true, placeholder: "+91 98xxxxxxxx" },
    { name: "city", label: "City", type: "text", required: false, placeholder: "Jaipur" },
    { name: "address", label: "Shipping address (optional)", type: "textarea", required: false, placeholder: "Studio or site address the sample should reach" },
    { name: "pincode", label: "Pincode", type: "text", required: false, placeholder: "302001" },
    { name: "notes", label: "Notes (optional)", type: "text", required: false, placeholder: "Finish, thickness, timeline…" },
  ],
  "product-inquiries": [
    { name: "name", label: "Your name", type: "text", required: true, placeholder: "Riya Kapoor" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "you@brand.com" },
    { name: "phone", label: "Phone (optional)", type: "text", required: false, placeholder: "+91 98xxxxxxxx" },
    { name: "product", label: "Product interest", type: "select", required: false, options: [{ value: "", label: "Multiple / not sure yet" }] },
    { name: "quantity", label: "Approx. quantity", type: "text", required: false, placeholder: "e.g. 200 sqft · 40 sheets · 12 rooms" },
    { name: "message", label: "Your requirement", type: "textarea", required: true, placeholder: "Project, finishes in mind, delivery city, timeline — anything helps." },
  ],
  inquiries: [
    { name: "name", label: "Your name", type: "text", required: true, placeholder: "Riya Kapoor" },
    { name: "email", label: "Work email", type: "email", required: true, placeholder: "you@brand.com" },
    { name: "company", label: "Company / Studio", type: "text", required: false, placeholder: "BDSM" },
    { name: "segment", label: "What does your project need?", type: "select", required: false, options: [{ value: "", label: "Not sure yet" }] },
    {
      name: "budget",
      label: "Rough budget",
      type: "select",
      required: false,
      options: [
        { value: "", label: "Prefer not to say" },
        { value: "under-25L", label: "Under ₹25L" },
        { value: "25L-1Cr", label: "₹25L – ₹1Cr" },
        { value: "1-5Cr", label: "₹1Cr – ₹5Cr" },
        { value: "5Cr-plus", label: "₹5Cr +" },
      ],
    },
    { name: "message", label: "Tell us about the project", type: "textarea", required: true, placeholder: "Site, brief, materials in mind — anything helps." },
  ],
  "quote-requests": [
    { name: "name", label: "Your name", type: "text", required: true, placeholder: "Riya Kapoor" },
    { name: "phone", label: "Phone", type: "text", required: true, placeholder: "+91 98xxxxxxxx" },
    { name: "email", label: "Email", type: "email", required: true, placeholder: "you@brand.com" },
    { name: "city", label: "City", type: "text", required: false, placeholder: "Jaipur" },
    { name: "notes", label: "Project / Material notes", type: "textarea", required: false, placeholder: "Rough dimensions, quantities, delivery city…" },
  ],
};

export const wordpressContent = (key, fallback) => {
  if (typeof window !== "undefined" && window.BDS_WORDPRESS?.content?.[key] !== undefined) {
    return window.BDS_WORDPRESS.content[key];
  }
  return fallback;
};

export const formSettings = (slug, fallback = {}) => {
  if (typeof window !== "undefined" && window.BDS_WORDPRESS?.forms?.[slug]) {
    return window.BDS_WORDPRESS.forms[slug];
  }
  return {
    enabled: true,
    submit_label: null,
    success_message: null,
    ...fallback,
  };
};

export function DynamicFields({ slug, form, setForm, firstFieldRef, options = {}, file, setFile }) {
  const fields = (typeof window !== "undefined" && window.BDS_WORDPRESS?.forms?.[slug]?.fields) || DEFAULT_FORMS[slug] || [];

  return (
    <>
      {fields.map((f, idx) => {
        if (f.enabled === false) return null;
        const isFull = f.type === "textarea" || f.type === "file" || f.name === "message" || f.name === "requirements" || f.name === "address";
        const isFirst = idx === 0;
        const refProp = isFirst ? { ref: firstFieldRef } : {};

        if (f.type === "file") {
          return (
            <label key={f.name} className={`cm-field ${isFull ? "cm-field--full" : ""}`}>
              <span>{f.label}</span>
              <input
                type="file"
                onChange={(e) => setFile && setFile(e.target.files?.[0] || null)}
                accept="image/*,.pdf"
              />
            </label>
          );
        }

        if (f.type === "select") {
          const selectOptions = options[f.name] || f.options || [];
          return (
            <label key={f.name} className={`cm-field ${isFull ? "cm-field--full" : ""}`}>
              <span>{f.label}{f.required ? " *" : ""}</span>
              <select
                {...refProp}
                name={f.name}
                value={form[f.name] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                required={f.required}
              >
                {selectOptions.map((opt, i) => {
                  const val = typeof opt === "object" ? opt.value : opt;
                  const lbl = typeof opt === "object" ? opt.label : opt;
                  return (
                    <option key={i} value={val}>
                      {lbl}
                    </option>
                  );
                })}
              </select>
            </label>
          );
        }

        if (f.type === "textarea") {
          return (
            <label key={f.name} className={`cm-field ${isFull ? "cm-field--full" : ""}`}>
              <span>{f.label}{f.required ? " *" : ""}</span>
              <textarea
                {...refProp}
                name={f.name}
                value={form[f.name] || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                placeholder={f.placeholder}
                required={f.required}
              />
            </label>
          );
        }

        return (
          <label key={f.name} className={`cm-field ${isFull ? "cm-field--full" : ""}`}>
            <span>{f.label}{f.required ? " *" : ""}</span>
            <input
              {...refProp}
              type={f.type || "text"}
              name={f.name}
              value={form[f.name] || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
              placeholder={f.placeholder}
              required={f.required}
            />
          </label>
        );
      })}
    </>
  );
}
