//! Non-sensitive, versioned native user preferences. No account, token or telemetry data.
use serde::{Deserialize, Serialize};
use std::{fs::{self, OpenOptions}, io::Write, path::{Path, PathBuf}};

const SCHEMA: u8 = 1;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Preferences {
    pub schema: u8,
    pub appearance: String,
    pub motion: String,
    pub high_contrast: bool,
}

impl Default for Preferences {
    fn default() -> Self {
        Self { schema: SCHEMA, appearance: "system".into(),
            motion: "system".into(), high_contrast: false }
    }
}

impl Preferences {
    pub fn valid(&self) -> bool {
        self.schema == SCHEMA
            && ["system", "light", "dark"].contains(&self.appearance.as_str())
            && ["system", "reduce", "full"].contains(&self.motion.as_str())
    }

    pub fn dark_mode(&self) -> bool {
        match self.appearance.as_str() {
            "dark" => true,
            "light" => false,
            _ => system_dark_mode(),
        }
    }

    pub fn reduced_motion(&self, system_reduced: bool) -> bool {
        match self.motion.as_str() {
            "reduce" => true,
            "full" => false,
            _ => system_reduced,
        }
    }
}

pub fn path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    { return std::env::var_os("APPDATA").map(|p| PathBuf::from(p)
        .join("Challenger Hub").join("preferences.json")); }
    #[cfg(target_os = "macos")]
    { return std::env::var_os("HOME").map(|p| PathBuf::from(p)
        .join("Library/Application Support/Challenger Hub/preferences.json")); }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let base = std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME")
                .map(|p| PathBuf::from(p).join(".config")));
        base.map(|p| p.join("challenger-hub/preferences.json"))
    }
}

pub fn read(path: &Path) -> Result<Preferences, String> {
    let data = match fs::read(path) {
        Ok(bytes) if bytes.len() <= 4096 => bytes,
        Ok(_) => return Err("Preferences file exceeds size limit".into()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound =>
            return Ok(Preferences::default()),
        Err(e) => return Err(format!("Cannot read preferences: {e}")),
    };
    let prefs: Preferences = serde_json::from_slice(&data)
        .map_err(|_| "Preferences file has unsupported or invalid data".to_string())?;
    if !prefs.valid() { return Err("Unsupported preference values or schema".into()); }
    Ok(prefs)
}

pub fn write(path: &Path, preferences: &Preferences) -> Result<(), String> {
    if !preferences.valid() { return Err("Refusing invalid preferences".into()); }
    let parent = path.parent().ok_or("Preferences path has no parent")?;
    fs::create_dir_all(parent).map_err(|e| format!("Cannot create preferences directory: {e}"))?;
    let tmp = parent.join(format!(".preferences-{}.tmp", std::process::id()));
    let write_result = (|| -> Result<(), String> {
        let mut options = OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
        let mut file = options.open(&tmp)
            .map_err(|e| format!("Cannot open preferences staging file: {e}"))?;
        serde_json::to_writer_pretty(&mut file, preferences)
            .map_err(|e| format!("Cannot serialize preferences: {e}"))?;
        file.write_all(b"\n").map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| format!("Cannot sync preferences: {e}"))?;
        drop(file);
        fs::rename(&tmp, path).map_err(|e| format!("Cannot save preferences: {e}"))?;
        Ok(())
    })();
    if write_result.is_err() { let _ = fs::remove_file(&tmp); }
    write_result
}

pub fn system_dark_mode() -> bool {
    #[cfg(target_os = "macos")]
    {
        return std::process::Command::new("/usr/bin/defaults")
            .args(["read", "-g", "AppleInterfaceStyle"]).output()
            .map(|r| r.status.success() &&
                String::from_utf8_lossy(&r.stdout).trim() == "Dark")
            .unwrap_or(false);
    }
    #[cfg(target_os = "windows")]
    {
        return std::process::Command::new("reg.exe")
            .args(["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize",
                   "/v", "AppsUseLightTheme"]).output()
            .map(|r| r.status.success() &&
                String::from_utf8_lossy(&r.stdout).to_ascii_lowercase().contains("0x0"))
            .unwrap_or(false);
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("gsettings")
            .args(["get", "org.gnome.desktop.interface", "color-scheme"]).output()
            .map(|r| r.status.success() &&
                String::from_utf8_lossy(&r.stdout).contains("prefer-dark"))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn default_uses_system_and_requires_known_schema() {
        let p = Preferences::default();
        assert!(p.valid());
        assert!(!p.high_contrast);
        assert_eq!(p.motion, "system");
        assert_eq!(p.appearance, "system");
        assert!(!Preferences { appearance: "violet".into(), ..p.clone() }.valid());
        assert!(!Preferences { schema: 10, ..p.clone() }.valid());
        assert_eq!(Preferences { motion: "full".into(), ..p }.reduced_motion(true), false);
    }
    #[test]
    fn file_round_trip_and_corruption_fail_closed() {
        let dir = std::env::temp_dir().join(format!("challenger-prefs-{}", std::process::id()));
        let path = dir.join("preferences.json");
        let expected = Preferences { appearance: "dark".into(),
            motion: "reduce".into(), high_contrast: true, ..Default::default() };
        write(&path, &expected).unwrap();
        assert_eq!(read(&path).unwrap(), expected);
        assert!(expected.dark_mode());
        assert!(expected.reduced_motion(false));
        fs::write(&path, br#"{"schema":1,"appearance":"other","motion":"full","high_contrast":true}"#).unwrap();
        assert!(read(&path).is_err());
        fs::write(&path, vec![b'X'; 4100]).unwrap();
        assert!(read(&path).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
}
