import { List } from "../../models/List.ts";
import { SortValue } from "../ListSearchPage.tsx";
import { Button } from "./Button.tsx";
import { Card } from "./Card.tsx";
import { Empty } from "./Empty.tsx";
import { ListItem } from "./ListItem.tsx";

export const ListFeed = (
  { lists, hasMore, page, search, sort, className }: {
    lists: List[];
    hasMore: boolean;
    page: number;
    search?: string;
    className?: string;
    sort?: SortValue;
  },
) => {
  return (
    <div
      id="lists"
      class={`w-full mx-auto flex flex-col gap-4 ${className || ""}`}
    >
      {lists.length
        ? lists.map((list) => (
          <Card>
            <ListItem list={list} />
          </Card>
        ))
        : <Empty />}
      <div id="lists-slot">
        {hasMore && (
          <Button
            id="load-more"
            hx-get={`/lists/search?page=${page + 1}${
              search ? `&search=${search}` : ""
            }${sort ? `&sort=${sort}` : ""}`}
            hx-swap="outerHTML"
            hx-target="#lists-slot"
          >
            Load More
          </Button>
        )}
      </div>
    </div>
  );
};
