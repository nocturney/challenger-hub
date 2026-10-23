use serde::{Deserialize, Serialize};
use std::{io::Write, time::Instant};
use tauri::{Manager, State};

#[derive(Clone, Deserialize, Serialize)]
struct Project {
    id: String, name: String, maker: String, category: String, summary: String,
    platforms: String, evidence: String, source: String, kind: String,
}
#[derive(Deserialize)]
struct Fixture { #[serde(rename="entryCount")] entry_count: usize, entries: Vec<Project> }
struct BenchState { entries: Vec<Project>, start: Instant, smoke: bool }
fn filter(entries: &[Project], q: &str, category: &str) -> Vec<Project> {
    let term = q.trim().to_lowercase();
    entries.iter().filter(|p| {
        (category == "All disciplines" || p.category == category) &&
        (term.is_empty() ||
         [&p.name, &p.maker, &p.category, &p.summary].iter().any(|x| x.to_lowercase().contains(&term)))
    }).cloned().collect()
}
#[tauri::command]
fn search_catalog(query: String, category: String, state: State<'_,BenchState>) -> Vec<Project> {
    filter(&state.entries, &query, &category)
}
#[tauri::command]
fn bench_ready(message: serde_json::Value, state: State<'_,BenchState>, app: tauri::AppHandle) -> Result<(),String> {
    let elapsed = state.start.elapsed().as_millis();
    let count = message.get("total").and_then(|v|v.as_u64()).unwrap_or(0);
    if count != 181 {return Err("Renderer did not load exactly 181 real projects".into())}
    println!("BENCH_READY framework=tauri total={} renderer=webview ms_since_main={} ui_ms={}",
        count,elapsed,message["uiMs"]);
    std::io::stdout().flush().ok();
    if state.smoke {
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(900));
            app.exit(0);
        });
    }
    Ok(())
}
fn main() {
    let start=Instant::now();
    let fixture: Fixture=serde_json::from_str(include_str!("../../../data/challenger181.json"))
        .expect("Challenger benchmark dataset must be valid");
    assert_eq!(fixture.entry_count,181);
    let state=BenchState{entries:fixture.entries,start,
        smoke:std::env::args().any(|a|a=="--bench-smoke")};
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![search_catalog,bench_ready])
        .run(tauri::generate_context!())
        .expect("Tauri benchmark startup failed");
}
#[cfg(test)]
mod tests {
 use super::*;
 #[test] fn search_uses_real_catalog() {
    let fixture:Fixture=serde_json::from_str(include_str!("../../../data/challenger181.json")).unwrap();
    assert_eq!(fixture.entries.len(),181);
    assert_eq!(filter(&fixture.entries,"","All disciplines").len(),181);
    assert!(filter(&fixture.entries,"neverexistsunlikely","All disciplines").is_empty());
 }
}
