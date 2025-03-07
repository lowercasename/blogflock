import { Context, Hono } from "hono";
import { getAuthenticatedUser } from "../lib/auth.ts";
import {
  getPostsForFollowedListsByUserId,
  getPostsForListsIds,
} from "../models/Post.ts";
import { PostFeed } from "../views/components/PostFeed.tsx";
import { getListByHashId } from "../models/List.ts";
import { postingFrequencyLabelToNumber } from "../models/User.ts";

const app = new Hono();

app.get("", async (c: Context) => {
  const loggedInUser = await getAuthenticatedUser(c);
  const page = Number(c.req.query("page")) || 1;
  const listHashId = c.req.query("list");
  const perPage = 10;
  const offset = (page - 1) * perPage;
  // List pages can be accessed by logged in and logged out users
  if (listHashId) {
    const list = await getListByHashId(listHashId);
    if (!list) {
      return c.body("List not found", 404);
    }
    const [posts, hasMore] = await getPostsForListsIds(
      [list.id],
      perPage,
      offset,
      loggedInUser &&
        postingFrequencyLabelToNumber[loggedInUser.setting_posting_frequency],
    );
    return c.html(PostFeed({ posts, hasMore, page, list }));
  }
  if (!loggedInUser) {
    c.header("HX-Redirect", "/login");
    return c.body("Unauthorized", 401);
  }
  // Home feed page is only accessible by logged in users
  const [posts, hasMore] = await getPostsForFollowedListsByUserId(
    loggedInUser.id,
    perPage,
    offset,
    postingFrequencyLabelToNumber[loggedInUser.setting_posting_frequency],
  );
  return c.html(PostFeed({ posts, hasMore, page }));
});

export default app;
