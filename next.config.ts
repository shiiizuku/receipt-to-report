import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["pg", "exceljs", "pdfkit", "bcryptjs"],
};

export default config;
