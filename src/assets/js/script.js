const bonelabPath = $(document.body).attr('bonelabPath')

$(document).on("DOMContentLoaded", function () {

    console.log("Bound")

    // grab attribute bonelabPath

    if (bonelabPath !== undefined && bonelabPath !== '' && bonelabPath !== null && bonelabPath !== false) {
        $('#bonelabstate').text("Trouvé")
        $("#bonelabstate").addClass("text-success")
    } else {
        $('#bonelabstate').text("Manquant...")
        $("#bonelabstate").addClass("text-danger")
    }
});