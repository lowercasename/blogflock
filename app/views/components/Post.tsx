import { pluralize } from "../../lib/text.ts";
import { Post as PostType } from "../../models/Post.ts";
import { Badge } from "./Badge.tsx";
import { Card } from "./Card.tsx";
import { BookmarkIcon, ClockIcon } from "./Icons.tsx";
import { Link } from "./Link.tsx";
import { ListNameAndAuthorBadge } from "./ListNameAndAuthorBadge.tsx";

const PostContent = ({ post }: { post: PostType }) => {
  if (!post.short_content) {
    return (
      <p class="text-gray-500">
        No post content available.{" "}
        <Link href={post.url} target="_blank">View original post</Link>.
      </p>
    );
  }
  return (
    <div
      class="post-content"
      dangerouslySetInnerHTML={{ __html: post.short_content }}
    />
  );
};

export const Post = (
  { post, hasSubscription }: { post: PostType; hasSubscription?: boolean },
) => (
  <Card
    id={`post-${post.id}`}
    padding={false}
  >
    <article
      class="flex flex-col"
      // These are necessary because the Post's parent element (PostFeed) has
      // an hx-swap attribute of its own which targets #posts. Because we have
      // hx-boost enabled on the body, and hx-swap is inherited, we need to
      // override the hx-swap target to be the body element, always.
      hx-swap="outerHTML"
      hx-target="body"
    >
      <header class="pb-2 px-4 mb-3 mt-3 border-b border-gray-200">
        <h2 class="text-xl font-semibold text-orange-900 mb-2">
          <a href={post.url} class="hover:underline" target="_blank">
            {post.title}
          </a>
        </h2>
        <a
          class="font-semibold mr-2 text-gray-600 hover:underline"
          href={post.list_blog.blog.site_url || "#"}
          target="_blank"
        >
          {post.list_blog.title}
        </a>
        <time
          datetime={post.published_at.toISOString()}
          class="text-gray-500 tracking-tight mr-2"
        >
          {post.published_at.toLocaleDateString("en-GB", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
        <Badge icon={<ClockIcon />} size="sm">
          {post.list_blog.blog.posts_last_month}{" "}
          {pluralize(post.list_blog.blog.posts_last_month ?? 0, "post")}{" "}
          last month
        </Badge>
      </header>
      <main class="pb-2 px-4 border-b border-gray-200">
        <PostContent post={post} />
      </main>
      <footer class="grid grid-cols-[1fr_auto] gap-2">
        <div class="pl-4 py-3">
          <ListNameAndAuthorBadge list={post.list_blog.list} />
        </div>
        {hasSubscription &&
          (
            <div class="border-l border-gray-200">
              <button
                type="button"
                class={`flex text-gray w-full h-full items-center justify-center px-2 ${
                  post.is_bookmarked
                    ? "text-orange-400 bg-orange-50 hover:bg-orange-100"
                    : "text-gray-300 hover:bg-gray-50 "
                }`}
                hx-post={!post.is_bookmarked
                  ? `/posts/${post.id}/bookmark`
                  : undefined}
                hx-delete={post.is_bookmarked
                  ? `/posts/${post.id}/bookmark`
                  : undefined}
                hx-swap="outerHTML"
                hx-target={`#post-${post.id}`}
              >
                <div class="size-6">
                  <BookmarkIcon />
                </div>
              </button>
            </div>
          )}
      </footer>
    </article>
  </Card>
);
