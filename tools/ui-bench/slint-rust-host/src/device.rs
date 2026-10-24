//! Explicit, bounded, native OS software-discovery evidence.
//!
//! Not an installer, updater, privileged host probe or authoritative inventory:
//! macOS: named .app bundles at known application roots;
//! Windows: registered Add/Remove Programs entries (not portable apps);
//! Linux: desktop launcher entries (not packages without launchers).
//! Never inspect user documents, program contents, networks, portable drives
//! or unrelated filesystem roots. Only run on an explicit UI action.

use std::time::{SystemTime, UNIX_EPOCH};

pub const MAX_ENTRIES: usize = 512;
const MAX_NAME: usize = 120;
const MAX_IDENTIFIER: usize = 160;
const MAX_VERSION: usize = 64;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DeviceApp {
    pub name: String,
    /// Original OS registration key (Windows: version-specific MSI ProductCode).
    pub identifier: String,
    /// Windows only: fixed, upstream-reviewed MSI UpgradeCode corroborated by
    /// the Installer UpgradeCodes->ProductCode association. Never name-derived.
    pub stable_identifier: String,
    pub version: String,
    pub provenance: String,
}

#[derive(Clone, Debug)]
pub struct DeviceSnapshot {
    pub platform: &'static str,
    pub scope: &'static str,
    pub status: &'static str,
    pub timestamp_ms: u64,
    pub entries: Vec<DeviceApp>,
    pub truncated: bool,
}

fn trimmed(input: &str, max_chars: usize) -> String {
    input.trim().chars().filter(|c| !c.is_control())
        .take(max_chars).collect::<String>().trim().to_string()
}

fn organize(input: Vec<DeviceApp>) -> (Vec<DeviceApp>, bool) {
    let mut unique = std::collections::HashSet::new();
    let mut found = Vec::new();
    // Do not assume a display name is a globally unique installed identity.
    for app in input {
        let name = trimmed(&app.name, MAX_NAME);
        if name.is_empty() { continue; }
        let identifier = trimmed(&app.identifier, MAX_IDENTIFIER);
        let stable_identifier = trimmed(&app.stable_identifier, MAX_IDENTIFIER);
        let version = trimmed(&app.version, MAX_VERSION);
        let provenance = trimmed(&app.provenance, 48);
        if provenance.is_empty() { continue; }
        let key = (name.to_lowercase(), identifier.to_lowercase(), provenance.clone());
        if unique.insert(key) {
            found.push(DeviceApp { name, identifier, stable_identifier, version, provenance });
        }
    }
    found.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase())
        .then_with(|| a.provenance.cmp(&b.provenance)));
    let truncated = found.len() > MAX_ENTRIES;
    found.truncate(MAX_ENTRIES);
    (found, truncated)
}

pub fn collect() -> Result<DeviceSnapshot, String> {
    #[cfg(target_os = "macos")]
    let (rows, scope) = (macos::enumerate()?, "known-application-bundle-roots");
    #[cfg(windows)]
    let (rows, scope) = (windows::enumerate()?, "windows-uninstall-registry");
    #[cfg(target_os = "linux")]
    let (rows, scope) = (linux::enumerate()?, "registered-desktop-launchers");
    #[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
    return Err("Unsupported native device inventory platform".into());

    // Platform-specific readers stop once they have collected MAX_ENTRIES+1
    // raw observations. Even if duplicates reduce the final row count, mark
    // the read incomplete rather than silently claiming exhaustive coverage.
    let raw_cap_reached = rows.len() > MAX_ENTRIES;
    let (entries, truncated) = organize(rows);
    let truncated = truncated || raw_cap_reached;
    let timestamp_ms = SystemTime::now().duration_since(UNIX_EPOCH)
        .map_err(|_| "Invalid system clock")?.as_millis() as u64;
    Ok(DeviceSnapshot {
        platform: std::env::consts::OS,
        scope, status: "observed",
        timestamp_ms, entries, truncated,
    })
}

