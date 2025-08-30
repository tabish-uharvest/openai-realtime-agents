# 🔒 HTTPS Setup for LAN Testing

If you want to test the Hyundai Showroom Assistant on your LAN IP with full voice functionality, you'll need HTTPS. Here are two approaches:

## 🚀 Quick Setup with mkcert (Recommended)

1. **Install mkcert**
   ```bash
   # Windows (using Chocolatey)
   choco install mkcert
   
   # Or download from: https://github.com/FiloSottile/mkcert/releases
   ```

2. **Create local CA and certificates**
   ```bash
   mkcert -install
   mkcert localhost 192.168.0.126 127.0.0.1 ::1
   ```

3. **Update your Next.js config**
   Create or update `next.config.ts`:
   ```typescript
   import { NextConfig } from 'next'
   import fs from 'fs'
   import path from 'path'

   const nextConfig: NextConfig = {
     // ... your existing config
   }

   // HTTPS configuration for development
   if (process.env.NODE_ENV === 'development') {
     const httpsOptions = {
       key: fs.readFileSync(path.join(process.cwd(), 'localhost+3-key.pem')),
       cert: fs.readFileSync(path.join(process.cwd(), 'localhost+3.pem'))
     }
   }

   export default nextConfig
   ```

4. **Run with HTTPS**
   ```bash
   # Start Next.js with HTTPS (requires custom server)
   npm run dev:https
   ```

## 🔧 Alternative: Custom HTTPS Dev Server

Create `server.js`:
```javascript
const { createServer } = require('https')
const { parse } = require('url')
const next = require('next')
const fs = require('fs')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

const httpsOptions = {
  key: fs.readFileSync('./localhost+3-key.pem'),
  cert: fs.readFileSync('./localhost+3.pem')
}

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  }).listen(3000, (err) => {
    if (err) throw err
    console.log('> Ready on https://localhost:3000')
  })
})
```

Add to `package.json`:
```json
{
  "scripts": {
    "dev:https": "node server.js"
  }
}
```

## ✅ Testing

After setup, you can access:
- `https://localhost:3000` - Full voice functionality ✅
- `https://192.168.0.126:3000` - Full voice functionality on LAN ✅

## 🔍 Why This Is Needed

Modern browsers restrict WebRTC, microphone, and camera APIs to:
- `localhost` (any protocol)
- `https://` origins (secure contexts)

The OpenAI Realtime SDK uses WebRTC for real-time audio, which requires these secure contexts.

---

**Current Status:**
- ✅ Works: `http://localhost:3002`
- ❌ Limited: `http://192.168.0.126:3002` (no voice features)
- ✅ Works: `https://192.168.0.126:3002` (with HTTPS setup)
