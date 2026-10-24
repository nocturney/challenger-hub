use crate::catalog::{validate, Catalog};
use std::{
    io::Read,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};

const MAX_STDOUT: u64 = 1_000_000;
const MAX_STDERR: u64 = 32_768;
const TIMEOUT: Duration = Duration::from_secs(22);

fn resources() -> Result<(PathBuf, bool), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let parent = exe.parent().ok_or("Executable has no directory")?;
    let mac_resources = parent.join("../Resources");
    if parent.file_name().and_then(|s| s.to_str()) == Some("MacOS") {
        if !mac_resources.join("sidecar.mjs").is_file() {
            return Err("Incomplete macOS app bundle: missing sidecar".into());
        }
        return Ok((mac_resources, true));
    }
    let adjacent = parent.join("resources");
    if adjacent.is_dir() {
        if !adjacent.join("sidecar.mjs").is_file() {
            return Err("Incomplete Windows/Linux package: missing sidecar".into());
        }
        return Ok((adjacent, true));
    }
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../slint-node-bridge");
    if !dev.join("sidecar.mjs").is_file() {
        return Err("Cannot find source sidecar".into());
    }
    Ok((dev, false))
}

fn node_executable(resource_dir: &Path, packaged: bool) -> Result<PathBuf, String> {
    let bundled = resource_dir.join(if cfg!(windows) { "node.exe" } else { "node" });
    if bundled.is_file() {
        return Ok(bundled);
    }
    if packaged {
        return Err("Package is missing its own Node executable (no global fallback)".into());
    }
    Ok(std::env::var_os("CHALLENGER_NODE_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("node")))
}

fn captured(reader: impl Read + Send + 'static, limit: u64) -> thread::JoinHandle<Vec<u8>> {
    thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = reader.take(limit + 1).read_to_end(&mut bytes);
        bytes
    })
}

#[cfg(unix)]
fn configure_group(cmd: &mut Command) {
    use std::os::unix::process::CommandExt;
    cmd.process_group(0);
}
#[cfg(not(unix))]
fn configure_group(_cmd: &mut Command) {}

fn stop_tree(child: &mut Child) {
    #[cfg(unix)]
    {
        // The sidecar and its real Challenger server share a dedicated process group.
        unsafe { libc::kill(-(child.id() as i32), libc::SIGTERM); }
        thread::sleep(Duration::from_millis(250));
        if child.try_wait().ok().flatten().is_none() {
            unsafe { libc::kill(-(child.id() as i32), libc::SIGKILL); }
        }
    }
    #[cfg(windows)]
    {
        // On a timeout, kill the entire test sidecar tree, not only node.exe.
        let _ = Command::new("taskkill.exe")
            .args(["/T", "/F", "/PID", &child.id().to_string()])
            .stdout(Stdio::null()).stderr(Stdio::null()).status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

fn run_bounded(mut cmd: Command, timeout: Duration) -> Result<String, String> {
    configure_group(&mut cmd);
    let mut child = cmd.spawn().map_err(|e| format!("Cannot launch Node sidecar: {e}"))?;
    let stdout = captured(child.stdout.take().ok_or("Missing sidecar stdout")?, MAX_STDOUT);
    let stderr = captured(child.stderr.take().ok_or("Missing sidecar stderr")?, MAX_STDERR);
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) if started.elapsed() < timeout => thread::sleep(Duration::from_millis(35)),
            Ok(None) => {
                stop_tree(&mut child);
                break Err("Sidecar timed out; its process tree was terminated".to_string());
            }
            Err(e) => {
                stop_tree(&mut child);
                break Err(format!("Cannot monitor sidecar: {e}"));
            }
        }
    };
    let out = stdout.join().map_err(|_| "Stdout reader failed")?;
    let err = stderr.join().map_err(|_| "Stderr reader failed")?;
    let status = status?;
    if out.len() as u64 > MAX_STDOUT || err.len() as u64 > MAX_STDERR {
        return Err("Sidecar IPC output exceeded bounded protocol limits".into());
    }
    let error_text = String::from_utf8_lossy(&err);
    if !status.success() {
        return Err(format!("Sidecar failed ({status}): {}", error_text.trim()));
    }
    String::from_utf8(out).map_err(|_| "Sidecar sent non-UTF-8 JSON".into())
}

