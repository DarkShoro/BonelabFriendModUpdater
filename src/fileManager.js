const tar = require('tar-fs')
const fs = require('fs')
const { dialog, ipcMain } = require('electron')
const axios = require('axios')
const crypto = require('crypto');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pipelineAsync = promisify(pipeline);
const os = require('os')

const getHash = path => new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const rs = fs.createReadStream(path);
    rs.on('error', reject);
    rs.on('data', chunk => hash.update(chunk));
    rs.on('end', () => resolve(hash.digest('hex')));
})

var boneLabPathAbsolute = ''

function tryToFindBoneLab() {

    if (getBoneLabPath() !== false) {
        boneLabPathAbsolute = getBoneLabPath()
        return boneLabPathAbsolute
    }

    let steamLibrary = []

    let disks = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']
    // ignore most of the disks since they can either be a Floppy Disk or a SMB share

    disks.forEach(disk => {
        let steamPath = `${disk}:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf`
        console.log(steamPath);
        if (fs.existsSync(steamPath)) {
            console.log('Steam Library Found');
            let content = fs.readFileSync(steamPath, 'utf-8')
            let lines = content.split('\n')
            lines.forEach(line => {
                if (line.includes('path')) {
                    let path = line.split('"')[3]
                    steamLibrary.push(path)
                }
            })
        } else {
            console.log('Steam Library Not Found on ' + disk);
        }
    });

    console.log(steamLibrary);

    let boneLabPath = ''

    steamLibrary.forEach(library => {
        if (boneLabPath !== '') return
        let boneLab = `${library}\\steamapps\\common\\BONELAB\\BONELAB_Steam_Windows64.exe`
        if (fs.existsSync(boneLab)) {
            boneLabPath = boneLab
            console.log('BoneLab Found at ' + boneLab);
            
            try {
                // if the folders beside the executable are not present, create them (Mods, Plugins)
                if (!fs.existsSync(boneLab.replace('BONELAB_Steam_Windows64.exe', 'Mods'))) {
                    fs.mkdirSync(boneLab.replace('BONELAB_Steam_Windows64.exe', 'Mods'))
                }

                if (!fs.existsSync(boneLab.replace('BONELAB_Steam_Windows64.exe', 'Plugins'))) {
                    fs.mkdirSync(boneLab.replace('BONELAB_Steam_Windows64.exe', 'Plugins'))
                }

            } catch (err) {
                console.error(err)
            }

            updateSettings('boneLabPath', boneLab)
        }
    })

    if (boneLabPath === '') {
        console.log('BoneLab Not Found');
        return false
    }

    boneLabPathAbsolute = boneLabPath
    // save the path for later use in "settings.json"
    
    return boneLabPath

}

function updateSettings(setting, value) {

    let settings = fs.readFileSync('./settings.json')
    settings = JSON.parse(settings)

    settings[setting] = value

    console.log("[FILE-MANAGER] Updated settings.json with " + setting + " = " + value);

    fs.writeFileSync('./settings.json', JSON.stringify(settings))

}

function readFromSettings(setting) {

    let settings = fs.readFileSync('./settings.json')
    settings = JSON.parse(settings)

    if (settings[setting] === undefined || settings[setting] === '' || settings[setting] === null) {
        return false
    }

    return settings[setting]
}

function removeSettings(setting) {

    let settings = fs.readFileSync('./settings.json')
    settings = JSON.parse(settings)

    delete settings[setting]

    console.log("[FILE-MANAGER] Removed " + setting + " from settings.json");

    fs.writeFileSync('./settings.json', JSON.stringify(settings))
}

function setBoneLabPath(path) {
    updateSettings('boneLabPath', path)
}

function getBoneLabPath() {
    return readFromSettings('boneLabPath')
}

