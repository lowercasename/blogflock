import { BaseLayout } from "./layouts/BaseLayout.tsx";
import { User } from "../models/User.ts";
import { List } from "../models/List.ts";
import { ListItem } from "./components/ListItem.tsx";
import { Card } from "./components/Card.tsx";
import { Stack } from "./components/Stack.tsx";
import { CogIcon } from "./components/Icons.tsx";
import { Button, IconButtonLink } from "./components/Button.tsx";
import { Input } from "./components/Input.tsx";
import { FlashMessage } from "./components/FlashMessage.tsx";
import { Flash } from "../lib/flash.ts";
import { UserBadge } from "./components/UserBadge.tsx";

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
            <Input
                type="text"
                name="description"
                value={formData?.description}
                placeholder="List description (optional)"
            />
            <FlashMessage messages={messages} />
            <Button type="submit">Create list</Button>
        </form>
    );
}

export function UserProfilePage(
    { loggedInUser, user, createdLists, followedLists }: {
        loggedInUser: User;
        user: User;
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
                    {user.bio
                        ? <p class="text-gray-600">{user.bio}</p>
                        : (
                            <p class="text-gray-500">
                                This person hasn't written anything about
                                themselves yet.
                            </p>
                        )}
                </Card>
                <Card title={`Lists followed by ${user.username}`}>
                    <Stack
                        items={followedLists.map((l) => <ListItem list={l} />)}
                    />
                </Card>
                <Card title={`Lists created by ${user.username}`}>
                    <Stack
                        items={createdLists.map((l) => <ListItem list={l} />)}
                    />
                    {isOwner ? <CreateListForm /> : null}
                </Card>
            </div>
        </BaseLayout>
    );
}
