mod catalog;
mod device;
mod identity;
mod install;
mod sidecar;

use catalog::{domain_counts, domain_label, domain_of, filtered_domain, Catalog, Inventory, Project, DOMAINS};
use slint::{ComponentHandle, Model, ModelRc, SharedString, Timer, TimerMode, VecModel};
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
    sync::{atomic::{AtomicBool,Ordering},mpsc,Arc},
    thread,
    time::{Duration, Instant},
};

slint::include_modules!();

const PAGE_SIZE: usize = 30;

#[derive(Clone, Debug, PartialEq, Eq)]
struct Route {
    page: String,
    query: String,
    domain: String,
    selected: Option<String>,
    limit: usize,
}

impl Route {
    fn home() -> Self {
        Self { page: "home".into(), query: String::new(), domain: "all".into(),
            selected: None, limit: PAGE_SIZE }
    }
    fn results(domain: &str, query: &str) -> Self {
        Self { page: "results".into(), query: query.into(), domain: domain.into(),
            selected: None, limit: PAGE_SIZE }
    }
    fn simple(page: &str) -> Self {
        Self { page: page.into(), ..Self::home() }
    }
}

struct State {
    all: Vec<Project>,
    visible: Vec<Project>,
    history: Vec<Route>,
    cursor: usize,
    inventory: Option<Inventory>,
    device_snapshot: Option<device::DeviceSnapshot>,
    device_query: String,
    device_error: Option<String>,
    events: Vec<SessionEvent>,
}

enum InstallerEvent {
    Reviewed { project_id:String, result:Result<install::InstallPlan,String> },
    Progress { project_id:String, progress:install::InstallProgress },
    Finished { project_id:String, result:Result<String,String> },
}

impl Default for State {
    fn default() -> Self {
        Self {
            all: Vec::new(), visible: Vec::new(), history: vec![Route::home()], cursor: 0,
            inventory: None, events: Vec::new(),
            device_snapshot: None, device_query: String::new(), device_error: None,
        }
    }
}

impl State {
    fn event(&mut self, name: &str, detail: &str, outcome: &str) {
        self.events.push(SessionEvent {
            name: name.into(), detail: detail.into(), outcome: outcome.into()
        });
        if self.events.len() > 32 { self.events.remove(0); }
    }

    fn route(&self) -> &Route { &self.history[self.cursor] }
    fn route_mut(&mut self) -> &mut Route { &mut self.history[self.cursor] }

    fn push(&mut self, target: Route) {
        if self.route() == &target { return; }
        self.history.truncate(self.cursor + 1);
        self.history.push(target);
        self.cursor = self.history.len() - 1;
    }
    fn back(&mut self) {
        if self.cursor > 0 { self.cursor -= 1; }
    }
    fn forward(&mut self) {
        if self.cursor + 1 < self.history.len() { self.cursor += 1; }
    }
}

fn source_status(p: &Project) -> &'static str {
    match p.kind.as_str() {
        "research" => "Research · unverified",
        "managed" => "Managed source",
        _ => "Curated source",
    }
}

fn detailed_status(p: &Project) -> &'static str {
    match p.kind.as_str() {
        "research" => "Research candidate — not verified for installation",
        "managed" if p.id=="managed:pdfcraft" && cfg!(all(target_os="windows",target_arch="x86_64"))
            => "Managed PdfCraft — verified portable installation requires your approval",
        "managed" if p.id=="managed:pdfcraft" => "Managed PdfCraft — native portable installer is Windows x64 only",
        "managed" => "Managed listing — installation not enabled in Native Preview",
        _ => "Curated source — installation only after verified release review and approval",
    }
}

// The source button is the only browser action. Do not accept arbitrary
// external hosts, credentials, insecure scheme, or port overrides.
fn safe_source(raw: &str) -> Option<String> {
    let u = url::Url::parse(raw).ok()?;
    if u.scheme() != "https" || !u.username().is_empty() || u.password().is_some()
        || u.port().is_some()
    {
        return None;
    }
    if !["github.com", "gitlab.com", "codeberg.org", "invent.kde.org"]
        .contains(&u.host_str()?)
    {
        return None;
    }
    if u.path_segments().map(|p| p.count()).unwrap_or(0) < 2 {
        return None;
    }
    Some(u.to_string())
}

fn media_id(p: &Project) -> &'static str {
    // Exact curated ID + exact upstream repository. Never attach imagery to a
    // similarly named research candidate or to an unverified source.
    if p.kind == "curated" && p.id == "curated:dune3d"
        && p.source == "https://github.com/dune3d/dune3d" {
        "dune3d"
    } else if p.kind == "curated" && p.id == "curated:material-maker"
        && p.source == "https://github.com/RodZill4/material-maker" {
        "material-maker"
    } else {
        ""
    }
}

fn media_caption(id: &str) -> &'static str {
    match id {
        "dune3d" => "Dune 3D main window · official GitHub screenshot · GPL-3.0 · checksum verified",
        "material-maker" => "Material Maker node editor · official GitHub screenshot · MIT · checksum verified",
        _ => ""
    }
}

fn entry(p: &Project) -> ProjectEntry {
    ProjectEntry {
        id: p.id.clone().into(),
        name: p.name.clone().into(),
        maker: p.maker.clone().into(),
        domain: domain_label(domain_of(p)).into(),
        summary: p.summary.clone().into(),
        platforms: p.platforms.clone().into(),
        status: source_status(p).into(),
        kind: p.kind.clone().into(),
        media: media_id(p).into(),
        initial: p.name.chars().next().unwrap_or('?').to_string().into(),
    }
}

fn fact(value: &str) -> SharedString {
    if value.trim().is_empty() { "Not reported".into() } else { value.into() }
}

fn set_detail(ui: &AppWindow, project: Option<&Project>) {
    if let Some(p) = project {
        if ui.get_install_project_id().as_str() != p.id {
            ui.set_install_project_id(p.id.clone().into());
            ui.set_install_ready(false);
            ui.set_install_approved(false);
            ui.set_install_version("".into());
            ui.set_install_asset("".into());
            ui.set_install_hash("".into());
            ui.set_install_destination("".into());
            ui.set_install_message("Review the official release before approving an install.".into());
            ui.set_install_cancel_allowed(false);
            ui.set_install_cancel_requested(false);
            ui.set_install_stage("".into());
            ui.set_install_percent(-1);
        }
        ui.set_detail_name(p.name.clone().into());
        ui.set_detail_maker(fact(&p.maker));
        ui.set_detail_summary(fact(&p.summary));
        ui.set_detail_domain(domain_label(domain_of(p)).into());
        ui.set_detail_category(p.category.clone().into());
        ui.set_detail_platforms(fact(&p.platforms));
        ui.set_detail_kind(p.kind.clone().into());
        ui.set_detail_status(detailed_status(p).into());
        ui.set_detail_source(safe_source(&p.source).unwrap_or_default().into());
        ui.set_detail_license(fact(&p.license));
        ui.set_detail_challenges(
            if p.challenges.is_empty() { "No source-reported comparison".into() }
            else { p.challenges.clone().into() }
        );
        ui.set_detail_release(fact(&p.release));
        ui.set_detail_evidence(p.evidence.clone().into());
        ui.set_detail_media(media_id(p).into());
        ui.set_detail_media_caption(media_caption(media_id(p)).into());
    } else {
        ui.set_install_project_id("".into());
        ui.set_install_ready(false);
        ui.set_install_approved(false);
        ui.set_install_cancel_allowed(false);
        ui.set_install_cancel_requested(false);
        ui.set_detail_name("".into());
        ui.set_detail_source("".into());
        ui.set_detail_media("".into());
        ui.set_detail_media_caption("".into());
    }
}

