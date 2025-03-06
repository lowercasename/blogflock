import { Post as PostType } from "../../models/Post.ts";
import { Card } from "./Card.tsx";
import { ScrollIcon, UserIcon } from "./Icons.tsx";
import { Link } from "./Link.tsx";
import { UserBadge } from "./UserBadge.tsx";

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
          class="w-full"
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
    title={post.title}
    href={post.url}
  >
    <article class="flex flex-col gap-2">
      <header class="pb-2 mb-1 border-b border-gray-200">
        <a
          class="font-semibold mr-2 text-gray-600 hover:underline"
          href={post.list_blog.blog.site_url || "#"}
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
      </header>
      <main class="pb-2 mb-1 border-b border-gray-200">
        <PostContent post={post} />
      </main>
      <footer>
        <div class="inline-flex items-center rounded-full border border-orange-200 text-sm">
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
