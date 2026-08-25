fn main() {
    #[cfg(feature = "tauri-ui")]
    tauri_build::build();
    #[cfg(feature = "pi-native")]
    slint_build::compile("ui/pi/main.slint").expect("slint ui");
}
