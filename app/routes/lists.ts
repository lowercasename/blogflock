import { Context, Hono } from "hono";
import { z } from "https://deno.land/x/zod/mod.ts";
import { parse as parseXml } from "https://deno.land/x/xml@6.0.4/mod.ts";
import opml from "npm:opml";
import { setFlash } from "../lib/flash.ts";
import { validateRequest } from "../lib/validateRequest.ts";
import { jwtAuthMiddleware } from "../lib/auth.ts";
import {
    createList,
    getAllListsByFilter,
    getListByHashId,
    updateList,
} from "../models/List.ts";
import { createBlog, getBlogByUrl } from "../models/Blog.ts";
import {
    addBlogToList,
    removeBlogFromList,
    updateBlogInList,
} from "../models/ListBlog.ts";
import { addListFollower, removeListFollower } from "../models/ListFollower.ts";
import { renderListPage } from "./client.ts";
import {
    AddBlogForm,
    BlogList,
    ImportOpmlForm,
    ListMeta,
} from "../views/ListPage.tsx";
import { upgradeWebSocket } from "hono/deno";
import { addWsClient, removeWsClient } from "../lib/websockets.ts";
import { WSContext } from "hono/ws";
import { CreateListForm } from "../views/UserProfilePage.tsx";
import { ListFeed } from "../views/components/ListFeed.tsx";

const app = new Hono();

const createListSchema = z.object({
    name: z.string().trim().min(1, { message: "List name must not be empty" }),
    description: z.string().trim().max(250, {
        message: "Description must be 250 characters or less",
    }).optional(),
});

const updateListSchema = z.object({
    name: z.string().trim().min(1, { message: "List name must not be empty" }),
    description: z.string().trim().max(250, {
        message: "Description must be 250 characters or less",
    }).optional(),
});

const addBlogToListSchema = z.object({
    feedUrl: z.string().trim().url({ message: "Invalid feed URL" }),
});

const importOpmlSchema = z.object({
    opmlUrl: z.string().trim().url({ message: "Invalid OPML URL" }),
});

const updateBlogInListSchema = z.object({
    title: z.string().trim().min(1, { message: "Title must not be empty" }),
    description: z.string().trim().max(250, {
        message: "Description must be 250 characters or less",
    }).optional(),
});

// GET /lists/search - Show all lists with pagination and search
app.get("/search", jwtAuthMiddleware, (c: Context) => {
    const search = c.req.query("search");
    const page = Number(c.req.query("page")) || 1;
    const perPage = 10;
    const offset = (page - 1) * perPage;
    const [lists, hasMore] = getAllListsByFilter(search || "", perPage, offset);
    return c.html(ListFeed({ lists, hasMore, page, search }));
});

// POST /lists - Create a new list
app.post(
    "",
    jwtAuthMiddleware,
    validateRequest(createListSchema, {
        parseBody: true,
    }),
    (c: Context) => {
        const formData = c.get("formData");
        const user = c.get("user");
        const validationErrors = c.get("flash");

        if (validationErrors) {
            return c.html(
                CreateListForm({ messages: validationErrors, formData }),
            );
        }

        const list = createList({
            name: formData.name,
            description: formData.description,
        }, user.id);

        if (!list) {
            return c.html(
                CreateListForm({
                    messages: [{
                        type: "error",
                        message:
                            "An unexpected error occurred. Please try again.",
                    }],
                    formData,
                }),
            );
        }

        c.header("HX-Redirect", `/list/${list.hashId}`);
        return c.text("", 200);
    },
);

// PATCH /lists/:hashId - Update a list
app.patch(
    "/:hashId",
    jwtAuthMiddleware,
    validateRequest(updateListSchema, { parseBody: true }),
    (c: Context) => {
        const user = c.get("user");
        const hashId = c.req.param("hashId");
        const list = getListByHashId(hashId);
        const formData = c.get("formData");
        const validationErrors = c.get("flash");
        if (!list) {
            return c.html("List not found", 404);
        }

        // Does the logged in user own this list?
        if (list.userId !== user.id) {
            return c.html("Unauthorized", 401);
        }

        if (validationErrors) {
            return c.html(
                ListMeta({
                    list,
                    messages: validationErrors,
                    formData,
                    loggedInUser: user,
                    isOwner: true,
                }),
            );
        }

        const updatedList = updateList(list.id, {
            name: formData.name,
            description: formData.description,
        });

        if (!updatedList) {
            return c.html(
                ListMeta({
                    list,
                    messages: [{
                        type: "error",
                        message:
                            "An unexpected error occurred. Please try again.",
                    }],
                    formData,
                    loggedInUser: user,
                    isOwner: true,
                }),
            );
        }
        return c.html(
            ListMeta({
                list: updatedList,
                messages: [{ type: "success", message: "List updated" }],
                formData,
                loggedInUser: user,
                isOwner: true,
            }),
        );
    },
);

