import { PublicUserFields } from "../../models/User.ts";
import { UserIcon } from "./Icons.tsx";

const sizeToIconSize = {
  sm: "size-3",
  md: "size-5",
  lg: "size-6",
};

const sizeToClasses = {
  sm: "text-sm gap-0.5 px-2",
  md: "text-md gap-2 px-3",
  lg: "text-lg gap-3 px-4",
};

export const UserBadge = (
  { user, size = "sm" }: {
    user: Pick<PublicUserFields, "username">;
    size?: "sm" | "md" | "lg";
  },
) => (
  <a
    href={`/user/${user.username}`}
    class={`inline-flex items-center rounded-full bg-orange-200 hover:bg-orange-100 ${
      sizeToClasses[size]
    }`}
  >
    <div class={`${sizeToIconSize[size]}`}>
      <UserIcon />
    </div>
    <span>{user.username}</span>
  </a>
);
