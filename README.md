# Mittens Desktop Pet

Mittens is a small Windows desktop companion built with Tauri 2. It reuses the validated Codex v2 pet atlas and renders all animation cells directly from the original WebP asset.

## Interaction

- Move the pointer over Mittens: 16-direction gaze tracking.
- Click: wave.
- Double-click: jump.
- Drag: move the pet window.
- Right-click: review/thinking animation.
- Tray menu: show, play animations, resize, toggle always-on-top, toggle startup launch, or quit.
- Double-click the tray icon: show or hide Mittens.

## Local development

Prerequisites: Node.js, pnpm, the Rust toolchain, and the platform dependencies listed in the Tauri prerequisites guide.

```powershell
pnpm install
pnpm tauri dev
```

## Build the Windows installer

On Windows 10 or 11:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm tauri build --bundles nsis
```

The setup executable is written to:

```text
src-tauri\target\release\bundle\nsis\Mittens Desktop Pet_0.1.0_x64-setup.exe
```

Alternatively, push a `v*` tag or manually run the included **Build Windows installer** GitHub Actions workflow. Download the `mittens-desktop-pet-windows` artifact when the job finishes.

## Signing

The generated installer is unsigned by default and Windows SmartScreen may show a warning. Add an Authenticode code-signing certificate before public distribution.
