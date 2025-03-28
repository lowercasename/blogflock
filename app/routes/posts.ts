import { Context, Hono } from "hono";
import {
  getAuthenticatedUser,
  hasSubscriptionMiddleware,
  jwtAuthMiddleware,
} from "../lib/auth.ts";
import {
  getBookmarkedPostsByUserId,
  getPostsForFollowedListsByUserId,
  getPostsForListsIds,
  getPostWithAssociationsById,
} from "../models/Post.ts";
import { PostFeed } from "../views/components/PostFeed.tsx";
import { getListByHashId } from "../models/List.ts";
import { postingFrequencyLabelToNumber } from "../models/User.ts";
import {
  createBookmarkedPost,
  deleteBookmarkedPostByPostIdAndUserId,
} from "../models/BookmarkedPost.ts";
import { Post } from "../views/components/Post.tsx";

const app = new Hono();

// GET /posts - Get posts by list or home feed
app.get("", async (c: Context) => {
  const loggedInUser = await getAuthenticatedUser(c);
  const type = c.req.query("type");
  if (!type || !["posts", "bookmarks"].includes(type)) {
    return c.body("Invalid type", 400);
  }
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
      loggedInUser?.id,
    );
    return c.html(
      PostFeed({
        posts,
        hasMore,
        page,
        list,
        hasSubscription: loggedInUser?.blogflock_supporter_subscription_active,
        type: "posts",
      }),
    );
  }
  // Home feed page and bookmarks page are only accessible by logged in users
  if (!loggedInUser) {
    c.header("HX-Redirect", "/login");
    return c.body("Unauthorized", 401);
  }
  if (type === "bookmarks") {
    if (!loggedInUser.blogflock_supporter_subscription_active) {
      c.header("HX-Redirect", "/");
      return c.body("Unauthorized", 401);
    }
    const [posts, hasMore] = await getBookmarkedPostsByUserId(
      loggedInUser.id,
      perPage,
      offset,
      postingFrequencyLabelToNumber[loggedInUser.setting_posting_frequency],
    );
    return c.html(
      PostFeed({
        posts,
        hasMore,
        page,
        hasSubscription: loggedInUser?.blogflock_supporter_subscription_active,
        type: "bookmarks",
      }),
    );
  }
  const [posts, hasMore] = await getPostsForFollowedListsByUserId(
    loggedInUser.id,
    perPage,
    offset,
    postingFrequencyLabelToNumber[loggedInUser.setting_posting_frequency],
  );
  return c.html(
    PostFeed({
      posts,
      hasMore,
      page,
      hasSubscription: loggedInUser?.blogflock_supporter_subscription_active,
      type: "posts",
    }),
  );
});

// POST /posts/:postId/bookmark - Bookmark a post
app.post(
  "/:postId/bookmark",
  jwtAuthMiddleware,
  hasSubscriptionMiddleware,
  async (c: Context) => {
    const loggedInUser = c.get("user");
    const postId = Number(c.req.param("postId"));
    const bookmarkedPost = await createBookmarkedPost({
      user_id: loggedInUser.id,
      post_id: postId,
    });
    if (!bookmarkedPost) {
      return c.body("Failed to bookmark post", 500);
    }
    return c.html(
      Post({
        post: bookmarkedPost,
        hasSubscription: loggedInUser?.blogflock_supporter_subscription_active,
      }),
    );
  },
);

// DELETE /posts/:postId/bookmark - Unbookmark a post
app.delete(
  "/:postId/bookmark",
  jwtAuthMiddleware,
  hasSubscriptionMiddleware,
  async (c: Context) => {
    const loggedInUser = c.get("user");
    const postId = Number(c.req.param("postId"));
    await deleteBookmarkedPostByPostIdAndUserId({
      user_id: loggedInUser.id,
      post_id: postId,
    });
    const post = await getPostWithAssociationsById(postId, loggedInUser.id);
    if (!post) {
      return c.body("Post not found", 404);
    }
    return c.html(
      Post({
        post,
        hasSubscription: loggedInUser?.blogflock_supporter_subscription_active,
      }),
    );
  },
);

export default app;
