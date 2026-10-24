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
// No Windows uninstall GUID or Linux .desktop ID has passed upstream review.
pub const REVIEWED: [ReviewedIdentity; 2] = [
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
];

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
        (a.name.clone(), a.identifier.clone())
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
    fn wrong_platform_cannot_reuse_macos_bundle_id_and_rules_reject_collisions() {
        let observed=vec![("RustDesk".into(),"com.carriez.rustdesk".into())];
        assert!(match_records_for_platform("windows",&observed,&[rustdesk()],&REVIEWED).unwrap().is_empty());
        let rules=[REVIEWED[0], REVIEWED[0]];
        assert!(match_records_for_platform("macos",&observed,&[rustdesk()],&rules).is_err());
    }
}
