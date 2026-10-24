fn main() {
    // Keep the previous Node-binding comparison experiment intact.
    slint_build::compile("ui/focus.slint")
        .expect("Native Challenger Focus/Orbit UI compilation failed");
    println!("cargo:rerun-if-changed=ui/focus.slint");
    for asset in [
        "orbit-app-128.png",
        "dune3d.svg", "dune3d.png",
        "material-maker-icon.png", "material-maker.png",
        "compositor-icon.png", "kiri-moto-icon.png",
        "espocrm-icon.png", "docuseal-icon.svg",
        "meshcentral-icon.png", "openhands-icon.png",
        "real-video-enhancer-icon.svg", "real-video-enhancer.png",
    ] {
        println!("cargo:rerun-if-changed=ui/{asset}");
    }
}
