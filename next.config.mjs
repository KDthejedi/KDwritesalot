/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit reads .afm font-metric files from its own package directory at
  // runtime. Keeping it external (not bundled by webpack) ensures those data
  // files resolve correctly in the server build.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
