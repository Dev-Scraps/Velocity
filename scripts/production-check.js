/**
 * Production readiness checks
 * Verifies all production requirements are met before deployment
 */

import fs from "fs";
import path from "path";

/** @typedef {{name: string, passed: boolean, message: string, severity: 'critical'|'warning'|'info'}} CheckResult */

/** @type {CheckResult[]} */
const results = [];

/**
 * Record a check result
 * @param {string} name
 * @param {boolean} condition
 * @param {string} message
 * @param {'critical'|'warning'|'info'} severity
 */
function check(name, condition, message, severity = "critical") {
  results.push({ name, passed: condition, message, severity });
  console.log(
    `${condition ? "✓" : severity === "critical" ? "✗" : "⚠"} ${name}: ${message}`,
  );
}

console.log("\n=== Production Readiness Check ===\n");

// Version consistency
console.log("📦 Version Consistency:");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
const tauriConf = JSON.parse(
  fs.readFileSync("src-tauri/tauri.conf.json", "utf-8"),
);
const cargoToml = fs.readFileSync("src-tauri/Cargo.toml", "utf-8");
const cargoVersion = cargoToml.match(/^version = "([^"]+)"/m)?.[1];

check("Package version", packageJson.version, packageJson.version);
check(
  "Tauri config version",
  tauriConf.version === packageJson.version,
  `Tauri: ${tauriConf.version}, Package: ${packageJson.version}`,
  tauriConf.version === packageJson.version ? "info" : "critical",
);
check(
  "Cargo version",
  cargoVersion === packageJson.version,
  `Cargo: ${cargoVersion}, Package: ${packageJson.version}`,
  cargoVersion === packageJson.version ? "info" : "critical",
);

// Environment configuration
console.log("\n🔧 Environment Configuration:");
check(
  ".env file exists",
  fs.existsSync("src-tauri/.env"),
  "src-tauri/.env found",
  "warning",
);
check(
  ".env.example exists",
  fs.existsSync(".env.example"),
  ".env.example found",
  "info",
);

// Required binaries
console.log("\n📁 Required Binaries:");
const platforms = ["windows", "macos", "linux"];
const binaries = ["ffmpeg", "yt-dlp", "ffprobe"];

platforms.forEach((platform) => {
  const dir = `src-tauri/resources/binaries/${platform}`;
  const exists = fs.existsSync(dir);
  check(
    `${platform} binaries`,
    exists,
    exists ? "directory found" : "directory NOT FOUND",
    "critical",
  );

  if (exists && platform === "windows") {
    binaries.forEach((binary) => {
      const binaryPath = `${dir}/${binary}.exe`;
      const exists = fs.existsSync(binaryPath);
      check(
        `  - ${binary}.exe`,
        exists,
        exists ? "found" : "NOT FOUND",
        "critical",
      );
    });
  }
});

// Security configuration
console.log("\n🔐 Security Configuration:");
check(
  "CSP policy",
  tauriConf.app?.security?.csp !== null,
  "Content Security Policy configured",
  "warning",
);
check(
  "HTTPS for YouTube",
  tauriConf.app?.security?.csp?.includes("https://www.youtube.com"),
  "YouTube API allowed in CSP",
  "warning",
);

// Code quality
console.log("\n📝 Code Quality:");
const srcDir = "src";
const tsFiles = fs
  .readdirSync(srcDir, { recursive: true })
  .filter((f) => typeof f === "string" && f.endsWith(".tsx"));
const hasAnyType = Array.from(tsFiles).some((f) => {
  const content = fs.readFileSync(path.join(srcDir, f), "utf-8");
  return /:\s*any/g.test(content);
});
check(
  'No "any" types',
  !hasAnyType,
  hasAnyType ? 'Found "any" types' : 'No "any" types found',
  hasAnyType ? "warning" : "info",
);

// Build configuration
console.log("\n🏗️  Build Configuration:");
check(
  "vite.config.ts exists",
  fs.existsSync("vite.config.ts"),
  "Vite config found",
);
check(
  "tsconfig.json exists",
  fs.existsSync("tsconfig.json"),
  "TypeScript config found",
);
check(
  "eslint.config.js exists",
  fs.existsSync("eslint.config.js"),
  "ESLint config found",
);
check(
  "tailwind.config.js exists",
  fs.existsSync("tailwind.config.js"),
  "Tailwind config found",
);

// Documentation
console.log("\n📚 Documentation:");
check("README.md", fs.existsSync("README.md"), "README found", "info");
check("LICENSE", fs.existsSync("LICENSE"), "LICENSE found", "info");
check(
  "Release notes",
  fs.existsSync(`RELEASE_NOTES_${packageJson.version}.md`),
  `RELEASE_NOTES_${packageJson.version}.md found`,
  "warning",
);

// Summary
console.log("\n=== Summary ===\n");
const critical = results.filter((r) => !r.passed && r.severity === "critical");
const warnings = results.filter((r) => !r.passed && r.severity === "warning");
const passed = results.filter((r) => r.passed);

console.log(`✓ Passed: ${passed.length}`);
console.log(`⚠ Warnings: ${warnings.length}`);
console.log(`✗ Critical: ${critical.length}`);

if (critical.length > 0) {
  console.log("\n❌ PRODUCTION CHECKS FAILED - Critical issues found:\n");
  critical.forEach((r) => console.log(`  - ${r.name}: ${r.message}`));
  process.exit(1);
}

if (warnings.length > 0) {
  console.log("\n⚠️  PRODUCTION CHECKS PASSED - But warnings present:\n");
  warnings.forEach((r) => console.log(`  - ${r.name}: ${r.message}`));
}

console.log("\n✅ All production checks passed!\n");
