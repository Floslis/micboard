// ─────────────────────────────────────────────────────────────
// MicBoard – Core Type Definitions
// ─────────────────────────────────────────────────────────────

/** A person who can be assigned to a slot */
export interface User {
  id: string
  displayName: string      // Short name shown on display (e.g. "Max")
  fullName: string         // Full name used in admin (e.g. "Max Mustermann")
  image?: string           // Path within data-repo: "images/user1.webp"
  imagePosition?: {        // CSS background-position (percentage)
    x: number
    y: number
  }
  imageScale?: number      // Zoom factor 1.0–3.0
  color?: string           // Accent hex color e.g. "#6366f1"
  tags?: string[]          // Optional labels: ["worship", "tech"]
  role?: string            // Optional role description
  active?: boolean         // Whether the user is currently available
  temporary?: boolean      // If true: auto-deleted when unassigned from all slots
  createdAt?: string       // ISO date string
  updatedAt?: string
}

/** A single slot within a display (= one mic / one position) */
export interface Slot {
  id: string
  name: string             // e.g. "Prediger", "Vox 1", "Gitarre"
  userId?: string          // ID of the assigned user (undefined = empty)
  order: number            // Display order within the display
  color?: string           // Optional slot accent color override
}

/** A full display configuration */
export interface Display {
  id: string
  name: string             // e.g. "Hauptbühne", "Backstage"
  description?: string
  slots: Slot[]
  layout?: DisplayLayout   // How slots are arranged
  theme?: DisplayTheme
  slotWidth?: number       // Fixed slot width in px; undefined = auto (equal columns)
  slotGap?: number         // Gap between slots in px; default 12
  aspectRatio?: DisplayAspectRatio  // Screen format for preview calculations
  updatedAt?: string
}

export type DisplayLayout      = 'grid' | 'row' | 'column'
export type DisplayTheme       = 'dark' | 'light' | 'cinema'
export type DisplayAspectRatio = '16:9' | '21:9' | '32:9'

/** Global application settings stored in config/settings.json */
export interface AppSettings {
  pollInterval: number     // ms between display refresh polls (default 8000)
  theme: DisplayTheme
  appTitle: string         // Shown in browser title
  showClock: boolean       // Whether to show a clock on display pages
  animateTransitions: boolean
  defaultLayout: DisplayLayout
  updatedAt?: string
}

/** Wrapper around a remote data object with metadata */
export interface RemoteData<T> {
  data: T
  sha: string              // Required for updates (GitHub needs the existing SHA)
  path: string
}

export type OperationState = 'idle' | 'loading' | 'saving' | 'error' | 'success'
