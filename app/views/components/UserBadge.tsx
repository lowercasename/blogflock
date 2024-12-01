import { PublicUserFields, User } from "../../models/User.ts";
import { UserIcon } from "./Icons.tsx";

const sizeToIconSize = {
    sm: 3,
    md: 5,
    lg: 6,
};

const sizeToClasses = {
    sm: "text-sm gap-0.5 px-2",
    md: "text-md gap-2 px-3",
    lg: "text-lg gap-3 px-4",
};

export const UserBadge = (
    { user, size = "sm" }: {
        user: PublicUserFields | User;
        size?: "sm" | "md" | "lg";
    },
) => (
    <a
        href={`/users/${user.username}`}
        class={`inline-flex items-center rounded-full bg-orange-200 hover:bg-orange-100 ${
            sizeToClasses[size]
        }`}
    >
        <div class={`size-${sizeToIconSize[size]}`}>
            <UserIcon />
        </div>
        <span>{user.username}</span>
    </a>
);
