import { List } from "../models/List.ts";
import { Card } from "./components/Card.tsx";
import { Link } from "./components/Link.tsx";
import { ListItem } from "./components/ListItem.tsx";
import PricingGrid from "./components/PricingGrid.tsx";
import { Stack } from "./components/Stack.tsx";
import { BaseLayout } from "./layouts/BaseLayout.tsx";

export function WelcomePage({ randomLists }: { randomLists: List[] }) {
  return (
    <BaseLayout>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-[2fr,1fr] w-full max-w-[1200px] mx-auto [&>*]:self-start px-4">
        <div class="flex flex-col gap-4 w-full max-w-[1200px] mx-auto px-4 mt-6">
          <h1 class="text-4xl font-bold">
            BlogFlock is a social network for reading, discovering, and sharing
            your favourite blogs and feeds with friends.
          </h1>
          <p class="text-lg text-gray-600">
            Create lists of blogs you love, and follow lists created by others.
            You can even use lists to aggregate Mastodon feeds, newspapers,
            Reddit subreddits, podcasts - anything that has an RSS or Atom feed.
          </p>
          <p class="text-lg text-gray-600">
            Think of BlogFlock as 'RSS feeds in public', for a web which is more
            curated, welcoming, and cosy than Big Tech would like us to feel.
            We'd love to hear your feedback and ideas for new features - message
            Raphael on <Link href="https://hachyderm.io/@lown">Mastodon</Link>
            {" "}
            or send him an email.
          </p>
          <h2 class="text-2xl font-bold">Support BlogFlock</h2>
          <p class="text-lg text-gray-600">
            BlogFlock will always be open source, ad-free, and anti-corporate;
            we love the IndieWeb.
          </p>
          <p class="text-lg text-gray-600">
            If you choose to support the project, you get my sincere gratitude,
            some neat extra features, and the knowledge that you're actively
            helping BlogFlock to grow.
          </p>
          <PricingGrid />
          <p class="text-lg text-gray-600">
            Because BlogFlock is open source, you are always welcome to host the
            app yourself and enable all the supporter features for free!
          </p>
        </div>
        <Card title="Some random lists">
          <Stack
            items={randomLists.map((l) => <ListItem key={l.id} list={l} />)}
          />
        </Card>
      </div>
    </BaseLayout>
  );
}
