import { Context, Hono } from "hono";
import { getAuthenticatedUser } from "../lib/auth.ts";
import {
    getPostsForFollowedListsByUserId,
    getPostsForListsIds,
} from "../models/Post.ts";
import { PostFeed } from "../views/components/PostFeed.tsx";
import { getListByHashId } from "../models/List.ts";

const app = new Hono();

app.get("", async (c: Context) => {
    const loggedInUser = await getAuthenticatedUser(c);
    const page = Number(c.req.query("page")) || 1;
    const listHashId = c.req.query("list");
    const perPage = 10;
    const offset = (page - 1) * perPage;
    // List pages can be accessed by logged in and logged out users
    if (listHashId) {
        const list = getListByHashId(listHashId);
        if (!list) {
            return c.body("List not found", 404);
        }
        const [posts, hasMore] = getPostsForListsIds(
            [list.id],
            perPage,
            offset,
        );
        return c.html(PostFeed({ posts, hasMore, page, list }));
    }
    if (!loggedInUser) {
        c.header("HX-Redirect", "/login");
        return c.body("Unauthorized", 401);
    }
    // Home feed page is only accessible by logged in users
    const [posts, hasMore] = getPostsForFollowedListsByUserId(
        loggedInUser.id,
        perPage,
        offset,
    );
    return c.html(PostFeed({ posts, hasMore, page }));
});

export default app;
