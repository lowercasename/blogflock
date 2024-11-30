import { PublicUserFields, User } from "../../models/User.ts";
import { Link } from "./Link.tsx";

export const UserLink = ({ user }: { user: User | PublicUserFields }) => (
    <>
        <Link href={`/user/${user.username}`}>{user.username}</Link>
    </>
);
