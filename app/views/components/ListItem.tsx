import { pluralize } from "../../lib/text.ts";
import { List } from "../../models/List.ts";
import { ScrollIcon } from "./Icons.tsx";
import { Link } from "./Link.tsx";
import { UserBadge } from "./UserBadge.tsx";

export const ListItem = ({ list }: { list: List }) => (
  <div className="flex flex-col gap-1">
    <div class="flex flex-col gap-1">
      <div>
        <div class="inline-flex size-4 mr-1 relative top-0.5">
          <ScrollIcon />
        </div>
        <Link href={`/list/${list.hash_id}`}>{list.name}</Link>
        {" "}
      </div>
      <div>
        <UserBadge user={list.user} />
      </div>
      <div class="text-sm font-semibold text-gray-800">
        {list.list_blogs?.length}{" "}
        {pluralize(list.list_blogs?.length || 0, "blog")} &middot;{" "}
        {list.list_followers?.length}{" "}
        {pluralize(list.list_followers?.length || 0, "follower")}
      </div>
    </div>
    {list.description && <p class="text-sm text-gray-600">{list.description}
    </p>}
  </div>
);
