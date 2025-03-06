import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { query, queryOne } from "../lib/db.ts";
import { BlogSchema } from "./Blog.ts";
import { ListSchema } from "./List.ts";

export const ListBlogSchema = z.object({
  list_id: z.number(),
  blog_id: z.number(),
  custom_title: z.string().nullable(),
  custom_description: z.string().nullable(),
  custom_image_url: z.string().nullable(),
  custom_author: z.string().nullable(),
  created_at: z.coerce.date(),
  blog: BlogSchema,
}).transform((data) => ({
  ...data,
  title: data.custom_title || data.blog.auto_title,
  description: data.custom_description || data.blog.auto_description,
  image_url: data.custom_image_url || data.blog.auto_image_url,
  author: data.custom_author || data.blog.auto_author,
}));

export const ListBlogWithRelationsSchema = z.object({
  list_id: z.number(),
  blog_id: z.number(),
  custom_title: z.string().nullable(),
  custom_description: z.string().nullable(),
  custom_image_url: z.string().nullable(),
  custom_author: z.string().nullable(),
  created_at: z.coerce.date(),
  blog: BlogSchema,
  list: z.lazy(() => ListSchema),
}).transform((data) => ({
  ...data,
  title: data.custom_title || data.blog.auto_title ||
    (data.blog.site_url
      ? new URL(data.blog.site_url).hostname
      : "Untitled Blog"),
  description: data.custom_description || data.blog.auto_description,
  image_url: data.custom_image_url || data.blog.auto_image_url,
  author: data.custom_author || data.blog.auto_author,
}));

export type ListBlogObject = z.infer<typeof ListBlogSchema>;
export type ListBlogWithRelationsObject = z.infer<
  typeof ListBlogWithRelationsSchema
>;
export type ListBlog = ListBlogObject;
export type ListBlogWithRelations = ListBlogWithRelationsObject;

export type CreateListBlog = Partial<
  Pick<
    ListBlog,
    | "list_id"
    | "blog_id"
    | "custom_title"
    | "custom_description"
    | "custom_image_url"
    | "custom_author"
  >
>;

export type UpdateListBlog = Pick<
  ListBlog,
  "custom_title" | "custom_description" | "custom_image_url" | "custom_author"
>;

export const addBlogToList = async (
  listBlog: CreateListBlog,
): Promise<ListBlog> => {
  await query`
        INSERT INTO list_blogs (
            list_id, 
            blog_id, 
            custom_title, 
            custom_description, 
            custom_image_url, 
            custom_author, 
            created_at
        ) 
        VALUES (
            ${listBlog.list_id},
            ${listBlog.blog_id},
            ${listBlog.custom_title},
            ${listBlog.custom_description},
            ${listBlog.custom_image_url},
            ${listBlog.custom_author},
            ${new Date().toISOString()}
        )
    `;

  const result = await queryOne<ListBlog>`
        SELECT * FROM list_blogs 
        WHERE list_id = ${listBlog.list_id} AND blog_id = ${listBlog.blog_id}
    `;

  if (!result) {
    throw new Error("Failed to add blog to list");
  }

  return result;
};

export const removeBlogFromList = async (
  listId: number,
  blogId: number,
): Promise<void> => {
  await query`
        DELETE FROM list_blogs 
        WHERE list_id = ${listId} AND blog_id = ${blogId}
    `;
};

export const updateBlogInList = async (
  listId: number,
  blogId: number,
  listBlog: UpdateListBlog,
): Promise<ListBlog | null> => {
  await query`
        UPDATE list_blogs 
        SET 
            custom_title = ${listBlog.custom_title},
            custom_description = ${listBlog.custom_description},
            custom_image_url = ${listBlog.custom_image_url},
            custom_author = ${listBlog.custom_author}
        WHERE list_id = ${listId} AND blog_id = ${blogId}
    `;

  return await queryOne<ListBlog>`
        SELECT * FROM list_blogs 
        WHERE list_id = ${listId} AND blog_id = ${blogId}
    `;
};
