import { User } from "../../models/User.ts";

export default function SubscribeCallout(
  { loggedInUser }: { loggedInUser: User },
) {
  if (loggedInUser.blogflock_supporter_subscription_active) {
    return null;
  }
  return (
    <a
      class="w-full bg-purple-200 text-purple-700 rounded shadow-sharp font-semibold hover:bg-purple-300 p-4 text-center"
      href=""
    >
      ⭐ Subscribe to <strong class="font-semibold">BlogFlock Supporter</strong>
      {" "}
      to create more lists, unlock cool features, and support the development of
      BlogFlock. ⭐
    </a>
  );
}