// POST /lists/:hashId/blogs - Add a blog to a list
app.post(
    "/:hashId/blogs",
    jwtAuthMiddleware,
    validateRequest(addBlogToListSchema, { parseBody: true }),
    async (c: Context) => {
        const user = c.get("user");
        const formData = c.get("formData");
        const validationErrors = c.get("flash");
        const hashId = c.req.param("hashId");

        const list = getListByHashId(hashId);
        if (!list) {
            return c.html("List not found", 404);
        }

        if (validationErrors) {
            return c.html(
                AddBlogForm({ list, messages: validationErrors, formData }),
            );
        }

        // Does the logged in user own this list?
        if (list.userId !== user.id) {
            return c.html(
                AddBlogForm({
                    list,
                    messages: [{ type: "error", message: "Unauthorized" }],
                    formData,
                }),
            );
        }

        // Is this one of BlogFlock's own feeds? If so, we don't want to add it for obvious reasons.
        try {
            if (new URL(formData.feedUrl).hostname === "blogflock.com") {
                return c.html(
                    AddBlogForm({
                        list,
                        messages: [{
                            type: "error",
                            message:
                                "Nice try, but as fun as exponential growth is, you can't add BlogFlock's own feeds to BlogFlock.",
                        }],
                        formData,
                    }),
                );
            }
        } catch (_) {
            return c.html(
                AddBlogForm({
                    list,
                    messages: [{
                        type: "error",
                        message: "Invalid feed URL",
                    }],
                    formData,
                }),
            );
        }

        // Does this blog exist in the database?
        let existingBlog = getBlogByUrl(formData.feedUrl);
        if (!existingBlog) {
            // No - create a new blog
            existingBlog = await createBlog({ feedUrl: formData.feedUrl });
            if (!existingBlog) {
                return c.html(
                    AddBlogForm({
                        list,
                        messages: [{
                            type: "error",
                            message:
                                "An unexpected error occurred. Please try again.",
                        }],
                        formData,
                    }),
                );
            }
        }

        // Does an entry for this blog already exist in the list?
        // We check this after we add the blog to the database because it's
        // not the end of the world if we add a blog to the database that
        // isn't connected to a list, but we need the fully created blog
        // to know what the URL we're checking is.
        if (
            list.listBlogs?.some((lb) =>
                lb.blog.feedUrl === existingBlog.feedUrl
            )
        ) {
            return c.html(
                AddBlogForm({
                    list,
                    messages: [{
                        type: "error",
                        message: "This blog is already in the list.",
                    }],
                    formData,
                }),
            );
        }

        addBlogToList({ listId: list.id, blogId: existingBlog.id });

        // // return c.html(
        //     AddBlogForm({
        //         list,
        //         messages: [{ type: "success", message: "Blog added to list" }],
        //     }),
        // );

        c.header("HX-Redirect", `/list/${hashId}`);
        return c.text("", 200);
    },
);

