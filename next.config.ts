import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** pg und nodemailer laufen nur serverseitig und werden nicht gebündelt. */
  serverExternalPackages: ["pg", "nodemailer"],
  poweredByHeader: false,
  experimental: {
    /** Server-Actions dürfen die üblichen Formulargrößen annehmen. */
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // Der Kalenderfeed wird von Outlook abgerufen und darf nicht im
        // Zwischenspeicher eines Proxys landen – er ist personenbezogen.
        source: "/api/ical/:token",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
