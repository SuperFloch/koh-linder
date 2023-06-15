/**
 * This file is used specifically for security reasons.
 * Here you can access Nodejs stuff and inject functionality into
 * the renderer thread (accessible there through the "window" object)
 *
 * WARNING!
 * If you import anything from node_modules, then make sure that the package is specified
 * in package.json > dependencies and NOT in devDependencies
 *
 * Example (injects window.myAPI.doAThing() into renderer thread):
 *
 *   import { contextBridge } from 'electron'
 *
 *   contextBridge.exposeInMainWorld('myAPI', {
 *     doAThing: () => {}
 *   })
 *
 * WARNING!
 * If accessing Node functionality (like importing @electron/remote) then in your
 * electron-main.js you will need to set the following when you instantiate BrowserWindow:
 *
 * mainWindow = new BrowserWindow({
 *   // ...
 *   webPreferences: {
 *     // ...
 *     sandbox: false // <-- to be able to import @electron/remote in preload script
 *   }
 * }
 */
const { contextBridge, ipcRenderer } = require('electron')

// White-listed channels.
const ipc = {
    render: {
        // From render to main.
        send: [
            'cards:save'
        ],
        // From main to render.
        receive: [

        ],
        // From render to main and back again.
        sendReceive: [
            'cards:getAll'
        ]
    }
}

// Exposed protected methods in the render process.
contextBridge.exposeInMainWorld(
    // Allowed 'ipcRenderer' methods.
    'ipcRenderer', {
    // From render to main.
    send: (channel, args) => {
        const validChannels = ipc.render.send
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, args)
        }
    },
    // From main to render.
    receive: (channel, listener) => {
        const validChannels = ipc.render.receive
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender`.
            ipcRenderer.on(channel, (event, ...args) => listener(...args))
        }
    },
    // From render to main and back again.
    invoke: (channel, args) => {
        const validChannels = ipc.render.sendReceive
        if (validChannels.includes(channel)) {
            return ipcRenderer.invoke(channel, args)
        }
    }
}
)