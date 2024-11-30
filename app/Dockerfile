FROM denoland/deno:alpine-2.1.2

WORKDIR /app

COPY . .

RUN deno cache main.ts

RUN deno task build:tailwind

USER deno
EXPOSE 8021

CMD ["run", "-A", "main.ts"]