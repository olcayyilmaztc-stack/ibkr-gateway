const http = require("http");
const https = require("https");
const { URL } = require("url");

const GATEWAY_PORT = 5000;
const PROXY_PORT = 10000;
const GATEWAY_BASE = `https://localhost:${GATEWAY_PORT}`;

// Store session cookies captured from gateway responses
let sessionCookies = "";

// Allow self-signed certs from the local gateway
const agent = new https.Agent({ rejectUnauthorized: false });

function proxyRequest(clientReq, clientRes) {
  const url = new URL(clientReq.url, GATEWAY_BASE);

  const isApiCall = clientReq.url.startsWith("/v1/api/");

  // Build headers to forward
  const headers = { ...clientReq.headers };
  delete headers.host;
  headers.host = `localhost:${GATEWAY_PORT}`;

  // For API calls without cookies (from Vercel), inject stored session cookies
  if (isApiCall && !headers.cookie && sessionCookies) {
    headers.cookie = sessionCookies;
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
    // Capture session cookies from gateway responses (set during login)
    const setCookieHeaders = proxyRes.headers["set-cookie"];
    if (setCookieHeaders) {
      const newCookies = setCookieHeaders
        .map((c) => c.split(";")[0])
        .join("; ");
      if (newCookies) {
        sessionCookies = newCookies;
        console.log("[proxy] Captured session cookies");
      }
    }

    // Forward response headers (but fix cookies for browser access)
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
});
