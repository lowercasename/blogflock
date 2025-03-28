import { Badge } from "./Badge.tsx";
import { ButtonLink } from "./Button.tsx";

interface TierLink {
  href: string;
  label: string;
}

export default function PricingGrid(
  { freeTierLink, supporterTierLink }: {
    freeTierLink?: TierLink;
    supporterTierLink?: TierLink;
  },
) {
  return (
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="shadow-sharp rounded-lg bg-white overflow-hidden w-full flex flex-col">
        <h3 class="text-xl text-center font-semibold text-orange-900 px-3 pt-3 pb-3 mb-3 border-b border-gray-200">
          BlogFlock <Badge size="lg" color="orange">Free</Badge>
        </h3>
        <div class="px-3 pb-3 flex flex-col h-full">
          <ul class="space-y-2 divide-y divide-gray-200 text-center text-balance mb-5">
            <li>
              Create up to{" "}
              <strong class="font-semibold text-orange-700">5 lists</strong>,
              with unlimited blogs in each
            </li>
            <li>
              Follow lists created by others
            </li>
            <li>
              View short blog post previews
            </li>
          </ul>
          {freeTierLink && (
            <div class="mt-auto">
              <ButtonLink href={freeTierLink.href}>
                {freeTierLink.label}
              </ButtonLink>
            </div>
          )}
        </div>
      </div>
      <div class="shadow-sharp rounded-lg bg-white overflow-hidden w-full flex flex-col">
        <h3 class="text-xl text-center font-semibold text-orange-900 px-3 pt-3 pb-3 mb-3 border-b border-gray-200">
          BlogFlock Supporter <Badge size="lg" color="orange">$20/year</Badge>
        </h3>
        <div class="px-3 pb-3 flex flex-col h-full">
          <ul class="space-y-2 divide-y divide-gray-200 text-center text-balance mb-5">
            <li>
              Create{" "}
              <strong class="font-semibold text-orange-700">unlimited</strong>
              {" "}
              lists
            </li>
            <li>
              View{" "}
              <strong class="font-semibold text-orange-700">
                full blog posts
              </strong>{" "}
              directly in BlogFlock
            </li>
            <li>
              <strong class="font-semibold text-orange-700">
                Bookmark posts
              </strong>{" "}
              into your personal bookmarks list
            </li>
            <li>
              Support ongoing BlogFlock development!
            </li>
          </ul>
          {supporterTierLink && (
            <div class="mt-auto">
              <ButtonLink href={supporterTierLink.href}>
                {supporterTierLink.label}
              </ButtonLink>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
