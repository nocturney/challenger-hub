fn main() {
    // Keep the previous Node-binding comparison experiment intact.
    slint_build::compile("ui/focus.slint")
        .expect("Native Challenger Focus/Orbit UI compilation failed");
    println!("cargo:rerun-if-changed=ui/focus.slint");
    println!("cargo:rerun-if-changed=ui/approved-gallery.slint");
    println!("cargo:rerun-if-changed=ui/screenshots");
    println!("cargo:rerun-if-changed=ui/icons");
    println!("cargo:rerun-if-changed=ui/APPROVED_GALLERY_INDEX.json");
    for asset in [
        "orbit-app-128.png",
        "dune3d.svg", "dune3d.png",
        "material-maker-icon.png", "material-maker.png",
        "compositor-icon.png", "kiri-moto-icon.png",
        "espocrm-icon.png", "docuseal-icon.svg",
        "meshcentral-icon.png", "openhands-icon.png",
        "real-video-enhancer-icon.svg", "real-video-enhancer.png",
        "craft-photocraft-icon.png",
        "craft-lightcraft-icon.png",
        "craft-filmcraft-icon.png",
        "craft-designcraft-icon.png",
        "craft-vectorcraft-icon.png",
        "craft-pdfcraft-icon.png",
        "craft-effectcraft-icon.png",
        "craft-wordcraft-icon.png",
        "craft-deckcraft-icon.png",
        "craft-gridcraft-icon.png",
        "craft-cadcraft-icon.png",
        "craft-soundcraft-icon.png",
        "craft-figcraft-icon.png",
    ] {
        println!("cargo:rerun-if-changed=ui/{asset}");
    }
}
