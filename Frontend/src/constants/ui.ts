/**
 * UI Constants — Extracted magic numbers for maintainability
 * Zentralisierte UI-Konfiguration für Zoom, Layout-Dimensionen und Timeouts
 */

// ============================================================================
// ZOOM — Grid-Ansicht (uiSlice)
// ============================================================================
export const GRID_ZOOM_MIN = 50;
export const GRID_ZOOM_MAX = 200;
export const GRID_ZOOM_STEP = 10;
export const GRID_ZOOM_DEFAULT = 100;

// ============================================================================
// ZOOM — Lightbox (lightboxStore)
// ============================================================================
export const LIGHTBOX_ZOOM_MIN = 50;
export const LIGHTBOX_ZOOM_MAX = 300;
export const LIGHTBOX_ZOOM_STEP = 25;
export const LIGHTBOX_ZOOM_DEFAULT = 100;

// ============================================================================
// LAYOUT — Panel-Dimensionen
// ============================================================================
export const SIDEBAR_WIDTH_DEFAULT = 280;
export const SIDEBAR_WIDTH_MIN = 180;
export const SIDEBAR_WIDTH_MAX = 500;
export const TAG_PANEL_WIDTH_DEFAULT = 320;
export const TAG_PANEL_WIDTH_MIN = 200;
export const TAG_PANEL_WIDTH_MAX = 600;

// ============================================================================
// TOASTS — Anzeigedauer (ms)
// ============================================================================
export const TOAST_DURATION_DEFAULT = 4000;
export const TOAST_DURATION_ERROR = 6000;
export const TOAST_DURATION_WARNING = 5000;
