import { BaseLayout } from "./layouts/BaseLayout.tsx";
import { User } from "../models/User.ts";
import { List } from "../models/List.ts";
import { Post as PostType } from "../models/Post.ts";
import { PostFeed } from "./components/PostFeed.tsx";
import { FlashMessage } from "./components/FlashMessage.tsx";
import { Flash } from "../lib/flash.ts";
import { UserLink } from "./components/UserLink.tsx";
import { Card } from "./components/Card.tsx";
import { Stack } from "./components/Stack.tsx";
import { Link } from "./components/Link.tsx";
import { Button, IconButton } from "./components/Button.tsx";
import {
  BinIcon,
  MinusCircleIcon,
  PenIcon,
  PlusCircleIcon,
} from "./components/Icons.tsx";
import { Input, Textarea } from "./components/Input.tsx";

export function AddBlogForm({
  list,
  messages,
  formData,
}: {
  list: List;
  messages?: Flash[];
  formData?: Record<string, string>;
}) {
  return (
    <form
      class="flex flex-col gap-2 p-4 bg-stone-100 border border-stone-300 rounded"
      hx-post={`/lists/${list.hashId}/blogs`}
      hx-swap="outerHTML"
      hx-target="this"
      x-data="{ loading: false }"
    >
      <Input
        type="text"
        name="feedUrl"
        placeholder="Blog or RSS feed URL"
        value={formData?.feedUrl}
        x-bind:disabled="loading"
        required
      />
      <FlashMessage messages={messages} />
      <Button
        type="submit"
        x-bind:disabled="loading"
        x-text="loading ? 'Adding...' : 'Add Blog'"
        x-on:click="$nextTick(() => loading = true)"
      >
        Add blog
      </Button>
    </form>
  );
}

export function ListMeta(
  { list, isOwner, messages, formData, user }: {
    list: List;
    isOwner: boolean;
    messages?: Flash[];
    formData?: Record<string, string>;
    user: User;
  },
) {
  return (
    <Card
      title={<div x-show="!editing">{list.name}</div>}
      controls={isOwner
        ? (
          <IconButton
            icon={<PenIcon />}
            x-on:click="editing = !editing"
            x-show="!editing"
          >
            Edit
          </IconButton>
        )
        : null}
      className="order-1 md:order-2"
      id="list-meta"
    >
      <div class="flex flex-col gap-4">
        <p x-show="!editing" class="text-gray-600">{list.description}</p>
        <EditListForm list={list} messages={messages} formData={formData} />
        <div>
          Created by <UserLink user={list.user} />
        </div>

        {list.listFollowers?.some((lf) => lf.userId === user.id)
          ? (
            <Button
              hx-delete={`/lists/${list.hashId}/followers`}
              hx-swap="outerHTML"
              hx-target="body"
              icon={<MinusCircleIcon />}
            >
              Unfollow
            </Button>
          )
          : (
            <Button
              hx-post={`/lists/${list.hashId}/followers`}
              hx-swap="outerHTML"
              hx-target="body"
              icon={<PlusCircleIcon />}
            >
              Follow
            </Button>
          )}

        <BlogList list={list} isOwner={isOwner} />
        {isOwner && <AddBlogForm list={list} />}
      </div>
    </Card>
  );
}

export function EditListForm(
  { list, messages, formData }: {
    list: List;
    messages?: Flash[];
    formData?: Record<string, string>;
  },
) {
  return (
    <form
      class="flex flex-col gap-4 p-4 bg-stone-100 border border-stone-300 rounded"
      style="display:none;"
      x-show="editing"
      hx-patch={`/lists/${list.hashId}`}
      hx-swap="outerHTML"
      hx-target="#list-meta"
    >
      <Input
        type="text"
        name="name"
        value={formData?.name || list.name}
        required
        placeholder="List name"
      />
      <Textarea name="description" placehodler="List description">
        {formData?.description || list.description}
      </Textarea>
      <FlashMessage messages={messages} />
      <Button type="submit" x-on:click="editing = false">Save</Button>
    </form>
  );
}

export function BlogList({
  list,
  flash,
  isOwner,
}: {
  list: List;
  flash?: Flash[];
  isOwner: boolean;
}) {
  return (
    <div id="blogs-list">
      <h2 class="text-lg font-semibold text-orange-800 mb-2">Blogs</h2>
      {isOwner && <FlashMessage messages={flash} />}
      <Stack
        items={list.listBlogs?.map((lb) => (
          <div x-data="{ editing: false }">
            {isOwner && (
              <form
                class="flex flex-col gap-4 p-4 bg-stone-100 border border-stone-300 rounded"
                style="display:none;"
                x-show="editing"
                hx-patch={`/lists/${list.hashId}/blogs/${lb.blog.hashId}`}
                hx-swap="outerHTML"
                hx-target="#blogs-list"
              >
                <Input
                  type="text"
                  name="title"
                  value={lb.title || ""}
                  placeholder="Blog title"
                  required
                />
                <Textarea name="description" placeholder="Blog description">
                  {lb.description}
                </Textarea>
                <Button type="submit">Save</Button>
              </form>
            )}
            <div x-show="!editing">
              <Link href={lb.blog.siteUrl!}>
                {lb.title || new URL(lb.blog.siteUrl!).hostname}
              </Link>
              <p class="text-sm text-gray-600 mb-2">{lb.description}</p>
            </div>
            {isOwner && (
              <div class="flex gap-2">
                <IconButton
                  icon={<PenIcon />}
                  x-on:click="editing = !editing"
                  x-show="!editing"
                >
                  Edit
                </IconButton>
                <IconButton
                  icon={<BinIcon />}
                  hx-delete={`/lists/${list.hashId}/blogs/${lb.blog.hashId}`}
                  hx-swap="outerHTML"
                  hx-target="body"
                  hx-confirm="Are you sure you want to remove this blog from the list?"
                >
                  Remove
                </IconButton>
              </div>
            )}
          </div>
        )) || []}
      />
    </div>
  );
}

export function ListPage({
  user,
  list,
  posts,
  hasMore,
}: {
  user: User;
  list: List;
  posts: PostType[];
  hasMore: boolean;
  page: number;
}) {
  const isOwner = list.userId === user.id;

  return (
    <BaseLayout loggedInUser={user}>
      <div
        class="grid grid-cols-1 gap-4 md:grid-cols-[2fr,1fr] w-full max-w-[1200px] mx-auto [&>*]:self-start px-4"
        x-data="{ editing: false }"
      >
        <PostFeed
          posts={posts}
          hasMore={hasMore}
          page={1}
          list={list}
          className="order-2 md:order-1"
        />
        <ListMeta list={list} isOwner={isOwner} user={user} />
      </div>
    </BaseLayout>
  );
}
