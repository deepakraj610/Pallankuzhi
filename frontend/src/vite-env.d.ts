/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  /** 'true' builds the offline app: games run on the device, there is no server or login. */
  readonly VITE_STANDALONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
