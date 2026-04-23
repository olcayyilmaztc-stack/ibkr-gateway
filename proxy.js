const http = require("http");
const https = require("https");

const GATEWAY_PORT = 5000;
const PROXY_PORT = 10000;

// Authenticated session cookies — only set from successful (non-401) flows
let authCookies = {};
let isAuthenticated = false;

// Allow self-signed certs from the local gateway
const agent = new https.Agent({ rejectUnauthorized: false });

function cookieString(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((c) => {
    const eq = c.indexOf("=");
    if (eq > 0) {
      cookies[c.substring(0, eq).trim()] = c.substring(eq + 1).trim();
    }
  });
  return cookies;
}

function proxyRequest(clientReq, clientRes) {
  // Diagnostic endpoint
  if (clientReq.url === "/proxy/status") {
    clientRes.writeHead(200, { "Content-Type": "application/json" });
    clientRes.end(JSON.stringify({
      authenticated: isAuthenticated,
      cookieKeys: Object.keys(authCookies),
      hasCookies: Object.keys(authCookies).length > 0,
    }));
    return;
  }

  const isApiCall = clientReq.url.startsWith("/v1/api/");
  const hasBrowserCookies = !!clientReq.headers.cookie;

  // Build headers to forward
  const headers = {};
  for (const [key, val] of Object.entries(clientReq.headers)) {
    if (key !== "host" && key !== "connection") {
      headers[key] = val;
    }
  }
  headers.host = `localhost:${GATEWAY_PORT}`;

  // For requests without cookies (from Vercel), inject stored auth cookies
  if (!hasBrowserCookies && isAuthenticated) {
    headers.cookie = cookieString(authCookies);
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
    const status = proxyRes.statusCode;

    // Capture cookies from gateway responses — but ONLY from non-401 responses
    // that came from browser requests (not health checks or Vercel API calls)
    const setCookieHeaders = proxyRes.headers["set-cookie"];
    if (setCookieHeaders && hasBrowserCookies && status !== 401) {
      setCookieHeaders.forEach((sc) => {
        const eq = sc.indexOf("=");
        const semi = sc.indexOf(";");
        if (eq > 0) {
          const key = sc.substring(0, eq).trim();
          const val = sc.substring(eq + 1, semi > 0 ? semi : undefined).trim();
          authCookies[key] = val;
        }
      });
      isAuthenticated = true;
      console.log("[proxy] Stored auth cookies from browser flow:", Object.keys(authCookies).join(", "));
    }

    // If a browser request gets a 200 on auth/status, capture those cookies too
    if (hasBrowserCookies && status === 200 && clientReq.url.includes("/auth/status")) {
      // Also store the cookies the browser sent
      const browserCookies = parseCookies(clientReq.headers.cookie);
      Object.assign(authCookies, browserCookies);
      isAuthenticated = true;
      console.log("[proxy] Stored browser cookies after auth success:", Object.keys(authCookies).join(", "));
    }

    // Forward response
    const responseHeaders = { ...proxyRes.headers };
    clientRes.writeHead(status, responseHeaders);
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
  console.log(`[proxy] Listening on port ${PROXY_PORT}`);
  console.log("[proxy] Login via browser, then visit /proxy/status to verify");
});
