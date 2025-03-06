import { List } from "../../models/List.ts";
import { Post as PostType } from "../../models/Post.ts";
import { Button } from "./Button.tsx";
import { Empty } from "./Empty.tsx";
import { Post } from "./Post.tsx";

export const NewPostsNotification = (
  { list, display }: { list?: List; display: boolean },
) => {
  return (
    <div
      class={`${
        !display
          ? "mt-[-1rem]"
          : "w-full py-2 bg-orange-200 text-orange-700 rounded shadow-sharp font-bold hover:bg-orange-300 flex items-center gap-2 justify-center"
      }`}
      id="new-posts-notification"
      hx-get={`/posts?page=1${list ? `&list=${list.hash_id}` : ""}`}
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
  { posts, hasMore, page, list, className }: {
    posts: PostType[];
    hasMore: boolean;
    page: number;
    list?: List;
    className?: string;
  },
) => {
  return (
    <div
      id="posts"
      hx-ext="ws"
      ws-connect={list?.hash_id ? `/lists/${list?.hash_id}/ws` : null}
      class={`w-full max-w-5xl mx-auto flex flex-col gap-4 ${className || ""}`}
    >
      <NewPostsNotification list={list} display={false} />
      {posts.length
        ? posts.map((post) => <Post key={post.id} post={post} />)
        : <Empty />}
      <div id="posts-slot">
        {hasMore && (
          <Button
            id="load-more"
            hx-get={`/posts?page=${page + 1}${
              list ? `&list=${list.hash_id}` : ""
            }`}
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
