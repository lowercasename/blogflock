import { List } from "../../models/List.ts";
import { Post as PostType } from "../../models/Post.ts";
import { Button } from "./Button.tsx";
import { Empty } from "./Empty.tsx";
import { Post } from "./Post.tsx";

export const NewPostsNotification = (
  { list, display, type }: {
    list?: List;
    display: boolean;
    type: "posts" | "bookmarks";
  },
) => {
  const newPostsUrlParams = new URLSearchParams();
  newPostsUrlParams.set("type", type);
  newPostsUrlParams.set("page", "1");
  if (list) {
    newPostsUrlParams.set("list", list.hash_id);
  }
  const newPostsUrl = `/posts?${newPostsUrlParams.toString()}`;

  return (
    <div
      class={`${
        !display
          ? "mt-[-1rem]"
          : "w-full py-2 bg-orange-200 text-orange-700 rounded shadow-sharp font-bold hover:bg-orange-300 flex items-center gap-2 justify-center"
      }`}
      id="new-posts-notification"
      hx-get={newPostsUrl}
      hx-swap="outerHTML"
      hx-target="#posts"
    >
      {display && (
        <button type="button">
          New posts are available! Click to reload the feed.
        </button>
      )}
    </div>
  );
};

export const PostFeed = (
  { posts, hasMore, page, list, className, hasSubscription, type }: {
    posts: PostType[];
    hasMore: boolean;
    page: number;
    list?: List;
    className?: string;
    hasSubscription?: boolean;
    type: "posts" | "bookmarks";
  },
) => {
  const websocketUrlParams = new URLSearchParams();
  websocketUrlParams.set("type", type);
  websocketUrlParams.set("page", "1");
  if (list) {
    websocketUrlParams.set("list", list.hash_id);
  }
  const websocketUrl = `/posts?${websocketUrlParams.toString()}`;

  const loadMoreUrlParams = new URLSearchParams();
  loadMoreUrlParams.set("type", type);
  loadMoreUrlParams.set("page", (page + 1).toString());
  if (list) {
    loadMoreUrlParams.set("list", list.hash_id);
  }
  const loadMoreUrl = `/posts?${loadMoreUrlParams.toString()}`;

  return (
    <div
      id="posts"
      hx-ext="ws"
      ws-connect={list?.hash_id ? `/lists/${list?.hash_id}/ws` : null}
      class={`w-full max-w-[48rem] mx-auto flex flex-col gap-4 ${
        className || ""
      }`}
      hx-trigger="postingFrequencyUpdated from:body"
      hx-get={websocketUrl}
      hx-swap="outerHTML"
      hx-target="#posts"
    >
      <NewPostsNotification list={list} display={false} type={type} />
      {posts.length
        ? posts.map((post) => (
          <Post key={post.id} post={post} hasSubscription={hasSubscription} />
        ))
        : <Empty />}
      <div id="posts-slot">
        {hasMore && (
          <Button
            id="load-more"
            hx-get={loadMoreUrl}
            hx-swap="outerHTML"
            hx-target="#posts-slot"
          >
            Load More
          </Button>
        )}
      </div>
    </div>
  );
};
