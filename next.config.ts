import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Самодостаточная сборка: .next/standalone содержит server.js и только
  // реально используемые зависимости. Нужно для образа на hostit.mifcom.dev —
  // без этого в контейнер пришлось бы тащить весь node_modules.
  output: "standalone",
};

export default nextConfig;
