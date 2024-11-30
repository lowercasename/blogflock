FROM denoland/deno:alpine-2.1.2

# Create and set permissions for deno directories
RUN mkdir -p /deno-dir && \
    chown -R deno:deno /deno-dir && \
    mkdir -p /app && \
    chown -R deno:deno /app

# Set deno cache directory
ENV DENO_DIR=/deno-dir

# Switch to deno user before operations that need write access
USER deno

WORKDIR /app

COPY --chown=deno:deno . .

RUN deno cache main.ts
RUN deno task build:tailwind

EXPOSE 8021

USER deno
CMD ["run", "-A", "main.ts"]