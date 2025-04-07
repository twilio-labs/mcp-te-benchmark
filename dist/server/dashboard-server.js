"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const PORT = 3001;
const MIME_TYPES = {
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
const server = http_1.default.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    if (!req.url) {
        res.writeHead(400);
        res.end("Bad request: URL missing");
        return;
    }
    // Handle the root path
    let filePath;
    if (req.url === "/") {
        filePath = path_1.default.join(__dirname, "../../public/dashboard.html");
    }
    else if (req.url.startsWith("/metrics/")) {
        // Serve metrics files from the metrics directory
        const metricsPath = req.url === "/metrics/summary.json"
            ? path_1.default.join(__dirname, "../../metrics", req.url.replace("/metrics/", ""))
            : path_1.default.join(__dirname, "../../metrics/tasks", req.url.replace("/metrics/", ""));
        filePath = metricsPath;
    }
    else if (req.url.startsWith("/css/")) {
        // Serve CSS files from the css directory
        filePath = path_1.default.join(__dirname, "..", req.url);
    }
    else if (req.url.startsWith("/js/")) {
        // Serve JavaScript files from the js directory
        filePath = path_1.default.join(__dirname, "..", req.url);
    }
    else {
        // Serve other static files from the project root
        filePath = path_1.default.join(__dirname, "../..", req.url);
    }
    // Get the file extension
    const extname = path_1.default.extname(filePath);
    const contentType = MIME_TYPES[extname] || "application/octet-stream";
    // Read the file
    fs_1.default.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === "ENOENT") {
                // Page not found
                console.error(`File not found: ${filePath}`);
                res.writeHead(404);
                res.end("404 Not Found");
            }
            else {
                // Server error
                console.error(`Server error: ${err.code}`);
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        }
        else {
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
//# sourceMappingURL=dashboard-server.js.map