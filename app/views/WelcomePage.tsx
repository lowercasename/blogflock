import { Link } from "./components/Link.tsx";
import { BaseLayout } from "./layouts/BaseLayout.tsx";

export function WelcomePage() {
    return (
        <BaseLayout>
            <div class="flex flex-col gap-4 text-center w-full max-w-[1200px] mx-auto px-4 mt-6">
                <h1 class="text-4xl font-bold">
                    BlogFlock is a tiny social network for sharing your
                    favourite blogs and feeds with friends.
                </h1>
                <p class="text-lg text-gray-600">
                    Create lists of blogs you love, and follow lists created by
                    others.
                </p>
                <p class="text-lg text-gray-600">
                    Think of BlogFlock as 'RSS feeds in public'. We'd love to hear your feedback and ideas for new features - <Link href="mailto:mail@raphaelkabo.com">just email Raphael</Link>.
                <p class="text-lg text-gray-600">
                    BlogFlock is open source, ad-free, anti-corporate, and loves
                    the IndieWeb.
                </p>
            </div>
        </BaseLayout>
    );
}
