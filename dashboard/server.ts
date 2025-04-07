import fs from 'fs';
import http from 'http';
import path from 'path';

const PORT = 3001;

interface MimeTypes {
  [key: string]: string;
}

const MIME_TYPES: MimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Bad request: URL missing');
    return;
  }

  let filePath: string;
  if (req.url === '/') {
    filePath = path.join(__dirname, '../public/dashboard.html');
  } else if (req.url === '/index.js') {
    filePath = path.join(__dirname, '../public/index.js');
  } else if (req.url === '/index.css') {
    filePath = path.join(__dirname, '../public/index.css');
  } else if (req.url.startsWith('/metrics/')) {
    const metricsPath =
      req.url === '/metrics/summary.json'
        ? path.join(__dirname, '../metrics', req.url.replace('/metrics/', ''))
        : path.join(
            __dirname,
            '../metrics/tasks',
            req.url.replace('/metrics/', ''),
          );
    filePath = metricsPath;
  } else if (req.url.startsWith('/docs/')) {
    filePath = path.join(__dirname, '../public', req.url);
  } else {
    filePath = path.join(__dirname, '../public', req.url);
  }

  // Get the file extension
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  // Read the file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
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