fn update_device_panels(ui: &AppWindow, state: &State) {
    // Deliberately only managed apps. The 152 curated and 15 research records
    // have no trusted OS-detection mapping and must never appear installed.
    let mut managed = state.all.iter().filter(|p| p.kind == "managed")
        .collect::<Vec<_>>();
    managed.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    let assessed = state.inventory.as_ref().is_some_and(|i| i.status == "assessed");
    let detected = managed.iter().filter(|p| assessed && p.managed_install_signal == "detected").count();
    let updates = managed.iter().filter(|p| assessed && p.update_hint).count();
    let rows = managed.iter().map(|p| {
        let status = if !assessed { "Not assessed" }
            else if p.update_hint { "Possible update" }
            else if p.managed_install_signal == "detected" { "Detected" }
            else { "Not detected" };
        ManagedEntry {
            name: p.name.clone().into(),
            installed: if !assessed { "Unsupported".into() }
                else if p.installed_version.is_empty() { "Not detected".into() }
                else { p.installed_version.clone().into() },
            latest: if p.latest_version.is_empty() { "Not verified".into() }
                else { p.latest_version.clone().into() },
            status: status.into(),
        }
    }).collect::<Vec<_>>();
    ui.set_managed_entries(ModelRc::new(VecModel::from(rows)));
    ui.set_managed_assessed(if assessed { managed.len() as i32 } else { 0 });
    ui.set_managed_detected(detected as i32);
    ui.set_managed_updates(updates as i32);
    ui.set_inventory_status(if assessed { "assessed" } else { "unsupported" }.into());
    ui.set_inventory_checked(match state.inventory.as_ref() {
        Some(i) if assessed => format!("Local read: {} UTC", &i.checked_at[..19]).into(),
        _ => "Local detector unavailable".into()
    });
    ui.set_session_event_count(state.events.len() as i32);
    ui.set_session_events(ModelRc::new(VecModel::from(
        state.events.iter().rev().cloned().collect::<Vec<_>>()
    )));
}

fn update_os_device_panel(ui: &AppWindow, state: &State) {
    ui.set_device_query(state.device_query.clone().into());
    ui.set_device_error(state.device_error.as_deref().unwrap_or("").into());
    if let Some(snapshot) = &state.device_snapshot {
        let fresh = device::is_current(snapshot);
        let linked = if fresh { match identity::catalog_links(snapshot, &state.all) {
            Ok(linked) => linked,
            Err(e) => {
                eprintln!("NATIVE_IDENTITY_REVIEW_REFUSED {e}");
                Vec::new()
            }
        } } else { Vec::new() };
        ui.set_device_linked(linked.len() as i32);
        ui.set_device_status(if fresh { "observed" } else { "stale" }.into());
        ui.set_device_age(device::age_ms(snapshot)
            .map_or_else(|| "invalid observation time".to_string(),
                |ms| format!("last read {}s ago", ms / 1000)).into());
        ui.set_device_scope(snapshot.scope.into());
        ui.set_device_total(snapshot.entries.len() as i32);
        ui.set_device_truncated(snapshot.truncated);
        let visible = device::search(snapshot, &state.device_query)
            .iter().map(|a| {
                let index = snapshot.entries.iter().position(|x|
                    std::ptr::eq(x, *a)).unwrap_or(usize::MAX);
                let reviewed = linked.iter().find(|l| l.device_index == index);
                DeviceEntry {
                    name: a.name.clone().into(),
                    version: a.version.clone().into(),
                    identifier: a.identifier.clone().into(),
                    provenance: a.provenance.clone().into(),
                    linked_project: reviewed.map_or("", |l| l.project_name.as_str()).into(),
                    linked_id: reviewed.map_or("", |l| l.project_id.as_str()).into(),
                }
            }).collect::<Vec<_>>();
        ui.set_device_showing(visible.len() as i32);
        ui.set_device_entries(ModelRc::new(VecModel::from(visible)));
    } else {
        ui.set_device_status(if state.device_error.is_some() { "error" } else { "not-read" }.into());
        ui.set_device_scope("Not inspected".into());
        ui.set_device_total(0);
        ui.set_device_showing(0);
        ui.set_device_linked(0);
        ui.set_device_age("".into());
        ui.set_device_truncated(false);
        ui.set_device_entries(ModelRc::new(VecModel::from(Vec::<DeviceEntry>::new())));
    }
}

