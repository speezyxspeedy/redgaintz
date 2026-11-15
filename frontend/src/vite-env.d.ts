/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CESIUM_ION_ACCESS_TOKEN?: string;
  readonly VITE_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv & {
    readonly BASE_URL: string;
    readonly DEV: boolean;
  };
}