pub fn validate(snapshot: &DeviceSnapshot) -> Result<(), String> {
    if snapshot.platform != std::env::consts::OS || snapshot.status != "observed" {
        return Err("Untrusted native snapshot platform or status".into());
    }
    let expected_scope = match std::env::consts::OS {
        "macos" => "known-application-bundle-roots",
        "windows" => "windows-uninstall-registry",
        "linux" => "registered-desktop-launchers",
        _ => return Err("Unsupported native snapshot platform".into()),
    };
    if snapshot.scope != expected_scope || snapshot.entries.len() > MAX_ENTRIES {
        return Err("Untrusted native snapshot scope or entry limit".into());
    }
    let now = SystemTime::now().duration_since(UNIX_EPOCH)
        .map_err(|_| "Invalid system clock")?.as_millis() as u64;
    if snapshot.timestamp_ms > now.saturating_add(15_000)
        || now.saturating_sub(snapshot.timestamp_ms) > 120_000
    {
        return Err("Native device snapshot is stale or future dated".into());
    }
    let mut ids = std::collections::HashSet::new();
    for app in &snapshot.entries {
        if app.name.trim().is_empty() || app.name.chars().count() > MAX_NAME ||
            app.identifier.chars().count() > MAX_IDENTIFIER ||
            app.stable_identifier.chars().count() > MAX_IDENTIFIER ||
            // Never trust a claimed stable identity from another OS.
            (!app.stable_identifier.is_empty() && (
                snapshot.platform != "windows" ||
                crate::identity::pack_msi_guid(&app.identifier).is_none() ||
                !app.provenance.starts_with("Machine ") ||
                !crate::identity::REVIEWED.iter().any(|r|
                    r.platform == "windows" && r.identifier == app.stable_identifier)
            )) ||
            app.version.chars().count() > MAX_VERSION ||
            app.provenance.is_empty() || app.provenance.chars().count() > 48 ||
            !ids.insert((&app.name, &app.identifier, &app.provenance)) ||
            [&app.name, &app.identifier, &app.stable_identifier,
                &app.version, &app.provenance]
                .iter().any(|s| s.chars().any(|c| c.is_control()))
        {
            return Err("Malformed native device-app evidence".into());
        }
    }
    Ok(())
}

pub fn search<'a>(s: &'a DeviceSnapshot, query: &str) -> Vec<&'a DeviceApp> {
    let q = query.trim().to_lowercase();
    s.entries.iter().filter(|x| {
        q.is_empty() || [&x.name, &x.identifier, &x.provenance]
            .iter().any(|f| f.to_lowercase().contains(&q))
    }).collect()
}

#[cfg(target_os="macos")]
mod macos {
    use super::DeviceApp;
    use std::{fs, path::{Path, PathBuf}, process::Command};

    const ROOTS: [(&str, &str); 5] = [
        ("/Applications", "Applications"),
        ("/Applications/Utilities", "Applications Utilities"),
        ("/System/Applications", "System Applications"),
        ("/System/Applications/Utilities", "System Utilities"),
        ("/System/Library/CoreServices/Applications", "CoreServices Applications"),
    ];

