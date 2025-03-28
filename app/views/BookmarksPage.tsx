import { User } from "../models/User.ts";
import { Post as PostType } from "../models/Post.ts";
import { PostFeed } from "./components/PostFeed.tsx";
import { BaseLayout } from "./layouts/BaseLayout.tsx";
import { PostingFrequencyForm } from "./SettingsPage.tsx";
import { Card } from "./components/Card.tsx";

export const BookmarksPage = (
  { loggedInUser, posts, hasMore }: {
    loggedInUser: User;
    posts: PostType[];
    hasMore: boolean;
  },
) => {
  return (
    <BaseLayout loggedInUser={loggedInUser}>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-[2fr,1fr] w-full max-w-[1200px] mx-auto [&>*]:self-start px-4">
        <PostFeed
          posts={posts}
          hasMore={hasMore}
          page={1}
          hasSubscription={loggedInUser.blogflock_supporter_subscription_active}
          type="bookmarks"
        />
        <div class="flex flex-col gap-4">
          <Card title="Your Bookmarks">
            <p>
              These are the posts you've bookmarked.
            </p>
          </Card>
          <Card title="Filter by posting frequency">
            <PostingFrequencyForm loggedInUser={loggedInUser} />
          </Card>
        </div>
      </div>
    </BaseLayout>
  );
};
