use crate::catalog::{validate, Catalog};
use std::{
    io::Read,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
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
