import http from "http";
import fs from "fs";
import path from "path";

const PORT = 3001;

interface MimeTypes {
  [key: string]: string;
}

const MIME_TYPES: MimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  if (!req.url) {
    res.writeHead(400);
    res.end("Bad request: URL missing");
    return;
  }

  // Handle the root path
  let filePath: string;
  if (req.url === "/") {
    filePath = path.join(__dirname, "../public/dashboard.html");
  } else if (req.url === "/index.js") {
    // Serve the main JS file from public folder
    filePath = path.join(__dirname, "../public/index.js");
  } else if (req.url === "/index.css") {
    // Serve the main CSS file from public folder
    filePath = path.join(__dirname, "../public/index.css");
  } else if (req.url.startsWith("/metrics/")) {
    // Serve metrics files from the metrics directory
    const metricsPath =
      req.url === "/metrics/summary.json"
        ? path.join(__dirname, "../metrics", req.url.replace("/metrics/", ""))
        : path.join(
            __dirname,
            "../metrics/tasks",
            req.url.replace("/metrics/", ""),
          );
    filePath = metricsPath;
  } else if (req.url.startsWith("/docs/")) {
    // Serve docs assets
    filePath = path.join(__dirname, "../public", req.url);
  } else {
    // Serve other static files from the public directory
    filePath = path.join(__dirname, "../public", req.url);
  }

  // Get the file extension
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || "application/octet-stream";

  // Read the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        // Page not found
        console.error(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end("404 Not Found");
      } else {
        // Server error
        console.error(`Server error: ${err.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log("Press Ctrl+C to stop the server");
});
