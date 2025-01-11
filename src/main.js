const {
    app,
    BrowserWindow,
    ipcMain
} = require('electron')
const path = require('path')
const fs = require('fs')
const ejse = require('ejs-electron')
const {
    tryToFindBoneLab,
    changeLocation,
    startDownload
} = require('./fileManager')
const {
    pathToFileURL
} = require('url')
const {
    promisify
} = require('util')

const os = require('os')

let splashWindow
let bonelabPath
let mainWind

app.on('ready', () => {

    // write a empty settings.json file if not exists
    if (!fs.existsSync('./settings.json')) {
        fs.writeFileSync('./settings.json', '{}')
    }

    splashWindow = new BrowserWindow({
        width: 513,
        height: 203,
        frame: false,
        title: "BONELAB | Loading...",
        transparent: true,
        show: false,
        icon: path.join(__dirname, 'assets/img/icon.png')
    });

    bonelabPath = tryToFindBoneLab()

    console.log(bonelabPath)

    userHome = os.userInfo().homedir

    console.log(userHome)

    try {
        // if the folder in LocalLow/Stress Level Zero is not present, create it
        if (!fs.existsSync(`${userHome}\\AppData\\LocalLow\\Stress Level Zero\\BONELAB\\Mods`)) {
            fs.mkdirSync(`${userHome}\\AppData\\LocalLow\\Stress Level Zero\\BONELAB\\Mods`)
        }
    } catch (error) {
        console.error(error)
    }


    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.once('ready-to-show', () => {
        splashWindow.show();
    });

    mainWin()

})

function mainWin() {

    const data = {
        bonelabPath: bonelabPath
    }

    mainWind = new BrowserWindow({
        title: "BONELAB | Loading...",
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            preload: path.join(__dirname, 'preload.js')
        },
        resizable: false,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, 'assets/img/icon.png')
    })

    Object.entries(data).forEach(([key, val]) => ejse.data(key, val))

    mainWind.loadURL(pathToFileURL(path.join(__dirname, 'index.ejs')).toString())
    mainWind.once('ready-to-show', () => {
        setTimeout(() => {
            mainWind.show()
            splashWindow.close()
        }, 1000);
    })

    mainWind.on('closed', () => {
        app.quit()
    })

    module.exports = {
        mainWind
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

ipcMain.on('changePath', (event, arg) => {
    console.log("[IPC] Change path requested")
    changeLocation(event)
});

ipcMain.on('download', (event, arg) => {
    console.log("[IPC] Download requested")
    startDownload(event)
});

ipcMain.on('downloadProgress', (event, arg) => {
    console.log("Received progress data:", arg); // Debug the data received
    mainWind.webContents.send('downloadProgress', arg);
});