    fn inspect_bundle(path: &Path, provenance: &str) -> Option<DeviceApp> {
        let fallback = path.file_stem()?.to_str()?.to_string();
        let info = path.join("Contents/Info.plist");
        let mut name = fallback;
        let mut identifier = String::new();
        let mut version = String::new();
        // Bundle Content and plist must be actual files, not redirected
        // symlinks to arbitrary locations on the user's computer.
        let contents=path.join("Contents");
        let safe_contents=fs::symlink_metadata(&contents).ok()
            .map(|m|m.file_type().is_dir()).unwrap_or(false);
        let safe_info=fs::symlink_metadata(&info).ok()
            .map(|m|m.file_type().is_file()).unwrap_or(false);
        if safe_contents && safe_info && info.metadata().ok()?.len() <= 512_000 {
            // System-owned utility, fixed arguments, never a shell, no code
            // execution from .app bundles. Output only bundle metadata.
            if let Ok(output) = Command::new("/usr/bin/plutil")
                .arg("-convert").arg("json").arg("-o").arg("-").arg(&info).output() {
                if output.status.success() && output.stdout.len() <= 1_000_000 {
                    if let Ok(j) = serde_json::from_slice::<serde_json::Value>(&output.stdout) {
                        name = j["CFBundleDisplayName"].as_str()
                            .or_else(|| j["CFBundleName"].as_str())
                            .map(str::to_owned).unwrap_or(name);
                        identifier = j["CFBundleIdentifier"].as_str().unwrap_or("").into();
                        version = j["CFBundleShortVersionString"].as_str()
                            .or_else(|| j["CFBundleVersion"].as_str())
                            .unwrap_or("").into();
                    }
                }
            }
        }
        Some(DeviceApp { name, identifier, stable_identifier: String::new(),
            version, provenance: provenance.into() })
    }

    fn scan(root: &Path, provenance: &str, out: &mut Vec<DeviceApp>) -> bool {
        if !fs::symlink_metadata(root).map(|m|m.file_type().is_dir()).unwrap_or(false) {
            return false;
        }
        let Ok(entries) = fs::read_dir(root) else { return false };
        for e in entries.flatten() {
            if out.len() >= super::MAX_ENTRIES + 1 { break; }
            let Ok(t) = e.file_type() else { continue };
            // Skip symlinks: no traversal of redirected roots or app bundles.
            if !t.is_dir() || t.is_symlink() { continue; }
            let path = e.path();
            if path.extension().and_then(|s| s.to_str()) != Some("app") { continue; }
            if let Some(row) = inspect_bundle(&path, provenance) { out.push(row); }
        }
        true
    }

    pub fn enumerate() -> Result<Vec<DeviceApp>, String> {
        let mut found = Vec::new();
        let mut accessible = 0;
        for (root, source) in ROOTS {
            if scan(Path::new(root), source, &mut found) { accessible += 1; }
        }
        if let Some(home) = std::env::var_os("HOME") {
            let user = PathBuf::from(home).join("Applications");
            if scan(&user, "User Applications", &mut found) { accessible += 1; }
        }
        if accessible == 0 { return Err("No readable macOS application roots".into()); }
        Ok(found)
    }
}

