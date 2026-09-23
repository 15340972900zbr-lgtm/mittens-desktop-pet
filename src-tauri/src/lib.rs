use tauri::{
    menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, PhysicalSize,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

fn resize_pet(app: &tauri::AppHandle, logical_width: u32) {
    if let Some(window) = app.get_webview_window("main") {
        let logical_height = (logical_width as f64 * 1.09).round() as u32;
        let _ = window.set_size(PhysicalSize::new(logical_width, logical_height));
    }
}

fn place_near_bottom_right(window: &tauri::WebviewWindow) {
    let Ok(Some(monitor)) = window.primary_monitor() else {
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let area = monitor.work_area();
    let margin = 24_i32;
    let x = area.position.x + area.size.width as i32 - size.width as i32 - margin;
    let y = area.position.y + area.size.height as i32 - size.height as i32 - margin;
    let _ = window.set_position(PhysicalPosition::new(x.max(area.position.x), y.max(area.position.y)));
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.emit("pet://hello", ());
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let show = MenuItemBuilder::with_id("show", "显示 Mittens").build(app)?;
            let wave = MenuItemBuilder::with_id("wave", "挥挥爪").build(app)?;
            let jump = MenuItemBuilder::with_id("jump", "跳一下").build(app)?;
            let work = MenuItemBuilder::with_id("work", "认真工作").build(app)?;
            let review = MenuItemBuilder::with_id("review", "仔细看看").build(app)?;
            let small = MenuItemBuilder::with_id("size-small", "小").build(app)?;
            let medium = MenuItemBuilder::with_id("size-medium", "中").build(app)?;
            let large = MenuItemBuilder::with_id("size-large", "大").build(app)?;
            let always_on_top = CheckMenuItemBuilder::with_id("always-on-top", "始终置顶")
                .checked(true)
                .build(app)?;
            let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
            let autostart = CheckMenuItemBuilder::with_id("autostart", "开机启动")
                .checked(autostart_enabled)
                .build(app)?;
            let separator_1 = PredefinedMenuItem::separator(app)?;
            let separator_2 = PredefinedMenuItem::separator(app)?;
            let separator_3 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .items(&[
                    &show,
                    &separator_1,
                    &wave,
                    &jump,
                    &work,
                    &review,
                    &separator_2,
                    &small,
                    &medium,
                    &large,
                    &always_on_top,
                    &autostart,
                    &separator_3,
                    &quit,
                ])
                .build()?;

            let always_on_top_for_menu = always_on_top.clone();
            let autostart_for_menu = autostart.clone();
            let tray = TrayIconBuilder::with_id("mittens-tray")
                .icon(app.default_window_icon().cloned().expect("application icon"))
                .tooltip("Mittens Desktop Pet")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "wave" => {
                        let _ = app.emit("pet://play", "waving");
                    }
                    "jump" => {
                        let _ = app.emit("pet://play", "jumping");
                    }
                    "work" => {
                        let _ = app.emit("pet://play", "running");
                    }
                    "review" => {
                        let _ = app.emit("pet://play", "review");
                    }
                    "size-small" => resize_pet(app, 210),
                    "size-medium" => resize_pet(app, 280),
                    "size-large" => resize_pet(app, 360),
                    "always-on-top" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let next = !window.is_always_on_top().unwrap_or(true);
                            let _ = window.set_always_on_top(next);
                            let _ = always_on_top_for_menu.set_checked(next);
                        }
                    }
                    "autostart" => {
                        let manager = app.autolaunch();
                        let enabled = manager.is_enabled().unwrap_or(false);
                        let result = if enabled { manager.disable() } else { manager.enable() };
                        if result.is_ok() {
                            let _ = autostart_for_menu.set_checked(!enabled);
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Keep the tray alive for the lifetime of the application.
            std::mem::forget(tray);

            if let Some(window) = app.get_webview_window("main") {
                place_near_bottom_right(&window);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Mittens Desktop Pet");
}