// Read installer stdout while it runs. Every line is bounded, and the full
// stdout is separately retained for the final authenticated completion record.
// The live lines are progress hints only, NEVER proof of an installation.
fn captured_install_stdout(
    mut reader: impl Read + Send + 'static,
    limit: u64,
    sender: mpsc::Sender<String>,
) -> thread::JoinHandle<Vec<u8>> {
    thread::spawn(move || {
        let mut output = Vec::new();
        let mut chunk = [0u8; 4096];
        let mut pending = Vec::new();
        let mut oversized_line = false;
        let mut emitted = 0usize;
        loop {
            let count = match reader.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(n) => n,
            };
            let capacity = (limit as usize + 1).saturating_sub(output.len());
            output.extend_from_slice(&chunk[..count.min(capacity)]);
            for &byte in &chunk[..count] {
                if byte == b'\n' {
                    if !oversized_line && !pending.is_empty() && emitted < 256 {
                        if let Ok(line) = String::from_utf8(std::mem::take(&mut pending)) {
                            let _ = sender.send(line);
                            emitted += 1;
                        }
                    }
                    pending.clear();
                    oversized_line = false;
                } else if !oversized_line {
                    if pending.len() < 2048 { pending.push(byte); }
                    else { pending.clear(); oversized_line = true; }
                }
            }
        }
        output
    })
}

// Unlike the regular bounded sidecar read, installer stdout is surfaced
// incrementally to the already-running native session. We continue draining
// beyond the cap so a verbose worker cannot deadlock on a full stdout pipe.
fn run_bounded_progress(
    mut cmd: Command,
    timeout: Duration,
    mut on_line: impl FnMut(&str),
) -> Result<String, String> {
    configure_group(&mut cmd);
    let mut child = cmd.spawn().map_err(|e| format!("Cannot launch installer sidecar: {e}"))?;
    let (sender, receiver) = mpsc::channel();
    let stdout = captured_install_stdout(
        child.stdout.take().ok_or("Missing installer stdout")?, MAX_STDOUT, sender);
    let stderr = captured(child.stderr.take().ok_or("Missing installer stderr")?, MAX_STDERR);
    let started = Instant::now();
    let status = loop {
        while let Ok(line) = receiver.try_recv() { on_line(&line); }
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) if started.elapsed() < timeout =>
                thread::sleep(Duration::from_millis(35)),
            Ok(None) => {
                stop_tree(&mut child);
                break Err("Installer timed out; its process tree was terminated".to_string());
            }
            Err(e) => {
                stop_tree(&mut child);
                break Err(format!("Cannot monitor installer sidecar: {e}"));
            }
        }
    };
    let out = stdout.join().map_err(|_| "Installer stdout reader failed")?;
    let err = stderr.join().map_err(|_| "Installer stderr reader failed")?;
    for line in receiver.try_iter() { on_line(&line); }
    let status = status?;
    if out.len() as u64 > MAX_STDOUT || err.len() as u64 > MAX_STDERR {
        return Err("Installer IPC output exceeded bounded protocol limits".into());
    }
    if !status.success() {
        return Err(format!("Installer failed ({status}): {}",
            String::from_utf8_lossy(&err).trim()));
    }
    String::from_utf8(out).map_err(|_| "Installer emitted non-UTF-8 output".into())
}

/// The native installer bridge is separate from the read-only catalog IPC.
//// Only explicit project-review / approved-install callbacks may invoke it.
/// It reuses the original vetted worker and never executes arbitrary commands.
pub fn installer_bridge(mode: &str, project_id: &str, approval_token: Option<&str>)
    -> Result<String, String>
{
    installer_bridge_with_progress(mode, project_id, approval_token, |_| {})
}

pub fn installer_bridge_with_progress(
    mode: &str,
    project_id: &str,
    approval_token: Option<&str>,
    on_line: impl FnMut(&str),
) -> Result<String, String> {
    // One exact managed exception: PdfCraft's vetted Windows portable archive.
    // Research and every other managed project remain installation-ineligible.
    let source_id = project_id.strip_prefix("curated:")
        .or_else(|| (project_id == "managed:pdfcraft").then_some("pdfcraft"))
        .unwrap_or("");
    if !matches!(mode, "plan" | "install") ||
       source_id.len() < 2 || project_id.len() > 95 ||
       !source_id.bytes().all(|b| b.is_ascii_lowercase() ||
           b.is_ascii_digit() || b == b'-') {
        return Err("Native installer request has invalid mode or source ID".into());
    }
    if mode == "plan" && approval_token.is_some() ||
       mode == "install" && !approval_token.is_some_and(|t|
           t.len() == 64 && t.bytes().all(|b| b.is_ascii_hexdigit()))
    {
        return Err("Missing exact user-approved plan token".into());
    }
    let (dir, packaged) = resources()?;
    let script = dir.join("install-bridge.mjs");
    if !script.is_file() { return Err("Native install bridge missing from app resources".into()); }
    let node = node_executable(&dir, packaged)?;
    let mut cmd = Command::new(node);
    cmd.arg(script).args([mode, project_id]);
    if let Some(token) = approval_token { cmd.arg(token); }
    cmd.current_dir(&dir).stdin(Stdio::null())
        .stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd.env_remove("NODE_OPTIONS").env_remove("NODE_PATH");
    if packaged {
        let path = dir.join("runtime-preview12");
        if !path.join("Install-Challenger.js").is_file() ||
           !path.join("adapters.json").is_file() ||
           !path.join("challengers.json").is_file() ||
           (project_id == "managed:pdfcraft" &&
             (!path.join("portable-assets.json").is_file() ||
              !path.join("catalog-cache.json").is_file())) {
            return Err("Missing original vetted installer or policy in bundled runtime".into());
        }
        cmd.env("CHALLENGER_PREVIEW_RUNTIME", path);
    }
    if mode == "install" {
        run_bounded_progress(cmd, Duration::from_secs(12 * 60), on_line)
    } else {
        run_bounded(cmd, Duration::from_secs(22))
    }
}

