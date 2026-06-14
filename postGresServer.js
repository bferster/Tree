const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const API_TARGET = 'http://127.0.0.1:3000'; // Target PostgREST API (local end of the SSH tunnel)

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Log incoming request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // 1. Handle API proxying
  if (req.url.startsWith('/api/')) {
    const apiPath = req.url.slice(4); // strip "/api" (leaving e.g. "/mentions?limit=1")
    const targetUrl = API_TARGET + apiPath;
    proxyRequest(targetUrl, req, res);
    return;
  }

  // 2. Serve static files
  let urlPath = req.url.split('?')[0];
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  
  // Basic security check to prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not Found');
      } else {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end(`Server Error: ${err.code}`);
      }
      return;
    }
    const ext = path.extname(filePath);
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    res.end(data);
  });
});

function proxyRequest(targetUrl, req, res) {
  const parsedUrl = new URL(targetUrl);
  
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    path: parsedUrl.pathname + parsedUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: parsedUrl.host
    }
  };

  // Avoid forwarding any conflicting CORS request headers that might confuse the target
  delete options.headers['sec-fetch-mode'];
  delete options.headers['sec-fetch-site'];
  delete options.headers['sec-fetch-dest'];

  const proxyReq = http.request(options, (proxyRes) => {
    // Copy headers from target API to client response
    Object.keys(proxyRes.headers).forEach(key => {
      // Skip incoming CORS headers to prevent duplicate/conflicting CORS headers
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, proxyRes.headers[key]);
      }
    });
    
    res.statusCode = proxyRes.statusCode;
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`Proxy request error for ${targetUrl}:`, err.message);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`Bad Gateway: Could not connect to API at ${API_TARGET}`);
  });

  req.pipe(proxyReq);
}

server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}/`);
  console.log(`Proxying /api/* requests to ${API_TARGET}/*`);
});
