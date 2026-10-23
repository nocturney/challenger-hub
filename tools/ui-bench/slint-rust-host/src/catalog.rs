use serde::Deserialize;
use std::collections::{HashMap, HashSet};

pub const EXPECTED_VERSION: &str = "4.0.0-desktop.preview.12";

#[derive(Clone, Debug, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub maker: String,
    pub category: String,
    pub summary: String,
    pub platforms: String,
    pub evidence: String,
    pub source: String,
    pub kind: String,
}

#[derive(Debug, Deserialize)]
pub struct Counts {
    pub managed: usize,
    pub curated: usize,
    pub research: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub schema: String,
    pub items: Vec<Project>,
    pub counts: Counts,
    pub engine_version: String,
    pub host_platform: String,
    pub host_arch: String,
    pub network_scan_disabled: bool,
    pub write_actions_exposed: bool,
}

pub fn validate(c: &Catalog) -> Result<(), String> {
    if c.schema != "challenger.native.catalog.v1" {
        return Err("Unexpected sidecar protocol (fail closed)".into());
    }
    if c.engine_version != EXPECTED_VERSION {
        return Err("Engine version mismatch (fail closed)".into());
    }
    if !c.network_scan_disabled || c.write_actions_exposed {
        return Err("Read-only scanner/write permission invariant failed".into());
    }
    if (c.counts.managed, c.counts.curated, c.counts.research) != (14, 152, 15)
        || c.items.len() != 181
    {
        return Err("Catalog count or category provenance mismatch".into());
    }
    let actual_platform = match std::env::consts::OS {
        "macos" => "darwin",
        "windows" => "win32",
        "linux" => "linux",
        other => other,
    };
    if c.host_platform != actual_platform {
        return Err(format!("Backend platform mismatch: {}", c.host_platform));
    }
    let actual_arch = match std::env::consts::ARCH {
        "aarch64" => "arm64",
        "x86_64" => "x64",
        other => other,
    };
    if c.host_arch != actual_arch {
        return Err(format!("Backend architecture mismatch: {}", c.host_arch));
    }

    let mut ids = HashSet::new();
    let mut managed = 0;
    let mut curated = 0;
    let mut research = 0;
    for p in &c.items {
        if p.id.trim().is_empty() || p.name.trim().is_empty() || !ids.insert(&p.id) {
            return Err("Invalid or duplicate project identity".into());
        }
        match p.kind.as_str() {
            "managed" if p.id.starts_with("managed:") => managed += 1,
            "curated" if p.id.starts_with("curated:") => curated += 1,
            "research" if p.id.starts_with("research:") => research += 1,
            _ => return Err("Unexpected project kind or ID prefix".into()),
        }
    }
    if (managed, curated, research) != (14, 152, 15) {
        return Err("Provenance counts disagree with actual records".into());
    }
    Ok(())
}

pub fn filtered<'a>(all: &'a [Project], q: &str, category: &str) -> Vec<&'a Project> {
    let term = q.trim().to_lowercase();
    all.iter()
        .filter(|p| {
            (category == "All disciplines" || p.category == category)
                && (term.is_empty()
                    || [&p.name, &p.maker, &p.category, &p.summary]
                        .iter()
                        .any(|v| v.to_lowercase().contains(&term)))
        })
        .collect()
}

pub fn categories(all: &[Project]) -> Vec<String> {
    let mut counts = HashMap::<String, usize>::new();
    for p in all {
        *counts.entry(p.category.clone()).or_default() += 1;
    }
    let mut sorted: Vec<_> = counts.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    std::iter::once("All disciplines".to_string())
        .chain(sorted.into_iter().take(11).map(|(name, _)| name))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example() -> Catalog {
        let items = (0..181).map(|i| {
            let kind = if i < 14 { "managed" } else if i < 166 { "curated" } else { "research" };
            Project {
                id: format!("{}:{}", kind, i), name: format!("Tool {}", i),
                maker: "Independent".into(), category: "Image editing".into(),
                summary: "A real native catalogue entry".into(),
                platforms: "macOS, Windows".into(), evidence: "Curated".into(),
                source: "https://github.com/example/tool".into(), kind: kind.into()
            }
        }).collect();
        Catalog {
            schema: "challenger.native.catalog.v1".into(), items,
            counts: Counts { managed: 14, curated: 152, research: 15 },
            engine_version: EXPECTED_VERSION.into(),
            host_platform: match std::env::consts::OS { "macos"=>"darwin", "windows"=>"win32", x=>x }.into(),
            host_arch: match std::env::consts::ARCH { "aarch64"=>"arm64", "x86_64"=>"x64", x=>x }.into(),
            network_scan_disabled: true, write_actions_exposed: false
        }
    }

    #[test]
    fn accepts_only_pinned_read_only_catalog() {
        assert!(validate(&example()).is_ok());
        let mut c = example();
        c.write_actions_exposed = true;
        assert!(validate(&c).is_err());
        c = example();
        c.network_scan_disabled = false;
        assert!(validate(&c).is_err());
        c = example();
        c.items[1].id = c.items[0].id.clone();
        assert!(validate(&c).is_err());
        c = example();
        c.items[166].kind = "curated".into();
        assert!(validate(&c).is_err());
    }

    #[test]
    fn search_and_categories_preserve_research_visibility() {
        let c = example();
        assert_eq!(filtered(&c.items, "", "All disciplines").len(), 181);
        assert_eq!(filtered(&c.items, "Tool 180", "All disciplines").len(), 1);
        assert!(filtered(&c.items, "never-a-project", "All disciplines").is_empty());
        assert_eq!(categories(&c.items), vec!["All disciplines", "Image editing"]);
    }
}
