import { Link } from "./components/Link.tsx";
import { BaseLayout } from "./layouts/BaseLayout.tsx";

export function WelcomePage() {
    return (
        <BaseLayout>
            <div class="flex flex-col gap-4 text-center w-full max-w-[1200px] mx-auto px-4 mt-6">
                <h1 class="text-4xl font-bold">
                    BlogFlock is a social network for reading, discovering, and
                    sharing your favourite blogs and feeds with friends.
                </h1>
                <p class="text-lg text-gray-600">
                    Create lists of blogs you love, and follow lists created by
                    others. You can even use lists to aggregate Mastodon feeds,
                    newspapers, Reddit subreddits, podcasts - anything that has
                    an RSS or Atom feed.
                </p>
                <p class="text-lg text-gray-600">
                    Think of BlogFlock as 'RSS feeds in public', for a web which
                    is more curated, welcoming, and cosy than Big Tech would
                    like us to feel. We'd love to hear your feedback and ideas
                    for new features - message Raphael on{" "}
                    <Link href="https://hachyderm.io/@lown">Mastodon</Link>{" "}
                    or send him an email.
                </p>
                <p class="text-lg text-gray-600">
                    BlogFlock will always be open source, ad-free, and
                    anti-corporate; we love the IndieWeb.
                </p>
            </div>
        </BaseLayout>
    );
}
