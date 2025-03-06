import { User } from "../models/User.ts";
import { Post as PostType } from "../models/Post.ts";
import { PostFeed } from "./components/PostFeed.tsx";
import { BaseLayout } from "./layouts/BaseLayout.tsx";
import { List } from "../models/List.ts";
import { ListItem } from "./components/ListItem.tsx";
import { Card } from "./components/Card.tsx";
import { Stack } from "./components/Stack.tsx";

export const HomeFeedPage = (
  { loggedInUser, posts, hasMore, randomLists }: {
    loggedInUser: User;
    posts: PostType[];
    hasMore: boolean;
    randomLists: List[];
  },
) => {
  return (
    <BaseLayout loggedInUser={loggedInUser}>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-[2fr,1fr] w-full max-w-[1200px] mx-auto [&>*]:self-start px-4">
        <PostFeed posts={posts} hasMore={hasMore} page={1} />
        <Card title="Random lists">
          <Stack
            items={randomLists.map((l) => <ListItem key={l.id} list={l} />)}
          />
        </Card>
      </div>
    </BaseLayout>
  );
};
