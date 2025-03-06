import { Flash } from "../../lib/flash.ts";

export const FlashMessage = ({ messages }: { messages?: Flash[] }) => (
  <div>
    {messages?.map((message, i) => (
      <div
        key={i}
        class={`p-2 ${
          message.type === "error"
            ? "bg-red-200 text-red-700"
            : "bg-green-200 text-green-700"
        } rounded text-sm text-center my-2`}
      >
        {message.message}
      </div>
    ))}
  </div>
);
