/// <reference types="vite/client" />

/**
 * Typed access to the build-time environment.
 *
 * Only variables prefixed with `VITE_` are exposed to the browser bundle.
 * Provider secrets must never appear here — they belong to the backend.
 */
interface ImportMetaEnv {
  /** Origin of the API, without a trailing slash. */
  readonly VITE_API_BASE_URL?: string;
  /** `mock` serves fixtures from MSW; `live` calls a real backend. */
  readonly VITE_API_MODE?: 'mock' | 'live';
  /** Shows the "sample data" banner. */
  readonly VITE_SHOW_PROTOTYPE_BANNER?: string;
  /** `demo` labels synthetic data; `student_testing` shows capability-specific status. */
  readonly VITE_PRODUCT_MODE?: 'demo' | 'student_testing';
  /** Dev-only proxy target for the Vite dev server. */
  readonly VITE_DEV_API_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
