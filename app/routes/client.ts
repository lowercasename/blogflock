import { Context, Hono } from "hono";
import {
  getAuthenticatedUser,
  jwtAuthMiddleware,
  redirectIfAuthenticated,
} from "../lib/auth.ts";
import {
  getUserByUsername,
  postingFrequencyLabelToNumber,
  validateForgotPasswordToken,
} from "../models/User.ts";
import { flash } from "../lib/flash.ts";
import {
  getAllListsByFilter,
  getCreatedListsByUserId,
  getFollowedListsByUserId,
  getListByHashId,
  getRandomLists,
  listToAtomFeed,
} from "../models/List.ts";
import { UserProfilePage } from "../views/UserProfilePage.tsx";
import { ListPage } from "../views/ListPage.tsx";
import { HomeFeedPage } from "../views/HomeFeedPage.tsx";
import {
  getBookmarkedPostsByUserId,
  getPostsForFollowedListsByUserId,
  getPostsForListsIds,
} from "../models/Post.ts";
import { SettingsPage } from "../views/SettingsPage.tsx";
import { BillingPage } from "../views/BillingPage.tsx";
import { wsClientsMap } from "../lib/websockets.ts";
import { AuthFormLayout } from "../views/layouts/AuthFormPage.tsx";
import {
  ForgotPasswordForm,
  LoginForm,
  RegisterForm,
  ResendVerificationEmailForm,
  ResetPasswordForm,
  VerifyEmailForm,
} from "../views/components/AuthForms.tsx";
import { WelcomePage } from "../views/WelcomePage.tsx";
import { ListSearchPage } from "../views/ListSearchPage.tsx";
import { stripe } from "../lib/stripe.ts";
import { db } from "../lib/db.ts";
import { BookmarksPage } from "../views/BookmarksPage.tsx";

const app = new Hono();

export const renderListPage = async (c: Context, page: number = 1) => {
  const loggedInUser = await getAuthenticatedUser(c);
  const hashId = c.req.param("hashId");

  // Fetch list by hashId
  const list = await getListByHashId(hashId);
  if (!list) {
    return c.redirect("/");
  }
  const [posts, hasMore] = await getPostsForListsIds(
    [list.id],
    10,
    0,
    loggedInUser &&
      postingFrequencyLabelToNumber[loggedInUser.setting_posting_frequency],
    loggedInUser?.id,
  );

  if (!list) {
    return c.redirect("/");
  }

  return c.html(ListPage({
    loggedInUser,
    list,
    posts,
    hasMore,
    page,
  }));
};

app.get("/login", redirectIfAuthenticated, flash, (c: Context) => {
  return c.html(AuthFormLayout({ title: "Login", children: LoginForm() }));
});

app.get("/register", redirectIfAuthenticated, flash, (c: Context) => {
  return c.html(
    AuthFormLayout({
      title: "Create a BlogFlock account",
      children: RegisterForm(),
    }),
  );
});

app.get("/verify-email", redirectIfAuthenticated, flash, (c: Context) => {
  return c.html(
    AuthFormLayout({ title: "Verify Email", children: VerifyEmailForm() }),
  );
});

app.get(
  "/resend-verification-email",
  redirectIfAuthenticated,
  flash,
  (c: Context) => {
    return c.html(AuthFormLayout({
      title: "Resend Verification Email",
      children: ResendVerificationEmailForm(),
    }));
  },
);

app.get("/forgot-password", redirectIfAuthenticated, flash, (c: Context) => {
  return c.html(AuthFormLayout({
    title: "Forgot Password",
    children: ForgotPasswordForm(),
  }));
});

app.get("/reset-password", redirectIfAuthenticated, flash, (c: Context) => {
  const token = c.req.query("token");
  if (!token) {
    return c.redirect("/forgot-password");
  }
  const user = validateForgotPasswordToken(token);
  if (!user) {
    return c.redirect("/forgot-password");
  }
  return c.html(AuthFormLayout({
    title: "Reset Password",
    children: ResetPasswordForm({ token }),
  }));
});

app.get(
  "/list/:hashId",
  flash,
  (c: Context) => renderListPage(c, 1),
);

