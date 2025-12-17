# JSPad

A lightweight JavaScript playground for macOS.

## Features

- 🚀 Fast and lightweight native macOS app
- ✏️ CodeMirror 6 editor with syntax highlighting
- 🎯 Real-time code execution with Web Worker sandbox
- 📊 Console output aligned with code lines
- 🗂️ Multi-tab support (up to 10 tabs)
- ⚙️ Auto-execute or manual execution modes
- 💾 Automatic state persistence
- 🌙 Dark theme only

## Tech Stack

- **Backend**: Tauri 2.0 (Rust)
- **Frontend**: React 19
- **Runtime**: Bun
- **Bundler**: Vite
- **Styling**: Tailwind CSS
- **Editor**: CodeMirror 6

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.0+
- [Rust](https://rustup.rs) 1.70+
- macOS 11+

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd jspad

# Install dependencies
bun install

# Run in development mode
bunx tauri dev
```

### Build

```bash
# Build for production
bunx tauri build
```

The built app will be in `src-tauri/target/release/bundle/macos/JSPad.app`

## Keyboard Shortcuts

- `Cmd+T` - New tab
- `Cmd+W` - Close tab (quit app if last tab)
- `Cmd+1~9` - Jump to nth tab
- `Cmd+Enter` - Run code (manual mode only)
- `Cmd+,` - Open settings

## License

MIT
