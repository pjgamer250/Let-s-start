const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ====== Ivide ninte app name maattu ======
const APP_NAME = "MyFileShare";
const PORT = process.env.PORT || 3000;
// =========================================

// Render-il persistent disk mount path DATA_DIR aayi kodukkuka (ex: /var/data)
const DATA_DIR = process.env.DATA_DIR || __dirname;
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "files.json");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "{}");

const readDb = () => JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
const writeDb = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const prettySize = (b) => {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
  if (b < 1024 * 1024 * 1024) return (b / 1024 / 1024).toFixed(1) + " MB";
  return (b / 1024 / 1024 / 1024).toFixed(2) + " GB";
};

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex")),
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500 MB limit

const page = (title, body) => `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#f4f6fb;color:#1c2333;
       min-height:100vh;display:flex;flex-direction:column;align-items:center}
  header{width:100%;padding:24px 16px;text-align:center;font-size:28px;font-weight:700;
         background:#fff;border-bottom:1px solid #e3e7ef}
  main{width:100%;max-width:460px;padding:24px 16px}
  .card{background:#fff;border-radius:16px;padding:28px;box-shadow:0 4px 20px rgba(0,0,0,.06);text-align:center}
  .fname{font-size:18px;font-weight:600;word-break:break-all;margin:8px 0 4px}
  .meta{color:#6b7385;margin-bottom:24px}
  .btn{display:inline-block;width:100%;padding:14px;border:0;border-radius:12px;background:#2563eb;
       color:#fff;font-size:17px;font-weight:600;text-decoration:none;cursor:pointer}
  .btn:hover{background:#1d4ed8}
  input[type=file]{width:100%;padding:14px;border:2px dashed #c5cbd9;border-radius:12px;margin-bottom:16px;background:#fafbfe}
  .link{width:100%;padding:12px;border:1px solid #d5dae6;border-radius:10px;font-size:15px;margin:12px 0}
</style></head><body>
<header>${esc(APP_NAME)}</header>
<main>${body}</main>
</body></html>`;

const app = express();

// 1) Home / Upload page
app.get("/", (req, res) => {
  res.send(page(APP_NAME, `
    <div class="card">
      <h3 style="margin-top:0">File upload cheyyuka</h3>
      <form action="/upload" method="post" enctype="multipart/form-data">
        <input type="file" name="file" required>
        <button class="btn" type="submit">Upload</button>
      </form>
    </div>`));
});

// 2) Upload -> download link undaakkunnu
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("File illa");
  const id = crypto.randomBytes(5).toString("hex"); // cheriya link ID
  const db = readDb();
  db[id] = {
    originalName: req.file.originalname,
    storedName: req.file.filename,
    size: req.file.size,
    mime: req.file.mimetype,
    uploadedAt: new Date().toISOString(),
  };
  writeDb(db);

  const link = `${req.protocol}://${req.get("host")}/d/${id}`;
  res.send(page("Link ready", `
    <div class="card">
      <h3 style="margin-top:0">Upload aayi ✅</h3>
      <p>Ninte download link:</p>
      <input class="link" id="l" value="${esc(link)}" readonly>
      <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('l').value);this.textContent='Copied!'">Copy link</button>
      <p><a href="/d/${id}">Link open cheythu nokku</a></p>
    </div>`));
});

// 3) Link open cheyyumbol: app name mukalil + Download button
app.get("/d/:id", (req, res) => {
  const f = readDb()[req.params.id];
  if (!f) return res.status(404).send(page("Not found", `<div class="card">File kittiyilla</div>`));
  res.send(page(`${APP_NAME} - Download`, `
    <div class="card">
      <div style="font-size:48px">📄</div>
      <div class="fname">${esc(f.originalName)}</div>
      <div class="meta">${prettySize(f.size)}</div>
      <a class="btn" href="/download/${esc(req.params.id)}">Download</a>
    </div>`));
});

// 4) Download button click -> file download aakunnu
app.get("/download/:id", (req, res) => {
  const f = readDb()[req.params.id];
  if (!f) return res.status(404).send("File kittiyilla");
  res.download(path.join(UPLOAD_DIR, f.storedName), f.originalName);
});

app.listen(PORT, () => console.log(`${APP_NAME} running: http://localhost:${PORT}`));
