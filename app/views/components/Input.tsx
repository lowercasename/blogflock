import { PropsWithChildren } from "hono/jsx";

export function Input({ ...props}: { [key: string]: unknown }) {
    return (
        <input
            class="border border-gray-300 rounded-lg p-2 w-full text-sm"
         {...props}
        />
    );
}

export function Textarea({ children, ...props}: PropsWithChildren<{ [key: string]: unknown }>) {
    return (
        <textarea
            class="border border-gray-300 rounded-lg p-2 w-full text-sm"
         {...props}
        >
            {children}
        </textarea>
    );
}