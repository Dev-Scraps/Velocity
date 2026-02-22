fn main() {
  // Copy resources during build if they exist
  let resources_src = "resources";
  let resources_dst = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap())
    .parent()
    .unwrap()
    .parent()
    .unwrap()
    .parent()
    .unwrap()
    .join("resources");

  if std::path::Path::new(resources_src).exists() {
    println!("cargo:warning=Copying resources from {} to {}", resources_src, resources_dst.display());
    // Resources are handled by tauri.conf.json bundle.resources configuration
    // This script just adds a warning during build
  }

  tauri_build::build()
}
