These files are meant for running as a proxied service on an Ubuntu machine (currently using: Ubuntu 18.04)

## Listeners

- `0.0.0.0:80/443`: Caddy (alternative to Nginx)
- `127.0.0.1:6081`: Varnish HTTP Cache server (caches requests and acts as reverse proxy for Node.js)
- `127.0.0.1:8235`: Node.js (Express) HTTP server