#[cfg(target_os="linux")]
mod linux {
    use super::DeviceApp;
    use std::{fs, path::{Path, PathBuf}};
    const ROOTS: [(&str, &str); 4] = [
        ("/usr/share/applications", "System desktop launcher"),
        ("/usr/local/share/applications", "Local desktop launcher"),
        ("/var/lib/flatpak/exports/share/applications", "Flatpak desktop launcher"),
        ("/var/lib/snapd/desktop/applications", "Snap desktop launcher"),
    ];
    fn parse_desktop(s: &str, id: &str, source: &str) -> Option<DeviceApp> {
        let mut in_main=false;
        let mut app_type = String::new();
        let mut name = String::new();
        let mut version = String::new();
        let mut hidden = false;
        for line in s.lines() {
            let line = line.trim();
            if line.starts_with('[') && line.ends_with(']') {
                in_main = line == "[Desktop Entry]";
                continue;
            }
            if !in_main || line.starts_with('#') { continue; }
            if let Some((k,v)) = line.split_once('=') {
                match k {
                    "Name" => name = v.into(),
                    "Type" => app_type = v.into(),
                    "Version" => version = v.into(),
                    "Hidden" | "NoDisplay" if v.eq_ignore_ascii_case("true") => hidden=true,
                    _ => {}
                }
            }
        }
        if hidden || app_type != "Application" || name.is_empty() { return None; }
        // The desktop Version key is the *launcher format version*, not the
        // installed application's version. Never mislabel it as app version.
        let _ = version;
        Some(DeviceApp {
            name, identifier: id.into(), stable_identifier: String::new(),
            version: String::new(), provenance: source.into(),
        })
    }
    fn scan(root:&Path, source:&str, out:&mut Vec<DeviceApp>) -> bool {
        if !fs::symlink_metadata(root).map(|m|m.file_type().is_dir()).unwrap_or(false) {
            return false;
        }
        let Ok(entries)=fs::read_dir(root) else { return false };
        for e in entries.flatten() {
            if out.len() >= super::MAX_ENTRIES + 1 { break; }
            if !e.file_type().map(|t| t.is_file() && !t.is_symlink()).unwrap_or(false) { continue; }
            let path=e.path();
            if path.extension().and_then(|s|s.to_str())!=Some("desktop"){continue;}
            if path.metadata().map(|m|m.len()>131_072).unwrap_or(true){continue;}
            let Ok(content)=fs::read_to_string(&path) else {continue};
            let id=path.file_name().and_then(|s|s.to_str()).unwrap_or("");
            if let Some(row)=parse_desktop(&content,id,source){out.push(row);}
        }
        true
    }
    pub fn enumerate() -> Result<Vec<DeviceApp>, String> {
        let mut found=Vec::new();
        let mut accessible=0;
        for (root,source) in ROOTS {
            if scan(Path::new(root),source,&mut found){accessible+=1;}
        }
        if let Some(home)=std::env::var_os("HOME"){
            let root=PathBuf::from(home).join(".local/share/applications");
            if scan(&root,"User desktop launcher",&mut found){accessible+=1;}
            let flatpak=PathBuf::from(std::env::var_os("HOME").unwrap()).join(".local/share/flatpak/exports/share/applications");
            if scan(&flatpak,"User Flatpak desktop launcher",&mut found){accessible+=1;}
        }
        if accessible==0{return Err("No readable Linux desktop launcher roots".into());}
        Ok(found)
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn desktop_version_is_not_application_version() {
            let row=parse_desktop("[Desktop Entry]\nType=Application\nName=Tool\nVersion=1.0\n", "tool.desktop", "System desktop launcher").unwrap();
            assert_eq!(row.version,"");
            assert_eq!(row.identifier,"tool.desktop");
            assert!(parse_desktop("[Desktop Entry]\nType=Application\nName=Hidden\nNoDisplay=true\n","hidden.desktop","System desktop launcher").is_none());
            assert!(parse_desktop("[Desktop Entry]\nType=Link\nName=Web\n","web.desktop","System desktop launcher").is_none());
        }
    }
}

#[cfg(windows)]
mod windows {
    use super::DeviceApp;
    use std::{io::Read, process::{Command, Stdio}, thread, time::{Duration,Instant}};
    const SCRIPT: &str = r#"
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)

