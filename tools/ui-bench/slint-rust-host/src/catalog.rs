use serde::Deserialize;
use std::collections::HashSet;

pub const EXPECTED_VERSION: &str = "4.0.0-desktop.preview.12";

// Approved Focus 4.0 taxonomy from app.js. Source categories are NOT rewritten.
pub const DOMAINS: [(&str, &str); 17] = [
    ("Design & Imaging", "Design & Imaging"),
    ("Video & Animation", "Video & Motion"),
    ("Live Production", "Live Production"),
    ("3D & Manufacturing", "3D & CAD"),
    ("Science & GIS", "Science & GIS"),
    ("Audio & Music", "Audio & Music"),
    ("Game Creation", "Game Creation"),
    ("Office & Productivity", "Office & Productivity"),
    ("CRM & Sales", "CRM & Sales"),
    ("ERP & Operations", "ERP & Operations"),
    ("Business & Legal", "Business & Legal"),
    ("Data & Internal Tools", "Data & Apps"),
    ("Marketing & Publishing", "Marketing"),
    ("AI & Agents", "AI & Agents"),
    ("Developer & Automation", "Dev & Automation"),
    ("Security & Infrastructure", "Security & Infra"),
    ("Finance & Accounting", "Finance"),
];

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
    #[serde(default)]
    pub license: String,
    #[serde(default)]
    pub challenges: String,
    #[serde(default)]
    pub release: String,
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

fn any(g: &str, terms: &[&str]) -> bool {
    terms.iter().any(|term| g.contains(term))
}

pub fn domain_of(p: &Project) -> &'static str {
    if let Some((id, _)) = DOMAINS.iter().find(|(id, _)| *id == p.category) {
        return id;
    }
    let g = p.category.to_lowercase();
    if any(&g, &["audio", "music", "sound", "daw", "synth"]) {
        return "Audio & Music";
    }
    if any(&g, &["video", "motion", "animation", "compositing", "rigging"]) {
        return "Video & Animation";
    }
    if any(&g, &["live production", "broadcast", "streaming"]) {
        return "Live Production";
    }
    if any(&g, &["crm", "sales"]) {
        return "CRM & Sales";
    }
    if any(&g, &["erp", "inventory", "operations", "supply", "mrp", "mes"]) {
        return "ERP & Operations";
    }
    if any(&g, &["finance", "accounting", "bookkeep"]) {
        return "Finance & Accounting";
    }
    if any(&g, &["marketing", "publish", "social media"]) {
        return "Marketing & Publishing";
    }
    if any(&g, &["ai", "agent", "memory", "knowledge graph", "rag", "llm"]) {
        return "AI & Agents";
    }
    if any(&g, &["dev", "automati", "workflow", "gateway", "api", "code editor"]) {
        return "Developer & Automation";
    }
    if any(&g, &["security", "infrastructure", "credential", "secret", "remote"]) {
        return "Security & Infrastructure";
    }
    if any(&g, &["science", "gis", "geospatial"]) {
        return "Science & GIS";
    }
    if any(&g, &["game creation", "game engine"]) {
        return "Game Creation";
    }
    if any(&g, &["business and legal", "business & legal", "legal", "esign"]) {
        return "Business & Legal";
    }
    if any(&g, &["database", "data", "internal", "no-code", "low-code", "bi"]) {
        return "Data & Internal Tools";
    }
    if any(&g, &["image", "vector", "photo", "typography", "font", "design", "illustrat"]) {
        return "Design & Imaging";
    }
    if any(&g, &["cad", "draft", "3d", "material", "engineering", "point cloud",
                  "mesh", "voxel", "manufactur", "electronic", "pcb", "cam"]) {
        return "3D & Manufacturing";
    }
    "Office & Productivity"
}

pub fn domain_label(id: &str) -> &'static str {
    DOMAINS.iter().find(|(key, _)| *key == id)
        .map(|(_, label)| *label).unwrap_or("All software")
}

pub fn filtered_domain<'a>(all: &'a [Project], term: &str, domain: &str) -> Vec<&'a Project> {
    let q = term.trim().to_lowercase();
    all.iter().filter(|p| {
        (domain == "all" || domain_of(p) == domain) &&
        (q.is_empty() || [&p.name, &p.maker, &p.category, &p.summary, &p.challenges]
            .iter().any(|v| v.to_lowercase().contains(&q)) ||
            domain_label(domain_of(p)).to_lowercase().contains(&q))
    }).collect()
}

pub fn domain_counts(all: &[Project]) -> Vec<(&'static str, &'static str, usize)> {
    DOMAINS.iter().map(|(id,label)| {
        (*id, *label, all.iter().filter(|p| domain_of(p) == *id).count())
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn example() -> Catalog {
        let items = (0..181).map(|i| {
            let kind = if i < 14 { "managed" } else if i < 166 { "curated" } else { "research" };
            let category = match i % 5 {
                0 => "Engineering and manufacturing",
                1 => "AI agents & workflows",
                2 => "Science and GIS",
                3 => "Audio & music",
                _ => "Design & Imaging"
            };
            Project {
                id: format!("{}:{}", kind, i), name: format!("Tool {}", i),
                maker: "Independent".into(), category: category.into(),
                summary: "A native catalogue entry".into(),
                platforms: "macOS, Windows".into(), evidence: "Source listed".into(),
                source: "https://github.com/example/tool".into(), kind: kind.into(),
                license: "".into(), challenges: "".into(), release: "".into(),
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
    fn exactly_seventeen_focus_disciplines_preserve_every_project() {
        let c = example();
        let count = domain_counts(&c.items);
        assert_eq!(count.len(),17);
        assert_eq!(count.iter().map(|(_,_,n)| n).sum::<usize>(),181);
        assert_eq!(filtered_domain(&c.items,"","all").len(),181);
        assert_eq!(filtered_domain(&c.items,"tool 180","all").len(),1);
        assert!(filtered_domain(&c.items,"never-a-project","all").is_empty());
        assert_eq!(domain_of(&c.items[0]),"3D & Manufacturing");
        assert_eq!(domain_of(&c.items[1]),"AI & Agents");
        assert_eq!(domain_of(&c.items[2]),"Science & GIS");
        assert_eq!(domain_label("3D & Manufacturing"),"3D & CAD");
    }

    #[test]
    fn research_visible_and_not_mistaken_for_installer_approved() {
        let c = example();
        let pending = filtered_domain(&c.items,"tool 180","all");
        assert_eq!(pending.len(),1);
        assert_eq!(pending[0].kind,"research");
        assert!(pending[0].id.starts_with("research:"));
        assert!(!pending[0].evidence.contains("Approved installer"));
    }
}
