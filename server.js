/* ゲームを配る。
   node server.js
   開いたアドレスを、遊ぶ人に渡す。ランキングは Firebase に残る。 */
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".gif": "image/gif",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const rel = decodeURIComponent(url.pathname === "/" ? "index.html" : url.pathname).replace(/^[/\\]+/, "");
  const file = path.resolve(ROOT, rel);
  const root = path.resolve(ROOT);
  if (rel.includes("..") || path.basename(file) === "ranking.json" || (file !== root && !file.startsWith(root + path.sep))) {
    res.writeHead(404);
    res.end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("http://localhost:" + PORT);
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const item of list || []) {
      if (item.family === "IPv4" && !item.internal) console.log("http://" + item.address + ":" + PORT);
    }
  }
});
