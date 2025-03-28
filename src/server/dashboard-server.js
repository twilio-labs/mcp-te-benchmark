const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Handle the root path
  let filePath;
  if (req.url === '/') {
    filePath = path.join(__dirname, 'dashboard.html');
  } else if (req.url.startsWith('/metrics/')) {
    // Serve metrics files from the metrics directory
    filePath = path.join(__dirname, req.url);
  } else if (req.url.startsWith('/css/')) {
    // Serve CSS files from the css directory
    filePath = path.join(__dirname, '..', req.url);
  } else if (req.url.startsWith('/js/')) {
    // Serve JavaScript files from the js directory
    filePath = path.join(__dirname, '..', req.url);
  } else {
    // Serve other static files from the project root
    filePath = path.join(__dirname, '../..', req.url);
  }
  
  // Get the file extension
  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  // Read the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Page not found
        console.error(`File not found: ${filePath}`);
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        // Server error
        console.error(`Server error: ${err.code}`);
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('Press Ctrl+C to stop the server');
});
