fn main() {
    slint_build::compile("../slint-node-bridge/main.slint")
        .expect("Native Challenger Slint UI compilation failed");
    println!("cargo:rerun-if-changed=../slint-node-bridge/main.slint");
}
