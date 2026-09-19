import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // situs statis untuk Firebase Hosting (hasil build di folder `out`)
  output: "export",
  // /login -> /login/index.html, cocok dengan cara Firebase Hosting menyajikan file
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
