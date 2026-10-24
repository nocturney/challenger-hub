mod catalog;
mod sidecar;

use catalog::{domain_counts, domain_label, domain_of, filtered_domain, Catalog, Inventory, Project, DOMAINS};
use slint::{ComponentHandle, Model, ModelRc, SharedString, Timer, TimerMode, VecModel};
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
    sync::mpsc,
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
    events: Vec<SessionEvent>,
}

impl Default for State {
    fn default() -> Self {
        Self {
            all: Vec::new(), visible: Vec::new(), history: vec![Route::home()], cursor: 0,
            inventory: None, events: Vec::new(),
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
        "managed" => "Managed listing — installation not enabled in Native Preview",
        _ => "Independent source listing — installation not verified",
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
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let started = Instant::now();
    let args: Vec<String> = std::env::args().collect();
    let check_backend = args.iter().any(|a| a == "--check-backend-only");
    let smoke = args.iter().any(|a| a == "--smoke");
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
            if ["home","library","activity"].contains(&dest.as_str()) {
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

    // Deterministic visual QA routes. Developer-preview only; self-closing
    // windows, no machine scans, downloads, installers or background tasks.
    if args.iter().any(|a| a == "--qa-preview-library") {
        ui.invoke_navigate("library".into());
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
        "--qa-preview-activity-refresh"].contains(&a.as_str())) {
        let weak = ui.as_weak();
        Timer::single_shot(Duration::from_secs(22), move || {
            if let Some(w) = weak.upgrade() { let _ = w.hide(); }
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
                    "noWebView": true, "writeActionsExposed": false
                }));
                let _ = w.hide();
            }
        });
    }

    ui.run()?;
    // In-flight Refresh can never outlive the host or leave a Node engine orphaned.
    for job in jobs.borrow_mut().drain(..) { let _ = job.join(); }
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
