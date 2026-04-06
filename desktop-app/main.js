const { app, BrowserWindow, Menu, ipcMain, dialog, shell, screen, Tray } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

class OffNetDesktop {
    constructor() {
        this.mainWindow = null;
        this.serverProcess = null;
        this.serverPort = 3000;
        this.isServerRunning = false;
        this.serverLogs = [];
        this.tray = null;
        this.windowState = {
            width: 1200,
            height: 800,
            x: undefined,
            y: undefined
        };
        this.setupApp();
    }

    setupApp() {
        // Set application user model ID for Windows
        if (process.platform === 'win32') {
            app.setAppUserModelId('com.offnet.desktop');
        }

        // Load window state from file
        this.loadWindowState();

        // Event handlers
        app.whenReady().then(() => this.onReady());
        app.on('window-all-closed', () => this.onWindowAllClosed());
        app.on('activate', () => this.onActivate());
        app.on('before-quit', () => this.onBeforeQuit());
        
        // IPC handlers
        this.setupIpcHandlers();
    }

    loadWindowState() {
        const stateFile = path.join(app.getPath('userData'), 'window-state.json');
        try {
            if (fs.existsSync(stateFile)) {
                const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
                this.windowState = { ...this.windowState, ...state };
            }
        } catch (error) {
            console.log('Could not load window state:', error.message);
        }
    }

    saveWindowState() {
        const stateFile = path.join(app.getPath('userData'), 'window-state.json');
        try {
            fs.writeFileSync(stateFile, JSON.stringify(this.windowState));
        } catch (error) {
            console.log('Could not save window state:', error.message);
        }
    }

    setupIpcHandlers() {
        // Server management
        ipcMain.handle('start-server', () => this.startServer());
        ipcMain.handle('stop-server', () => this.stopServer());
        ipcMain.handle('restart-server', () => this.restartServer());
        ipcMain.handle('get-server-status', () => this.getServerStatus());
        ipcMain.handle('get-server-logs', () => this.getServerLogs());
        
        // Window management
        ipcMain.handle('minimize-window', () => this.mainWindow?.minimize());
        ipcMain.handle('maximize-window', () => this.toggleMaximize());
        ipcMain.handle('restore-window', () => this.mainWindow?.restore());
        ipcMain.handle('close-window', () => this.closeWindow());
        ipcMain.handle('get-window-state', () => this.getWindowState());
        
        // Application management
        ipcMain.handle('get-app-version', () => app.getVersion());
        ipcMain.handle('open-external', (event, url) => shell.openExternal(url));
        ipcMain.handle('show-in-folder', (event, filePath) => shell.showItemInFolder(filePath));
        ipcMain.handle('toggle-dev-tools', () => this.toggleDevTools());
        
        // Settings
        ipcMain.handle('get-settings', () => this.getSettings());
        ipcMain.handle('save-settings', (event, settings) => this.saveSettings(settings));
        ipcMain.handle('get-auto-start', () => this.getAutoStart());
        ipcMain.handle('set-auto-start', (event, enabled) => this.setAutoStart(enabled));
    }

    async onReady() {
        // Create system tray
        this.createTray();
        
        // Create main window
        await this.createMainWindow();
        this.setupMenu();
        
        // Auto-start server if enabled
        const settings = this.getSettings();
        if (settings.autoStart !== false) {
            setTimeout(() => {
                this.startServer();
            }, 1000);
        }
    }

