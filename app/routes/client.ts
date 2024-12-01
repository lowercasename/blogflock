import { Context, Hono } from "hono";
import {
    getAuthenticatedUser,
    jwtAuthMiddleware,
    redirectIfAuthenticated,
} from "../lib/auth.ts";
import {
    getUserByUsername,
    validateForgotPasswordToken,
} from "../models/User.ts";
import { flash } from "../lib/flash.ts";
import {
    getAllListsByFilter,
    getCreatedListsByUserId,
    getFollowedListsByUserId,
    getListByHashId,
    getRandomLists,
} from "../models/List.ts";
import { UserProfilePage } from "../views/UserProfilePage.tsx";
import { ListPage } from "../views/ListPage.tsx";
import { HomeFeedPage } from "../views/HomeFeedPage.tsx";
import {
    getPostsForFollowedListsByUserId,
    getPostsForListsIds,
} from "../models/Post.ts";
import { SettingsPage } from "../views/SettingsPage.tsx";
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

const app = new Hono();

export const renderListPage = async (c: Context, page: number = 1) => {
    const loggedInUser = await getAuthenticatedUser(c);
    const hashId = c.req.param("hashId");

    // Fetch list by hashId
    const list = getListByHashId(hashId);
    if (!list) {
        return c.redirect("/");
    }
    const [posts, hasMore] = getPostsForListsIds([list.id], 10, 0);

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
        AuthFormLayout({ title: "Register", children: RegisterForm() }),
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

app.get("/user/:username", jwtAuthMiddleware, (c: Context) => {
    const loggedInUser = c.get("user");
    const user = getUserByUsername(c.req.param("username"));
    if (!user) {
        return c.redirect("/");
    }
    const createdLists = getCreatedListsByUserId(user.id);
    const followedLists = getFollowedListsByUserId(user.id);
    return c.html(
        UserProfilePage({ loggedInUser, user, createdLists, followedLists }),
    );
});

app.get("/", async (c: Context) => {
    const loggedInUser = await getAuthenticatedUser(c);
    const randomLists = getRandomLists(5);
    if (loggedInUser) {
        const [posts, hasMore] = getPostsForFollowedListsByUserId(
            loggedInUser.id,
            10,
            0,
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

app.get("/lists", jwtAuthMiddleware, (c: Context) => {
    const loggedInUser = c.get("user");
    const [lists, hasMore] = getAllListsByFilter("", 10, 0);
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
