//! Reviewed upstream native application identifiers only.
//!
//! This is NOT name similarity matching and NOT code-signature authentication.
//! Each mapping is pinned to an immutable upstream source commit and applies
//! only to the precise catalog project ID, repository URL and OS identifier.
//! A self-declared OS bundle ID alone does not prove a signed binary identity,
//! installation health, execution state or permission to install/update.

use crate::{catalog::Project, device::DeviceSnapshot};
use std::collections::HashSet;

#[derive(Clone, Copy, Debug)]
pub struct ReviewedIdentity {
    pub project_id: &'static str,
    pub source_url: &'static str,
    pub platform: &'static str,
    pub identifier: &'static str,
    pub source_manifest: &'static str,
    pub source_commit: &'static str,
    pub source_blob_sha: &'static str,
    pub reviewed_date: &'static str,
}

// Pinned original source files were retrieved and checked, not guessed from
// product names or derived from an arbitrary local application bundle.
// Windows uses reviewed stable MSI UpgradeCode, not version-specific ProductCode.
// Linux uses the exact upstream-installed .desktop filename, not the display name.
pub const REVIEWED: [ReviewedIdentity; 5] = [
    ReviewedIdentity {
        project_id: "curated:rustdesk",
        source_url: "https://github.com/rustdesk/rustdesk",
        platform: "macos",
        identifier: "com.carriez.rustdesk",
        source_manifest: "Cargo.toml",
        source_commit: "ed6a1acce896fb165f2642aa13b609166d57a734",
        source_blob_sha: "10025869435836f4a8de53a37b91cf851f550425",
        reviewed_date: "2026-10-24",
    },
    ReviewedIdentity {
        project_id: "curated:gh-obsproject-obs-studio",
        source_url: "https://github.com/obsproject/obs-studio",
        platform: "macos",
        identifier: "com.obsproject.obs-studio",
        source_manifest: "cmake/macos/helpers.cmake",
        source_commit: "72e86655715d9a25d69ce446aa4dd44ba58e10d2",
        source_blob_sha: "3afe4c344eb4a9566930d0b94daa1e49aa556e35",
        reviewed_date: "2026-10-24",
    },
    ReviewedIdentity {
        project_id: "curated:rustdesk",
        source_url: "https://github.com/rustdesk/rustdesk",
        platform: "linux",
        identifier: "rustdesk.desktop",
        source_manifest: "res/rustdesk.desktop",
        source_commit: "ed6a1acce896fb165f2642aa13b609166d57a734",
        source_blob_sha: "4e7d14fe51d8707beecd7a698e944287ddda1c70",
        reviewed_date: "2026-10-24",
    },
    ReviewedIdentity {
        project_id: "curated:gh-obsproject-obs-studio",
        source_url: "https://github.com/obsproject/obs-studio",
        platform: "linux",
        identifier: "com.obsproject.Studio.desktop",
        source_manifest: "frontend/cmake/linux/com.obsproject.Studio.desktop",
        source_commit: "72e86655715d9a25d69ce446aa4dd44ba58e10d2",
        source_blob_sha: "43ec1555633f00afc31d111e83dd31db6899226a",
        reviewed_date: "2026-10-24",
    },
    ReviewedIdentity {
        project_id: "curated:rustdesk",
        source_url: "https://github.com/rustdesk/rustdesk",
        platform: "windows",
        // Computed by official res/msi/preprocess.py:
        // uuid.uuid5(uuid.NAMESPACE_OID, "RustDesk.exe").
        identifier: "D3DC41E3-3C37-5D52-BB47-F6673705C01B",
        source_manifest: "res/msi/preprocess.py",
        source_commit: "ed6a1acce896fb165f2642aa13b609166d57a734",
        source_blob_sha: "ffbd478806e212a945813b90341a4291b6ff5d4a",
        reviewed_date: "2026-10-24",
    },
];

