import { Badge } from "./Badge.tsx";
import { CopyIcon, RSSIcon } from "./Icons.tsx";

export const FeedBadge = ({ feedUrl }: { feedUrl: string }) => (
  <div className="relative" x-data="{ copied: false }">
    <a href={feedUrl} target="_blank">
      <Badge
        icon={<RSSIcon />}
        size="sm"
        action={
          <button
            type="button"
            x-on:click={`$event.preventDefault(); $event.stopPropagation(); navigator.clipboard.writeText('${feedUrl}'); copied = true; setTimeout(() => copied = false, 1500)`}
          >
            <div class="size-3">
              <CopyIcon />
            </div>
          </button>
        }
      >
        Feed
      </Badge>
    </a>
    <div
      x-show="copied"
      x-transition:enter="transition ease-out duration-300"
      x-transition:enter-start="opacity-0 translate-y-2"
      x-transition:enter-end="opacity-100 translate-y-0"
      x-transition:leave="transition ease-in duration-500"
      x-transition:leave-start="opacity-100 translate-y-0"
      x-transition:leave-end="opacity-0 -translate-y-4"
      className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white border border-gray-200 text-gray-700 text-sm px-3 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none z-10"
      x-cloak
    >
      Copied!
    </div>
  </div>
);
