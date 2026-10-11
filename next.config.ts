import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  outputFileTracingRoot: path.join(__dirname),
  serverActions: {
    bodySizeLimit: "8mb",
  },
};

export default nextConfig;