/// Deterministic Windows Installer packed GUID. Registry UpgradeCodes store
/// the product membership values using a packed PRODUCT code, NOT the
/// human-readable MSI ProductCode. This is not a signature check.
pub fn pack_msi_guid(guid: &str) -> Option<String> {
    let raw = if let Some(inner) = guid.strip_prefix('{') {
        inner.strip_suffix('}')?
    } else {
        guid
    };
    if raw.contains('{') || raw.contains('}') { return None; }
    let parts: Vec<&str> = raw.split('-').collect();
    if parts.len() != 5 || parts.iter().zip([8, 4, 4, 4, 12]).any(|(p, len)|
        p.len() != len || !p.bytes().all(|b| b.is_ascii_hexdigit())
    ) { return None; }
    let upper = parts.concat().to_ascii_uppercase();
    let bytes = upper.as_bytes();
    let mut packed = String::with_capacity(32);
    for (start, end) in [(0, 8), (8, 12), (12, 16)] {
        for i in (start..end).rev() { packed.push(char::from(bytes[i])); }
    }
    for i in (16..32).step_by(2) {
        packed.push(char::from(bytes[i + 1]));
        packed.push(char::from(bytes[i]));
    }
    Some(packed)
}

/// Fixed reviewed source metadata only, not registry-generated identifiers.
#[cfg(windows)]
pub fn reviewed_msi_upgrades() -> Result<Vec<(&'static str, String)>, String> {
    validate_rules(&REVIEWED)?;
    REVIEWED.iter().filter(|r| r.platform == "windows").map(|r|
        pack_msi_guid(r.identifier).map(|packed| (r.identifier, packed))
            .ok_or_else(|| "Invalid reviewed MSI UpgradeCode".into())
    ).collect()
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProjectLink {
    pub device_index: usize,
    pub project_id: String,
    pub project_name: String,
    pub identifier: String,
}

// Compiled-in review metadata itself must be internally consistent.
// Fail closed on a future accidental duplicate/prefix/wildcard rule.
pub fn validate_rules(rules: &[ReviewedIdentity]) -> Result<(), String> {
    let mut project_bindings = HashSet::new();
    let mut platform_bindings = HashSet::new();
    for rule in rules {
        if !rule.project_id.starts_with("curated:")
            || rule.source_url.is_empty()
            || !rule.source_url.starts_with("https://github.com/")
            || rule.source_url.contains('?') || rule.source_url.contains('#')
            || !matches!(rule.platform, "macos" | "windows" | "linux")
            || rule.identifier.trim() != rule.identifier
            || rule.identifier.len() < 6 || rule.identifier.len() > 160
            || !rule.identifier.is_ascii()
            || !rule.identifier.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
            || !rule.source_manifest.contains('.')
            || !rule.source_manifest.chars().all(|c|
                c.is_ascii_alphanumeric() || "._/-".contains(c))
            || rule.source_manifest.contains("..")
            || rule.source_commit.len() != 40
            || rule.source_blob_sha.len() != 40
            || !rule.source_commit.chars().all(|c| c.is_ascii_hexdigit())
            || !rule.source_blob_sha.chars().all(|c| c.is_ascii_hexdigit())
            || rule.reviewed_date != "2026-10-24"
            || (rule.platform == "windows" && pack_msi_guid(rule.identifier).is_none())
            || (rule.platform == "linux" && !rule.identifier.ends_with(".desktop"))
        {
            return Err("Malformed or unreviewed upstream native identity".into());
        }
        if !project_bindings.insert((rule.platform, rule.project_id))
            || !platform_bindings.insert((rule.platform, rule.identifier))
        {
            return Err("Ambiguous upstream native identity mapping".into());
        }
    }
    Ok(())
}

fn match_records_for_platform(
    platform: &str,
    apps: &[(String, String)],
    catalog: &[Project],
    rules: &[ReviewedIdentity],
) -> Result<Vec<ProjectLink>, String> {
    validate_rules(rules)?;
    let mut found = Vec::new();
    for rule in rules.iter().filter(|r| r.platform == platform) {
        let candidates = apps.iter().enumerate().filter(|(_, (_, native_id))| {
            native_id == rule.identifier
        }).map(|(idx, _)| idx).collect::<Vec<_>>();
        // The OS may have multiple app bundles claiming one bundle ID, or
        // stale duplicate registry entries. Ambiguous observations receive
        // NO automatic catalog link or installed-state assertion.
        if candidates.len() != 1 { continue; }

        let projects = catalog.iter().filter(|p| {
            p.kind == "curated" && p.id == rule.project_id && p.source == rule.source_url
        }).collect::<Vec<_>>();
        if projects.len() != 1 { continue; }
        let p = projects[0];
        found.push(ProjectLink {
            device_index: candidates[0], project_id: p.id.clone(),
            project_name: p.name.clone(), identifier: rule.identifier.into(),
        });
    }
    let mut ids = HashSet::new();
    found.retain(|f| ids.insert(f.device_index));
    Ok(found)
}

pub fn catalog_links(snapshot: &DeviceSnapshot, catalog: &[Project])
    -> Result<Vec<ProjectLink>, String>
{
    // Never accept a snapshot that claims another platform, stale time,
    // modified scope or malformed evidence. Even after a previous read,
    // a caller may accidentally reuse a snapshot outside its valid lifetime.
    crate::device::validate(snapshot)?;
    let app_ids = snapshot.entries.iter().map(|a|
        (a.name.clone(), if snapshot.platform == "windows" {
            a.stable_identifier.clone()
        } else {
            a.identifier.clone()
        })
    ).collect::<Vec<_>>();
    match_records_for_platform(snapshot.platform, &app_ids, catalog, &REVIEWED)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(kind: &str, id: &str, source: &str) -> Project {
        Project {
            id:id.into(), name:"RustDesk".into(), maker:"Reviewed upstream".into(),
            category:"Remote access".into(), summary:"Test".into(),
            platforms:"Mac".into(), evidence:"Source".into(),
            source:source.into(), kind:kind.into(), license:"".into(),
            challenges:"".into(), release:"".into(),
            managed_install_signal:"".into(), installed_version:"".into(),
            latest_version:"".into(), update_hint:false,
        }
    }
    fn rustdesk() -> Project {
        project("curated","curated:rustdesk","https://github.com/rustdesk/rustdesk")
    }
    #[test]
    fn verified_review_rules_have_unique_exact_immutable_upstream_sources() {
        assert!(validate_rules(&REVIEWED).is_ok());
        let r=REVIEWED[0];
        assert_eq!(r.identifier,"com.carriez.rustdesk");
        assert_eq!(r.source_commit.len(),40);
        assert_eq!(r.source_blob_sha.len(),40);
        assert_eq!(REVIEWED[1].identifier,"com.obsproject.obs-studio");
    }

    #[test]
    fn exact_upstream_bundle_id_links_even_if_display_name_differs() {
        let observed=vec![("Misleading display name".into(),"com.carriez.rustdesk".into())];
        let linked=match_records_for_platform("macos",&observed,&[rustdesk()],&REVIEWED).unwrap();
        assert_eq!(linked.len(),1);
        assert_eq!(linked[0].project_id,"curated:rustdesk");
        assert_eq!(linked[0].device_index,0);
    }

    #[test]
    fn never_match_only_on_display_name_or_prefix() {
        let observed=vec![
            ("RustDesk".into(),"com.someone.else".into()),
            ("RustDesk".into(),"com.carriez.rustdesk.clone".into()),
        ];
        let linked=match_records_for_platform("macos",&observed,&[rustdesk()],&REVIEWED).unwrap();
        assert!(linked.is_empty());
    }

    #[test]
    fn wrong_upstream_or_research_kind_cannot_match_claimed_bundle_id() {
        let observed=vec![("RustDesk".into(),"com.carriez.rustdesk".into())];
        for p in [
            project("research","curated:rustdesk","https://github.com/rustdesk/rustdesk"),
            project("curated","curated:rustdesk","https://github.com/attacker/rustdesk"),
            project("curated","research:rustdesk","https://github.com/rustdesk/rustdesk"),
        ] {
            assert!(match_records_for_platform("macos",&observed,&[p],&REVIEWED).unwrap().is_empty());
        }
    }

    #[test]
    fn duplicate_bundle_claims_or_duplicate_catalog_records_fail_closed() {
        let observed=vec![
            ("RustDesk".into(),"com.carriez.rustdesk".into()),
            ("RustDesk copy".into(),"com.carriez.rustdesk".into()),
        ];
        assert!(match_records_for_platform("macos",&observed,&[rustdesk()],&REVIEWED).unwrap().is_empty());
        let observed=vec![("RustDesk".into(),"com.carriez.rustdesk".into())];
        assert!(match_records_for_platform("macos",&observed,&[rustdesk(),rustdesk()],&REVIEWED).unwrap().is_empty());
    }

    #[test]
    fn upstream_linux_desktop_ids_are_exact_and_never_name_matched() {
        let projects = [
            rustdesk(),
            project("curated", "curated:gh-obsproject-obs-studio",
                "https://github.com/obsproject/obs-studio"),
        ];
        let valid = vec![
            ("Not-RustDesk".into(), "rustdesk.desktop".into()),
            ("Unrelated local display name".into(), "com.obsproject.Studio.desktop".into()),
        ];
        let linked = match_records_for_platform("linux", &valid, &projects, &REVIEWED).unwrap();
        assert_eq!(linked.len(), 2);
        assert_eq!(linked[0].project_id, "curated:rustdesk");
        assert_eq!(linked[1].project_id, "curated:gh-obsproject-obs-studio");
        let impostors = vec![
            ("RustDesk".into(), "rustdesk-custom.desktop".into()),
            ("OBS Studio".into(), "com.obsproject.Studio.backup.desktop".into()),
        ];
        assert!(match_records_for_platform("linux", &impostors, &projects, &REVIEWED)
            .unwrap().is_empty());
    }

    #[test]
    fn windows_msi_upgrade_link_requires_exact_upstream_upgrade_code() {
        let upgrade = "D3DC41E3-3C37-5D52-BB47-F6673705C01B";
        // The official WiX preprocess.py computes uuid5(NAMESPACE_OID,
        // "RustDesk.exe"). Registry key and product membership observed on
        // Chris Windows on 2026-10-24, independently of app display name.
        assert_eq!(pack_msi_guid(upgrade).as_deref(),
            Some("3E14CD3D73C325D5BB746F7673500CB1"));
        assert_eq!(
            pack_msi_guid("{9D5F8A39-0D7B-4BC4-851D-DA8501D03DE7}").as_deref(),
            Some("93A8F5D9B7D04CB458D1AD58100DD37E")
        );
        let observed = vec![("Renamed MSI listing".into(), upgrade.into())];
        let linked = match_records_for_platform("windows", &observed, &[rustdesk()],
            &REVIEWED).unwrap();
        assert_eq!(linked.len(), 1);
        assert_eq!(linked[0].project_id, "curated:rustdesk");
        // A raw ProductCode, a similarly named MSI, and macOS bundle IDs
        // are not trusted as Windows stable identity keys.
        for fake in ["9D5F8A39-0D7B-4BC4-851D-DA8501D03DE7",
            "D3DC41E3-3C37-5D52-BB47-F6673705C01C",
            "com.carriez.rustdesk"]
        {
            let items = vec![("RustDesk".into(), fake.into())];
            assert!(match_records_for_platform("windows", &items, &[rustdesk()],
                &REVIEWED).unwrap().is_empty());
        }
        assert!(pack_msi_guid("D3DC41E3-3C37-5D52-BB47-F6673705C01").is_none());
        assert!(pack_msi_guid("malicious powershell ; echo bad").is_none());
    }

    #[test]
    fn reviewed_windows_and_linux_links_reject_wrong_upstream_records() {
        for (os, key) in [
            ("linux", "rustdesk.desktop"),
            ("windows", "D3DC41E3-3C37-5D52-BB47-F6673705C01B"),
        ] {
            let observed = vec![("RustDesk".into(), key.into())];
            for project in [
                project("research", "curated:rustdesk",
                    "https://github.com/rustdesk/rustdesk"),
                project("curated", "curated:rustdesk",
                    "https://github.com/fork/rustdesk"),
            ] {
                assert!(match_records_for_platform(os, &observed, &[project],
                    &REVIEWED).unwrap().is_empty());
            }
        }
    }

    #[test]
    fn wrong_platform_cannot_reuse_macos_bundle_id_and_rules_reject_collisions() {
        let observed=vec![("RustDesk".into(),"com.carriez.rustdesk".into())];
        assert!(match_records_for_platform("windows",&observed,&[rustdesk()],&REVIEWED).unwrap().is_empty());
        let rules=[REVIEWED[0], REVIEWED[0]];
        assert!(match_records_for_platform("macos",&observed,&[rustdesk()],&rules).is_err());
    }
}
