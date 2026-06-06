/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_WS_BASE?: string;
  readonly VITE_MOCK?: string;
  readonly VITE_SHOPEE_BASE?: string;
  readonly VITE_SHOPEE_LISTING_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
