import { User } from "../models/User.ts";
import { BaseLayout } from "./layouts/BaseLayout.tsx";
import { List } from "../models/List.ts";
import { ListFeed } from "./components/ListFeed.tsx";
import { Input } from "./components/Input.tsx";
import { Button } from "./components/Button.tsx";

export const ListSearchPage = (
    { loggedInUser, lists, hasMore, search }: {
        loggedInUser: User;
        lists: List[];
        hasMore: boolean;
        search?: string;
    },
) => {
    return (
        <BaseLayout loggedInUser={loggedInUser}>
            <div class="grid grid-cols-1 gap-4 w-full max-w-[1200px] mx-auto [&>*]:self-start px-4">
                <div>
                    <form
                        class="grid grid-cols-1 sm:grid-cols-[3fr_1fr] gap-4 p-4 bg-stone-100 border border-stone-300 rounded"
                        hx-get="/lists/search"
                        hx-swap="outerHTML"
                        hx-target="#lists"
                    >
                        <Input
                            type="text"
                            name="search"
                            placeholder="Search lists"
                            value={search}
                        />
                        <Button type="submit">Search</Button>
                    </form>
                    <ListFeed
                        lists={lists}
                        hasMore={hasMore}
                        page={1}
                        search={search}
                    />
                </div>
            </div>
        </BaseLayout>
    );
};