// POST /lists/:hashId/import/opml - Import an OPML file
app.post(
    "/:hashId/import/opml",
    jwtAuthMiddleware,
    validateRequest(importOpmlSchema, { parseBody: true }),
    async (c: Context) => {
        const user = c.get("user");
        const formData = c.get("formData");
        const validationErrors = c.get("flash");
        const hashId = c.req.param("hashId");

        const list = getListByHashId(hashId);
        if (!list) {
            return c.html("List not found", 404);
        }
        if (validationErrors) {
            return c.html(
                ImportOpmlForm({
                    list,
                    messages: validationErrors,
                    formData,
                }),
            );
        }
        // Does the logged in user own this list?
        if (list.userId !== user.id) {
            return c.html(
                ImportOpmlForm({
                    list,
                    messages: [{ type: "error", message: "Unauthorized" }],
                    formData,
                }),
            );
        }

        try {
            // Fetch the OPML file
            const response = await fetch(formData.opmlUrl);
            if (!response.ok) {
                return c.html(
                    ImportOpmlForm({
                        list,
                        messages: [{
                            type: "error",
                            message: "Failed to fetch OPML file",
                        }],
                        formData,
                    }),
                );
            }
            const opml = await response.text();

            let doc;
            try {
                // Parse the OPML file
                doc = parseXml(opml);
            } catch (e: unknown) {
                console.error("Error parsing OPML: ", e);
                return c.html(
                    ImportOpmlForm({
                        list,
                        messages: [{
                            type: "error",
                            message:
                                "Error parsing OPML file. Ensure it is valid OPML.",
                        }],
                        formData,
                    }),
                );
            }

            // Receives either an array of outlines or a single outline object, which can either contain
            // the key 'outline' (in which case 'outline' is an array of outlines) or the key '@xmlUrl'
            // (in which case 'outline' is a single outline object).
            const recursiveReadOutlines = (outline): string[] => {
                console.log("Processing outline:", outline);
                if (Array.isArray(outline)) {
                    return outline.flatMap((o) => recursiveReadOutlines(o));
                }
                if (typeof outline === "object" && outline["outline"]) {
                    return recursiveReadOutlines(outline["outline"]);
                }
                if (typeof outline === "object" && outline["@xmlUrl"]) {
                    return [outline["@xmlUrl"]];
                }
                return [];
            };

            const opmlDoc = doc.opml as {
                body: {
                    outline: Record<string, string> | Record<string, string>[];
                };
            };
            if (
                !opmlDoc || typeof opmlDoc !== "object" || !opmlDoc.body ||
                typeof opmlDoc.body !== "object" || !opmlDoc.body.outline ||
                typeof opmlDoc.body.outline !== "object"
            ) {
                return c.html(
                    ImportOpmlForm({
                        list,
                        messages: [{
                            type: "error",
                            message: "Invalid OPML file",
                        }],
                        formData,
                    }),
                );
            }

            const feedUrls = recursiveReadOutlines(opmlDoc.body.outline);
            console.log(feedUrls);

            // Add each feed to the list
            for (const feedUrl of feedUrls) {
                if (!feedUrl) {
                    continue;
                }
                // Is this one of BlogFlock's own feeds? If so, we don't want to add it for obvious reasons.
                try {
                    if (new URL(feedUrl).hostname === "blogflock.com") {
                        continue;
                    }
                } catch (_) {
                    continue;
                }

                // Does this blog exist in the database?
                let existingBlog = getBlogByUrl(feedUrl);
                if (!existingBlog) {
                    // No - create a new blog
                    try {
                        existingBlog = await createBlog({ feedUrl });
                    } catch (e) {
                        console.error(
                            "Error importing blog during import: ",
                            e,
                        );
                        continue;
                    }
                }
                if (!existingBlog) {
                    return c.html(
                        AddBlogForm({
                            list,
                            messages: [{
                                type: "error",
                                message:
                                    "An unexpected error occurred. Please try again.",
                            }],
                            formData,
                        }),
                    );
                }

                // Does an entry for this blog already exist in the list?
                // We check this after we add the blog to the database because it's
                // not the end of the world if we add a blog to the database that
                // isn't connected to a list, but we need the fully created blog
                // to know what the URL we're checking is.
                if (
                    list.listBlogs?.some((lb) =>
                        lb.blog.feedUrl === existingBlog.feedUrl
                    )
                ) {
                    continue;
                }

                addBlogToList({ listId: list.id, blogId: existingBlog.id });
            }

            c.header("HX-Redirect", `/list/${hashId}`);
            return c.text("", 200);
        } catch (e) {
            console.error("Error importing OPML: ", e);
            return c.html(
                ImportOpmlForm({
                    list,
                    messages: [{
                        type: "error",
                        message:
                            "An unexpected error occurred. Please try again.",
                    }],
                    formData,
                }),
            );
        }
    },
);

