//! Explicit installer review and execution; no automatic installs.
//! Original Challenger policy+worker handles extraction and digest checks.

use crate::{catalog::Project,sidecar};
use serde::Deserialize;

#[derive(Clone,Debug,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct InstallPlan {
    pub schema:String,
    pub project_id:String,
    pub id:String,
    pub name:String,
    pub repository:String,
    pub platform:String,
    pub arch:String,
    pub tag:String,
    pub kind:String,
    pub asset_name:String,
    pub asset_size:u64,
    pub sha256:String,
    #[serde(rename="downloadURL")]
    pub download_url:String,
    pub destination:String,
    pub requires_user_approval:bool,
    pub source_digest_verified_after_download:bool,
    pub approval_token:String,
}
#[derive(Debug,Deserialize)]
#[serde(rename_all="camelCase")]
struct InstallResult {
    schema:String,
    state:String,
    project_id:String,
    tag:String,
    sha256:String,
    installed_path:String,
    source_digest_verified:bool,
}
pub fn eligible_source(project:&Project)->bool {
    project.kind=="curated"&&project.id.starts_with("curated:")&&
    project.source.starts_with("https://github.com/")&&
    project.id.len()<96
}
pub fn validate_plan(plan:&InstallPlan,project:&Project)->Result<(),String> {
    if !eligible_source(project) ||
        plan.schema!="challenger.native.install-plan.v1" ||
        plan.project_id != project.id ||
        plan.project_id != format!("curated:{}",plan.id) ||
        plan.name != project.name ||
        plan.repository.is_empty() ||
        project.source != format!("https://github.com/{}",plan.repository) ||
        plan.platform != match std::env::consts::OS {
            "macos"=>"darwin","windows"=>"win32",_=>"unsupported",
        } ||
        plan.arch != std::env::consts::ARCH.replace("aarch64","arm64")
                     .replace("x86_64","x64") ||
        !matches!(plan.kind.as_str(),"zip"|"dmg"|"zip-app"|"exe-portable") ||
        !plan.requires_user_approval || plan.source_digest_verified_after_download ||
        plan.asset_name.len()>175 || plan.asset_name.is_empty() ||
        plan.asset_size<1001 || plan.asset_size>=800*1024*1024 ||
        plan.sha256.len()!=64 ||
        !plan.sha256.bytes().all(|c|c.is_ascii_hexdigit()) ||
        plan.approval_token.len()!=64 ||
        !plan.approval_token.bytes().all(|c|c.is_ascii_hexdigit()) ||
        plan.destination.trim().is_empty() ||
        !plan.download_url.starts_with(&format!(
            "https://github.com/{}/releases/download/",plan.repository
        ))
    {
        return Err("Installer plan is not source, platform and digest verified".into());
    }
    Ok(())
}
pub fn review(project:&Project)->Result<InstallPlan,String> {
    if !eligible_source(project) {return Err("Only vetted curated sources can request installation".into());}
    let response=sidecar::installer_bridge("plan",&project.id,None)?;
    let plan:InstallPlan=serde_json::from_str(response.trim())
        .map_err(|_|"Invalid installer plan response")?;
    validate_plan(&plan,project)?;
    Ok(plan)
}
pub fn run_approved(plan:&InstallPlan)->Result<String,String> {
    if plan.approval_token.len()!=64 {return Err("Missing confirmed install plan".into());}
    let stdout=sidecar::installer_bridge("install",&plan.project_id,Some(&plan.approval_token))?;
    let last=stdout.lines().rev().find(|line|line.contains("challenger.native.install-result.v1"))
        .ok_or("Installer did not return a completed installation record")?;
    let data:InstallResult=serde_json::from_str(last)
        .map_err(|_|"Installer did not return a valid completion record")?;
    if data.schema!="challenger.native.install-result.v1" ||
        data.state!="success" || data.project_id!=plan.project_id ||
        data.tag!=plan.tag || data.sha256!=plan.sha256 ||
        !data.source_digest_verified ||
        !std::path::Path::new(&data.installed_path)
            .starts_with(std::path::Path::new(&plan.destination)) ||
        data.installed_path.len()<=plan.destination.len() {
        return Err("Installer completion does not match explicit approved package".into());
    }
    Ok(format!("{} {} installed and SHA-256 verified at {}",
        plan.name,plan.tag,data.installed_path))
}
#[cfg(test)]
mod tests {
    use super::*;
    fn source(kind:&str)->Project {
        Project{id:"curated:compositor".into(),name:"Compositor".into(),
        maker:"Independent".into(),category:"Design".into(),summary:"".into(),
        platforms:"macOS".into(),evidence:"Curated source".into(),
        source:"https://github.com/robbietilton/Compositor".into(),
        kind:kind.into(),license:"".into(),challenges:"".into(),release:"".into(),
        managed_install_signal:"".into(),installed_version:"".into(),
        latest_version:"".into(),update_hint:false}
    }
    #[test]
    fn only_exact_curated_project_can_request_review(){
        assert!(eligible_source(&source("curated")));
        assert!(!eligible_source(&source("research")));
        let mut p=source("curated");p.id="managed:compositor".into();
        assert!(!eligible_source(&p));
    }
    #[test]
    fn reject_fake_plan_before_user_approval(){
        let project=source("curated");
        let plan=InstallPlan {
            schema:"challenger.native.install-plan.v1".into(),
            project_id:project.id.clone(),id:"compositor".into(),
            name:"Compositor".into(),repository:"robbietilton/Compositor".into(),
            platform:if cfg!(target_os="macos"){"darwin".into()}
                else if cfg!(windows){"win32".into()}else{"linux".into()},
            arch:std::env::consts::ARCH.replace("aarch64","arm64").replace("x86_64","x64"),
            tag:"v1.5.8".into(),kind:"dmg".into(),asset_name:"Compositor.dmg".into(),
            asset_size:8539058,sha256:"a".repeat(64),
            download_url:"https://github.com/robbietilton/Compositor/releases/download/v1.5.8/Compositor.dmg".into(),
            destination:"/Users/test/Applications/ChallengerHub Apps".into(),
            requires_user_approval:true,source_digest_verified_after_download:false,
            approval_token:"b".repeat(64),
        };
        if !cfg!(target_os="linux"){assert!(validate_plan(&plan,&project).is_ok());}
        let mut bad=plan.clone();bad.repository="malicious/repo".into();
        assert!(validate_plan(&bad,&project).is_err());
        let mut bad=plan.clone();bad.requires_user_approval=false;
        assert!(validate_plan(&bad,&project).is_err());
        let mut bad=plan.clone();bad.source_digest_verified_after_download=true;
        assert!(validate_plan(&bad,&project).is_err());
    }
}
