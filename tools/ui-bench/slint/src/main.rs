use slint::{ComponentHandle, ModelRc, SharedString, Timer, VecModel};
use serde::Deserialize;
use std::{collections::HashMap, rc::Rc, time::{Duration, Instant}};

slint::include_modules!();

#[derive(Clone, Deserialize)]
struct Project {
    id: String, name: String, maker: String, category: String, summary: String,
    platforms: String, evidence: String, source: String, kind: String,
}
#[derive(Deserialize)]
struct Fixture { #[serde(rename="entryCount")] entry_count: usize, entries: Vec<Project> }

fn filtered<'a>(all: &'a [Project], q: &str, category: &str) -> Vec<&'a Project> {
    let term = q.trim().to_lowercase();
    all.iter().filter(|x| {
        (category == "All disciplines" || x.category == category) &&
        (term.is_empty() ||
         [&x.name, &x.maker, &x.category, &x.summary].iter()
            .any(|v| v.to_lowercase().contains(&term)))
    }).collect()
}
fn transfer(p: &Project) -> ProjectEntry {
    ProjectEntry {
        id: p.id.clone().into(), initial: p.name.chars().next().unwrap_or('•').to_string().into(), name: p.name.clone().into(),
        maker: p.maker.clone().into(), category: p.category.clone().into(),
        summary: p.summary.clone().into(), platforms: p.platforms.clone().into(),
        evidence: p.evidence.clone().into(), source: p.source.clone().into(),
    }
}
fn update_detail(ui: &AppWindow, p: Option<&Project>) {
    if let Some(p) = p {
        ui.set_detail_name(p.name.clone().into());
        ui.set_detail_initial(p.name.chars().next().unwrap_or('•').to_string().into());
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
fn apply(ui: &AppWindow, all: &[Project], q: &str, category: &str) -> Vec<Project> {
    let projects = filtered(all, q, category).into_iter().cloned().collect::<Vec<_>>();
    let slint_rows = projects.iter().map(transfer).collect::<Vec<_>>();
    ui.set_entries(ModelRc::new(VecModel::from(slint_rows)));
    ui.set_visible_total(projects.len() as i32);
    ui.set_selected_index(0);
    update_detail(ui, projects.first());
    projects
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let started = Instant::now();
    let fixture: Fixture = serde_json::from_str(include_str!("../../data/challenger181.json"))?;
    if fixture.entry_count != 181 || fixture.entries.len() != 181 {
        return Err("Invalid benchmark fixture (expected 181 actual source-linked entries)".into());
    }
    let all = Rc::new(fixture.entries);
    let ui = AppWindow::new()?;
    ui.set_total(all.len() as i32);
    let mut counts = HashMap::<String, usize>::new();
    for p in all.iter() { *counts.entry(p.category.clone()).or_default() += 1; }
    let mut categories: Vec<(String, usize)> = counts.into_iter().collect();
    categories.sort_by(|a,b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    let labels: Vec<SharedString> = std::iter::once("All disciplines".into())
        .chain(categories.iter().take(11).map(|(name,_)| name.clone().into())).collect();
    ui.set_categories(ModelRc::new(VecModel::from(labels)));
    let shown = std::rc::Rc::new(std::cell::RefCell::new(
        apply(&ui, &all, "", "All disciplines")
    ));
    ui.on_search_changed({
        let weak = ui.as_weak();
        let source = Rc::clone(&all);
        let visible = Rc::clone(&shown);
        move |query| {
            if let Some(window) = weak.upgrade(){
                window.set_search_term(query.clone());
                *visible.borrow_mut() = apply(&window, &source, &query, &window.get_active_category());
            }
        }
    });
    ui.on_category_changed({
        let weak = ui.as_weak(); let source = Rc::clone(&all);
        let visible = Rc::clone(&shown);
        move |cat| {
            if let Some(window) = weak.upgrade() {
                window.set_active_category(cat.clone());
                *visible.borrow_mut() = apply(&window, &source, &window.get_search_term(), &cat);
            }
        }
    });
    ui.on_selected({
        let weak = ui.as_weak(); let visible = Rc::clone(&shown);
        move |index| {
            if let Some(window) = weak.upgrade() {
                if let Some(p) = visible.borrow().get(index as usize) {
                    window.set_selected_index(index);
                    update_detail(&window, Some(p));
                }
            }
        }
    });
    let smoke = std::env::args().any(|arg| arg == "--bench-smoke");
    let weak = ui.as_weak();
    let count = all.len();
    Timer::single_shot(Duration::from_millis(130), move ||{
        eprintln!("BENCH_READY framework=slint total={} renderer=native ms_since_main={}", count, started.elapsed().as_millis());
        if smoke {
            let weak = weak.clone();
            Timer::single_shot(Duration::from_millis(950), move || {
                if let Some(window) = weak.upgrade() { let _ = window.hide(); }
            });
        }
    });
    ui.run()?;
    Ok(())
}
#[cfg(test)]
mod tests {
 use super::*;
 #[test] fn catalog_and_search_are_real() {
    let fixture: Fixture = serde_json::from_str(include_str!("../../data/challenger181.json")).unwrap();
    assert_eq!(fixture.entries.len(),181);
    assert_eq!(filtered(&fixture.entries,"","All disciplines").len(),181);
    assert!(filtered(&fixture.entries,"something-intentionally-absent","All disciplines").is_empty());
    assert!(filtered(&fixture.entries,"","Image editing").len()>0);
 }
}
