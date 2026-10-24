fn main() {
    // Keep the previous Node-binding comparison experiment intact.
    slint_build::compile("ui/focus.slint")
        .expect("Native Challenger Focus/Orbit UI compilation failed");
    println!("cargo:rerun-if-changed=ui/focus.slint");
    println!("cargo:rerun-if-changed=ui/orbit-app-128.png");
}
