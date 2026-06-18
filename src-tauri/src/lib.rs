mod artifacts;
mod cloud;
mod commands;
mod config;
mod feed;
mod files;
mod gpu;
mod grpo;
mod hf;
mod launch;
mod process;
mod providers;
mod runs;
mod ssh;
mod tips;

use commands::{AppConfig, TailStop};
use process::SharedRun;
use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg = config::load_from(&config::config_path());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .manage(AppConfig(Mutex::new(cfg)))
        .manage(SharedRun::new())
        .manage(TailStop::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::set_config,
            commands::start_monitor,
            commands::list_runs,
            commands::run_status,
            commands::quit_app,
            commands::stop_run,
            commands::launch_sft,
            commands::list_gpus,
            commands::list_tips,
            commands::list_providers,
            commands::search_models,
            commands::search_datasets,
            commands::list_dir,
            commands::surogate_version,
            commands::complete_onboarding,
            commands::cloud_options,
            commands::configure_dstack,
            commands::launch_modal,
            commands::launch_dstack,
            commands::launch_ssh,
            commands::launch_grpo,
            commands::fetch_artifacts,
        ])
        .setup(|app| {
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show Jackalope", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Jackalope")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        if let Some(srv) = app.try_state::<SharedRun>() {
                            process::stop(&mut srv.lock());
                        }
                        app.exit(0);
                    }
                    "show" => toggle_window(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Close button quits the app (stop any running child first). No more
            // hide-to-tray surprise — the X exits, and the tray has Quit too.
            if let WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                if let Some(srv) = app.try_state::<SharedRun>() {
                    process::stop(&mut srv.lock());
                }
                app.exit(0);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Some(srv) = app_handle.try_state::<SharedRun>() {
                    process::stop(&mut srv.lock());
                }
            }
        });
}

fn toggle_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}
