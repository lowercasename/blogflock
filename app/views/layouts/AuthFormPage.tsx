import { PropsWithChildren } from "hono/jsx";
import { BaseLayout } from "./BaseLayout.tsx";
import { Flash } from "../../lib/flash.ts";
import { FlashMessage } from "../components/FlashMessage.tsx";
import { Card } from "../components/Card.tsx";

interface Props {
    title: string;
    messages?: Flash[];
}

export const AuthFormLayout = (
    { title, messages, children }: PropsWithChildren<Props>,
) => {
    return (
        <BaseLayout>
            <h1 class="text-3xl font-semibold text-center mb-4 text-orange-900">
                {title}
            </h1>
            <div class="flex flex-col w-full max-w-[800px] mx-auto px-4">
                <Card>
                    <FlashMessage messages={messages} />
                    {children}
                </Card>
            </div>
        </BaseLayout>
    );
};
