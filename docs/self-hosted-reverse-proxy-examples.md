# Self-hosted Reverse Proxy Examples

These examples are drafts for a future self-hosted staging server. On the office server, Caddy is user-managed; do not generate, overwrite, stop, or restart the existing Caddy configuration from the app deployment flow.

Assumptions:

- The Next.js app listens on the host-local upstream `127.0.0.1:3334`.
- PostgreSQL is not publicly exposed.
- HTTPS is required for production-like cookie behavior.
- Replace `staging.example.com` with the real staging domain on the server.

## Caddy Example

```caddyfile
staging.example.com {
  encode zstd gzip

  reverse_proxy 127.0.0.1:3334 {
    header_up X-Forwarded-Proto {scheme}
    header_up X-Forwarded-Host {host}
    header_up X-Real-IP {remote_host}
  }

  log {
    output file /var/log/caddy/voting-service-web-staging-access.log
    format console
  }
}
```

Notes:

- Caddy can manage HTTPS automatically when DNS points to the server and ports `80`/`443` are reachable.
- Review access logs for token and PII leakage after smoke testing.
- Do not log request bodies.

## Nginx Example

```nginx
server {
  listen 80;
  server_name staging.example.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name staging.example.com;

  ssl_certificate /etc/letsencrypt/live/staging.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/staging.example.com/privkey.pem;

  client_max_body_size 10m;

  access_log /var/log/nginx/voting-service-web-staging.access.log;
  error_log /var/log/nginx/voting-service-web-staging.error.log warn;

  location / {
    proxy_pass http://127.0.0.1:3334;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Notes:

- Use certbot or the server's existing certificate process for TLS.
- Do not expose the app container directly to the public internet.
- Review access and error logs after login, voter invite, ballot submission, and result smoke tests.

## Redaction Checklist

Do not allow proxy, app, or database logs to contain:

- invite token originals
- admin session token originals
- voter session token originals
- step-up token originals
- ballot group token originals
- `ballotGroupTokenHash`
- password originals
- one-time code originals
- raw private identifiers in request bodies
- Ballot/Vote/AnonymousBallotGroup identifiers
- voter-to-ballot linkage

Access logs may contain paths and status codes. They must not contain request bodies, cookies, Authorization headers, or token query/path values. Invite token APIs must stay body-based and must not move tokens into URL paths.