function changeLocation(event) {
    dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Executable', extensions: ['exe'] }] }).then(result => {
        if (!result.canceled) {
            // check if it's a BONELAB executable
            if (result.filePaths[0].includes('BONELAB_Steam_Windows64.exe')) {
                // save the path for later use in "settings.json"
                updateSettings('boneLabPath', result.filePaths[0])
                
                try {
                    // if the folders beside the executable are not present, create them (Mods, Plugins)
                    if (!fs.existsSync(result.filePaths[0].replace('BONELAB_Steam_Windows64.exe', 'Mods'))) {
                        fs.mkdirSync(result.filePaths[0].replace('BONELAB_Steam_Windows64.exe', 'Mods'))
                    }

                    if (!fs.existsSync(result.filePaths[0].replace('BONELAB_Steam_Windows64.exe', 'Plugins'))) {
                        fs.mkdirSync(result.filePaths[0].replace('BONELAB_Steam_Windows64.exe', 'Plugins'))
                    }

                } catch (err) {
                    console.error(err)
                }

                event.reply('bonelabPath', true)
            } else {
                event.reply('bonelabPath', false)
            }
        } else {
            event.reply()
            console.log('[FILE-MANAGER] User cancelled the file picker')
        }
    }).catch(err => {
        console.log(err)
        ipcMain.emit('bonelabPath', false)
    })
}

