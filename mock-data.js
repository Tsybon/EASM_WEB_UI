const MOCK_DATA = {
  organisations: [
    { id: "cip", name: "cip" },
    { id: "ngu", name: "ngu" },
    { id: "gpu", name: "gpu" }
  ],
  assets: [
    { organisation: "cip", type: "ip", value: "192.168.1.1", source: "NetBox" },
    { organisation: "cip", type: "ip", value: "192.168.1.2", source: "NetBox" },
    { organisation: "cip", type: "ip", value: "192.168.1.3", source: "NetBox" },
    { organisation: "cip", type: "ip", value: "192.168.1.4", source: "NetBox" },
    { organisation: "cip", type: "ip", value: "192.168.1.5", source: "NetBox" },
    { organisation: "cip", type: "ip", value: "192.168.1.6", source: "NetBox" },
    { organisation: "cip", type: "ip", value: "192.168.1.7", source: "NetBox" },
    { organisation: "cip", type: "ip", value: "192.168.1.8", source: "NetBox" },
    { organisation: "cip", type: "ip", value: "192.168.1.9", source: "NetBox" },
    { organisation: "cip", type: "ip", value: "192.168.1.10", source: "NetBox" },
    { organisation: "cip", type: "domain", value: "portal.cip.example.com", source: "NetBox" },

    { organisation: "ngu", type: "ip", value: "192.168.1.11", source: "NetBox" },
    { organisation: "ngu", type: "ip", value: "192.168.1.12", source: "NetBox" },
    { organisation: "ngu", type: "ip", value: "192.168.1.13", source: "NetBox" },
    { organisation: "ngu", type: "ip", value: "192.168.1.14", source: "NetBox" },
    { organisation: "ngu", type: "ip", value: "192.168.1.15", source: "NetBox" },
    { organisation: "ngu", type: "ip", value: "192.168.1.16", source: "NetBox" },
    { organisation: "ngu", type: "ip", value: "192.168.1.17", source: "NetBox" },
    { organisation: "ngu", type: "ip", value: "192.168.1.18", source: "NetBox" },
    { organisation: "ngu", type: "ip", value: "192.168.1.19", source: "NetBox" },
    { organisation: "ngu", type: "ip", value: "192.168.1.20", source: "NetBox" },
    { organisation: "ngu", type: "cidr", value: "10.20.0.0/24", source: "NetBox" },

    { organisation: "gpu", type: "ip", value: "192.168.1.21", source: "NetBox" },
    { organisation: "gpu", type: "ip", value: "192.168.1.22", source: "NetBox" },
    { organisation: "gpu", type: "ip", value: "192.168.1.23", source: "NetBox" },
    { organisation: "gpu", type: "ip", value: "192.168.1.24", source: "NetBox" },
    { organisation: "gpu", type: "ip", value: "192.168.1.25", source: "NetBox" },
    { organisation: "gpu", type: "ip", value: "192.168.1.26", source: "NetBox" },
    { organisation: "gpu", type: "ip", value: "192.168.1.27", source: "NetBox" },
    { organisation: "gpu", type: "ip", value: "192.168.1.28", source: "NetBox" },
    { organisation: "gpu", type: "ip", value: "192.168.1.29", source: "NetBox" },
    { organisation: "gpu", type: "ip", value: "192.168.1.30", source: "NetBox" },
    { organisation: "gpu", type: "domain", value: "gpu.example.com", source: "NetBox" }
  ],
  presets: [
    { name: "active_scan", modules: ["nmap", "screenshot"] },
    { name: "passive_scan", modules: ["scan_subdomain", "osint"] },
    { name: "full_scan", modules: ["scan_subdomain", "nmap", "osint", "screenshot"] },

    // PoC presets based on BBOT docs:
    // https://www.blacklanternsecurity.com/bbot/Stable/scanning/presets_list/
    { name: "subdomain-enum", modules: ["dnsbrute", "httpx", "wayback"] },
    { name: "tech-detect", modules: ["nuclei", "wappalyzer", "fingerprintx"] },
    { name: "web-screenshots", modules: ["gowitness", "httpx", "social"] }
  ],
  modules: [
    "scan_subdomain",
    "nmap",
    "osint",
    "screenshot",
    "dns_enum",
    "http_probe",
    "whois_lookup",
    "ssl_audit",
    "port_scan",
    "email_harvest",

    // PoC modules based on BBOT docs presets_list examples
    "dnsbrute",
    "httpx",
    "wayback",
    "nuclei",
    "wappalyzer",
    "fingerprintx",
    "gowitness",
    "social"
  ],
  moduleParameters: {
    scan_subdomain: [
      { key: "depth", label: "Depth", type: "number", default: 2, min: 1, max: 10 },
      { key: "wordlist", label: "Wordlist", type: "text", default: "subdomains-top1k.txt" },
      { key: "bruteforce", label: "Bruteforce", type: "boolean", default: false }
    ],
    nmap: [
      { key: "ports", label: "Ports", type: "text", default: "top-1000" },
      { key: "timing", label: "Timing", type: "text", default: "T3" },
      { key: "scripts", label: "Scripts", type: "text", default: "default" }
    ],
    osint: [
      { key: "provider", label: "Provider", type: "select", default: "shodan", options: ["shodan", "censys", "securitytrails"] },
      { key: "max_results", label: "Max results", type: "number", default: 100, min: 10, max: 10000 },
      { key: "api_key", label: "API key", type: "text", default: "" }
    ],
    screenshot: [
      { key: "viewport", label: "Viewport", type: "select", default: "1366x768", options: ["1024x768", "1366x768", "1920x1080"] },
      { key: "timeout_ms", label: "Timeout (ms)", type: "number", default: 8000, min: 1000, max: 60000 },
      { key: "full_page", label: "Full page", type: "boolean", default: true }
    ],
    dns_enum: [
      { key: "resolvers", label: "Resolvers", type: "text", default: "system" },
      { key: "timeout_ms", label: "Timeout (ms)", type: "number", default: 2000, min: 500, max: 10000 },
      { key: "retries", label: "Retries", type: "number", default: 2, min: 0, max: 10 }
    ],
    http_probe: [
      { key: "follow_redirects", label: "Follow redirects", type: "boolean", default: true },
      { key: "timeout_ms", label: "Timeout (ms)", type: "number", default: 5000, min: 500, max: 60000 },
      { key: "user_agent", label: "User-Agent", type: "text", default: "bbot-mvp" }
    ],
    whois_lookup: [
      { key: "privacy_redact", label: "Privacy redact", type: "boolean", default: true },
      { key: "timeout_ms", label: "Timeout (ms)", type: "number", default: 3000, min: 500, max: 20000 }
    ],
    ssl_audit: [
      { key: "min_tls", label: "Min TLS", type: "select", default: "1.2", options: ["1.0", "1.1", "1.2", "1.3"] },
      { key: "check_expiry_days", label: "Expiry threshold (days)", type: "number", default: 30, min: 1, max: 365 }
    ],
    port_scan: [
      { key: "ports", label: "Ports", type: "text", default: "1-1024" },
      { key: "concurrency", label: "Concurrency", type: "number", default: 200, min: 1, max: 5000 }
    ],
    email_harvest: [
      { key: "sources", label: "Sources", type: "text", default: "search,archives" },
      { key: "max_pages", label: "Max pages", type: "number", default: 3, min: 1, max: 50 }
    ],

    // PoC: params sampled from BBOT preset YAML examples:
    // https://www.blacklanternsecurity.com/bbot/Stable/scanning/presets_list/
    dnsbrute: [
      { key: "threads", label: "Threads", type: "number", default: 25, min: 1, max: 5000 },
      { key: "brute_threads", label: "Brute threads", type: "number", default: 1000, min: 1, max: 100000 }
    ],
    httpx: [
      { key: "timeout_s", label: "Timeout (s)", type: "number", default: 10, min: 1, max: 120 },
      { key: "follow_redirects", label: "Follow redirects", type: "boolean", default: true }
    ],
    wayback: [
      { key: "max_urls", label: "Max URLs", type: "number", default: 200, min: 1, max: 100000 },
      { key: "include_subdomains", label: "Include subdomains", type: "boolean", default: true }
    ],
    nuclei: [
      { key: "tags", label: "Template tags", type: "text", default: "tech" },
      { key: "severity", label: "Severity", type: "select", default: "medium", options: ["info", "low", "medium", "high", "critical"] }
    ],
    wappalyzer: [
      { key: "categories", label: "Categories", type: "text", default: "all" },
      { key: "confidence_min", label: "Min confidence", type: "number", default: 50, min: 0, max: 100 }
    ],
    fingerprintx: [
      { key: "aggressive", label: "Aggressive", type: "boolean", default: false },
      { key: "max_fingerprints", label: "Max fingerprints", type: "number", default: 25, min: 1, max: 5000 }
    ],
    gowitness: [
      { key: "resolution_x", label: "Resolution X", type: "number", default: 1440, min: 320, max: 8000 },
      { key: "resolution_y", label: "Resolution Y", type: "number", default: 900, min: 240, max: 8000 },
      { key: "output_path", label: "Output path", type: "text", default: "" },
      { key: "social", label: "Include social pages", type: "boolean", default: true }
    ],
    social: [{ key: "enabled", label: "Enabled", type: "boolean", default: true }]
  },

  // PoC: sampled docs metadata (keep UI offline; do not fetch at runtime).
  docs: {
    sources: [
      {
        label: "BBOT presets list",
        url: "https://www.blacklanternsecurity.com/bbot/Stable/scanning/presets_list/"
      },
      {
        label: "BBOT presets (dev)",
        url: "https://www.blacklanternsecurity.com/bbot/Stable/dev/presets/"
      }
    ],
    presets: {
      "subdomain-enum": {
        description: "Enumerate subdomains via APIs, brute-force.",
        url: "https://www.blacklanternsecurity.com/bbot/Stable/scanning/presets_list/#subdomain-enum"
      },
      "tech-detect": {
        description: "Detect technologies via Wappalyzer, Nuclei, and FingerprintX.",
        url: "https://www.blacklanternsecurity.com/bbot/Stable/scanning/presets_list/#tech-detect"
      },
      "web-screenshots": {
        description: "Take screenshots of webpages.",
        url: "https://www.blacklanternsecurity.com/bbot/Stable/scanning/presets_list/#web-screenshots"
      }
    },
    modules: {
      dnsbrute: {
        description: "DNS brute-force / mutations (see subdomain-enum example).",
        url: "https://www.blacklanternsecurity.com/bbot/Stable/scanning/presets_list/#subdomain-enum"
      },
      nuclei: {
        description: "Template-based scanning (see tech-detect example: `tags: tech`).",
        url: "https://www.blacklanternsecurity.com/bbot/Stable/scanning/presets_list/#tech-detect"
      },
      gowitness: {
        description: "Take web screenshots (see web-screenshots example: resolution + output_path).",
        url: "https://www.blacklanternsecurity.com/bbot/Stable/scanning/presets_list/#web-screenshots"
      }
    }
  }
};