fn redraw(ui: &AppWindow, state: &mut State) {
    let route = state.route().clone();
    let counts = domain_counts(&state.all);
    debug_assert_eq!(counts.iter().map(|(_,_,n)|n).sum::<usize>(), state.all.len());

    let groups: Vec<Discipline> = counts.iter().map(|(id,label,count)| Discipline {
        id: (*id).into(), label: (*label).into(), count: *count as i32
    }).collect();
    let half = (groups.len() + 1) / 2;
    ui.set_disciplines_left(ModelRc::new(VecModel::from(groups[..half].to_vec())));
    ui.set_disciplines_right(ModelRc::new(VecModel::from(groups[half..].to_vec())));

    state.visible = filtered_domain(&state.all, &route.query, &route.domain)
        .into_iter().cloned().collect();
    let showing = state.visible.len().min(route.limit);
    ui.set_entries(ModelRc::new(VecModel::from(
        state.visible.iter().take(showing).map(entry).collect::<Vec<_>>()
    )));
    ui.set_total(state.all.len() as i32);
    ui.set_matching(state.visible.len() as i32);
    ui.set_showing(showing as i32);
    ui.set_has_more(showing < state.visible.len());
    ui.set_page(route.page.into());
    ui.set_selected_domain(route.domain.clone().into());
    ui.set_selected_domain_label(domain_label(&route.domain).into());
    ui.set_query(route.query.into());
    ui.set_can_back(state.cursor > 0);
    ui.set_can_forward(state.cursor + 1 < state.history.len());

    let detail = route.selected.as_ref().and_then(|id| state.all.iter().find(|p| &p.id == id));
    set_detail(ui, detail);
    update_device_panels(ui, state);
    update_os_device_panel(ui, state);
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let started = Instant::now();
    let args: Vec<String> = std::env::args().collect();
    let check_backend = args.iter().any(|a| a == "--check-backend-only");
    let smoke = args.iter().any(|a| a == "--smoke");
    if args.iter().any(|a| a == "--qa-e2e-install-sandbox") {
        // Executable installer integration QA. Refuse to write anything unless
        // run under a throwaway /tmp HOME with a deliberate test-only marker.
        let home = std::env::var("HOME").unwrap_or_default();
        if !cfg!(target_os="macos") ||
            !home.starts_with("/tmp/challenger-native-install-e2e.") ||
            !home.ends_with("/user") ||
            std::env::var("CHALLENGER_NATIVE_SANDBOX_TEST").as_deref()
                != Ok("isolated-install-v1") ||
            !std::fs::symlink_metadata(&home).map(|m|m.file_type().is_dir()).unwrap_or(false) {
            return Err("Refusing installer sandbox QA outside a known temporary HOME".into());
        }
        let catalog = sidecar::read_catalog()?;
        let p = catalog.items.iter().find(|p|p.id=="curated:compositor")
            .ok_or("Curated Compositor is missing from the real source catalog")?;
        let plan = install::review(p)?;
        let completed = install::run_approved(&plan, |_| {}, &AtomicBool::new(false))?;
        println!("NATIVE_INSTALL_SANDBOX_E2E_PASS {}",serde_json::json!({
            "projectId": plan.project_id,"tag":plan.tag,
            "sha256":plan.sha256,"installedUnderTemporaryHome":true,
            "sourceDigestVerified":true,
            "approval": "test-only isolated sandbox", "record":completed
        }));
        return Ok(());
    }
    if args.iter().any(|a| a == "--check-identity-only") {
        let snapshot = device::collect()
            .map_err(|e| format!("Native identity observation refused: {e}"))?;
        device::validate(&snapshot)?;
        let catalog = sidecar::read_catalog()
            .map_err(|e| format!("Native identity source catalog refused: {e}"))?;
        let links = identity::catalog_links(&snapshot, &catalog.items)?;
        println!("NATIVE_IDENTITY_LINK_PASS {}", serde_json::json!({
            "platform": snapshot.platform,
            "osObserved": snapshot.entries.len(),
            "reviewedUpstreamIdentities": identity::REVIEWED.len(),
            "linkedRecords": links.len(),
            "linkedProjectIds": links.iter().map(|l| l.project_id.as_str()).collect::<Vec<_>>(),
            "requiresExactIdAndRepo": true,
            "codeSignatureVerified": false,
            "installationAuthorized": false,
            "noNameHeuristics": true,
        }));
        return Ok(());
    }
    if args.iter().any(|a| a == "--check-device-only") {
        let snapshot = device::collect().map_err(|e| format!("Local OS discovery refused: {e}"))?;
        device::validate(&snapshot).map_err(|e| format!("Untrusted native device evidence: {e}"))?;
        println!("NATIVE_OS_REGISTRATION_PASS {}", serde_json::json!({
            "platform": snapshot.platform, "scope": snapshot.scope,
            "status": snapshot.status, "rows": snapshot.entries.len(),
            "truncated": snapshot.truncated, "readOnly": true,
            "installedCertainty": false, "networkOrInstaller": false
        }));
        return Ok(());
    }
    let initial = sidecar::read_catalog().map_err(|e| format!("Native startup denied: {e}"))?;

    if check_backend {
        println!("RUST_HOST_LIVE_BACKEND_PASS {}", serde_json::json!({
            "count": initial.items.len(),
            "managed": initial.counts.managed,
            "curated": initial.counts.curated,
            "research": initial.counts.research,
            "focusDomains": domain_counts(&initial.items).len(),
            "verifiedMedia": initial.items.iter().filter(|p| !media_id(p).is_empty()).count(),
            "inventoryScope": initial.inventory.scope,
            "inventoryStatus": initial.inventory.status,
            "assessedManaged": initial.inventory.assessed_managed_count,
            "managedDetected": initial.items.iter()
                .filter(|p| p.kind == "managed" && p.managed_install_signal == "detected").count(),
            "engineVersion": initial.engine_version,
            "platform": initial.host_platform,
            "arch": initial.host_arch,
            "readOnly": !initial.write_actions_exposed,
            "scannerDisabled": initial.network_scan_disabled,
        }));
        return Ok(());
    }

    let ui = AppWindow::new()?;
    ui.set_pdfcraft_install_supported(cfg!(all(target_os="windows",target_arch="x86_64")));
    let state = Rc::new(RefCell::new(State::default()));
    {
        let mut s = state.borrow_mut();
        s.event("Initial local engine read", &format!(
            "{} · {} source records · managed detector {}",
            initial.inventory.checked_at, initial.items.len(), initial.inventory.status
        ), "OK");
        s.inventory = Some(initial.inventory);
        s.all = initial.items;
        redraw(&ui, &mut s);
    }

    ui.on_navigate({
        let state = Rc::clone(&state); let weak = ui.as_weak();
        move |dest| if let Some(w) = weak.upgrade() {
            let dest = dest.to_string();
            if ["home","library","device","activity"].contains(&dest.as_str()) {
                let mut state = state.borrow_mut();
                state.push(Route::simple(&dest));
                redraw(&w, &mut state);
            }
        }
    });
    ui.on_open_discipline({
        let state = Rc::clone(&state); let weak = ui.as_weak();
        move |domain| if let Some(w) = weak.upgrade() {
            let domain = domain.to_string();
            if DOMAINS.iter().any(|(id,_)| *id == domain) {
                let mut state = state.borrow_mut();
                state.push(Route::results(&domain, ""));
                redraw(&w, &mut state);
            }
        }
    });
    ui.on_search_edited({
        let state = Rc::clone(&state); let weak = ui.as_weak();
        move |query| if let Some(w) = weak.upgrade() {
            let mut state = state.borrow_mut();
            state.route_mut().query = query.to_string();
            redraw(&w, &mut state);
        }
    });
    ui.on_search_submitted({
        let state = Rc::clone(&state); let weak = ui.as_weak();
        move |query| if let Some(w) = weak.upgrade() {
            let mut state = state.borrow_mut();
            if state.route().page == "home" {
                state.push(Route::results("all", &query));
            } else if state.route().page == "results" {
                state.route_mut().query = query.to_string();
            }
            redraw(&w, &mut state);
        }
    });
    ui.on_open_project({
        let state = Rc::clone(&state); let weak = ui.as_weak();
        move |index| if let Some(w) = weak.upgrade() {
            let mut state = state.borrow_mut();
            if state.route().page != "results" { return; }
            if let Ok(index) = usize::try_from(index) {
                if index >= state.route().limit { return; }
                if let Some(p) = state.visible.get(index) {
                    let selected = p.id.clone();
                    let mut detail = state.route().clone();
                    detail.page = "detail".into();
                    detail.selected = Some(selected);
                    state.push(detail);
                    redraw(&w, &mut state);
                }
            }
        }
    });
    ui.on_load_more({
        let state = Rc::clone(&state); let weak = ui.as_weak();
        move || if let Some(w) = weak.upgrade() {
            let mut state = state.borrow_mut();
            if state.route().page != "results" { return; }
            state.route_mut().limit = state.route().limit.saturating_add(PAGE_SIZE);
            redraw(&w, &mut state);
        }
    });
    ui.on_go_back({
        let state = Rc::clone(&state); let weak = ui.as_weak();
        move || if let Some(w) = weak.upgrade() {
            let mut state = state.borrow_mut();
            state.back(); redraw(&w, &mut state);
        }
    });
    ui.on_go_forward({
        let state = Rc::clone(&state); let weak = ui.as_weak();
        move || if let Some(w) = weak.upgrade() {
            let mut state = state.borrow_mut();
            state.forward(); redraw(&w, &mut state);
        }
    });
    ui.on_open_source({
        let state = Rc::clone(&state);
        move || {
            let state = state.borrow();
            if let Some(id) = &state.route().selected {
                if let Some(url) = state.all.iter().find(|p| &p.id == id).and_then(|p| safe_source(&p.source)) {
                    if let Err(e) = webbrowser::open(&url) { eprintln!("NATIVE_SOURCE_OPEN_FAILED {e}"); }
                }
            }
        }
    });
    ui.on_toggle_theme({
        let weak = ui.as_weak();
        move || if let Some(w) = weak.upgrade() {
            w.set_dark_mode(!w.get_dark_mode());
        }
    });
    ui.on_device_search_edited({
        let state = Rc::clone(&state); let weak = ui.as_weak();
        move |value| if let Some(w) = weak.upgrade() {
            let mut s = state.borrow_mut();
            s.device_query = value.to_string();
            update_os_device_panel(&w, &s);
        }
    });
    ui.on_open_device_project({
        let state = Rc::clone(&state); let weak = ui.as_weak();
        move |id| if let Some(w) = weak.upgrade() {
            let mut s = state.borrow_mut();
            if s.route().page != "device" { return; }
            let Some(snapshot) = &s.device_snapshot else { return; };
            // The callback value is not trusted: recompute the pinned identity
            // linkage from the current OS observation and source catalog.
            let matches = identity::catalog_links(snapshot, &s.all).unwrap_or_default();
            if matches.iter().any(|m| m.project_id == id.as_str()) {
                let mut target = s.route().clone();
                target.page = "detail".into();
                target.selected = Some(id.to_string());
                s.push(target);
                redraw(&w, &mut s);
            }
        }
    });

    // Source-approved installer review, isolated from the read-only catalog
    // and OS inventory probes. Nothing is downloaded during review.
    let (installer_tx, installer_rx) = mpsc::channel::<InstallerEvent>();
    let installer_plan = Rc::new(RefCell::new(None::<install::InstallPlan>));
    let installer_busy = Rc::new(Cell::new(false));
    let installer_cancel = Rc::new(RefCell::new(None::<Arc<AtomicBool>>));
    let installer_jobs = Rc::new(RefCell::new(Vec::<thread::JoinHandle<()>>::new()));

    ui.on_review_install({
        let state = Rc::clone(&state);
        let tx = installer_tx.clone();
        let plan = Rc::clone(&installer_plan);
        let busy = Rc::clone(&installer_busy);
        let jobs = Rc::clone(&installer_jobs);
        let weak = ui.as_weak();
        move || if let Some(w) = weak.upgrade() {
            if w.get_page() != "detail" || busy.get() {return;}
            let source = {
                let s = state.borrow();
                s.route().selected.as_ref().and_then(|id|
                    s.all.iter().find(|p| &p.id == id)
                ).filter(|p| install::eligible_source(p)).cloned()
            };
            let Some(project) = source else {return;};
            busy.set(true);
            *plan.borrow_mut() = None;
            w.set_install_busy(true);
            w.set_install_ready(false);
            w.set_install_approved(false);
            w.set_install_cancel_allowed(false);
            w.set_install_cancel_requested(false);
            w.set_install_message("Checking GitHub's official release digest and reviewed installer policy…".into());
            w.set_install_stage("REVIEWING".into());
            w.set_install_percent(-1);
            let tx = tx.clone();
            jobs.borrow_mut().push(thread::spawn(move || {
                let id = project.id.clone();
                let result = install::review(&project);
                let _ = tx.send(InstallerEvent::Reviewed{project_id:id,result});
            }));
        }
    });

    ui.on_confirm_install({
        let state = Rc::clone(&state);
        let tx = installer_tx.clone();
        let plan = Rc::clone(&installer_plan);
        let busy = Rc::clone(&installer_busy);
        let jobs = Rc::clone(&installer_jobs);
        let cancel = Rc::clone(&installer_cancel);
        let weak = ui.as_weak();
        move || if let Some(w) = weak.upgrade() {
            if w.get_page() != "detail" || !w.get_install_approved() ||
               !w.get_install_ready() || busy.get() {return;}
            let approved = plan.borrow().clone();
            let Some(approved) = approved else {return;};
            let eligible = {
                let s=state.borrow();
                s.route().selected.as_deref() == Some(approved.project_id.as_str()) &&
                s.all.iter().find(|p|p.id==approved.project_id)
                    .is_some_and(|p|install::validate_plan(&approved,p).is_ok())
            };
            if !eligible {
                w.set_install_message("The selected project changed; review this installer again.".into());
                w.set_install_ready(false);
                w.set_install_approved(false);
                *plan.borrow_mut() = None;
                return;
            }
            busy.set(true);
            w.set_install_busy(true);
            w.set_install_cancel_allowed(true);
            w.set_install_cancel_requested(false);
            w.set_install_message("Starting approved installation. Keep this window open.".into());
            w.set_install_stage("STARTING".into());
            w.set_install_percent(-1);
            state.borrow_mut().event("Explicitly approved native install",
                &format!("{} · {} · {}",approved.project_id,approved.tag,approved.asset_name),"RUNNING");
            let tx=tx.clone();
            let cancel_flag=Arc::new(AtomicBool::new(false));
            *cancel.borrow_mut()=Some(Arc::clone(&cancel_flag));
            jobs.borrow_mut().push(thread::spawn(move || {
                let id=approved.project_id.clone();
                let result=install::run_approved(&approved, |progress| {
                    let _=tx.send(InstallerEvent::Progress {
                        project_id:id.clone(),progress
                    });
                }, &cancel_flag);
                let _=tx.send(InstallerEvent::Finished{project_id:id,result});
            }));
        }
    });

    // A request is advisory until the worker proves it stopped before commit.
    // The Rust host never uses taskkill to implement a user's cancel click.
    ui.on_cancel_install({
        let state=Rc::clone(&state);
        let plan=Rc::clone(&installer_plan);
        let cancel=Rc::clone(&installer_cancel);
        let weak=ui.as_weak();
        move || if let Some(w)=weak.upgrade() {
            if w.get_page()!="detail" || !w.get_install_busy() ||
               !w.get_install_cancel_allowed() || w.get_install_cancel_requested() {return;}
            let id=plan.borrow().as_ref().map(|p|p.project_id.clone());
            let Some(id)=id else {return;};
            if state.borrow().route().selected.as_deref()!=Some(id.as_str()){return;}
            if let Some(flag)=cancel.borrow().as_ref(){
                flag.store(true,Ordering::SeqCst);
                w.set_install_cancel_requested(true);
                w.set_install_cancel_allowed(false);
                w.set_install_message("Safe cancellation requested. If file replacement already began, the verified install will finish instead.".into());
                state.borrow_mut().event("Explicit installer cancel request",&id,"REQUESTED");
            }
        }
    });

    let installer_timer = Timer::default();
    installer_timer.start(TimerMode::Repeated, Duration::from_millis(85), {
        let state=Rc::clone(&state);
        let weak=ui.as_weak();
        let plan=Rc::clone(&installer_plan);
        let busy=Rc::clone(&installer_busy);
        let cancel=Rc::clone(&installer_cancel);
        move || while let Ok(message)=installer_rx.try_recv() {
            let terminal=!matches!(message,InstallerEvent::Progress {..});
            if terminal {busy.set(false);}
            if let Some(w)=weak.upgrade() {
                if terminal {w.set_install_busy(false);}
                let mut s=state.borrow_mut();
                match message {
                    InstallerEvent::Reviewed{project_id,result} => match result {
                        Ok(found) => {
                            let same=s.route().page=="detail" &&
                                s.route().selected.as_deref()==Some(project_id.as_str());
                            s.event("Verified installer plan available",
                                &format!("{} · {} · {} · SHA-256 listed",project_id,found.tag,found.asset_name),"READY");
                            if same {w.set_install_stage("REVIEWED".into());w.set_install_percent(-1);}
                            if same {
                                w.set_install_ready(true);
                                w.set_install_approved(false);
                                w.set_install_version(found.tag.clone().into());
                                w.set_install_asset(found.asset_name.clone().into());
                                w.set_install_hash(found.sha256.clone().into());
                                w.set_install_destination(found.destination.clone().into());
                                w.set_install_message(format!(
                                    "Official asset size {:.1} MiB. Hash is published upstream and will be verified after download. Review it before approving.",
                                    found.asset_size as f64/1048576.0
                                ).into());
                                *plan.borrow_mut()=Some(found);
                            }
                        }
                        Err(err) => {
                            s.event("Installation unavailable",
                                &format!("{} · {}",project_id,err),"BLOCKED");
                            if s.route().selected.as_deref()==Some(project_id.as_str()) {
                                w.set_install_ready(false);
                                w.set_install_approved(false);
                                w.set_install_message(format!("Not installable here: {err}").into());
                                w.set_install_stage("UNAVAILABLE".into());
                                w.set_install_percent(-1);
                            }
                            *plan.borrow_mut()=None;
                        }
                    },
                    InstallerEvent::Progress{project_id,progress} => {
                        let same=s.route().page=="detail" &&
                            s.route().selected.as_deref()==Some(project_id.as_str());
                        if same && busy.get() {
                            if matches!(progress.stage,"COMMITTING"|"RECORDING"|"FINALIZING"|"RESTORED"){
                                w.set_install_cancel_allowed(false);
                            }
                            w.set_install_stage(progress.stage.into());
                            w.set_install_percent(progress.percent.map_or(-1,i32::from));
                            if !w.get_install_cancel_requested() ||
                                progress.stage=="COMMITTING" {
                                w.set_install_message(progress.message.clone().into());
                            }
                        }
                        s.event("Native installer progress",
                            &format!("{} · {} · {}",project_id,progress.stage,progress.message),
                            "RUNNING");
                    }
                    InstallerEvent::Finished{project_id,result} => {
                        let same=s.route().page=="detail" &&
                            s.route().selected.as_deref()==Some(project_id.as_str());
                        *plan.borrow_mut()=None;
                        *cancel.borrow_mut()=None;
                        if same {
                            w.set_install_ready(false);
                            w.set_install_approved(false);
                            w.set_install_cancel_allowed(false);
                            w.set_install_cancel_requested(false);
                        }
                        match result {
                            Ok(info) => {
                                s.event("Verified installation completed",&info,"OK");
                                if same {
                                    w.set_install_stage("COMPLETE".into());
                                    w.set_install_percent(-1);
                                    w.set_install_message(info.into());
                                }
                            }
                            Err(err) => {
                                let canceled=err.contains("INSTALL_CANCELLED_BEFORE_COMMIT");
                                if canceled {
                                    s.event("Installer safely canceled before commit",
                                        &project_id,"CANCELED");
                                }else{
                                    s.event("Approved installation failed",
                                        &format!("{} · {}",project_id,err),"ERROR");
                                }
                                if same {
                                    w.set_install_stage(if canceled{"CANCELED"}else{"FAILED"}.into());
                                    w.set_install_percent(-1);
                                    w.set_install_message(if canceled {
                                        "Cancellation confirmed before any application replacement.".into()
                                    }else{
                                        format!("Installation stopped/failed: {err}").into()
                                    });
                                }
                            }
                        }
                    }
                }
                update_device_panels(&w,&s);
            }
        }
    });

    // Explicit, read-only account-local installation history. Opening Activity
    // alone cannot imply a live background worker or current installed status.
    let (history_tx,history_rx)=mpsc::channel::<Result<install::HistoryResponse,String>>();
    let history_busy=Rc::new(Cell::new(false));
    let history_jobs=Rc::new(RefCell::new(Vec::<thread::JoinHandle<()>>::new()));
    ui.on_load_install_history({
        let tx=history_tx.clone();
        let busy=Rc::clone(&history_busy);
        let jobs=Rc::clone(&history_jobs);
        let weak=ui.as_weak();
        move || if let Some(w)=weak.upgrade() {
            if w.get_page()!="activity"||busy.replace(true){return;}
            w.set_install_history_loading(true);
            w.set_install_history_status("Reading bounded local installation records…".into());
            let tx=tx.clone();
            jobs.borrow_mut().push(thread::spawn(move || {
                let _=tx.send(install::read_local_history());
            }));
        }
    });
    let history_timer=Timer::default();
    history_timer.start(TimerMode::Repeated,Duration::from_millis(85),{
        let state=Rc::clone(&state);
        let busy=Rc::clone(&history_busy);
        let weak=ui.as_weak();
        move || while let Ok(result)=history_rx.try_recv() {
            busy.set(false);
            if let Some(w)=weak.upgrade() {
                w.set_install_history_loading(false);
                match result {
                    Ok(history)=>{
                        let count=history.entries.len();
                        let rows=history.entries.into_iter().map(|e| SessionEvent{
                            name:format!("{} · {}",e.project_id,e.tag).into(),
                            detail:format!("{} UTC · SHA-256 {}…",
                                &e.timestamp[..19],&e.sha256[..12]).into(),
                            outcome:e.state.into(),
                        }).collect::<Vec<_>>();
                        w.set_install_history_events(ModelRc::new(VecModel::from(rows)));
                        w.set_install_history_count(count as i32);
                        let note=if history.incomplete {
                            "Incomplete trailing record; the latest attempt may be unresolved."
                                .to_string()
                        }else if count==0 {
                            "No recorded Native installer attempts yet; older installations are not backfilled."
                                .to_string()
                        }else{
                            format!("{count} recorded attempts (local user only). UNRESOLVED is not proof of success or failure.")
                        };
                        w.set_install_history_status(note.into());
                        state.borrow_mut().event("Explicit installation history read",
                            &format!("{count} durable attempts; incomplete={}",history.incomplete),"OK");
                    }
                    Err(e)=>{
                        w.set_install_history_status(
                            format!("History unavailable: {e}. Existing snapshot is not refreshed.").into());
                        state.borrow_mut().event("Installation history read refused",
                            &e,"ERROR");
                    }
                }
                update_device_panels(&w,&state.borrow());
            }
        }
    });

    let (tx, rx) = mpsc::channel::<Result<Catalog, String>>();
    let busy = Rc::new(Cell::new(false));
    let jobs = Rc::new(RefCell::new(Vec::<thread::JoinHandle<()>>::new()));
    ui.on_refresh_requested({
        let tx = tx.clone(); let busy = Rc::clone(&busy);
        let jobs = Rc::clone(&jobs); let weak = ui.as_weak();
        move || {
            if busy.replace(true) { return; }
            if let Some(w) = weak.upgrade() { w.set_refreshing(true); }
            let tx = tx.clone();
            jobs.borrow_mut().push(thread::spawn(move || {
                let _ = tx.send(sidecar::read_catalog());
            }));
        }
    });

    let timer = Timer::default();
    timer.start(TimerMode::Repeated, Duration::from_millis(80), {
        let weak = ui.as_weak();
        let state = Rc::clone(&state);
        let busy = Rc::clone(&busy);
        move || {
            while let Ok(result) = rx.try_recv() {
                busy.set(false);
                if let Some(w) = weak.upgrade() {
                    w.set_refreshing(false);
                    match result {
                        Ok(catalog) => {
                            let mut s = state.borrow_mut();
                            s.event("Manual local engine refresh", &format!(
                                "{} · {} verified source records · managed {}",
                                catalog.inventory.checked_at, catalog.items.len(),
                                catalog.inventory.status
                            ), "OK");
                            s.inventory = Some(catalog.inventory);
                            s.all = catalog.items;
                            redraw(&w, &mut s);
                            eprintln!("FOCUS_NATIVE_REFRESH_PASS {}", w.get_total());
                        }
                        Err(e) => {
                            let mut s = state.borrow_mut();
                            s.event("Manual local engine refresh refused",
                                "No update applied; prior verified snapshot preserved. See local stderr.", "ERROR");
                            redraw(&w, &mut s);
                            eprintln!("FOCUS_NATIVE_REFRESH_REFUSED {e}");
                        },
                    }
                }
            }
        }
    });

    // A second, independent one-shot channel: OS registration evidence is read
    // ONLY after the user explicitly invokes Inspect local apps. Neither the
    // initial catalog read nor general Refresh starts this device probe.
    let (device_tx, device_rx) = mpsc::channel::<Result<device::DeviceSnapshot, String>>();
    let device_busy = Rc::new(Cell::new(false));
    let device_jobs = Rc::new(RefCell::new(Vec::<thread::JoinHandle<()>>::new()));
    ui.on_device_read_requested({
        let tx = device_tx.clone();
        let busy = Rc::clone(&device_busy);
        let jobs = Rc::clone(&device_jobs);
        let weak = ui.as_weak();
        move || {
            if busy.replace(true) { return; }
            if let Some(w) = weak.upgrade() { w.set_device_reading(true); }
            let tx = tx.clone();
            jobs.borrow_mut().push(thread::spawn(move || {
                let snapshot = device::collect().and_then(|s| {
                    device::validate(&s)?;
                    Ok(s)
                });
                let _ = tx.send(snapshot);
            }));
        }
    });
    let device_timer = Timer::default();
    device_timer.start(TimerMode::Repeated, Duration::from_millis(75), {
        let state = Rc::clone(&state);
        let busy = Rc::clone(&device_busy);
        let weak = ui.as_weak();
        move || {
            while let Ok(result) = device_rx.try_recv() {
                busy.set(false);
                if let Some(w) = weak.upgrade() {
                    w.set_device_reading(false);
                    let mut s = state.borrow_mut();
                    match result {
                        Ok(snapshot) => {
                            s.event("Explicit native OS registration read",
                                &format!("{} observed {} records; truncated={}",
                                    snapshot.scope, snapshot.entries.len(), snapshot.truncated),
                                "OK");
                            eprintln!("NATIVE_DEVICE_READ_PASS scope={} rows={} capped={}",
                                snapshot.scope, snapshot.entries.len(), snapshot.truncated);
                            s.device_snapshot = Some(snapshot);
                            s.device_error = None;
                        }
                        Err(error) => {
                            s.event("Native OS registration read refused",
                                "No new local observations applied; prior snapshot preserved", "ERROR");
                            eprintln!("NATIVE_DEVICE_READ_REFUSED {error}");
                            s.device_error = Some(error.chars().take(180).collect());
                        }
                    }
                    update_os_device_panel(&w, &s);
                    update_device_panels(&w, &s);
                }
            }
        }
    });

    // Pure UI freshness indicator; never rescans the machine or launches a
    // worker. When the last explicit observation expires, hide all reviewed
    // source links until the user explicitly inspects the local OS again.
    let device_age_timer = Timer::default();
    device_age_timer.start(TimerMode::Repeated, Duration::from_secs(10), {
        let weak = ui.as_weak();
        let state = Rc::clone(&state);
        move || if let Some(w) = weak.upgrade() {
            if w.get_page() != "device" { return; }
            let s = state.borrow();
            if let Some(snapshot) = &s.device_snapshot {
                if w.get_device_status() == "observed" && !device::is_current(snapshot) {
                    update_os_device_panel(&w, &s);
                } else {
                    w.set_device_age(device::age_ms(snapshot)
                        .map_or_else(|| "invalid observation time".to_string(),
                            |ms| format!("last read {}s ago", ms / 1000)).into());
                }
            }
        }
    });

    if args.iter().any(|a| a == "--qa-verify-stale") {
        // An explicit, deterministic QA case: use a genuine bounded local
        // observation with a simulated 121-second age. Never wait two minutes
        // or pretend this is a newly measured stale device status.
        let mut sample = device::collect()?;
        let expected = sample.entries.len();
        sample.timestamp_ms = sample.timestamp_ms.saturating_sub(121_000);
        {
            let mut s = state.borrow_mut();
            s.device_snapshot = Some(sample);
            s.push(Route::simple("device"));
            redraw(&ui, &mut s);
        }
        if ui.get_device_status() != "stale"
            || ui.get_device_linked() != 0
            || ui.get_device_entries().row_count() != expected
            || ui.get_device_age().is_empty()
        {
            return Err("Stale device snapshot UI falsely retained trusted links".into());
        }
        println!("NATIVE_DEVICE_STALE_UI_PASS {}", serde_json::json!({
            "scope": "previous local observation",
            "visibleRecords": expected, "linkedRecords": 0,
            "ageSimulationSeconds": 121, "autoRescan": false,
            "reinspectionRequired": true, "readOnly": true
        }));
        return Ok(());
    }

    if args.iter().any(|a| a == "--qa-review-install" || a == "--qa-preview-install") {
        // Explicit QA on real official metadata. No download/installation.
        ui.invoke_search_submitted("Compositor".into());
        ui.invoke_open_project(0);
        if ui.get_page() != "detail" || ui.get_detail_name() != "Compositor" {
            return Err("Official Compositor project not present in source catalog".into());
        }
        ui.invoke_review_install();
        if args.iter().any(|a| a == "--qa-review-install") {
            let weak = ui.as_weak();
            Timer::single_shot(Duration::from_secs(10), move || {
                if let Some(w) = weak.upgrade() {
                    if !w.get_install_ready() || w.get_install_busy() ||
                        w.get_install_hash().len()!=64 ||
                        w.get_install_version().is_empty() ||
                        w.get_install_approved() {
                        eprintln!("NATIVE_INSTALL_REVIEW_FAIL source review incomplete/implicitly approved");
                        std::process::exit(3);
                    }
                    // Forged confirmation without a user's approval MUST do nothing.
                    w.invoke_confirm_install();
                    if w.get_install_busy() || w.get_install_approved() {
                        eprintln!("NATIVE_INSTALL_REVIEW_FAIL install without explicit approval");
                        std::process::exit(3);
                    }
                    eprintln!("NATIVE_INSTALL_REVIEW_PASS official release shown, no downloads or installs");
                    let _ = w.hide();
                }
            });
        }
    }

    // Deterministic visual QA routes. Developer-preview only; self-closing
    // windows, no machine scans, downloads, installers or background tasks.
    if args.iter().any(|a| a == "--qa-preview-library") {
        ui.invoke_navigate("library".into());
    }
    if args.iter().any(|a| a == "--qa-preview-device" ||
        a == "--qa-preview-identity") {
        ui.invoke_navigate("device".into());
        if args.iter().any(|a| a == "--qa-preview-identity") {
            let mut s = state.borrow_mut();
            s.device_query = "RustDesk".into();
            update_os_device_panel(&ui, &s);
        }
        ui.invoke_device_read_requested();
    }
    if args.iter().any(|a| a == "--qa-preview-activity" || a == "--qa-preview-activity-refresh") {
        ui.invoke_navigate("activity".into());
    }
    if args.iter().any(|a| a == "--qa-preview-activity-refresh") {
        // Explicit developer QA of a true manual read; never starts an installer.
        ui.invoke_refresh_requested();
    }
    if args.iter().any(|a| a == "--qa-preview-results") {
        ui.invoke_search_submitted("".into());
    }
    if args.iter().any(|a| a == "--qa-preview-dune") {
        ui.invoke_search_submitted("Dune 3D".into());
        ui.invoke_open_project(0);
    }
    if args.iter().any(|a| ["--qa-preview-results", "--qa-preview-dune",
        "--qa-preview-library", "--qa-preview-activity",
        "--qa-preview-activity-refresh", "--qa-preview-device",
        "--qa-preview-identity", "--qa-preview-install"].contains(&a.as_str())) {
        let weak = ui.as_weak();
        Timer::single_shot(Duration::from_secs(22), move || {
            if let Some(w) = weak.upgrade() { let _ = w.hide(); }
        });
    }

    if args.iter().any(|a| a == "--qa-verify-identity") {
        // Explicit developer-only interactive regression. This scenario is
        // only meaningful on a machine with the reviewed RustDesk bundle.
        ui.invoke_navigate("device".into());
        ui.invoke_device_read_requested();
        let weak = ui.as_weak();
        Timer::single_shot(Duration::from_secs(4), move || {
            if let Some(w) = weak.upgrade() {
                let fail = |error: &str| {
                    eprintln!("NATIVE_IDENTITY_GUI_FAIL {error}");
                    std::process::exit(3);
                };
                if w.get_page() != "device" || w.get_device_status() != "observed"
                    || w.get_device_linked() < 1 {
                    fail("No reviewed device registration available");
                }
                w.invoke_open_device_project("curated:dune3d".into());
                if w.get_page() != "device" { fail("Forged device project callback accepted"); }
                w.invoke_open_device_project("curated:rustdesk".into());
                if w.get_page() != "detail" || w.get_detail_name() != "RustDesk" {
                    fail("Pinned RustDesk native ID did not open proper project dossier");
                }
                w.invoke_go_back();
                if w.get_page() != "device" { fail("Native device-to-dossier back navigation"); }
                eprintln!("NATIVE_IDENTITY_GUI_PASS RustDesk · exact reviewed upstream/native ID only");
                let _ = w.hide();
            }
        });
    }

    if args.iter().any(|a|a=="--qa-history-read") {
        // Explicit native Activity control reads only the account-local file.
        // No installation, online release lookup or OS inventory probe.
        ui.invoke_navigate("activity".into());
        ui.invoke_load_install_history();
        let weak=ui.as_weak();
        Timer::single_shot(Duration::from_secs(6),move || {
            if let Some(w)=weak.upgrade(){
                let status=w.get_install_history_status();
                if w.get_install_history_loading() ||
                    status.is_empty() || status.contains("History unavailable") ||
                    status.contains("Reading bounded") {
                    eprintln!("NATIVE_INSTALL_HISTORY_READ_FAIL {status}");
                    std::process::exit(3);
                }
                eprintln!("NATIVE_INSTALL_HISTORY_READ_PASS {}",
                    serde_json::json!({"entries":w.get_install_history_count(),
                        "readOnly":true,"notLiveWorkerQueue":true}));
                let _=w.hide();
            }
        });
    }

    if smoke {
        let weak = ui.as_weak();
        Timer::single_shot(Duration::from_millis(600), move || {
            if let Some(w) = weak.upgrade() {
                let fail = |error: &str| { eprintln!("FOCUS_NATIVE_GUI_FAIL {error}"); std::process::exit(3); };
                if w.get_page() != "home" || w.get_disciplines_left().row_count()
                    + w.get_disciplines_right().row_count() != 17 || w.get_total() != 181 {
                    fail("17-domain home or source count");
                }
                w.invoke_search_submitted("Composa".into());
                if w.get_page() != "results" || w.get_matching() == 0 { fail("home search navigation"); }
                w.invoke_open_project(0);
                if w.get_page() != "detail" || w.get_detail_name().is_empty() { fail("full page dossier"); }
                if w.get_install_ready() || w.get_install_busy() || w.get_install_approved() {
                    fail("Installer must not initialize automatically on dossier navigation");
                }
                w.invoke_confirm_install();
                w.invoke_cancel_install();
                if w.get_install_busy() || w.get_install_cancel_requested() {
                    fail("Installer or cancel accepted without explicit install approval");
                }
                w.invoke_go_back();
                if w.get_page() != "results" { fail("back to results"); }
                w.invoke_go_forward();
                if w.get_page() != "detail" { fail("native forward navigation"); }
                w.invoke_navigate("home".into());
                w.invoke_open_discipline("3D & Manufacturing".into());
                if w.get_page() != "results" || w.get_matching() == 0 { fail("discipline mapping"); }
                w.invoke_navigate("library".into());
                if w.get_page() != "library" || w.get_managed_entries().row_count() != 14 {
                    fail("14 real managed inventory evidence rows");
                }
                if cfg!(target_os = "linux") {
                    if w.get_inventory_status() != "unsupported" ||
                        w.get_managed_assessed() != 0 || w.get_managed_detected() != 0 {
                        fail("Linux unsupported inventory must not infer installed status");
                    }
                } else if w.get_inventory_status() != "assessed" ||
                    w.get_managed_assessed() != 14 || w.get_managed_detected() > 14 ||
                    w.get_managed_updates() > w.get_managed_detected() {
                    fail("real managed inventory counts or provenance");
                }
                w.invoke_navigate("device".into());
                if w.get_page() != "device" || w.get_device_status() != "not-read"
                    || w.get_device_total() != 0 || w.get_device_linked() != 0 {
                    fail("native OS probe must NOT execute without explicit request");
                }
                w.invoke_navigate("activity".into());
                if w.get_page() != "activity" || w.get_session_event_count() != 1 ||
                    w.get_session_events().row_count() != 1 {
                    fail("native session diagnostics, not transient backend job queue");
                }
                w.invoke_toggle_theme();
                if !w.get_dark_mode() { fail("dark appearance"); }
                w.invoke_navigate("home".into());
                w.invoke_search_submitted("".into());
                if w.get_matching() != 181 || w.get_showing() != 30 || !w.get_has_more() {
                    fail("default 30 and complete catalog");
                }
                w.invoke_load_more();
                if w.get_showing() != 60 { fail("real show more"); }
                w.invoke_search_submitted("intentionally-no-such-project-xyz".into());
                if w.get_matching() != 0 { fail("empty search state"); }
                w.invoke_search_submitted("".into());
                if w.get_matching() != 181 { fail("clear search restores entire index"); }
                w.invoke_navigate("home".into());
                w.invoke_search_submitted("Dune 3D".into());
                w.invoke_open_project(0);
                if w.get_page() != "detail" || w.get_detail_media() != "dune3d" {
                    fail("source-verified Dune 3D screenshot");
                }
                w.invoke_navigate("home".into());
                w.invoke_search_submitted("Material Maker".into());
                w.invoke_open_project(0);
                if w.get_page() != "detail" || w.get_detail_media() != "material-maker" {
                    fail("source-verified Material Maker screenshot");
                }
                eprintln!("FOCUS_NATIVE_GUI_PASS {}", serde_json::json!({
                    "count": w.get_total(), "disciplines": 17,
                    "pages": ["home","results","detail","library","activity"],
                    "history": "back+forward", "pageSize": 30,
                    "pageSizeVerified": 60, "sourceScreenshots": 2, "darkMode": true,
                    "managedCoverage": w.get_managed_assessed(),
                    "managedDetected": w.get_managed_detected(),
                    "sessionEvents": w.get_session_event_count(),
                    "engine": "real Preview12", "renderer": "Rust/Slint",
                    "startToReadyMs": started.elapsed().as_millis(),
                    "noWebView": true, "catalogIPCReadOnly": true,
                    "nativeInstallerRequiresApproval": true,
                    "automaticInstalls": false
                }));
                let _ = w.hide();
            }
        });
    }

    ui.run()?;
    // In-flight Refresh can never outlive the host or leave a Node engine orphaned.
    for job in jobs.borrow_mut().drain(..) { let _ = job.join(); }
    for job in device_jobs.borrow_mut().drain(..) { let _ = job.join(); }
    for job in history_jobs.borrow_mut().drain(..) { let _ = job.join(); }
    // An approved install belongs to the session; do not abandon its verified
    // worker as an uncontrolled background process if the window is closed.
    for job in installer_jobs.borrow_mut().drain(..) { let _ = job.join(); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_events_are_ephemeral_and_bounded() {
        let mut state = State::default();
        assert!(state.events.is_empty());
        for n in 0..36 {
            state.event("Local snapshot", &format!("read #{}", n), "OK");
        }
        assert_eq!(state.events.len(), 32);
        assert_eq!(state.events.first().unwrap().detail, "read #4");
        assert_eq!(state.events.last().unwrap().outcome, "OK");
    }

    #[test]
    fn history_restores_discovery_query_and_clears_forward_after_new_route() {
        let mut s = State::default();
        s.push(Route::results("all", "Composa"));
        let detail = Route { page: "detail".into(), selected: Some("curated:test".into()),
            ..s.route().clone() };
        s.push(detail);
        s.back();
        assert_eq!(s.route().query, "Composa");
        s.forward();
        assert_eq!(s.route().page, "detail");
        s.back();
        s.push(Route::simple("activity"));
        assert_eq!(s.history.len(), 3);
        assert_eq!(s.route().page, "activity");
    }

    #[test]
    fn official_screenshot_routing_requires_exact_pinned_identity() {
        let mut p = Project {
            id:"curated:dune3d".into(), name:"Dune 3D".into(),
            maker:"Independent".into(), category:"CAD & engineering".into(),
            summary:"CAD".into(), platforms:"Linux".into(),
            evidence:"Curated source".into(), source:"https://github.com/dune3d/dune3d".into(),
            kind:"curated".into(), license:"GPL-3.0".into(), challenges:"".into(),
            release:"".into(), managed_install_signal:"".into(), installed_version:"".into(),
            latest_version:"".into(), update_hint:false
        };
        assert_eq!(media_id(&p), "dune3d");
        p.kind = "research".into();
        assert_eq!(media_id(&p), "");
        p.kind = "curated".into();
        p.source = "https://github.com/dune3d-fake/dune3d".into();
        assert_eq!(media_id(&p), "");
    }

    #[test]
    fn source_link_is_explicitly_allowlisted() {
        assert_eq!(safe_source("https://github.com/owner/repo"),
            Some("https://github.com/owner/repo".into()));
        for value in ["http://github.com/a/b", "https://github.com.evil.tld/a/b",
            "https://someone@github.com/a/b", "https://127.0.0.1/a/b",
            "https://github.com:8080/a/b", "javascript:alert(1)", "https://github.com/"
        ] {
            assert!(safe_source(value).is_none(), "Unexpected safe link: {value}");
        }
    }
}
