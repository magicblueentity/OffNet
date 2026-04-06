# OffNet Installation Guide

## 🚀 Quick Installation Options

### Option 1: Installer (Recommended for most users)
Run the installer to install OffNet on your system with shortcuts and auto-start options.

### Option 2: Portable (No installation required)
Download and extract the portable version to run OffNet without installation.

---

## 📦 Installation Methods

### Method 1: System Installer (INSTALLER.bat)

**Best for:** Regular users who want permanent installation

**Features:**
- ✅ Full system installation
- ✅ Desktop shortcuts
- ✅ Start Menu integration
- ✅ Auto-start option
- ✅ Uninstaller included
- ✅ Registry integration

**How to use:**
1. Download OffNet.zip
2. Extract to any folder
3. Right-click `INSTALLER.bat` → "Run as administrator"
4. Follow the prompts
5. Installation completes automatically

**What gets installed:**
- Application files to `%USERPROFILE%\OffNet\`
- Desktop shortcut: "OffNet"
- Start Menu shortcut: "OffNet"
- Background service shortcut: "OffNet Background"
- Optional auto-start on Windows boot

---

### Method 2: Portable Version (BUILD-PORTABLE.bat)

**Best for:** Users who want to try OffNet without installation

**Features:**
- ✅ No installation required
- ✅ Works from USB drive
- ✅ All-in-one package
- ✅ Pre-installed dependencies
- ✅ Multiple launcher options

**How to use:**
1. Download OffNet.zip
2. Extract to any folder
3. Run `BUILD-PORTABLE.bat`
4. Use the created `OffNet-Portable` folder

**What you get:**
- Complete OffNet application
- Background service
- All dependencies
- Launcher scripts:
  - `Start OffNet.bat` - Main application
  - `Start Background Service.bat` - Background caching
  - `Start Developer Mode.bat` - Development mode

---

## 🎯 Which Method to Choose?

### Choose Installer if:
- You use OffNet regularly
- You want desktop shortcuts
- You want auto-start on boot
- You prefer system integration
- You have administrator access

### Choose Portable if:
- You want to try OffNet first
- You don't have administrator rights
- You want to run from USB drive
- You prefer no system changes
- You're testing or developing

---

## 📋 System Requirements

### Minimum Requirements:
- **Windows 10** or higher
- **Node.js 16.0** or higher (auto-installed)
- **2GB RAM** (4GB recommended)
- **500MB disk space** (1GB recommended)
- **Internet connection** (for background caching)

### Recommended:
- **Windows 11**
- **4GB+ RAM**
- **SSD storage**
- **Stable internet connection**

---

## 🔄 After Installation

### First Time Setup:
1. **Start OffNet** using your preferred method
2. **Wait for server** to start (green status)
3. **Background service** automatically begins caching
4. **Desktop app** shows real-time status

### Daily Use:
- **Main App**: Use desktop shortcut or Start Menu
- **Background Service**: Runs automatically or use background shortcut
- **Settings**: Configure in the app or edit config files
- **Updates**: Run installer again to update

---

## 🛠️ Advanced Options

### Manual Installation:
```bash
# Install dependencies
cd desktop-app
npm install

# Start main app
npm start

# Start background service
npm run background
```

### Development Mode:
```bash
# Start with developer tools
npm run dev
```

### Build from Source:
```bash
# Build Windows installer
npm run build-win

# Build macOS app
npm run build-mac

# Build Linux AppImage
npm run build-linux
```

---

## 🔧 Configuration Files

### Main App Settings:
- **Location**: App directory or `%USERPROFILE%\OffNet\`
- **File**: `settings.json`
- **Options**: auto-start, notifications, window behavior

### Background Service Settings:
- **Location**: App directory
- **File**: `background-settings.json`
- **Options**: caching interval, endpoints, sync settings

### Database:
- **Location**: App directory
- **File**: `offnet.db`
- **Purpose**: Cached API responses and offline data

---

## 📱 Usage Guide

### Main Application:
1. **Start Server** - Click button or press `Ctrl+S`
2. **Monitor Status** - See server and caching status
3. **Use Features** - Browse cached data, manage settings
4. **Keyboard Shortcuts** - Use Ctrl+S, Ctrl+Shift+S, Ctrl+R

### Background Service:
1. **Automatic** - Starts with system or manually
2. **Continuous** - Caches data every 30 seconds
3. **14 Endpoints** - Posts, users, comments, albums, photos, todos
4. **Console Logs** - Monitor sync activity

### Integration:
- **Main App** reads cached data from background service
- **Background Service** updates database continuously
- **Seamless** - Always fresh data available offline

---

## 🆘 Troubleshooting

### Installation Issues:
- **Run as Administrator** - Required for installer
- **Check Node.js** - Auto-installed, verify with `node --version`
- **Antivirus** - May block installation, temporarily disable
- **Disk Space** - Ensure 1GB+ free space

### Runtime Issues:
- **Port 3000** - Ensure not used by other apps
- **Firewall** - Allow Node.js and Electron
- **Permissions** - Ensure write access to app directory
- **Background Service** - Check console for sync errors

### Performance:
- **Memory Usage** - Normal: 100-300MB total
- **Disk Usage** - Database grows with cached data
- **Network** - ~5MB per sync cycle
- **CPU Usage** - Minimal, spikes during sync

---

## 📞 Support

### Getting Help:
1. **Check logs** - Console output shows errors
2. **Try portable** - If installer fails
3. **Manual install** - Use npm commands directly
4. **Reinstall** - Run installer again

### Report Issues:
- **Windows Version** - Include in bug reports
- **Error Messages** - Copy full error text
- **Steps to Reproduce** - What you were doing
- **System Info** - RAM, disk space, antivirus

---

## 🎉 Ready to Install!

Choose your installation method:
- **🖥️ System Installer** - `INSTALLER.bat` (Run as Administrator)
- **📦 Portable Version** - `BUILD-PORTABLE.bat` (No admin required)

Both methods provide the same powerful OffNet experience with continuous background caching! 🌐
