# The standard Caddy image for every box (coraline + the VPS fleet).
# Reference copy; the live one builds from each box's ~/docker/caddy/ or
# ~/caddy/. Bakes both plugins any box needs; unused plugins are inert.
#   caddy-cloudflare-ip : trusted_proxies cloudflare (coraline, paperstack)
#   caddy-ratelimit     : rl_strict / rl_default zones (marceline)
FROM caddy:builder-alpine AS builder
RUN xcaddy build \
    --with github.com/WeidiDeng/caddy-cloudflare-ip \
    --with github.com/mholt/caddy-ratelimit

FROM caddy:alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
