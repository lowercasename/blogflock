import { PropsWithChildren } from "hono/jsx";

interface Props {
    href: string;
}

export const Link = ({ href, children }: PropsWithChildren<Props>) => (
    <a
        href={href}
        className="font-semibold text-orange-500 hover:text-orange-300"
    >
        {children}
    </a>
);