pub fn read_catalog() -> Result<Catalog, String> {
    let (dir, packaged) = resources()?;
    let node = node_executable(&dir, packaged)?;
    let mut cmd = Command::new(node);
    cmd.arg(dir.join("sidecar.mjs"));
    cmd.current_dir(&dir);
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    // NODE_OPTIONS may execute arbitrary injected code; never inherit it.
    cmd.env_remove("NODE_OPTIONS").env_remove("NODE_PATH");
    if packaged {
        let runtime = dir.join("runtime-preview12");
        let research = dir.join("catalog-candidates.preview10.json");
        if !runtime.join("desktop-manifest.json").is_file() || !research.is_file() {
            return Err("Incomplete package: verified backend runtime or seed missing".into());
        }
        cmd.env("CHALLENGER_PREVIEW_RUNTIME", runtime);
        cmd.env("CHALLENGER_RESEARCH_SEED", research);
    }
    let response = run_bounded(cmd, TIMEOUT)?;
    let catalog: Catalog = serde_json::from_str(response.trim())
        .map_err(|e| format!("Invalid sidecar JSON: {e}"))?;
    validate(&catalog)?;
    Ok(catalog)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn streaming_stdout_is_bounded_and_delivers_real_lines() {
        let mut bytes=Vec::new();
        for idx in 0..270 { bytes.extend_from_slice(format!("stage-{idx}\n").as_bytes()); }
        bytes.extend_from_slice(&vec![b'A';4096]);
        bytes.extend_from_slice(b"\naccepted-after-overlong-line\n");
        let (tx,rx)=mpsc::channel();
        let handle=captured_install_stdout(std::io::Cursor::new(bytes),64,tx);
        let out=handle.join().unwrap();
        assert_eq!(out.len(),65);
        let events:Vec<_>=rx.try_iter().collect();
        assert_eq!(events.len(),256);
        assert_eq!(events[0],"stage-0");
        assert_eq!(events[255],"stage-255");
    }
    #[cfg(unix)]
    #[test]
    fn streaming_stdout_is_delivered_before_process_completes() {
        let mut cmd=Command::new("/bin/sh");
        cmd.args(["-c","printf 'stream-stage\\n'; sleep 2; printf 'done\\n'"]);
        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
        let started=Instant::now();
        let mut first=None;
        let output=run_bounded_progress(cmd,Duration::from_secs(5),|line| {
            if first.is_none() { first=Some((line.to_string(),started.elapsed())); }
        }).unwrap();
        assert_eq!(first.as_ref().map(|x|x.0.as_str()),Some("stream-stage"));
        assert!(first.unwrap().1<Duration::from_millis(1500));
        assert!(output.contains("done"));
    }
    #[test]
    fn absent_binary_is_not_misreported_as_catalog_success() {
        let mut cmd = Command::new("nonexistent-challenger-sidecar-test-executable");
        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
        assert!(run_bounded(cmd, Duration::from_secs(1)).is_err());
    }

    #[test]
    fn read_only_protocol_has_size_limit() {
        assert_eq!(MAX_STDOUT, 1_000_000);
        assert!(MAX_STDERR < MAX_STDOUT);
    }

    #[cfg(unix)]
    #[test]
    fn timed_out_sidecar_and_child_are_stopped() {
        let mut cmd = Command::new("/bin/sh");
        cmd.args(["-c", "sleep 5"]);
        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
        let start = Instant::now();
        let err = run_bounded(cmd, Duration::from_millis(180)).unwrap_err();
        assert!(err.contains("timed out"), "{err}");
        assert!(start.elapsed() < Duration::from_secs(3));
    }
}
