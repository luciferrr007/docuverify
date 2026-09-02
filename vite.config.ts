import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    base: "/docuverify/",
  },

  tanstackStart: {
    prerender: {
      enabled: true,
      autoStaticPathsDiscovery: true,
      crawlLinks: false,
    },
  },
});