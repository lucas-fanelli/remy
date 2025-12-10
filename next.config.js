const withSerwist = require("@serwist/next").default({
    swSrc: "src/sw.ts",
    swDest: "public/sw.js",
    // Only disable service worker in dev server mode, not during production build
    disable: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Force webpack mode - Serwist doesn't support Turbopack yet
    turbopack: {},
};

module.exports = withSerwist(nextConfig);
