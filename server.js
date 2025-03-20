const express = require("express");
const nodemailer = require("nodemailer");
const SftpClient = require("ssh2-sftp-client");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");
const settings = require("./settings");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("view"));

// Koneksi ke MongoDB
mongoose.connect(settings.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.error("MongoDB Connection Error:", err));

// Skema untuk pendaftaran whitelist
const WhitelistSchema = new mongoose.Schema({
    namaic: String,
    gmail: String,
    date: { type: Date, default: Date.now },
});

const Whitelist = mongoose.model("Whitelist", WhitelistSchema);

// Serve Halaman Index
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "view", "index.html"));
});

// API untuk Pendaftaran Whitelist
app.post("/whitelist", async (req, res) => {
    const { namaic, gmail, cfToken } = req.body;

    // Validasi Cloudflare Turnstile
    if (!cfToken) {
        return res.status(400).json({ success: false, message: "Verifikasi Cloudflare gagal!" });
    }

    try {
        const cfResponse = await axios.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            new URLSearchParams({ secret: settings.cloudflareSecret, response: cfToken })
        );

        if (!cfResponse.data.success) {
            return res.status(400).json({ success: false, message: "Verifikasi Cloudflare tidak valid!" });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: "Gagal memverifikasi Cloudflare!", error });
    }

    // Validasi Input
    if (!namaic || !gmail) {
        return res.status(400).json({ success: false, message: "Harap isi semua bidang!" });
    }

    if (!namaic.includes("_")) {
        return res.status(400).json({ success: false, message: "Nama IC harus memiliki simbol _ (Contoh: Fajar_Zylphix)" });
    }

    if (namaic.length > 20) {
        return res.status(400).json({ success: false, message: "Nama IC tidak boleh lebih dari 20 karakter!" });
    }

    if (!gmail.includes("@")) {
        return res.status(400).json({ success: false, message: "Email harus valid!" });
    }
    
    // Cek apakah user sudah mendaftar sebelumnya
    const existingUser = await Whitelist.findOne({ gmail });
    if (existingUser) {
        return res.status(400).json({ success: false, message: "Anda sudah terdaftar!" });
    }

    // Simpan ke MongoDB
    const newUser = new Whitelist({ namaic, gmail });
    await newUser.save();

    // Simpan ke SFTP
    const sftp = new SftpClient();
    try {
        await sftp.connect({
            host: settings.host,
            port: settings.port,
            username: settings.username,
            password: settings.password,
        });

        const filePath = `${settings.sftppath}${namaic}${settings.namafile}`;
        await sftp.put(Buffer.from(`Nama IC: ${namaic}\nEmail: ${gmail}\nTanggal: ${new Date().toLocaleString()}`), filePath);
        await sftp.end();
    } catch (err) {
        return res.status(500).json({ success: false, message: "Gagal menyimpan ke SFTP!", error: err });
    }

    // Kirim Email Notifikasi
    const transporter = nodemailer.createTransport({
        host: settings.emailHost,
        port: settings.emailPort,
        auth: {
            user: settings.emailUser,
            pass: settings.emailPass,
        },
    });

    const mailOptions = {
        from: settings.emailUser,
        to: gmail,
        subject: "Pendaftaran Whitelist Berhasil",
        text: `Selamat Pendaftaran Whitelist Kamu Berhasil!\n\nNAMA IC: ${namaic}\nTanggal: ${new Date().toLocaleString()}\n\n#${settings.namaserver}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "Pendaftaran berhasil! Cek di Gmail Anda." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Gagal mengirim email!", error: err });
    }
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
