import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // native modules used by the server-side face engine and the database client
  serverExternalPackages: ["onnxruntime-node", "sharp", "@libsql/client", "libsql"],
  // keep serverless bundles small: only the Linux x64 binaries are needed on Vercel
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/onnxruntime-node/bin/napi-v6/darwin/**",
      "./node_modules/onnxruntime-node/bin/napi-v6/win32/**",
      "./node_modules/@libsql/darwin-*/**",
      "./node_modules/@libsql/win32-*/**",
      "./node_modules/@img/sharp-darwin-*/**",
      "./node_modules/@img/sharp-libvips-darwin-*/**",
      "./node_modules/@img/sharp-win32-*/**",
      "./node_modules/@img/sharp-linuxmusl-*/**",
      "./node_modules/@img/sharp-libvips-linuxmusl-*/**",
      "./models/**",
      "./data/**",
    ],
  },
  poweredByHeader: false,
};

export default nextConfig;
