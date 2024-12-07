import { Post as PostType } from "../../models/Post.ts";
import { Card } from "./Card.tsx";
import { ScrollIcon } from "./Icons.tsx";
import { Link } from "./Link.tsx";
import { UserBadge } from "./UserBadge.tsx";

const PostContent = ({ post }: { post: PostType }) => {
    if (post.shortContent.type === "text") {
        return <p class="text-gray-900 break-words">{post.shortContent.content}</p>;
    } else {
        return (
            <>
                <img
                    src={post.shortContent.image || ""}
                    alt={post.shortContent.alt || post.title}
                    class="w-full"
                />
                <p class="text-gray-900 break-words">{post.shortContent.content}</p>
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
                    href={post.listBlog.blog.siteUrl || "#"}
                >
                    {post.listBlog.title}
                </a>
                <time
                    datetime={post.publishedAt.toISOString()}
                    class="text-gray-500 tracking-tight mr-2"
                >
                    {post.publishedAt.toLocaleDateString("en-GB", {
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
            <main>
                <PostContent post={post} />
            </main>
        </article>
    </Card>
);
