import { User } from "../models/User.ts";
import { BaseLayout } from "./layouts/BaseLayout.tsx";
import { List } from "../models/List.ts";
import { ListFeed } from "./components/ListFeed.tsx";
import { Input, Select } from "./components/Input.tsx";
import { Button } from "./components/Button.tsx";
import { SortIcon } from "./components/Icons.tsx";

export type SortValue = "last_updated" | "most_followed" | "most_blogs" | "last_created";

export const ListSearchPage = (
  { loggedInUser, lists, hasMore, search, sort = "last_updated" }: {
    loggedInUser: User;
    lists: List[];
    hasMore: boolean;
    search?: string;
    sort?: string;
  },
) => {
  return (
    <BaseLayout loggedInUser={loggedInUser}>
      <div class="grid grid-cols-1 gap-4 w-full max-w-[1200px] mx-auto [&>*]:self-start px-4">
        <div>
          <form
            hx-get="/lists/search"
            hx-swap="outerHTML"
            hx-target="#lists"
            class="p-4 bg-stone-100 border border-stone-300 rounded flex flex-col gap-4"
          >
            <div class="grid grid-cols-1 sm:grid-cols-[3fr_1fr] gap-4">
              <Input
                type="text"
                name="search"
                placeholder="Search lists"
                value={search}
              />
              <Button type="submit">Search</Button>
            </div>
            <div class="flex gap-2 items-center">
              <Select
                name="sort"
                icon={<SortIcon />}
                value={sort}
                options={[
                  { value: "last_updated", text: "Most recent posts" },
                  { value: "most_followed", text: "Most followed" },
                  { value: "most_blogs", text: "Most blogs" },
                  { value: "last_created", text: "Most recently created lists" }
                ] satisfies { value: SortValue; text: string }[]}
                hx-get="/lists/search"
                hx-swap="outerHTML"
                hx-target="#lists"
                hx-trigger="change"
                hx-include="[name=search]"
              />
            </div>
          </form>
          <ListFeed
            lists={lists}
            hasMore={hasMore}
            page={1}
            search={search}
            sort={sort as SortValue}
          />
        </div>
      </div>
    </BaseLayout>
  );
};
