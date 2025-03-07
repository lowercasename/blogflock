import { pluralize } from "../../lib/text.ts";
import { Post as PostType } from "../../models/Post.ts";
import { Badge } from "./Badge.tsx";
import { Card } from "./Card.tsx";
import { ClockIcon } from "./Icons.tsx";
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

export const Post = ({ post }: { post: PostType }) => (
  <Card
    padding={false}
  >
    <article
      class="flex flex-col gap-2"
      // These are necessary because the Post's parent element (PostFeed) has
      // an hx-swap attribute of its own which targets #posts. Because we have
      // hx-boost enabled on the body, and hx-swap is inherited, we need to
      // override the hx-swap target to be the body element, always.
      hx-swap="outerHTML"
      hx-target="body"
    >
      <header class="pb-2 px-4 mb-1 mt-3 border-b border-gray-200">
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
      <footer class="px-4 pt-1 mb-4">
        <ListNameAndAuthorBadge list={post.list_blog.list} />
      </footer>
    </article>
  </Card>
);
