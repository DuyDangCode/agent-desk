pub mod agent_events;
pub mod commands;
pub mod git;
pub mod integrations;
pub mod preview;
pub mod process_info;
pub mod pty;
pub mod watcher;

use commands::*;
use pty::PtyManager;
use watcher::WatcherManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(PtyManager::new())
        .manage(WatcherManager::new())
        .setup(|app| {
            agent_events::spawn_event_listener(app.handle().clone(), 4020);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_default_working_dir,
            list_directory_folders,
            spawn_pty,
            write_pty,
            resize_pty,
            kill_pty,
            get_pty_process_info,
            open_repository,
            unwatch_repository,
            get_repository_diffs,
            stage_file,
            unstage_file,
            stage_files,
            unstage_files,
            stage_all,
            unstage_all,
            stage_hunk,
            unstage_hunk,
            discard_hunk,
            discard_file,
            commit_staged,
            commit_amend,
            list_branches,
            checkout_branch,
            create_branch,
            stash_save,
            stash_pop,
            list_stashes,
            pull_repository,
            push_repository,
            create_directory,
            init_repository,
            read_file_content,
            show_desktop_notification,
            focus_app_window,
            get_agent_integrations,
            install_agent_integration,
            uninstall_agent_integration,
            fetch_preview_page,
            open_native_preview_window,
            close_native_preview_window,
            is_native_preview_open,
            focus_native_preview_window,
            reload_native_preview_window,
            report_inspected_component,
            steer_selected_component,
            close_native_steer_popup,
            set_native_preview_inspect
        ])
        .run(tauri::generate_context!())
        .expect("error while running agent-deck application");
}
