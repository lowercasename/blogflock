import { Post as PostType } from "../../models/Post.ts";
import { Card } from "./Card.tsx";
import { ScrollIcon } from "./Icons.tsx";
import { Link } from "./Link.tsx";

export const Post = ({ post }: { post: PostType }) => (
    <Card
        title={post.title || `Post on ${post.listBlog.blog.siteUrl}`}
        href={post.url}
    >
        <article class="flex flex-col gap-2">
            <header class="pb-2 mb-1 border-b border-gray-200">
                <span class="font-semibold mr-2 text-gray-600">
                    {post.listBlog.title}
                </span>
                <time
                    datetime={post.createdAt.toISOString()}
                    class="text-gray-500 tracking-tight mr-2"
                >
                    {post.createdAt.toLocaleDateString("en-GB", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    })}
                </time>{" "}
                <div class="inline-flex size-4 mr-1 relative top-0.5">
                    <ScrollIcon />
                </div>
                <Link href={`/list/${post.listBlog.list.hashId}`}>
                    {post.listBlog.list.name}
                </Link>{" "}
                <UserBadge user={post.listBlog.list.user} />
            </header>
            <main class="text-gray-900">{post.shortContent}</main>
        </article>
    </Card>
);