function startDownload(event) {
    let baseURL = "https://cdn.eradium.fr/BONELAB"
    distributionFile = baseURL + "/sdk_and_melon_info.json"
    SDK_URL = baseURL + "/Distrib/SDK/"
    MelonMods_URL = baseURL + "/Distrib/Melon/Mods/"
    MelonPlugins_URL = baseURL + "/Distrib/Melon/Plugins/"
    // SDK and Melon Info

    // SDK mods should be downloaded to AppData\LocalLow\Stress Level Zero\BONELAB\Mods
    // MelonLoader mods ans plugins should be downloaded to the game's root folder (beside BONELAB_Steam_Windows64.exe)
    // folder for mods is Mods and for plugins is Plugins

    // gets json info from the distribution file

    axios.get(distributionFile)
        .then(response => {
            let jsonInfo = response.data;
            var totalSize = 0;
            var SDKZips = 0;

            for (let i = 0; i < jsonInfo.sdk.length; i++) {
                totalSize += jsonInfo.sdk[i].size;
                SDKZips++;
            }

            for (let i = 0; i < jsonInfo.melon.mods.length; i++) {
                totalSize += jsonInfo.melon.mods[i].size;
            }

            for (let i = 0; i < jsonInfo.melon.plugins.length; i++) {
                totalSize += jsonInfo.melon.plugins[i].size;
            }

            console.log('Total Size to download: ' + totalSize + ' bytes');

            let downloadedSize = 0;
            let uncompressedFiles = 0;

            const updateProgress = () => {
                let mainWind = require('./main').mainWind;
                console.log('Downloaded ' + downloadedSize + ' bytes out of ' + totalSize + ' bytes');
                mainWind.webContents.send('downloadProgress', { downloaded: downloadedSize, total: totalSize });
            };

            const updateUnpackProgress = () => {
                let mainWind = require('./main').mainWind;
                // console.log('Unpacking ' + entry.path);
                mainWind.webContents.send('unpackProgress', { unpacked: uncompressedFiles, total: SDKZips });
            };

            const processFile = async (file, type) => {
                let name = file.name;
                let size = file.size;

                let filePath = '';
                switch (type) {
                    case 'SDK':
                        filePath = `${os.userInfo().homedir}\\AppData\\LocalLow\\Stress Level Zero\\BONELAB\\Mods\\${name}`;
                        break;
                    case 'MelonMods':
                        filePath = `${boneLabPathAbsolute.replace('BONELAB_Steam_Windows64.exe', '\\Mods\\')}${name}`;
                        break;
                    case 'MelonPlugins':
                        filePath = `${boneLabPathAbsolute.replace('BONELAB_Steam_Windows64.exe', '\\Plugins\\')}${name}`;
                        break;
                }

                if (fs.existsSync(filePath)) {
                    let hash = await getHash(filePath);
                    if (hash === file.hash) {
                        console.log('File ' + name + ' already exists and has the same hash');
                        downloadedSize += size;
                        updateProgress();
                        // if it's a SDK type, check if a corresponding folder exists in the Mods folder, if not, uncompressed it
                        if (type === 'SDK' && !fs.existsSync(`${os.userInfo().homedir}\\AppData\\LocalLow\\Stress Level Zero\\BONELAB\\Mods\\${name.replace('.tar', '')}`)) {
                            console.log('Uncompressing ' + name);
                            fs.createReadStream(filePath).pipe(tar.extract(`${os.userInfo().homedir}\\AppData\\LocalLow\\Stress Level Zero\\BONELAB\\Mods\\${name.replace('.tar', '')}`))
                            uncompressedFiles++;
                            updateUnpackProgress();
                        } else if (type === 'SDK' && fs.existsSync(`${os.userInfo().homedir}\\AppData\\LocalLow\\Stress Level Zero\\BONELAB\\Mods\\${name.replace('.tar', '')}`)) {
                            uncompressedFiles++;
                            updateUnpackProgress();
                        }
                    } else {
                        console.log('File ' + name + ' already exists but has a different hash');
                        await downloadFile(file, type);
                    }
                } else {
                    await downloadFile(file, type);
                }
            };

            const downloadFile = async (file, type) => {
                let url = '';
                let filepath = '';
                switch (type) {
                    case 'SDK':
                        url = SDK_URL + file.name;
                        filePath = `${os.userInfo().homedir}\\AppData\\LocalLow\\Stress Level Zero\\BONELAB\\Mods\\${file.name}`;
                        break;
                    case 'MelonMods':
                        url = MelonMods_URL + file.name;
                        filePath = `${boneLabPathAbsolute.replace('BONELAB_Steam_Windows64.exe', '\\Mods\\')}${file.name}`;
                        break;
                    case 'MelonPlugins':
                        url = MelonPlugins_URL + file.name;
                        filePath = `${boneLabPathAbsolute.replace('BONELAB_Steam_Windows64.exe', '\\Plugins\\')}${file.name}`;
                        break;
                }

                let response = await axios({
                    method: 'get',
                    url: url,
                    responseType: 'stream'
                }).catch(error => {
                    console.log(error);
                    console.log('Failed to download the file at ' + url);
                });

                response.data.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    updateProgress();
                });

                await pipelineAsync(response.data, fs.createWriteStream(filePath));

                if (type === 'SDK') {
                    // if target folder already exists, remove it and its contents
                    if (fs.existsSync(`${os.userInfo().homedir}\\AppData\\LocalLow\\Stress Level Zero\\BONELAB\\Mods\\${file.name.replace('.tar', '')}`)) {
                        fs.rmdirSync(`${os.userInfo().homedir}\\AppData\\LocalLow\\Stress Level Zero\\BONELAB\\Mods\\${file.name.replace('.tar', '')}`, { recursive: true });
                    }
                    console.log('Uncompressing ' + file.name);
                    fs.createReadStream(filePath).pipe(tar.extract(`${os.userInfo().homedir}\\AppData\\LocalLow\\Stress Level Zero\\BONELAB\\Mods\\${file.name.replace('.tar', '')}`))
                    uncompressedFiles++;
                    updateUnpackProgress();
                }
            };

            (async () => {
                for (let i = 0; i < jsonInfo.sdk.length; i++) {
                    await processFile(jsonInfo.sdk[i], "SDK");
                }

                for (let i = 0; i < jsonInfo.melon.mods.length; i++) {
                    await processFile(jsonInfo.melon.mods[i], "MelonMods");
                }

                for (let i = 0; i < jsonInfo.melon.plugins.length; i++) {
                    await processFile(jsonInfo.melon.plugins[i], "MelonPlugins");
                }
            })();
        }).catch(error => {
            console.log(error);
            console.log('Failed to download the distribution file');
        });

}

module.exports = {
    tryToFindBoneLab,
    changeLocation,
    startDownload,
}