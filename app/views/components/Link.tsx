import { PropsWithChildren } from "hono/jsx";

interface Props {
  href: string;
  target?: string;
}

export const Link = ({ href, children, target }: PropsWithChildren<Props>) => (
  <a
    href={href}
    class="font-semibold text-orange-500 hover:text-orange-300"
    target={target}
  >
    {children}
  </a>
);
