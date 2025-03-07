import { PropsWithChildren } from "hono/jsx";

export function Input({ ...props }: { [key: string]: unknown }) {
  return (
    <input
      class="border border-gray-300 rounded-lg p-2 w-full text-sm"
      {...props}
    />
  );
}

export function Textarea(
  { children, ...props }: PropsWithChildren<{ [key: string]: unknown }>,
) {
  return (
    <textarea
      class="border border-gray-300 rounded-lg p-2 w-full text-sm"
      {...props}
    >
      {children}
    </textarea>
  );
}

export function MaxLengthInput(
  { maxLength, ...props }: { maxLength: number; [key: string]: unknown },
) {
  const xData = JSON.stringify({ value: props.value || "", maxLength });
  return (
    <div
      class="border border-gray-300 rounded-lg p-2 w-full text-sm bg-white focus-within:outline focus-within:outline-blue-600"
      x-data={xData}
    >
      <input
        class="w-full mb-1 outline-none"
        maxLength={maxLength}
        x-model="value"
        {...props}
      />
      <span
        class="text-xs text-gray-400"
        x-text="`${maxLength - (value || '').length} characters remaining`"
      />
    </div>
  );
}

export function MaxLengthTextarea(
  { maxLength, markdown, children, ...props }: PropsWithChildren<
    { maxLength: number; markdown?: boolean; [key: string]: unknown }
  >,
) {
  const xData = JSON.stringify({ value: children || "", maxLength });
  return (
    <div
      class="border border-gray-300 rounded-lg p-2 w-full text-sm bg-white focus-within:outline focus-within:outline-blue-600"
      x-data={xData}
    >
      <textarea
        class="w-full mb-1 outline-none"
        maxLength={maxLength}
        x-model="value"
        {...props}
      >
        {children}
      </textarea>
      <span
        class="text-xs text-gray-400"
        x-text="`${maxLength - (value || '').length} characters remaining`"
      />
      {markdown && (
        <span class="text-xs text-gray-400">
          , Markdown supported.
        </span>
      )}
    </div>
  );
}
