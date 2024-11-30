import { Context, Hono } from "hono";
import { getAuthenticatedUser } from "../lib/auth.ts";
import { getPostsForFollowedListsByUserId, getPostsForListsIds } from "../models/Post.ts";
import { PostFeed } from "../views/components/PostFeed.tsx";
import { getListByHashId } from "../models/List.ts";

const app = new Hono();

app.get("", async (c: Context) => {
    const loggedInUser = await getAuthenticatedUser(c);
    const page = Number(c.req.query("page")) || 1;
    const listHashId = c.req.query("list");
    const perPage = 10;
    if (loggedInUser) {
        const offset = (page - 1) * perPage;
        if (listHashId) {
            const list = getListByHashId(listHashId);
            if (!list) {
                return c.body("List not found", 404);
            }
            const [posts, hasMore] = getPostsForListsIds([list.id], perPage, offset);
            return c.html(PostFeed({ posts, hasMore, page, list }));
        }
        const [posts, hasMore] = getPostsForFollowedListsByUserId(loggedInUser.id, perPage, offset);
        return c.html(PostFeed({ posts, hasMore, page }));
    }
    return c.json([]);
});

export default app;