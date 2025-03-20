async function submitWhitelist() {
    const namaic = document.getElementById("namaic").value.trim();
    const gmail = document.getElementById("gmail").value.trim();
    const message = document.getElementById("message");
    const cfToken = document.querySelector(".cf-turnstile iframe").dataset["cf-challenge-response"];

    // Reset pesan
    message.classList.add("hidden");
    message.classList.remove("success", "error");

    if (!namaic || !gmail) {
        message.innerText = "Harap isi semua bidang!";
        message.classList.add("error");
        message.classList.remove("hidden");
        return;
    }

    if (!cfToken) {
        message.innerText = "Harap selesaikan verifikasi!";
        message.classList.add("error");
        message.classList.remove("hidden");
        return;
    }

    try {
        const response = await fetch("/whitelist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ namaic, gmail, cfToken }),
        });

        const result = await response.json();
        message.innerText = result.message;
        message.classList.add(result.success ? "success" : "error");
        message.classList.remove("hidden");
    } catch (error) {
        message.innerText = "Terjadi kesalahan, coba lagi.";
        message.classList.add("error");
        message.classList.remove("hidden");
    }
}
