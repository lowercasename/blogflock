interface Props {
  items: unknown[];
  showInitial?: number;
}

export function Stack({ items, showInitial }: Props) {
  const initialItems = items.slice(0, showInitial) || [];
  const remainingItems = items.slice(showInitial) || [];
  const showMore = initialItems.length < items.length;

  return (
    <ul
      class="flex flex-col divide-y divide-gray-200 border border-gray-200 rounded"
      x-data="{ showMore: false }"
    >
      {items.length
        ? initialItems.map((item, index) => (
          <li class="py-2 px-4" key={index}>
            {item}
          </li>
        ))
        : (
          <li class="py-2 px-4 text-gray-500 text-center bg-gray-100 text-sm">
            Nothing here.
          </li>
        )}
      {showMore && (
        <li
          class="py-4 px-4 text-gray-500 text-center bg-gray-100 shadow-inner"
          x-show="!showMore"
        >
          {remainingItems.length} more &middot;{" "}
          <button
            type="button"
            class="font-semibold text-orange-500 hover:text-orange-300 inline"
            x-on:click="showMore = !showMore"
          >
            show all
          </button>
        </li>
      )}
      {showMore &&
        remainingItems.map((item, index) => (
          <li class="py-2 px-4" key={index} x-show="showMore">
            {item}
          </li>
        ))}
    </ul>
  );
}
