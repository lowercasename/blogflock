import { User } from "../models/User.ts";
import { ButtonLink } from "./components/Button.tsx";
import { Card } from "./components/Card.tsx";
import PricingGrid from "./components/PricingGrid.tsx";
import { BaseLayout } from "./layouts/BaseLayout.tsx";
import { type Stripe } from "npm:stripe";

export const BillingPage = (
  { loggedInUser, session }: {
    loggedInUser: User;
    session: Stripe.Checkout.Session | null;
  },
) => {
  return (
    <BaseLayout loggedInUser={loggedInUser}>
      <div class="flex flex-col gap-4 w-full max-w-[1200px] mx-auto px-4">
        <Card title="Billing">
          {!loggedInUser.blogflock_supporter_subscription_active && (
            <div class="space-y-2">
              <p>
                You do not currently have a BlogFlock Supporter subscription.
              </p>
              <p>
                BlogFlock will always be open source, ad-free, and
                anti-corporate; we love the IndieWeb.
              </p>
              <p>
                If you choose to support the project, you get my sincere
                gratitude, some neat extra features, and the knowledge that
                you're actively helping BlogFlock to grow.
              </p>
            </div>
          )}
          {loggedInUser.blogflock_supporter_subscription_active && (
            <>
              <div class="text-green-500 font-semibold mb-4">
                Thank you for being a BlogFlock Supporter! You're wonderful.
              </div>
              <ButtonLink href="/billing/portal">
                Manage your subscription
              </ButtonLink>
            </>
          )}
        </Card>
        {(!loggedInUser.blogflock_supporter_subscription_active && session) && (
          <>
            <PricingGrid />
            <ButtonLink
              href={session.url || ""}
            >
              Become a BlogFlock Supporter
            </ButtonLink>
          </>
        )}
      </div>
    </BaseLayout>
  );
};
