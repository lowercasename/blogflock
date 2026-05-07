FROM denoland/deno:alpine-2.5.1

# Create and set permissions for deno directories
RUN mkdir -p /deno-dir && \
    chown -R deno:deno /deno-dir && \
    mkdir -p /app && \
    chown -R deno:deno /app

# Set deno cache directory
ENV DENO_DIR=/deno-dir

# Use the Alpine system CA bundle (ca-certificates) instead of Deno's
# bundled Mozilla store. The Mozilla bundle is missing chains for some
# real-world feeds (Medium-hosted blogs, Cloudflare-fronted sites with
# uncommon intermediates) and produces "invalid peer certificate:
# UnknownIssuer" errors at fetch time.
ENV DENO_TLS_CA_STORE=system

# Switch to deno user before operations that need write access
USER deno

WORKDIR /app

COPY --chown=deno:deno . .

RUN deno cache main.ts
RUN deno task build:tailwind

EXPOSE 8021

USER deno
CMD ["run", "-A", "main.ts"]