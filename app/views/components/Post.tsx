import { Post as PostType } from "../../models/Post.ts";
import { Badge } from "./Badge.tsx";
import { Card } from "./Card.tsx";
import { ClockIcon, ScrollIcon, UserIcon } from "./Icons.tsx";

const PostContent = ({ post }: { post: PostType }) => {
  if (post.short_content.type === "text") {
    return (
      <p class="text-gray-900 [word-break:break-word]">
        {post.short_content.content}
      </p>
    );
  } else {
    return (
      <>
        <img
          src={post.short_content.image || ""}
          alt={post.short_content.alt || post.title}
          class="w-full mb-2"
        />
        <p class="text-gray-900 [word-break:break-word]">
          {post.short_content.content}
        </p>
      </>
    );
  }
};

export const Post = ({ post }: { post: PostType }) => (
  <Card
    padding={false}
  >
    <article class="flex flex-col gap-2">
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
          {post.list_blog.blog.posts_last_month === 1 ? "post" : "posts"}{" "}
          last month
        </Badge>
      </header>
      <main class="pb-2 px-4 border-b border-gray-200">
        <PostContent post={post} />
      </main>
      <footer class="px-4 pt-1 mb-4">
        <div class="inline-flex items-center rounded-full border border-orange-200 text-sm overflow-hidden">
          <a
            class="px-2 border-r border-orange-200 hover:bg-orange-50 text-gray-600"
            href={`/list/${post.list_blog.list.hash_id}`}
          >
            <div class="inline-flex size-4 mr-1 relative top-0.5">
              <ScrollIcon />
            </div>
            {post.list_blog.list.name}
          </a>
          <a
            class="px-2 hover:bg-orange-50 text-gray-600"
            href={`/user/${post.list_blog.list.user.username}`}
          >
            <div class="inline-flex size-4 mr-1 relative top-0.5">
              <UserIcon />
            </div>
            {post.list_blog.list.user.username}
          </a>
        </div>
      </footer>
    </article>
  </Card>
);
