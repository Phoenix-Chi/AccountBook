declare module 'next-pwa' {
  import { NextConfig } from 'next';

  interface PWAConfig {
    dest?: string;
    disable?: boolean;
    register?: boolean;
    scope?: string;
    sw?: string;
    runtimeCaching?: Array<{
      urlPattern: string | RegExp | ((params: { url: URL }) => boolean);
      handler: string;
      options?: {
        cacheName?: string;
        expiration?: {
          maxEntries?: number;
          maxAgeSeconds?: number;
        };
        cacheableResponse?: {
          statuses: number[];
          headers: { [key: string]: string };
        };
      };
    }>;
    skipWaiting?: boolean;
    publicExcludes?: string[];
    buildExcludes?: string[];
  }

  function withPWA(config: PWAConfig): (nextConfig: NextConfig) => NextConfig;
  export default withPWA;
}