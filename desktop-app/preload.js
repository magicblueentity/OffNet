const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Server management
    startServer: () => ipcRenderer.invoke('start-server'),
    stopServer: () => ipcRenderer.invoke('stop-server'),
    restartServer: () => ipcRenderer.invoke('restart-server'),
    getServerStatus: () => ipcRenderer.invoke('get-server-status'),
    getServerLogs: () => ipcRenderer.invoke('get-server-logs'),
    
    // Window management
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
    restoreWindow: () => ipcRenderer.invoke('restore-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),
    getWindowState: () => ipcRenderer.invoke('get-window-state'),
    
    // Application management
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
    toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools'),
    
    // Settings management
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
    setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),
    
    // Event listeners
    onServerStatus: (callback) => ipcRenderer.on('server-status', callback),
    onWindowStateChanged: (callback) => ipcRenderer.on('window-state-changed', callback),
    onShowNotification: (callback) => ipcRenderer.on('show-notification', callback),
    onShowPreferences: (callback) => ipcRenderer.on('show-preferences', callback),
    onShowLogs: (callback) => ipcRenderer.on('show-logs', callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// DOM manipulation helpers
contextBridge.exposeInMainWorld('domAPI', {
    // Element selection
    $: (selector) => document.querySelector(selector),
    $$: (selector) => document.querySelectorAll(selector),
    
    // Element creation
    create: (tag, attributes = {}, text = '') => {
        const element = document.createElement(tag);
        Object.assign(element, attributes);
        if (text) element.textContent = text;
        return element;
    },
    
    // Event handling
    on: (element, event, handler) => element.addEventListener(event, handler),
    off: (element, event, handler) => element.removeEventListener(event, handler),
    
    // Class manipulation
    addClass: (element, className) => element.classList.add(className),
    removeClass: (element, className) => element.classList.remove(className),
    toggleClass: (element, className) => element.classList.toggle(className),
    hasClass: (element, className) => element.classList.contains(className)
});

// Window manipulation helpers
contextBridge.exposeInMainWorld('windowAPI', {
    // Window dragging
    startDrag: () => {
        if (window.electronAPI) {
            document.body.style.cursor = 'move';
            document.body.style.userSelect = 'none';
        }
    },
    
    stopDrag: () => {
        if (window.electronAPI) {
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    },
    
    // Window resizing
    startResize: (direction) => {
        if (window.electronAPI) {
            document.body.style.cursor = `${direction}-resize`;
            document.body.style.userSelect = 'none';
        }
    },
    
    stopResize: () => {
        if (window.electronAPI) {
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    },
    
    // Window state
    isMaximized: () => document.body.classList.contains('maximized'),
    isFocused: () => document.body.classList.contains('focused'),
    
    // Notifications
    showNotification: (title, body, icon = null) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon });
        }
    },
    
    requestNotificationPermission: () => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
});