    createTray() {
        if (process.platform === 'darwin') {
            // macOS doesn't support tray as well, skip for now
            return;
        }

        this.tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));
        
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show OffNet',
                click: () => {
                    this.mainWindow?.show();
                    this.mainWindow?.focus();
                }
            },
            {
                label: 'Server Status',
                click: () => this.showServerStatus()
            },
            { type: 'separator' },
            {
                label: this.isServerRunning ? 'Stop Server' : 'Start Server',
                click: () => {
                    if (this.isServerRunning) {
                        this.stopServer();
                    } else {
                        this.startServer();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => app.quit()
            }
        ]);

        this.tray.setToolTip('OffNet - Offline-First Middleware');
        this.tray.setContextMenu(contextMenu);

        // Double click to show window
        this.tray.on('double-click', () => {
            this.mainWindow?.show();
            this.mainWindow?.focus();
        });
    }

    async createMainWindow() {
        // Get screen dimensions for centering
        const primaryScreen = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryScreen.workAreaSize;

        // Center window if no saved position
        if (this.windowState.x === undefined || this.windowState.y === undefined) {
            this.windowState.x = Math.floor((screenWidth - this.windowState.width) / 2);
            this.windowState.y = Math.floor((screenHeight - this.windowState.height) / 2);
        }

        this.mainWindow = new BrowserWindow({
            width: this.windowState.width,
            height: this.windowState.height,
            x: this.windowState.x,
            y: this.windowState.y,
            minWidth: 800,
            minHeight: 600,
            show: false,
            frame: false,
            titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
            icon: path.join(__dirname, 'assets', 'icon.png'),
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js')
            }
        });

        // Save window state on move/resize
        this.mainWindow.on('moved', () => this.saveWindowBounds());
        this.mainWindow.on('resized', () => this.saveWindowBounds());

        // Load the dashboard
        const serverUrl = `http://localhost:${this.serverPort}`;
        this.mainWindow.loadURL(serverUrl).catch(() => {
            // If server is not ready, load a local loading page
            this.mainWindow.loadFile(path.join(__dirname, 'loading.html'));
        });

        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            this.mainWindow.focus();
            
            // Focus on app start
            if (process.platform === 'win32') {
                this.mainWindow.setSkipTaskbar(false);
            }
        });

        // Handle window closed
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Handle window state changes
        this.mainWindow.on('maximize', () => {
            this.mainWindow.webContents.send('window-state-changed', { maximized: true });
        });

        this.mainWindow.on('unmaximize', () => {
            this.mainWindow.webContents.send('window-state-changed', { maximized: false });
        });

        this.mainWindow.on('focus', () => {
            this.mainWindow.webContents.send('window-state-changed', { focused: true });
        });

        this.mainWindow.on('blur', () => {
            this.mainWindow.webContents.send('window-state-changed', { focused: false });
        });

        // Handle navigation errors (server not ready)
        this.mainWindow.webContents.on('did-fail-load', () => {
            console.log('Failed to load server, retrying...');
            setTimeout(() => {
                this.mainWindow.loadURL(serverUrl);
            }, 2000);
        });

        // Handle close event
        this.mainWindow.on('close', (event) => {
            const settings = this.getSettings();
            if (settings.minimizeToTray && this.tray) {
                event.preventDefault();
                this.mainWindow.hide();
                
                // Show notification
                if (process.platform === 'win32') {
                    this.mainWindow.webContents.send('show-notification', {
                        title: 'OffNet',
                        body: 'Minimized to tray. Click tray icon to restore.'
                    });
                }
            }
        });
    }

    saveWindowBounds() {
        if (this.mainWindow) {
            const bounds = this.mainWindow.getBounds();
            this.windowState = {
                ...this.windowState,
                ...bounds
            };
            this.saveWindowState();
        }
    }

    setupMenu() {
        const template = [
            {
                label: 'OffNet',
                submenu: [
                    {
                        label: 'About OffNet',
                        click: () => this.showAboutDialog()
                    },
                    { type: 'separator' },
                    {
                        label: 'Preferences',
                        accelerator: 'CmdOrCtrl+,',
                        click: () => this.showPreferences()
                    },
                    { type: 'separator' },
                    {
                        label: 'Minimize to Tray',
                        type: 'checkbox',
                        checked: this.getSettings().minimizeToTray || false,
                        click: (item) => {
                            this.saveSettings({ minimizeToTray: item.checked });
                        }
                    },
                    {
                        label: 'Auto-start Server',
                        type: 'checkbox',
                        checked: this.getSettings().autoStart !== false,
                        click: (item) => {
                            this.saveSettings({ autoStart: item.checked });
                        }
                    },
                    { type: 'separator' },
                    {
                        label: 'Quit',
                        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                        click: () => app.quit()
                    }
                ]
            },
            {
                label: 'Server',
                submenu: [
                    {
                        label: 'Start Server',
                        accelerator: 'CmdOrCtrl+S',
                        click: () => this.startServer()
                    },
                    {
                        label: 'Stop Server',
                        accelerator: 'CmdOrCtrl+Shift+S',
                        click: () => this.stopServer()
                    },
                    {
                        label: 'Restart Server',
                        accelerator: 'CmdOrCtrl+R',
                        click: () => this.restartServer()
                    },
                    { type: 'separator' },
                    {
                        label: 'View Logs',
                        click: () => this.showLogs()
                    },
                    {
                        label: 'Server Status',
                        click: () => this.showServerStatus()
                    }
                ]
            },
            {
                label: 'View',
                submenu: [
                    {
                        label: 'Reload',
                        accelerator: 'CmdOrCtrl+Shift+R',
                        click: () => this.mainWindow?.reload()
                    },
                    {
                        label: 'Force Reload',
                        accelerator: 'CmdOrCtrl+Shift+I',
                        click: () => this.mainWindow?.webContents.reloadIgnoringCache()
                    },
                    {
                        label: 'Toggle Full Screen',
                        accelerator: 'F11',
                        click: () => this.mainWindow?.setFullScreen(!this.mainWindow.isFullScreen())
                    },
                    {
                        label: 'Toggle Developer Tools',
                        accelerator: 'F12',
                        click: () => this.toggleDevTools()
                    }
                ]
            },
            {
                label: 'Window',
                submenu: [
                    {
                        label: 'Minimize',
                        accelerator: 'CmdOrCtrl+M',
                        click: () => this.mainWindow?.minimize()
                    },
                    {
                        label: 'Maximize',
                        accelerator: 'CmdOrCtrl+Shift+M',
                        click: () => this.mainWindow?.maximize()
                    },
                    {
                        label: 'Restore',
                        accelerator: 'CmdOrCtrl+Shift+R',
                        click: () => this.mainWindow?.restore()
                    },
                    { type: 'separator' },
                    {
                        label: 'Center Window',
                        click: () => this.centerWindow()
                    },
                    {
                        label: 'Close',
                        accelerator: 'CmdOrCtrl+W',
                        click: () => this.closeWindow()
                    }
                ]
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        Menu.setApplicationMenu(menu);
    }

    centerWindow() {
        if (this.mainWindow) {
            const primaryScreen = screen.getPrimaryDisplay();
            const { width: screenWidth, height: screenHeight } = primaryScreen.workAreaSize;
            const windowBounds = this.mainWindow.getBounds();
            
            const x = Math.floor((screenWidth - windowBounds.width) / 2);
            const y = Math.floor((screenHeight - windowBounds.height) / 2);
            
            this.mainWindow.setPosition(x, y);
            this.saveWindowBounds();
        }
    }

    closeWindow() {
        const settings = this.getSettings();
        if (settings.minimizeToTray && this.tray) {
            this.mainWindow?.hide();
        } else {
            this.mainWindow?.close();
        }
    }

    async startServer() {
        if (this.isServerRunning) {
            return { success: false, message: 'Server is already running' };
        }

        try {
            const serverPath = path.join(__dirname, '..', 'server.js');
            
            this.serverProcess = spawn('node', [serverPath], {
                cwd: path.join(__dirname, '..'),
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.serverProcess.stdout.on('data', (data) => {
                const log = data.toString();
                this.serverLogs.push({ type: 'stdout', message: log, timestamp: new Date() });
                
                // Notify renderer about server status
                if (log.includes('Server running on')) {
                    this.isServerRunning = true;
                    this.mainWindow?.loadURL(`http://localhost:${this.serverPort}`);
                    this.mainWindow?.webContents.send('server-status', { running: true, message: 'Server started successfully' });
                    this.updateTrayMenu();
                }
            });

            this.serverProcess.stderr.on('data', (data) => {
                const log = data.toString();
                this.serverLogs.push({ type: 'stderr', message: log, timestamp: new Date() });
            });

            this.serverProcess.on('error', (error) => {
                this.serverLogs.push({ type: 'error', message: error.message, timestamp: new Date() });
                this.mainWindow?.webContents.send('server-status', { running: false, message: error.message });
            });

            this.serverProcess.on('close', (code) => {
                this.isServerRunning = false;
                this.serverLogs.push({ type: 'info', message: `Server process exited with code ${code}`, timestamp: new Date() });
                this.mainWindow?.webContents.send('server-status', { running: false, message: 'Server stopped' });
                this.updateTrayMenu();
            });

            return { success: true, message: 'Server starting...' };
            
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async stopServer() {
        if (!this.isServerRunning || !this.serverProcess) {
            return { success: false, message: 'Server is not running' };
        }

        try {
            this.serverProcess.kill('SIGTERM');
            this.serverProcess = null;
            this.isServerRunning = false;
            this.updateTrayMenu();
            
            return { success: true, message: 'Server stopped' };
            
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async restartServer() {
        await this.stopServer();
        setTimeout(() => this.startServer(), 1000);
    }

    updateTrayMenu() {
        if (!this.tray) return;

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show OffNet',
                click: () => {
                    this.mainWindow?.show();
                    this.mainWindow?.focus();
                }
            },
            {
                label: 'Server Status',
                click: () => this.showServerStatus()
            },
            { type: 'separator' },
            {
                label: this.isServerRunning ? 'Stop Server' : 'Start Server',
                click: () => {
                    if (this.isServerRunning) {
                        this.stopServer();
                    } else {
                        this.startServer();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => app.quit()
            }
        ]);

        this.tray.setContextMenu(contextMenu);
        this.tray.setToolTip(`OffNet - Server ${this.isServerRunning ? 'Running' : 'Stopped'}`);
    }

    getServerStatus() {
        return {
            running: this.isServerRunning,
            port: this.serverPort,
            url: `http://localhost:${this.serverPort}`
        };
    }

    getServerLogs() {
        return this.serverLogs.slice(-100); // Return last 100 logs
    }

    getWindowState() {
        return {
            ...this.windowState,
            maximized: this.mainWindow?.isMaximized() || false,
            focused: this.mainWindow?.isFocused() || false
        };
    }

    getSettings() {
        const settingsFile = path.join(app.getPath('userData'), 'settings.json');
        try {
            if (fs.existsSync(settingsFile)) {
                return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
            }
        } catch (error) {
            console.log('Could not load settings:', error.message);
        }
        
        return {
            autoStart: true,
            minimizeToTray: false,
            startMinimized: false,
            enableNotifications: true
        };
    }

    saveSettings(settings) {
        const settingsFile = path.join(app.getPath('userData'), 'settings.json');
        try {
            const currentSettings = this.getSettings();
            const newSettings = { ...currentSettings, ...settings };
            fs.writeFileSync(settingsFile, JSON.stringify(newSettings));
            return true;
        } catch (error) {
            console.log('Could not save settings:', error.message);
            return false;
        }
    }

    getAutoStart() {
        // Implementation depends on platform
        return app.getLoginItemSettings().openAtLogin;
    }

    setAutoStart(enabled) {
        app.setLoginItemSettings({
            openAtLogin: enabled,
            openAsHidden: false
        });
    }

    toggleMaximize() {
        if (this.mainWindow?.isMaximized()) {
            this.mainWindow.unmaximize();
        } else {
            this.mainWindow?.maximize();
        }
    }

    toggleDevTools() {
        if (this.mainWindow) {
            if (this.mainWindow.webContents.isDevToolsOpened()) {
                this.mainWindow.webContents.closeDevTools();
            } else {
                this.mainWindow.webContents.openDevTools();
            }
        }
    }

    showAboutDialog() {
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'About OffNet',
            message: 'OffNet Desktop',
            detail: `Version: ${app.getVersion()}\n\nAdvanced Offline-First Middleware Manager\n\nBuilt with Electron and Node.js\n\n© 2026 OffNet Team`,
            buttons: ['OK']
        });
    }

    showPreferences() {
        // TODO: Implement preferences dialog
        this.mainWindow?.webContents.send('show-preferences');
    }

    showLogs() {
        // TODO: Implement logs viewer
        this.mainWindow?.webContents.send('show-logs');
    }

    showServerStatus() {
        const status = this.getServerStatus();
        dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'Server Status',
            message: `Server: ${status.running ? 'Running' : 'Stopped'}`,
            detail: `Port: ${status.port}\nURL: ${status.url}\n\n${status.running ? 'The server is currently running and accepting connections.' : 'The server is not running. Click "Start Server" to begin.'}`,
            buttons: ['OK']
        });
    }

    onWindowAllClosed() {
        // Don't quit on macOS when window is closed if tray is enabled
        if (process.platform !== 'darwin' && !this.tray) {
            this.quit();
        }
    }

    onActivate() {
        if (BrowserWindow.getAllWindows().length === 0) {
            this.createMainWindow();
        } else {
            this.mainWindow?.show();
            this.mainWindow?.focus();
        }
    }

    onBeforeQuit() {
        // Clean up before quitting
        this.quit();
    }

    quit() {
        // Stop server
        if (this.serverProcess) {
            this.serverProcess.kill();
        }
        
        // Save window state
        this.saveWindowState();
        
        // Quit app
        app.quit();
    }
}

// Create the desktop app instance
new OffNetDesktop();
