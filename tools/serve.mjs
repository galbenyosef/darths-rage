// serve.mjs — dependency-free static server for the capture.
// usage: node tools/serve.mjs <port> [document-root]
//
// Binds 127.0.0.1 only. Serves the repo root (or the given root), with a
// directory index and honest 404s — never an SPA fallback.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, "..");
const port = Number(process.argv[2] || 8080);
const root = path.resolve(process.argv[3] || proj);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".bin": "application/octet-stream",
  ".dat": "application/octet-stream",
  ".hdr": "application/octet-stream",
  ".ktx2": "image/ktx2",
  ".ico": "image/x-icon",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let rel;
  try {
    rel = path.normalize(urlPath).replace(/^([/\\])+/, "");
  } catch {
    return send(res, 400, "bad request\n");
  }
  let file = path.resolve(root, rel);
  if (file !== root && !file.startsWith(root + path.sep)) {
    console.log(`${urlPath} 403`);
    return send(res, 403, "forbidden\n");
  }
  if (urlPath.endsWith("/")) file = path.join(file, "index.html");

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) {
      file = path.join(file, "index.html");
      return serveFile(file, urlPath);
    }
    serveFile(file, urlPath);
  });

  function serveFile(target, original) {
    fs.readFile(target, (err, data) => {
      if (err) {
        console.log(`${original} 404`);
        return send(res, 404, "not found\n", { "content-type": "text/plain; charset=utf-8" });
      }
      const type = TYPES[path.extname(target).toLowerCase()] || "application/octet-stream";
      console.log(`${original} 200 (${data.length})`);
      send(res, 200, data, { "content-type": type, "cache-control": "no-store" });
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}/`);
});
