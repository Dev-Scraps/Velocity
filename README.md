# Velocity

![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=000)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=000)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=FFF)
![License](https://img.shields.io/badge/License-MIT-green)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)

A powerful YouTube video downloader and playlist manager built with Tauri, React, and yt-dlp.

> [!NOTE]
> Velocity is a modern desktop application for downloading YouTube videos and managing playlists with ease.

## Table of Contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Quick Start](#quick-start)
- [Requirements](#requirements)
- [Installation](#installation)
- [Development](#development)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)
- [Support](#support)

## Screenshots

### Main Interface
![Main Interface](images/Screenshot%202026-01-27%20135432.png)

### Download Progress
![Download Progress](images/Screenshot%202026-01-27%20135455.png)

### Playlist Management
![Playlist Management](images/Screenshot%202026-01-27%20135507.png)

### Settings & Configuration
![Settings](images/Screenshot%202026-01-27%20135517.png)

## Features

- **Video Downloads**: Download videos from YouTube in your preferred format and quality
- **High Speed**: Fast downloads with progress tracking
- **Multiple Formats**: Support for various video formats (MP4, MKV, WebM) and audio formats
- **Pause & Resume**: Control your downloads with pause, resume, and cancel options
- **Playlist Support**: Sync and manage your YouTube playlists
- **Private Videos**: Access and download private videos using cookies
- **Download History**: Track all your downloads with detailed metadata
- **Modern UI**: Clean, fluent design with dark mode support
- **Cross-Platform**: Available for Windows, macOS, and Linux

## Quick Start

Get up and running with Velocity in minutes:

```bash
# Clone the repository
git clone https://github.com/777abhishek/velocity.git
cd velocity

# Install dependencies
pnpm install

# Start development server
pnpm run tauri:dev
```

That's it! The application will launch automatically with hot-reloading enabled.

## Requirements

- **Node.js**: v18 or higher
- **pnpm**: Latest version
- **Rust**: v1.77.2 or higher (with Cargo)
- **Operating System**: Windows, macOS, or Linux

## Installation

### Prerequisites

1. Install [Node.js](https://nodejs.org/) (v18 or higher)
2. Install [pnpm](https://pnpm.io/):
   ```bash
   npm install -g pnpm
   ```
3. Install [Rust](https://www.rust-lang.org/tools/install):
   ```bash
   # Using rustup (recommended)
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Or on Windows with winget
   winget install Rustlang.Rustup
   ```

### Clone and Install

```bash
git clone https://github.com/777abhishek/velocity.git
cd velocity
pnpm install
```

> [!TIP]
> Make sure you have all prerequisites installed before running the above commands.

## Development

### Start Development Server

```bash
pnpm run tauri:dev
```

This command will:

1. Start the Vite development server at `http://localhost:5173`
2. Build and launch the Tauri application
3. Enable hot-reloading for both frontend and backend changes

### Build for Production

```bash
pnpm run tauri:build
```

This will create platform-specific installers in the `src-tauri/target/release/bundle/` directory:

| Platform | Installer |
|----------|-----------|
| Windows | `.msi` installer |
| macOS | `.dmg` disk image |
| Linux | `.deb` and `.appimage` packages |

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Start Vite dev server only |
| `pnpm run build` | Build the frontend for production |
| `pnpm run preview` | Preview production build |
| `pnpm run lint` | Run ESLint to check code quality |
| `pnpm run tauri` | Run Tauri CLI commands |
| `pnpm run tauri:dev` | Start full development environment |
| `pnpm run tauri:build` | Build production installers |

## Project Structure

```
velocity/
├── src/                    # React frontend source
│   ├── components/         # Reusable UI components
│   │   ├── Header/        # Header component
│   │   ├── MainContent/   # Main content area
│   │   ├── Player/        # Video player component
│   │   └── ...           # Other components
│   ├── context/           # React context providers
│   │   ├── AuthContext.tsx
│   │   ├── LanguageContext.tsx
│   │   └── PlaylistsContext.tsx
│   ├── hooks/             # Custom React hooks
│   ├── App.tsx           # Main App component
│   └── main.tsx          # Application entry point
├── src-tauri/             # Rust backend source
│   ├── src/              # Rust source code
│   ├── capabilities/     # Tauri capabilities
│   ├── Cargo.toml       # Rust dependencies
│   └── tauri.conf.json   # Tauri configuration
├── images/                # Screenshots and assets
├── scripts/               # Build and utility scripts
├── dist/                  # Production build output
└── package.json          # Node.js dependencies
```

## Technology Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool (using rolldown-vite)
- **Tailwind CSS** - Styling
- **Radix UI** - Component library
- **Lucide React** - Icons
- **Tauri API** - Desktop integration

### Backend
- **Rust** - Systems programming
- **Tauri 2** - Desktop framework
- **SQLite** (rusqlite) - Database
- **Tokio** - Async runtime
- **yt-dlp** - Video downloader (external binary)
- **FFmpeg** - Video processing (external binary)

## Configuration

### Environment Variables

Create a `.env` file in the root directory (optional):

```env
# Tauri configuration (if needed)
TAURI_PRIVATE_KEY=path/to/private/key
TAURI_KEY_PASSWORD=your-password
```

### Tauri Configuration

Edit `src-tauri/tauri.conf.json` to customize:

- App name and version
- Window size and behavior
- Bundle targets
- Icons and metadata

### Application Settings

Velocity stores configuration in the following locations:

| Platform | Configuration Path |
|----------|-------------------|
| Windows | `%APPDATA%\velocity\` |
| macOS | `~/Library/Application Support/velocity/` |
| Linux | `~/.config/velocity/` |

## Troubleshooting

### Cargo not found

If you encounter `cargo: command not found`, ensure Rust is installed:

```bash
cargo --version
rustc --version
```

### Build errors on Windows

If you encounter build errors, try:

```powershell
# Clean build artifacts
cargo clean

# Reinstall dependencies
Remove-Item -Recurse -Force node_modules
Remove-Item pnpm-lock.yaml
pnpm install
```

### yt-dlp/FFmpeg not working

The app includes bundled binaries. If they're not working:

1. Download the latest binaries:
   - [yt-dlp](https://github.com/yt-dlp/yt-dlp/releases)
   - [FFmpeg](https://ffmpeg.org/download.html)
2. Place them in the appropriate platform directory:
   - Windows: `src-tauri/resources/binaries/windows/`
   - macOS: `src-tauri/resources/binaries/macos/`
   - Linux: `src-tauri/resources/binaries/linux/`

### Common Issues

| Issue | Solution |
|-------|----------|
| App won't start | Check if Node.js v18+ is installed |
| Downloads fail | Verify internet connection and yt-dlp version |
| UI not loading | Clear browser cache and restart dev server |
| Build fails | Run `cargo clean` and reinstall dependencies |

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

### Code of Conduct

Be respectful and inclusive. We're here to learn and help each other.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

Velocity is built with amazing open-source tools and libraries:

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - YouTube video downloader
- [FFmpeg](https://ffmpeg.org/) - Video processing toolkit
- [Tauri](https://tauri.app/) - Desktop application framework
- [React](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vite](https://vitejs.dev/) - Fast build tool
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Radix UI](https://www.radix-ui.com/) - Accessible UI components
- [Lucide](https://lucide.dev/) - Beautiful icon library

## Support

For issues, questions, or suggestions:

- 📖 Check the [documentation](https://github.com/777abhishek/velocity/wiki)
- 🐛 [Report a bug](https://github.com/777abhishek/velocity/issues)
- 💡 [Request a feature](https://github.com/777abhishek/velocity/issues)
- 💬 Join our [community discussions](https://github.com/777abhishek/velocity/discussions)

---

<div align="center">
  <sub>Built with ❤️ by the Velocity community</sub>
</div>
#   V e l o c i t y  
 #   V e l o c i t y  
 #   V e l o c i t y  
 #   V e l o c i t y  
 