app.get("/list/:hashId/feed.xml", async (c: Context) => {
  const list = await getListByHashId(c.req.param("hashId"));
  if (!list) {
    return c.text("List not found", 404);
  }

  const feed = await listToAtomFeed(list);
  c.header("Content-Type", "application/xml");
  return c.text(feed);
});

app.get("/bookmarks", jwtAuthMiddleware, async (c: Context) => {
  const loggedInUser = c.get("user");
  const [posts, hasMore] = await getBookmarkedPostsByUserId(
    loggedInUser.id,
    10,
    0,
    postingFrequencyLabelToNumber[loggedInUser.setting_posting_frequency],
  );
  return c.html(
    BookmarksPage({
      loggedInUser,
      posts,
      hasMore,
    }),
  );
});

app.get("/user/:username", jwtAuthMiddleware, async (c: Context) => {
  const loggedInUser = c.get("user");
  const user = await getUserByUsername(c.req.param("username"));
  if (!user) {
    return c.redirect("/");
  }
  const createdLists = await getCreatedListsByUserId(user.id);
  const followedLists = await getFollowedListsByUserId(user.id);
  return c.html(
    UserProfilePage({ loggedInUser, user, createdLists, followedLists }),
  );
});

app.get("/", async (c: Context) => {
  const loggedInUser = await getAuthenticatedUser(c);
  const randomLists = await getRandomLists(5);
  if (loggedInUser) {
    const [posts, hasMore] = await getPostsForFollowedListsByUserId(
      loggedInUser.id,
      10,
      0,
      postingFrequencyLabelToNumber[loggedInUser.setting_posting_frequency],
    );
    return c.html(
      HomeFeedPage({ loggedInUser, posts, hasMore, randomLists }),
    );
  }
  return c.html(WelcomePage({ randomLists }));
});

app.get("/settings", jwtAuthMiddleware, (c: Context) => {
  const loggedInUser = c.get("user");
  return c.html(SettingsPage({ loggedInUser }));
});

app.get("/billing", jwtAuthMiddleware, async (c: Context) => {
  const loggedInUser = c.get("user");

  // Skip checkout if user already has active subscription
  if (loggedInUser.blogflock_supporter_subscription_active) {
    return c.html(BillingPage({ loggedInUser, session: null }));
  }

  let sessionParams = {};

  if (loggedInUser.stripe_customer_id) {
    // Use existing customer
    sessionParams = {
      customer: loggedInUser.stripe_customer_id,
    };
  } else {
    // Create a new customer
    const customer = await stripe.customers.create({
      email: loggedInUser.email,
      metadata: {
        user_id: loggedInUser.id,
      },
    });
    await db.queryObject(
      "UPDATE users SET stripe_customer_id = $1 WHERE id = $2",
      [customer.id, loggedInUser.id],
    );
    sessionParams = {
      customer: customer.id,
    };
  }

  const priceId = Deno.env.get("BLOGFLOCK_SUPPORTER_PRICE_ID");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    ...sessionParams,
    success_url:
      "https://blogflock.com/api/billing/complete?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: "https://blogflock.com/billing",
  });

  return c.html(BillingPage({ loggedInUser, session }));
});

app.get("/billing/portal", jwtAuthMiddleware, async (c: Context) => {
  const loggedInUser = c.get("user");
  if (!loggedInUser.stripe_customer_id) {
    return c.redirect("/billing");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: loggedInUser.stripe_customer_id,
    return_url: "https://blogflock.com/billing",
  });
  return c.redirect(session.url);
});

app.get("/lists", jwtAuthMiddleware, async (c: Context) => {
  const loggedInUser = c.get("user");
  const [lists, hasMore] = await getAllListsByFilter("", 10, 0, "last_updated");
  return c.html(ListSearchPage({ loggedInUser, lists, hasMore }));
});

app.get("/debug/ws-clients", (c) => {
  return c.json({
    clients: Array.from(wsClientsMap).map(([k, v]) => ({
      id: k,
      socketStates: Array.from(v).map((v) => v.readyState),
    })),
  });
});

export default app;
