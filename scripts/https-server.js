const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs').promises;
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

async function startServer() {
  try {
    const certDir = path.join(__dirname, '../certificates');
    const certPath = path.join(certDir, 'cert.crt');
    const keyPath = path.join(certDir, 'cert.key');

    // 检查证书文件是否存在
    try {
      await fs.access(certPath);
      await fs.access(keyPath);
    } catch (err) {
      console.error('SSL certificates not found. Please run "npm run create-cert" first.');
      process.exit(1);
    }

    const httpsOptions = {
      key: await fs.readFile(keyPath),
      cert: await fs.readFile(certPath),
    };

    const app = next({ dev, hostname, port });
    const handle = app.getRequestHandler();

    await app.prepare();

    createServer(httpsOptions, async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling', req.url, err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }).listen(port, (err) => {
      if (err) {
        console.error('Failed to start HTTPS server:', err);
        process.exit(1);
      }
      console.log(`\n🔒 HTTPS Development Server Ready on https://${hostname}:${port}\n`);
      console.log('Note: You may need to accept the self-signed certificate in your browser');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();