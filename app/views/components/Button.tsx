import { PropsWithChildren } from "hono/jsx";

interface Props {
    href?: string;
    [key: string]: unknown;
}

export function Button({ children, icon, ...props }: PropsWithChildren<Props>) {
    return (
        <button
            class="w-full py-2 bg-orange-200 text-orange-700 rounded shadow-sharp font-bold hover:bg-orange-300 flex items-center gap-2 justify-center"
            {...props}
        >
            {icon && (
                <div class="size-5">
                    {icon}
                </div>
            )}
            {children}
        </button>
    );
}

export function IconButton(
    { children, icon, ...props }: PropsWithChildren<Props>,
) {
    return (
        <button
            class="px-3 py-1 text-sm bg-stone-200 text-stone-700 rounded-full hover:bg-stone-300 flex items-center gap-2 justify-center"
            {...props}
        >
            <div class="size-4">
                {icon}
            </div>
            {children}
        </button>
    );
}

export function IconButtonLink(
    { children, icon, href, ...props }: PropsWithChildren<Props>,
) {
    return (
        <a
            href={href}
            class="px-3 py-1 text-sm bg-stone-200 text-stone-700 rounded-full hover:bg-stone-300 flex items-center gap-2"
            {...props}
        >
            <div class="size-4">
                {icon}
            </div>
            {children}
        </a>
    );
}
