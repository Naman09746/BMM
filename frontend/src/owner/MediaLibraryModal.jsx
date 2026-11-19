import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  UploadCloud,
  Search,
  Check,
  Trash2,
  Copy,
  Image as ImageIcon,
  Film,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { api, resolveBackendMedia } from "../stays/store";

export function MediaLibraryModal({ isOpen, onClose, onSelectMedia, currentSelectedUrl }) {
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api("/admin/media");
      const list = Array.isArray(res) ? res : [];
      setMediaList(list);
      if (list.length > 0 && !selectedItem) {
        setSelectedItem(list[0]);
      }
    } catch (err) {
      setError(err.message || "Failed to load media assets");
    } finally {
      setLoading(false);
    }
  }, [selectedItem]);

  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [isOpen, loadMedia]);

  const handleUploadFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api("/admin/media/upload", { method: "POST", body: formData });
      await loadMedia();
      if (res && res.url) {
        const uploadedItem = { url: res.url, filename: res.filename, size: res.size, content_type: res.content_type };
        setSelectedItem(uploadedItem);
        if (onSelectMedia) {
          // If in select mode, highlight this new upload
        }
      }
    } catch (err) {
      setError(err.message || "Upload failed. Please check file format and size (max 15MB).");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename) => {
    if (!filename) return;
    if (!window.confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api(`/admin/media/${encodeURIComponent(filename)}`, { method: "DELETE" });
      setMediaList((prev) => prev.filter((m) => m.filename !== filename));
      if (selectedItem?.filename === filename) {
        setSelectedItem(null);
      }
    } catch (err) {
      alert("Failed to delete media: " + err.message);
    }
  };

  const copyUrl = (url) => {
    if (!url) return;
    const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    navigator.clipboard?.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredMedia = mediaList.filter((m) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (m.filename || "").toLowerCase().includes(term) || (m.original_name || "").toLowerCase().includes(term);
  });

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="ws-modal-backdrop" data-testid="media-library-modal">
      <div className="ws-modal-card ws-media-modal">
        {/* Header */}
        <div className="ws-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="ws-modal-icon-badge"><ImageIcon size={18} /></div>
            <div>
              <h2 className="ws-modal-title">Central Media Library</h2>
              <p className="ws-modal-subtitle">Browse, upload, and manage verified images & video assets for the live website.</p>
            </div>
          </div>
          <button type="button" className="ws-modal-close" onClick={onClose} data-testid="close-media-modal">
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="ws-media-toolbar">
          <div className="ws-media-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search media by filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="media-search-input"
            />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label className="ws-btn ws-btn--primary ws-btn--upload" data-testid="media-upload-btn">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
                onChange={(e) => handleUploadFile(e.target.files?.[0])}
                style={{ display: "none" }}
                disabled={uploading}
              />
              {uploading ? <Loader2 size={14} className="od-spin" /> : <UploadCloud size={14} />}
              <span>{uploading ? "Uploading..." : "Upload New Asset"}</span>
            </label>
            <button type="button" className="ws-btn ws-btn--ghost" onClick={loadMedia} title="Refresh media library">
              <RefreshCw size={14} className={loading ? "od-spin" : ""} />
            </button>
          </div>
        </div>

        {error && <div className="ws-alert ws-alert--error">{error}</div>}

        {/* Main Content: Gallery + Inspector */}
        <div className="ws-media-body">
          {/* Grid Area */}
          <div
            className={`ws-media-grid-area ${dragActive ? "is-dragover" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleUploadFile(file);
            }}
          >
            {loading ? (
              <div className="ws-center-box"><Loader2 size={24} className="od-spin" /><p>Loading media assets...</p></div>
            ) : filteredMedia.length === 0 ? (
              <div className="ws-empty-box">
                <ImageIcon size={36} />
                <p>No media files found{search ? ` matching "${search}"` : ""}.</p>
                <span>Upload a JPG, PNG, WEBP, GIF, or MP4 (max 15MB) above.</span>
              </div>
            ) : (
              <div className="ws-media-thumbnails">
                {filteredMedia.map((item) => {
                  const isSelected = selectedItem?.filename === item.filename || currentSelectedUrl === item.url;
                  const isVideo = (item.content_type || "").includes("video") || (item.filename || "").endsWith(".mp4");
                  const thumbSrc = resolveBackendMedia(item.url || item.filename);

                  return (
                    <div
                      key={item.id || item.filename}
                      className={`ws-media-thumb ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedItem(item)}
                      data-testid={`media-item-${item.filename}`}
                    >
                      <div className="ws-thumb-frame">
                        {isVideo ? (
                          <div className="ws-video-thumb">
                            <Film size={26} />
                            <span>MP4 Video</span>
                          </div>
                        ) : (
                          <img src={thumbSrc} alt={item.original_name || item.filename} loading="lazy" />
                        )}
                        {isSelected && <span className="ws-thumb-check"><Check size={12} /></span>}
                      </div>
                      <span className="ws-thumb-label">{item.original_name || item.filename}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Details Sidebar */}
          {selectedItem && (
            <div className="ws-media-details-panel" data-testid="media-details-panel">
              <div className="ws-details-preview">
                {(selectedItem.content_type || "").includes("video") || (selectedItem.filename || "").endsWith(".mp4") ? (
                  <video src={resolveBackendMedia(selectedItem.url)} controls style={{ width: "100%", maxHeight: 180, borderRadius: 8 }} />
                ) : (
                  <img src={resolveBackendMedia(selectedItem.url || selectedItem.filename)} alt={selectedItem.filename} />
                )}
              </div>

              <div className="ws-details-meta">
                <h4>{selectedItem.original_name || selectedItem.filename}</h4>
                <div className="ws-meta-row">
                  <span>Format</span>
                  <code>{selectedItem.content_type || "image/jpeg"}</code>
                </div>
                <div className="ws-meta-row">
                  <span>File size</span>
                  <span>{formatBytes(selectedItem.size)}</span>
                </div>
                {selectedItem.uploaded_at && (
                  <div className="ws-meta-row">
                    <span>Uploaded</span>
                    <span>{new Date(selectedItem.uploaded_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                )}
                <div className="ws-meta-row">
                  <span>Path</span>
                  <code style={{ fontSize: 10, wordBreak: "break-all" }}>{selectedItem.url}</code>
                </div>
              </div>

              <div className="ws-details-actions">
                {onSelectMedia && (
                  <button
                    type="button"
                    className="ws-btn ws-btn--primary ws-btn--full"
                    onClick={() => {
                      onSelectMedia(selectedItem.url);
                      onClose();
                    }}
                    data-testid="use-media-btn"
                  >
                    <Check size={14} /> Use This Asset
                  </button>
                )}

                <button
                  type="button"
                  className="ws-btn ws-btn--secondary ws-btn--full"
                  onClick={() => copyUrl(selectedItem.url)}
                  data-testid="copy-media-url-btn"
                >
                  <Copy size={13} /> {copied ? "Copied URL!" : "Copy Asset URL"}
                </button>

                <button
                  type="button"
                  className="ws-btn ws-btn--danger ws-btn--full"
                  onClick={() => handleDelete(selectedItem.filename)}
                  data-testid="delete-media-btn"
                >
                  <Trash2 size={13} /> Delete File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MediaLibraryModal;

