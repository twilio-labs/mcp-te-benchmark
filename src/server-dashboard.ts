import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

import { logger } from './utils';

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
const dirName = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(dirName, '../public');

type Options = {
  directory: string;
  port: number;
};

export default class Server {
  private readonly server: http.Server;

  private readonly directory: string;

  private readonly port: number;

  constructor(options: Options) {
    this.directory = options.directory;
    this.port = options.port;
    this.server = this.create();
  }

  public static createServer(argv: string[]) {
    const parsedArgs = yargs(hideBin(argv))
      .option('port', {
        alias: 'p',
        type: 'number',
        description: 'Port to run the server on',
        default: 3001,
      })
      .option('directory', {
        alias: 'd',
        type: 'string',
        description: 'Specify a custom metrics directory path',
        default: path.join(os.homedir(), '.mcp-te-benchmark'),
      })
      .help()
      .alias('help', 'h')
      .parseSync();

    const server = new Server({
      directory: parsedArgs.directory,
      port: parsedArgs.port,
    });

    server.start();

    return server;
  }

  /**
   * Starts the server
   */
  public start() {
    this.server.listen(this.port, () => {
      logger.info(`Server running at http://localhost:${this.port}/`);
      logger.info('Press Ctrl+C to stop the server');
    });
  }

  private getPath(url: string) {
    if (url === '/') {
      return path.join(publicDir, 'dashboard.html');
    }

    if (url === '/index.js') {
      return path.join(publicDir, 'index.js');
    }

    if (url === '/index.css') {
      return path.join(publicDir, 'index.css');
    }

    if (url.startsWith('/metrics/')) {
      return url === '/metrics/summary.json'
        ? path.join(this.directory, url.replace('/metrics/', ''))
        : path.join(this.directory, 'tasks', url.replace('/metrics/', ''));
    }

    if (url.startsWith('/docs/')) {
      return path.join(publicDir, url);
    }

    return path.join(publicDir, url);
  }

  /**
   * Creates the http server
   * @returns
   */
  private create() {
    return http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad request: URL missing');
        return;
      }

      const filePath = this.getPath(req.url);
      const extname = path.extname(filePath);
      const contentType = MIME_TYPES[extname] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404);
            res.end('404 Not Found');
            return;
          }

          res.writeHead(500);
          res.end(`Server Error: ${err.code}`);
          return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      });
    });
  }
}
