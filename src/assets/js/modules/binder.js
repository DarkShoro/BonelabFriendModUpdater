const $ = require('jquery')

document.addEventListener('readystatechange', function () {
    if (document.readyState === 'interactive') {
        $("#changeLocationButton").on('click', changePath);
        $("#downloadButton").on('click', download);
    }
    console.log("Bound")
});

window.ipcRenderer.on('bonelabPath', (event, arg) => {
    console.log(arg)
    if (arg) {
        $('#bonelabstate').text("Trouvé")
        $("#bonelabstate").addClass("text-success")
    } else {
        $('#bonelabstate').text("Manquant...")
        $("#bonelabstate").addClass("text-danger")
    }
});

let downloadFinished = false
let unpackFinished = false

window.ipcRenderer.on('downloadProgress', (event, arg) => {
    console.log(arg)
    let downloaded = arg.downloaded
    let total = arg.total

    var percentage = (downloaded / total) * 100

    console.log(percentage)

    $('#progressBar').css('width', percentage + '%')
    $("#bars").removeClass("hidden")
    $("#progressPercent").text(percentage.toFixed(2) + '%')

    if (downloaded == total) {
        $("#progressPercent").text("Téléchargement terminé")
        downloadFinished = true
    }
});

window.ipcRenderer.on('unpackProgress', (event, arg) => {
    let unpacked = arg.unpacked
    let total = arg.total

    var percentage = (unpacked / total) * 100

    $('#progressBarUnpack').css('width', percentage + '%')
    $("#progressUnpack").removeClass("hidden")
    $("#progressPercentUnpack").text(unpacked + '/' + total)
    if (unpacked == total) {
        $("#progressPercentUnpack").text("La décompression est terminée")
        unpackFinished = true
    }
});

function changePath() {
    // prompt user to select a folder
    ipcRenderer.send('changePath');
}

function download() {
    downloadFinished = false
    unpackFinished = false
    ipcRenderer.send('download');
}