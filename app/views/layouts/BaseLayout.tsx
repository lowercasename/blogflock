import { PropsWithChildren } from "hono/jsx";
import { User } from "../../models/User.ts";
import { Link } from "../components/Link.tsx";
import { HeartIcon } from "../components/Icons.tsx";

interface Props {
  loggedInUser?: User;
}

export function BaseLayout(
  { loggedInUser, children }: PropsWithChildren<Props>,
) {
  return (
    <html>
      <head>
        <title>BlogFlock</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <link rel="icon" href="/static/favicon.png" />
        <script src="https://unpkg.com/htmx.org@2.0.3"></script>
        <script src="https://unpkg.com/htmx.org@1.9.12/dist/ext/ws.js">
        </script>
        <script src="//unpkg.com/alpinejs" defer></script>
        <link rel="stylesheet" href="/static/style.css" />
      </head>
      <body
        className="bg-stone-100 flex flex-col min-h-screen font-rethink-sans"
        hx-boost
      >
        <header className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-between shadow-sharp rounded-full bg-white m-4 px-6 py-4">
          <h1 className="text-xl font-semibold flex items-center gap-2 text-orange-900">
            <img
              src="/static/birds.svg"
              class="inline-block size-8"
            />
            <a href="/">BlogFlock</a>
          </h1>
          <nav className="flex gap-4">
            {loggedInUser && <Link href="/">Home</Link>}
            {loggedInUser && <Link href="/lists">Lists</Link>}
            {loggedInUser && (
              <Link href={`/user/${loggedInUser.username}`}>
                Profile
              </Link>
            )}
            {loggedInUser && (
              <Link href="/auth/logout">
                Logout
              </Link>
            )}
            {!loggedInUser && <Link href="/login">Login</Link>}
            {!loggedInUser && (
              <Link href="/register">
                Register
              </Link>
            )}
          </nav>
        </header>
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-stone-300 bg-stone-50 p-4 w-full text-center mt-4">
          Yet another Thing made with ️{" "}
          <div class="size-4 inline-flex relative top-0.5">
            <HeartIcon />
          </div>{" "}
          by <Link href="https://raphael.computer">Raphael Kabo</Link>.{" "}
          <Link href="https://github.com/lowercasename/blogflock">
            Source code
          </Link>.
        </footer>
      </body>
    </html>
  );
}
