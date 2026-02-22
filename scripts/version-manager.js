#!/usr/bin/env node

/**
 * Version Management Utility
 * Syncs version across all project files
 *
 * Usage:
 *   npm run version:sync              # Display current version
 *   npm run version:sync -- --check   # Check version consistency
 *   npm run version:sync -- --set 1.0.1  # Set new version
 */

const fs = require("fs");
const path = require("path");

// Configuration
const FILES_TO_UPDATE = [
  "package.json",
  "src-tauri/Cargo.toml",
  "src-tauri/tauri.conf.json",
];

const CURRENT_DIR = process.cwd();

class VersionManager {
  constructor() {
    this.versions = {};
    this.issues = [];
  }

  /**
   * Get current version from package.json
   */
  getCurrentVersion() {
    try {
      const packagePath = path.join(CURRENT_DIR, "package.json");
      const content = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      return content.version;
    } catch (error) {
      this.issues.push(`Failed to read current version: ${error.message}`);
      return null;
    }
  }

  /**
   * Check version consistency across all files
   */
  checkConsistency() {
    const versionMap = new Map();

    for (const file of FILES_TO_UPDATE) {
      const filePath = path.join(CURRENT_DIR, file);

      if (!fs.existsSync(filePath)) {
        this.issues.push(`File not found: ${file}`);
        continue;
      }

      let version = null;

      try {
        const content = fs.readFileSync(filePath, "utf8");

        if (file.endsWith(".json")) {
          // JSON files
          const data = JSON.parse(content);
          version = data.version || data.package?.version;
        } else if (file.includes("Cargo.toml")) {
          // Cargo.toml
          const match = content.match(/^version\s*=\s*"([^"]+)"/m);
          version = match ? match[1] : null;
        }

        if (version) {
          this.versions[file] = version;
          versionMap.set(version, (versionMap.get(version) || 0) + 1);
        } else {
          this.issues.push(`Could not extract version from: ${file}`);
        }
      } catch (error) {
        this.issues.push(`Error reading ${file}: ${error.message}`);
      }
    }

    // Check if all versions match
    const uniqueVersions = versionMap.size;
    if (uniqueVersions > 1) {
      this.issues.push(
        `Version mismatch detected. Found versions: ${Array.from(versionMap.keys()).join(", ")}`,
      );
    }

    return uniqueVersions === 1;
  }

  /**
   * Update version in all files
   */
  setVersion(newVersion) {
    let successCount = 0;

    for (const file of FILES_TO_UPDATE) {
      const filePath = path.join(CURRENT_DIR, file);

      if (!fs.existsSync(filePath)) {
        this.issues.push(`File not found: ${file}`);
        continue;
      }

      try {
        let content = fs.readFileSync(filePath, "utf8");
        let updated = false;

        if (file === "package.json") {
          const data = JSON.parse(content);
          if (data.version !== newVersion) {
            data.version = newVersion;
            content = JSON.stringify(data, null, 2) + "\n";
            updated = true;
          }
        } else if (file === "src-tauri/tauri.conf.json") {
          const data = JSON.parse(content);
          if (data.productVersion !== newVersion) {
            data.productVersion = newVersion;
            if (data.package && data.package.version) {
              data.package.version = newVersion;
            }
            content = JSON.stringify(data, null, 2) + "\n";
            updated = true;
          }
        } else if (file.includes("Cargo.toml")) {
          // Update Cargo.toml
          const pattern = /^(version\s*=\s*)"[^"]+"/m;
          if (pattern.test(content)) {
            content = content.replace(pattern, `$1"${newVersion}"`);
            updated = true;
          }
        }

        if (updated) {
          fs.writeFileSync(filePath, content, "utf8");
          successCount++;
          console.log(`✓ Updated ${file} to ${newVersion}`);
        } else {
          console.log(`- ${file} already at ${newVersion}`);
        }
      } catch (error) {
        this.issues.push(`Error updating ${file}: ${error.message}`);
      }
    }

    return successCount;
  }

  /**
   * Display version info
   */
  display() {
    console.log("\n" + "=".repeat(50));
    console.log("VERSION REPORT");
    console.log("=".repeat(50));

    if (Object.keys(this.versions).length === 0) {
      console.log("No versions found.");
      return;
    }

    console.log("\nFile Versions:");
    for (const [file, version] of Object.entries(this.versions)) {
      console.log(`  ${file.padEnd(30)} ${version}`);
    }

    const isConsistent = new Set(Object.values(this.versions)).size === 1;
    console.log(`\nConsistency: ${isConsistent ? "✓ OK" : "✗ MISMATCH"}`);

    if (this.issues.length > 0) {
      console.log("\nIssues:");
      for (const issue of this.issues) {
        console.log(`  ⚠ ${issue}`);
      }
    }

    console.log("=".repeat(50) + "\n");
  }
}

// Main execution
async function main() {
  const manager = new VersionManager();
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "--set" && args[1]) {
    // Set new version
    const newVersion = args[1];
    console.log(`Setting version to ${newVersion}...`);

    manager.setVersion(newVersion);

    // Verify
    manager.checkConsistency();
    manager.display();

    if (manager.issues.length > 0) {
      process.exit(1);
    }
  } else if (command === "--check") {
    // Check consistency
    const consistent = manager.checkConsistency();
    manager.display();

    if (!consistent) {
      console.error("\n❌ Version mismatch detected!");
      console.error("Run: npm run version:sync -- --set <version>");
      process.exit(1);
    }
  } else {
    // Default: display current version
    const currentVersion = manager.getCurrentVersion();
    manager.checkConsistency();
    manager.display();

    if (currentVersion) {
      console.log(`Current version: ${currentVersion}\n`);
    }
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
