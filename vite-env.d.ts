/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_API_BASE_URL?: string;
  readonly VITE_ENABLE_SIDEBAR_TEST_CONTROLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
