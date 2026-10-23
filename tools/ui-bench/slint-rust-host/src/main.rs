mod catalog;
mod sidecar;

use catalog::{categories, filtered, Catalog, Project};
use slint::{ComponentHandle, ModelRc, SharedString, Timer, TimerMode, VecModel};
use std::{
    cell::{Cell, RefCell},
    rc::Rc,
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

slint::include_modules!();

#[derive(Default)]
struct State {
    all: Vec<Project>,
    visible: Vec<Project>,
    selected: Option<String>,
}

fn as_entry(p: &Project) -> ProjectEntry {
    ProjectEntry {
        id: p.id.clone().into(),
        initial: p.name.chars().next().unwrap_or('?').to_string().into(),
        name: p.name.clone().into(),
        maker: p.maker.clone().into(),
        category: p.category.clone().into(),
        summary: p.summary.clone().into(),
        platforms: p.platforms.clone().into(),
        evidence: p.evidence.clone().into(),
        source: p.source.clone().into(),
    }
}

fn set_detail(ui: &AppWindow, p: Option<&Project>) {
    if let Some(p) = p {
        ui.set_detail_name(p.name.clone().into());
        ui.set_detail_initial(p.name.chars().next().unwrap_or('?').to_string().into());
        ui.set_detail_maker(p.maker.clone().into());
        ui.set_detail_summary(p.summary.clone().into());
        ui.set_detail_category(p.category.clone().into());
        ui.set_detail_platforms(p.platforms.clone().into());
        ui.set_detail_source(p.source.clone().into());
        ui.set_detail_evidence(p.evidence.clone().into());
    } else {
        ui.set_detail_name("No matches".into());
        ui.set_detail_initial("?".into());
        ui.set_detail_maker("".into());
        ui.set_detail_summary("Try another search or discipline.".into());
        ui.set_detail_category("".into());
        ui.set_detail_platforms("".into());
        ui.set_detail_source("".into());
        ui.set_detail_evidence("".into());
    }
}

fn update_view(ui: &AppWindow, state: &mut State) {
    let query = ui.get_search_term().to_string();
    let category = ui.get_active_category().to_string();
    state.visible = filtered(&state.all, &query, &category)
        .into_iter().cloned().collect();
    if !state.visible.iter().any(|p| state.selected.as_ref() == Some(&p.id)) {
        state.selected = state.visible.first().map(|p| p.id.clone());
    }
    let selected_index = state.visible.iter()
        .position(|p| state.selected.as_ref() == Some(&p.id))
        .unwrap_or(0);
    ui.set_entries(ModelRc::new(VecModel::from(
        state.visible.iter().map(as_entry).collect::<Vec<_>>()
    )));
    ui.set_total(state.all.len() as i32);
    ui.set_visible_total(state.visible.len() as i32);
    ui.set_selected_index(selected_index as i32);
    set_detail(ui, state.visible.get(selected_index));
}

fn set_catalog(ui: &AppWindow, state: &mut State, catalog: Catalog) {
    state.all = catalog.items;
    let labels = categories(&state.all).into_iter()
        .map(SharedString::from).collect::<Vec<_>>();
    ui.set_categories(ModelRc::new(VecModel::from(labels)));
    // Preserve current query/category on Refresh, but never silently hide all
    // research entries from the unfiltered catalogue.
    let category = ui.get_active_category().to_string();
    if !categories(&state.all).contains(&category) {
        ui.set_active_category("All disciplines".into());
    }
    update_view(ui, state);
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let started = Instant::now();
    let args: Vec<String> = std::env::args().collect();
    let read_only = args.iter().any(|a| a == "--check-backend-only");
    let smoke = args.iter().any(|a| a == "--smoke");
    let initial = sidecar::read_catalog().map_err(|e| format!("Native startup denied: {e}"))?;

    if read_only {
        println!("RUST_HOST_LIVE_BACKEND_PASS {}", serde_json::json!({
            "count": initial.items.len(),
            "managed": initial.counts.managed,
            "curated": initial.counts.curated,
            "research": initial.counts.research,
            "engineVersion": initial.engine_version,
            "platform": initial.host_platform,
            "arch": initial.host_arch,
            "readOnly": !initial.write_actions_exposed,
            "scannerDisabled": initial.network_scan_disabled
        }));
        return Ok(());
    }

    let ui = AppWindow::new()?;
    let state = Rc::new(RefCell::new(State::default()));
    set_catalog(&ui, &mut state.borrow_mut(), initial);

    ui.on_search_changed({
        let weak = ui.as_weak();
        let state = Rc::clone(&state);
        move |query| if let Some(w) = weak.upgrade() {
            w.set_search_term(query);
            update_view(&w, &mut state.borrow_mut());
        }
    });
    ui.on_category_changed({
        let weak = ui.as_weak();
        let state = Rc::clone(&state);
        move |category| if let Some(w) = weak.upgrade() {
            w.set_active_category(category);
            update_view(&w, &mut state.borrow_mut());
        }
    });
    ui.on_selected({
        let weak = ui.as_weak();
        let state = Rc::clone(&state);
        move |index| if let Some(w) = weak.upgrade() {
            if let Ok(index) = usize::try_from(index) {
                let mut state = state.borrow_mut();
                if let Some(p) = state.visible.get(index) {
                    state.selected = Some(p.id.clone());
                    w.set_selected_index(index as i32);
                    set_detail(&w, state.visible.get(index));
                }
            }
        }
    });

    // Manual Refresh is the ONLY subsequent engine invocation. The read occurs
    // off the UI thread; all Slint state updates remain on the UI event loop.
    let (tx, rx) = mpsc::channel::<Result<Catalog, String>>();
    let busy = Rc::new(Cell::new(false));
    let jobs = Rc::new(RefCell::new(Vec::<thread::JoinHandle<()>>::new()));
    ui.on_refresh_requested({
        let tx = tx.clone();
        let busy = Rc::clone(&busy);
        let jobs = Rc::clone(&jobs);
        move || {
            if busy.replace(true) { return; }
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
                    match result {
                        Ok(catalog) => {
                            set_catalog(&w, &mut state.borrow_mut(), catalog);
                            eprintln!("RUST_HOST_MANUAL_REFRESH_PASS {}", w.get_total());
                        }
                        Err(e) => eprintln!("RUST_HOST_REFRESH_REFUSED {e}"),
                    }
                }
            }
        }
    });

    if smoke {
        let weak = ui.as_weak();
        Timer::single_shot(Duration::from_millis(550), move || {
            if let Some(w) = weak.upgrade() {
                w.invoke_search_changed("Composa".into());
                let search_ok = w.get_visible_total() > 0 && w.get_detail_name() == "Composa";
                w.invoke_search_changed("".into());
                if search_ok && w.get_visible_total() == 181 {
                    eprintln!("RUST_HOST_NATIVE_GUI_PASS {}", serde_json::json!({
                        "count": w.get_total(),
                        "search": "Composa",
                        "renderer": "Slint/Rust",
                        "webView": false,
                        "startToReadyMs": started.elapsed().as_millis()
                    }));
                } else {
                    eprintln!("RUST_HOST_NATIVE_GUI_FAIL search callback or model parity");
                    std::process::exit(3);
                }
                let _ = w.hide();
            }
        });
    }

    ui.run()?;
    // A late Refresh must finish (or be killed by the bounded supervisor)
    // before this host exits, so its Challenger child cannot be abandoned.
    for job in jobs.borrow_mut().drain(..) {
        let _ = job.join();
    }
    Ok(())
}