# This static allowlist is rendered by Rust only from upstream-reviewed,
# immutable MSI UpgradeCodes. Do not enumerate all Installer upgrades.
$approvedUpgrades=@(__MSI_ID_RULES__)
$products=@{}
foreach($rule in $approvedUpgrades) {
  $k=Get-Item -LiteralPath ('HKLM:\SOFTWARE\Classes\Installer\UpgradeCodes\'+$rule.packed) -ErrorAction SilentlyContinue
  if($null -eq $k){continue}
  foreach($code in $k.GetValueNames()){
    if($code -notmatch '^[A-Fa-f0-9]{32}$'){continue}
    $normalized=$code.ToUpperInvariant()
    if($products.ContainsKey($normalized)){
      # Ambiguous ownership: no inferred source link.
      $products[$normalized]=''
    }else{$products[$normalized]=[string]$rule.id}
  }
}
function Reverse-Text([string]$str) {
  $chars=$str.ToCharArray()
  [Array]::Reverse($chars)
  return -join $chars
}
function Pack-MsiProductCode([string]$code) {
  if($code -notmatch '^\{[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}\}$'){return ''}
  $s=$code.Trim('{}').Replace('-','').ToUpperInvariant()
  $packed=(Reverse-Text($s.Substring(0,8)))+
    (Reverse-Text($s.Substring(8,4)))+
    (Reverse-Text($s.Substring(12,4)))
  for($i=16;$i -lt 32;$i+=2){
    $packed+=$s.Substring($i+1,1)+$s.Substring($i,1)
  }
  return $packed
}
$roots=@(
  @{path='HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*';source='Machine uninstall registry'},
  @{path='HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*';source='Machine 32-bit registry'},
  @{path='HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*';source='User uninstall registry'}
)
$rows=@(foreach($root in $roots){
  Get-ItemProperty -Path $root.path -ErrorAction SilentlyContinue | ForEach-Object {
    if($_.DisplayName -and $_.SystemComponent -ne 1) {
      $nativeCode=''
      if($_.WindowsInstaller -eq 1 -and $root.source -match '^Machine ') {
        $packed=Pack-MsiProductCode ([string]$_.PSChildName)
        if($packed -and $products.ContainsKey($packed)){
          $nativeCode=[string]$products[$packed]
        }
      }
      [pscustomobject]@{
        name=[string]$_.DisplayName;
        identifier=[string]$_.PSChildName;
        stableIdentifier=$nativeCode;
        version=[string]$_.DisplayVersion;
        provenance=[string]$root.source
      }
    }
  }
})
ConvertTo-Json -InputObject $rows -Depth 3 -Compress
"#;

    fn run() -> Result<Vec<u8>,String> {
        let reviewed=crate::identity::reviewed_msi_upgrades()?;
        let allowed=reviewed.iter().map(|(id, packed)|
            format!("@{{id='{id}';packed='{packed}'}}")
        ).collect::<Vec<_>>().join(",");
        let script=SCRIPT.replace("__MSI_ID_RULES__", &allowed);
        let mut cmd=Command::new("powershell.exe");
        cmd.args(["-NoProfile","-NonInteractive","-Command",&script])
            .stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut child=cmd.spawn().map_err(|e|format!("Windows registry reader unavailable: {e}"))?;
        let stdout=child.stdout.take().ok_or("Missing PowerShell stdout")?;
        let stderr=child.stderr.take().ok_or("Missing PowerShell stderr")?;
        let out=thread::spawn(move || { let mut b=Vec::new();let _=stdout.take(2_000_001).read_to_end(&mut b);b });
        let err=thread::spawn(move || { let mut b=Vec::new();let _=stderr.take(16_385).read_to_end(&mut b);b });
        let start=Instant::now();
        let status=loop {
            match child.try_wait() {
                Ok(Some(s))=>break Ok(s),
                Ok(None) if start.elapsed()<Duration::from_secs(12) => thread::sleep(Duration::from_millis(40)),
                Ok(None)=>{let _=child.kill();let _=child.wait();break Err("Windows uninstall registry scan timed out".to_string());},
                Err(e)=>{let _=child.kill();let _=child.wait();break Err(format!("Cannot wait for Windows registry: {e}"));}
            }
        };
        let bytes=out.join().map_err(|_|"Registry reader stdout panicked")?;
        let errbytes=err.join().map_err(|_|"Registry reader stderr panicked")?;
        let status=status?;
        if bytes.len()>2_000_000 || errbytes.len()>16_384 {
            return Err("Windows registry evidence exceeded size bound".into());
        }
        if !status.success(){
            return Err(format!("Windows registry reader failed: {}", String::from_utf8_lossy(&errbytes)));
        }
        Ok(bytes)
    }
    pub fn enumerate() -> Result<Vec<DeviceApp>,String> {
        let raw=run()?;
        let value:serde_json::Value=serde_json::from_slice(&raw)
            .map_err(|_|"Windows registry returned invalid JSON")?;
        let list=value.as_array().ok_or("Windows registry did not return an array")?;
        if list.len()>10_000 { return Err("Windows registry enumeration exceeded safety bound".into()); }
        let rows=list.iter().take(super::MAX_ENTRIES+1).map(|x|DeviceApp{
            name:x["name"].as_str().unwrap_or("").into(),
            identifier:x["identifier"].as_str().unwrap_or("").into(),
            stable_identifier:x["stableIdentifier"].as_str().unwrap_or("").into(),
            version:x["version"].as_str().unwrap_or("").into(),
            provenance:x["provenance"].as_str().unwrap_or("").into(),
        }).collect();
        Ok(rows)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn app(name:&str,identifier:&str,provenance:&str)->DeviceApp {
        DeviceApp { name:name.into(),identifier:identifier.into(),
            stable_identifier:String::new(), version:"1.0".into(),
            provenance:provenance.into() }
    }
    #[test]
    fn does_not_merge_distinct_identifiers_or_provenance() {
        let (out,truncated)=organize(vec![
            app("Editor","com.vendor.one","System"),
            app("Editor","com.vendor.two","System"),
            app("Editor","com.vendor.two","User"),
            app("Editor","com.vendor.one","System"),
        ]);
        assert!(!truncated);
        assert_eq!(out.len(),3);
    }
    #[test]
    fn malicious_names_are_bounded_and_controls_removed() {
        let (rows,_) = organize(vec![
            app(&format!("  Tool{}\n", "x".repeat(800)),"abc", "System"),
            app("   ","missing","System"),
        ]);
        assert_eq!(rows.len(),1);
        assert!(rows[0].name.chars().count()<=MAX_NAME);
        assert!(!rows[0].name.contains('\n'));
    }
    #[test]
    fn inventory_is_explicitly_non_authoritative_and_bounded() {
        let rows=(0..600).map(|i|app(&format!("Tool {i}"),&format!("key-{i}"),"System")).collect();
        let (list,truncated)=organize(rows);
        assert_eq!(list.len(),MAX_ENTRIES);
        assert!(truncated);
    }
    #[test]
    fn stable_windows_msi_identity_requires_windows_machine_product_code() {
        let mut app = app("Label not trusted", "some.package.id", "Known OS registry");
        app.stable_identifier = "D3DC41E3-3C37-5D52-BB47-F6673705C01B".into();
        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
        let mut snapshot = DeviceSnapshot {
            platform: std::env::consts::OS,
            scope: match std::env::consts::OS {
                "macos" => "known-application-bundle-roots",
                "windows" => "windows-uninstall-registry",
                "linux" => "registered-desktop-launchers",
                _ => "unsupported",
            },
            status: "observed", timestamp_ms: now, entries: vec![app],
            truncated: false,
        };
        assert!(validate(&snapshot).is_err()); // No product GUID or valid source.
        snapshot.entries[0].identifier =
            "{9D5F8A39-0D7B-4BC4-851D-DA8501D03DE7}".into();
        assert!(validate(&snapshot).is_err()); // Not a machine MSI association.
        snapshot.entries[0].provenance = "Machine uninstall registry".into();
        if cfg!(windows) {
            assert!(validate(&snapshot).is_ok()); // Bounded source evidence only.
        } else {
            assert!(validate(&snapshot).is_err()); // No Windows upgrade on other OSes.
        }
        snapshot.entries[0].stable_identifier = "00000000-0000-0000-0000-000000000000".into();
        assert!(validate(&snapshot).is_err()); // Never accept an unreviewed code.
    }

    #[test]
    fn snapshot_rejects_stale_or_forged_os_evidence() {
        let mut s=DeviceSnapshot {
            platform:std::env::consts::OS,
            scope:match std::env::consts::OS {
                "macos"=>"known-application-bundle-roots",
                "windows"=>"windows-uninstall-registry",
                "linux"=>"registered-desktop-launchers",
                _=>"unsupported",
            },
            status:"observed",
            timestamp_ms:SystemTime::now().duration_since(UNIX_EPOCH)
                .unwrap().as_millis() as u64,
            entries:vec![app("Real registration","some.package.id","Known OS registry")],
            truncated:false,
        };
        assert!(validate(&s).is_ok());
        s.timestamp_ms=1;
        assert!(validate(&s).is_err());
        s.timestamp_ms=SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;
        s.scope="all-installed-apps-certified";
        assert!(validate(&s).is_err());
    }
}
