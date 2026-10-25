//! Explicit installer review and execution; no automatic installs.
//! Original Challenger policy+worker handles extraction and digest checks.

use crate::{catalog::Project,sidecar};
use serde::Deserialize;
use std::sync::atomic::AtomicBool;

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
    #[serde(default)]
    history_persisted:Option<bool>,
}
// Persistent history is a bounded account-local audit trail, not live status.
// A STARTED record with no verified terminal record is explicitly UNRESOLVED.
#[derive(Clone,Debug,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct HistoryEntry {
    pub run_id:String,
    pub project_id:String,
    pub tag:String,
    pub sha256:String,
    pub timestamp:String,
    pub state:String,
}
#[derive(Debug,Deserialize)]
pub struct HistoryResponse {
    pub schema:String,
    pub entries:Vec<HistoryEntry>,
    pub incomplete:bool,
}
fn valid_history(response:&HistoryResponse)->bool {
    response.schema=="challenger.native.install-history.v1" &&
    response.entries.len()<=30 &&
    response.entries.iter().all(|e|
        e.run_id.len()==36 &&
        e.run_id.bytes().all(|c|c.is_ascii_hexdigit()||c==b'-') &&
        (e.project_id.starts_with("curated:")||
            e.project_id=="managed:pdfcraft") &&
        e.project_id.len()<=96 &&
        e.project_id.bytes().all(|c|c.is_ascii_alphanumeric()||c==b'-'||c==b':') &&
        !e.tag.is_empty() && e.tag.len()<=100 &&
        e.tag.bytes().all(|c|c.is_ascii_alphanumeric()||b"._+-".contains(&c)) &&
        e.sha256.len()==64 && e.sha256.bytes().all(|c|c.is_ascii_hexdigit()) &&
        e.timestamp.len()==24 && e.timestamp.is_ascii() &&
        e.timestamp.ends_with('Z') &&
        matches!(e.state.as_str(),"COMPLETED"|"CANCELED"|"FAILED"|"UNRESOLVED"|"NEEDS_REVIEW")
    )
}
pub fn read_local_history()->Result<HistoryResponse,String> {
    let response=sidecar::read_install_history()?;
    let value:HistoryResponse=serde_json::from_str(response.trim())
        .map_err(|_|"Invalid persistent install history response")?;
    if !valid_history(&value){
        return Err("History response failed schema and source validation".into());
    }
    Ok(value)
}
pub fn eligible_source(project:&Project)->bool {
    let curated=project.kind=="curated"&&project.id.starts_with("curated:")&&
        project.source.starts_with("https://github.com/");
    let pdfcraft=cfg!(all(target_os="windows",target_arch="x86_64"))&&
        project.kind=="managed"&&project.id=="managed:pdfcraft"&&
        project.name=="PdfCraft"&&
        project.source=="https://github.com/storytold/pdfcraft";
    (curated||pdfcraft)&&project.id.len()<96
}
pub fn validate_plan(plan:&InstallPlan,project:&Project)->Result<(),String> {
    if !eligible_source(project) ||
        plan.schema!="challenger.native.install-plan.v1" ||
        plan.project_id != project.id ||
        plan.project_id != format!("{}:{}",project.kind,plan.id) ||
        (project.kind=="managed"&&
         (plan.repository!="storytold/pdfcraft" || plan.kind!="zip" ||
          plan.platform!="win32" || plan.arch!="x64")) ||
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
// Only allowlisted, syntactically valid worker status events appear in the UI.
// Nested JSON is never executed; untrusted text is never used as a terminal state.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InstallProgress {
    pub stage: &'static str,
    pub message: String,
    pub percent: Option<u8>,
}
pub fn parse_install_progress(line: &str) -> Option<InstallProgress> {
    let outer: serde_json::Value = serde_json::from_str(line).ok()?;
    let top = outer.get("state")?.as_str()?;
    if top == "approved" {
        return Some(InstallProgress {
            stage: "STARTING", message: "Starting the explicitly approved install".into(),
            percent: None,
        });
    }
    if top != "worker" { return None; }
    let inner: serde_json::Value = serde_json::from_str(outer.get("detail")?.as_str()?).ok()?;
    let event = inner.get("state")?.as_str()?;
    match event {
        "download" => Some(InstallProgress {
            stage: "DOWNLOADING", message: "Downloading the reviewed official release".into(),
            percent: Some(0),
        }),
        "download-progress" => {
            let value: u8 = inner.get("detail")?.as_str()?.parse().ok()?;
            if value == 0 || value > 90 || value % 10 != 0 { return None; }
            Some(InstallProgress {
                stage: "DOWNLOADING",
                message: format!("Received {value}% of the declared release bytes"),
                percent: Some(value),
            })
        },
        "verified" => Some(InstallProgress {
            stage: "VERIFIED",
            message: "Official release bytes passed the complete SHA-256 check".into(),
            percent: None,
        }),
        "extract" => Some(InstallProgress {
            stage: "EXTRACTING",
            message: "Checking package contents and installing to the approved location".into(),
            percent: None,
        }),
        "cancel-ready" => Some(InstallProgress {
            stage: "CANCELABLE",
            message: "Ready to download; cancellation is available".into(),
            percent: None,
        }),
        "committing" => Some(InstallProgress {
            stage: "COMMITTING",
            message: "Applying verified files; cancellation is now unsafe".into(),
            percent: None,
        }),
        "cancelled" => Some(InstallProgress {
            stage: "CANCELED",
            message: "Worker confirmed cancellation before application replacement".into(),
            percent: None,
        }),
        "installed" => Some(InstallProgress {
            stage: "RECORDING",
            message: "Application files placed; validating the managed install record".into(),
            percent: None,
        }),
        "rolled-back" => Some(InstallProgress {
            stage: "RESTORED",
            message: "Previous managed application restored after a failed install".into(),
            percent: None,
        }),
        "success" => Some(InstallProgress {
            stage: "FINALIZING",
            message: "Worker completed; independently checking the final install record".into(),
            percent: None,
        }),
        _ => None,
    }
}
pub fn run_approved(
    plan:&InstallPlan,
    mut on_progress: impl FnMut(InstallProgress),
    cancel_requested: &AtomicBool,
) -> Result<String,String> {
    if plan.approval_token.len()!=64 {return Err("Missing confirmed install plan".into());}
    let stdout=sidecar::installer_bridge_with_cancel(
        "install",&plan.project_id,Some(&plan.approval_token),cancel_requested,
        |line| if let Some(progress)=parse_install_progress(line) {on_progress(progress)}
    )?;
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
    let warning=if data.history_persisted==Some(false) {
        " (WARNING: local history could not be saved)"
    }else{""};
    Ok(format!("{} {} installed and SHA-256 verified at {}{}",
        plan.name,plan.tag,data.installed_path,warning))
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
    fn line(stage: &str, detail: &str) -> String {
        let inner=serde_json::json!({"state":stage,"detail":detail}).to_string();
        serde_json::json!({"state":"worker","detail":inner}).to_string()
    }
    #[test]
    fn installation_progress_only_parses_allowlisted_verified_worker_stages() {
        assert_eq!(parse_install_progress(&line("download-progress","20")),
            Some(InstallProgress {
                stage:"DOWNLOADING",
                message:"Received 20% of the declared release bytes".into(),
                percent:Some(20),
            }));
        assert_eq!(parse_install_progress(&line("verified","SHA-256 checked"))
            .unwrap().stage,"VERIFIED");
        assert_eq!(parse_install_progress(&line("installed","some executable path"))
            .unwrap().stage,"RECORDING");
        assert_eq!(parse_install_progress(&line("rolled-back","managed backup restored"))
            .unwrap().stage,"RESTORED");
        assert_eq!(parse_install_progress(&line("committing","boundary"))
            .unwrap().stage,"COMMITTING");
        assert_eq!(parse_install_progress(&line("cancelled","before commit"))
            .unwrap().stage,"CANCELED");
        assert_eq!(parse_install_progress(&line("success","worker may say success"))
            .unwrap().stage,"FINALIZING");
        for bad in [
            "invalid JSON".to_string(),
            r#"{"state":"worker","detail":"not JSON"}"#.to_string(),
            line("download-progress","101"),
            line("download-progress","95"),
            line("download-progress","-1"),
            line("download-progress","nan"),
            line("worker-error","fake"),
            r#"{"state":"worker-error","detail":"{\"state\":\"verified\"}"}"#.to_string(),
            r#"{"state":"success","detail":"unreviewed"}"#.to_string(),
            line("unknown-stage","100"),
        ] {
            assert!(parse_install_progress(&bad).is_none(),"Accepted: {bad}");
        }
    }
    #[test]
    fn persisted_history_rejects_forged_status_and_unbounded_rows(){
        let valid=HistoryEntry {
            run_id:"11111111-1111-4111-8111-111111111111".into(),
            project_id:"managed:pdfcraft".into(),
            tag:"v0.13.0".into(),
            sha256:"a".repeat(64),
            timestamp:"2026-10-24T10:00:00.000Z".into(),
            state:"UNRESOLVED".into(),
        };
        let mut response=HistoryResponse{
            schema:"challenger.native.install-history.v1".into(),
            entries:vec![valid.clone()],incomplete:false,
        };
        assert!(valid_history(&response));
        response.entries[0].state="NEEDS_REVIEW".into();
        assert!(valid_history(&response));
        response.entries[0].state="SUCCESS_WITHOUT_PROOF".into();
        assert!(!valid_history(&response));
        response.entries[0]=valid.clone();
        response.entries[0].project_id="research:pdfcraft".into();
        assert!(!valid_history(&response));
        response.entries=vec![valid;31];
        assert!(!valid_history(&response));
    }
    #[test]
    fn only_exact_curated_project_can_request_review(){
        assert!(eligible_source(&source("curated")));
        assert!(!eligible_source(&source("research")));
        let mut p=source("curated");p.id="managed:compositor".into();
        assert!(!eligible_source(&p));
    }
    #[test]
    fn managed_pdfcraft_is_pinned_to_exact_source_and_windows_x64(){
        let mut p=source("managed");
        p.id="managed:pdfcraft".into();
        p.name="PdfCraft".into();
        p.source="https://github.com/storytold/pdfcraft".into();
        assert_eq!(eligible_source(&p),cfg!(all(target_os="windows",target_arch="x86_64")));
        p.source="https://github.com/impostor/pdfcraft".into();
        assert!(!eligible_source(&p));
        p.source="https://github.com/storytold/pdfcraft".into();
        p.id="managed:wordcraft".into();
        assert!(!eligible_source(&p));
        p.id="managed:pdfcraft".into();
        p.kind="research".into();
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
