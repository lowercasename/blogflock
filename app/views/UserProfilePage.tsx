import { BaseLayout } from "./layouts/BaseLayout.tsx";
import { PublicUserFieldsWithRenderedBio, User } from "../models/User.ts";
import { List } from "../models/List.ts";
import { ListItem } from "./components/ListItem.tsx";
import { Card } from "./components/Card.tsx";
import { Stack } from "./components/Stack.tsx";
import { CogIcon } from "./components/Icons.tsx";
import { Button, IconButtonLink } from "./components/Button.tsx";
import { Input, MaxLengthTextarea } from "./components/Input.tsx";
import { FlashMessage } from "./components/FlashMessage.tsx";
import { Flash } from "../lib/flash.ts";
import { UserBadge } from "./components/UserBadge.tsx";
import { LIST_DESCRIPTION_MAX_LENGTH } from "../routes/lists.ts";
import SubscribeCallout from "./components/SubscribeCallout.tsx";

export function CreateListForm(
  { messages, formData }: {
    messages?: Flash[];
    formData?: Record<string, string>;
  },
) {
  return (
    <form
      class="mt-4 flex flex-col gap-4 p-4 bg-stone-100 border border-stone-300 rounded"
      hx-post="/lists"
      hx-swap="outerHTML"
      hx-target="this"
    >
      <Input
        type="text"
        name="name"
        placeholder="List name"
        value={formData?.name}
        required
      />
      <MaxLengthTextarea
        type="text"
        name="description"
        value={formData?.description}
        placeholder="List description (optional)"
        maxLength={LIST_DESCRIPTION_MAX_LENGTH}
        rows={5}
        markdown
      />
      <FlashMessage messages={messages} />
      <Button type="submit">Create list</Button>
    </form>
  );
}

export function UserProfilePage(
  { loggedInUser, user, createdLists, followedLists }: {
    loggedInUser: User;
    user: PublicUserFieldsWithRenderedBio;
    createdLists: List[];
    followedLists: List[];
  },
) {
  const isOwner = loggedInUser.id === user.id;
  return (
    <BaseLayout loggedInUser={loggedInUser}>
      <div class="flex flex-col gap-4 w-full max-w-[1200px] mx-auto px-4">
        <Card
          title={<UserBadge user={user} size="md" />}
          controls={isOwner
            ? (
              <IconButtonLink icon={<CogIcon />} href="/settings">
                Settings
              </IconButtonLink>
            )
            : null}
        >
          {user.rendered_bio
            ? (
              <div
                class="text-gray-600 markdown"
                dangerouslySetInnerHTML={{
                  __html: user.rendered_bio.toString(),
                }}
              />
            )
            : (
              <p class="text-gray-500">
                This person hasn't written anything about themselves yet.
              </p>
            )}
        </Card>
        <SubscribeCallout loggedInUser={loggedInUser} />
        <Card title={`Lists created by ${user.username}`}>
          <Stack
            items={createdLists.map((l) => <ListItem key={l.id} list={l} />)}
          />
          {isOwner ? <CreateListForm /> : null}
        </Card>
        <Card title={`Lists followed by ${user.username}`}>
          <Stack
            items={followedLists.map((l) => <ListItem key={l.id} list={l} />)}
          />
        </Card>
      </div>
    </BaseLayout>
  );
}
