const http = require("http");
const https = require("https");

const GATEWAY_PORT = 5000;
const PROXY_PORT = 10000;

// Store session cookies — accumulated from browser requests after login
let sessionCookies = {};

// Allow self-signed certs from the local gateway
const agent = new https.Agent({ rejectUnauthorized: false });

function mergeCookies(cookieHeader) {
  if (!cookieHeader) return;
  cookieHeader.split(";").forEach((c) => {
    const [key, ...rest] = c.trim().split("=");
    if (key && rest.length) {
      sessionCookies[key.trim()] = rest.join("=").trim();
    }
  });
}

function cookieString() {
  return Object.entries(sessionCookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function proxyRequest(clientReq, clientRes) {
  const isApiCall = clientReq.url.startsWith("/v1/api/");

  // Capture cookies from browser requests (browser has them after login)
  if (clientReq.headers.cookie) {
    mergeCookies(clientReq.headers.cookie);
    console.log("[proxy] Captured cookies from browser:", Object.keys(sessionCookies).join(", "));
  }

  // Build headers to forward
  const headers = {};
  for (const [key, val] of Object.entries(clientReq.headers)) {
    if (key !== "host" && key !== "connection") {
      headers[key] = val;
    }
  }
  headers.host = `localhost:${GATEWAY_PORT}`;

  // For API calls without cookies (from Vercel), inject stored session cookies
  if (isApiCall && !clientReq.headers.cookie) {
    const cookies = cookieString();
    if (cookies) {
      headers.cookie = cookies;
      console.log("[proxy] Injecting stored cookies for API call:", clientReq.url);
    }
  }

  const options = {
    hostname: "localhost",
    port: GATEWAY_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers,
    agent,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Also capture cookies from gateway responses
    const setCookieHeaders = proxyRes.headers["set-cookie"];
    if (setCookieHeaders) {
      setCookieHeaders.forEach((sc) => {
        const [pair] = sc.split(";");
        const [key, ...rest] = pair.split("=");
        if (key && rest.length) {
          sessionCookies[key.trim()] = rest.join("=").trim();
        }
      });
      console.log("[proxy] Captured cookies from gateway response:", Object.keys(sessionCookies).join(", "));
    }

    // Forward response
    const responseHeaders = { ...proxyRes.headers };
    clientRes.writeHead(proxyRes.statusCode, responseHeaders);
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error("[proxy] Gateway error:", err.message);
    clientRes.writeHead(502, { "Content-Type": "application/json" });
    clientRes.end(JSON.stringify({ error: "Gateway not ready", detail: err.message }));
  });

  clientReq.pipe(proxyReq, { end: true });
}

const server = http.createServer(proxyRequest);
server.listen(PROXY_PORT, () => {
  console.log(`[proxy] Listening on port ${PROXY_PORT}, forwarding to gateway on ${GATEWAY_PORT}`);
  console.log("[proxy] Login via browser to capture session cookies");
});

// Also add a debug endpoint
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    hasCookies: Object.keys(sessionCookies).length > 0,
    cookieKeys: Object.keys(sessionCookies),
  }));
}).listen(10001);
