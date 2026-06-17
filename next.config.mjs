/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@react-pdf/renderer"],
  experimental: {
    serverComponentsExternalPackages: [
      "@remotion/renderer",
      "@remotion/compositor-linux-x64-gnu",
      "@sparticuz/chromium",
    ],
    // Bundle Remotion précompilé au build (build/) — pas de @remotion/bundler en prod.
    outputFileTracingIncludes: {
      "/api/generate-video": [
        "./build/**/*",
        "./node_modules/@remotion/compositor-linux-x64-gnu/**/*",
        "./node_modules/@sparticuz/chromium/**/*",
      ],
    },
    outputFileTracingExcludes: {
      "/api/generate-video": [
        "./node_modules/.cache/**/*",
        "./node_modules/@remotion/bundler/**/*",
        "./node_modules/@remotion/studio/**/*",
        "./node_modules/@rspack/**/*",
        "./node_modules/webpack/**/*",
        "./node_modules/typescript/**/*",
        "./node_modules/terser/**/*",
        "./node_modules/@esbuild/**/*",
        "./node_modules/@remotion/compositor-linux-x64-musl/**/*",
        "./node_modules/@remotion/compositor-darwin-*/**/*",
        "./node_modules/@remotion/compositor-win32-*/**/*",
        "./remotion/**/*",
        // Ne pas exclure build/**/*.map : @remotion/renderer lit bundle.js.map au runtime.
      ],
    },
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /\.node$/,
      loader: "node-loader",
    })
    return config
  },
}

export default nextConfig