// PATCH /lists/:hashId/blogs/:blogHashId - Update a blog in a list
app.patch(
    "/:hashId/blogs/:blogHashId",
    jwtAuthMiddleware,
    validateRequest(updateBlogInListSchema, { parseBody: true }),
    (c: Context) => {
        const user = c.get("user");
        const hashId = c.req.param("hashId");
        const blogHashId = c.req.param("blogHashId");
        const formData = c.get("formData");
        const validationErrors = c.get("flash");

        const list = getListByHashId(hashId);
        if (!list) {
            return c.html("List not found", 404);
        }

        // Does the logged in user own this list?
        if (list.userId !== user.id) {
            return c.html("Unauthorized", 401);
        }

        if (validationErrors) {
            return c.html(
                BlogList({ list, flash: validationErrors, isOwner: true }),
            );
        }

        const listBlog = list.listBlogs?.find((lb) =>
            lb.blog.hashId === blogHashId
        );
        if (!listBlog) {
            return c.html(
                BlogList({
                    list,
                    flash: [{
                        type: "error",
                        message: "Blog not found in list",
                    }],
                    isOwner: true,
                }),
            );
        }

        // Update the blog in the list
        const updatedListBlog = updateBlogInList(
            listBlog.listId,
            listBlog.blogId,
            {
                customTitle: formData.title,
                customDescription: formData.description,
                customAuthor: "",
                customImageUrl: "",
            },
        );
        if (!updatedListBlog) {
            return c.html(
                BlogList({
                    list,
                    flash: [{
                        type: "error",
                        message:
                            "An unexpected error occurred. Please try again.",
                    }],
                    isOwner: true,
                }),
            );
        }
        const listWithUpdatedBlog = getListByHashId(hashId);
        if (!listWithUpdatedBlog) {
            return c.html(
                BlogList({
                    list,
                    flash: [{
                        type: "error",
                        message:
                            "An unexpected error occurred. Please try again.",
                    }],
                    isOwner: true,
                }),
            );
        }

        return c.html(
            BlogList({
                list: listWithUpdatedBlog,
                flash: [{ type: "success", message: "Blog updated" }],
                isOwner: true,
            }),
        );
    },
);

// DELETE /lists/:hashId/blogs/:blogHashId - Remove a blog from a list
app.delete("/:hashId/blogs/:blogHashId", jwtAuthMiddleware, (c: Context) => {
    const user = c.get("user");
    const hashId = c.req.param("hashId");
    const blogHashId = c.req.param("blogHashId");

    const list = getListByHashId(hashId);
    if (!list) {
        console.log("List not found");
        setFlash(c, {
            message: "List not found",
            type: "error",
        });
        return renderListPage(c);
    }

    // Does the logged in user own this list?
    if (list.userId !== user.id) {
        return c.body("Unauthorized", 401);
    }

    const blog = list.listBlogs?.find((lb) => lb.blog.hashId === blogHashId);
    if (!blog) {
        console.log("Blog not found in list");
        setFlash(c, {
            message: "Blog not found in list",
            type: "error",
        });
        return renderListPage(c);
    }

    removeBlogFromList(list.id, blog.blog.id);

    setFlash(c, {
        message: "Blog removed from list",
        type: "success",
    });
    return renderListPage(c);
});

// POST /lists/:hashId/followers - Follow a list
app.post("/:hashId/followers", jwtAuthMiddleware, (c: Context) => {
    const list = getListByHashId(c.req.param("hashId"));
    if (!list) {
        return c.redirect("/");
    }

    addListFollower({
        userId: c.get("user").id,
        listId: list.id,
    });

    return renderListPage(c);
});

// DELETE /lists/:hashId/followers - Unfollow a list
app.delete("/:hashId/followers", jwtAuthMiddleware, (c: Context) => {
    const list = getListByHashId(c.req.param("hashId"));
    if (!list) {
        return c.redirect("/");
    }

    removeListFollower(c.get("user").id, list.id);
    return renderListPage(c);
});

app.get(
    "/:hashId/ws",
    jwtAuthMiddleware,
    upgradeWebSocket((c: Context) => {
        const hashId = c.req.param("hashId");
        return {
            onOpen: (_: Event, ws: WSContext<WebSocket>) => {
                if (ws.raw?.readyState !== WebSocket.OPEN) {
                    return;
                }
                addWsClient(hashId, ws.raw);
                console.log(`[WS] Connection opened for ${hashId}`);
            },
            onClose: (_: Event, ws: WSContext<WebSocket>) => {
                if (ws.raw?.readyState !== WebSocket.OPEN) {
                    return;
                }
                removeWsClient(hashId, ws.raw);
                console.log(`[WS] Connection closed for ${hashId}`);
            },
        };
    }),
);

export default app;
