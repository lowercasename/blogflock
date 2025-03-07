import { List } from "../../models/List.ts";
import { ScrollIcon, UserIcon } from "./Icons.tsx";

export const ListNameAndAuthorBadge = ({ list }: { list: List }) => {
  return (
    <div class="inline-flex items-center rounded-full border border-orange-200 text-sm overflow-hidden">
      <a
        class="px-2 border-r border-orange-200 hover:bg-orange-50 text-gray-600"
        href={`/list/${list.hash_id}`}
      >
        <div class="inline-flex size-4 mr-1 relative top-0.5">
          <ScrollIcon />
        </div>
        {list.name}
      </a>
      <a
        class="px-2 hover:bg-orange-50 text-gray-600"
        href={`/user/${list.user.username}`}
      >
        <div class="inline-flex size-4 mr-1 relative top-0.5">
          <UserIcon />
        </div>
        {list.user.username}
      </a>
    </div>
  );
};
