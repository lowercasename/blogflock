import { Flash } from "../lib/flash.ts";
import {  User } from "../models/User.ts";
import { BIO_MAX_LENGTH } from "../routes/users.ts";
import { Button } from "./components/Button.tsx";
import { Card } from "./components/Card.tsx";
import { FlashMessage } from "./components/FlashMessage.tsx";
import { Input, MaxLengthTextarea } from "./components/Input.tsx";
import { BaseLayout } from "./layouts/BaseLayout.tsx";

export const BioForm = (
  { loggedInUser, messages }: { loggedInUser: User; messages?: Flash[] },
) => {
  return (
    <form
      hx-patch="/users/bio"
      hx-swap="outerHTML"
      hx-target="this"
      class="space-y-2"
    >
      <label class="font-bold">
        Bio
      </label>
      <MaxLengthTextarea
        type="text"
        name="bio"
        maxLength={BIO_MAX_LENGTH}
        rows={5}
      >
        {loggedInUser.bio}
      </MaxLengthTextarea>
      <FlashMessage messages={messages} />
      <Button type="submit">Update bio</Button>
    </form>
  );
};

export const UsernameForm = (
  { loggedInUser, messages }: { loggedInUser: User; messages?: Flash[] },
) => {
  return (
    <form
      hx-patch="/users/username"
      hx-swap="outerHTML"
      hx-target="this"
      class="space-y-2"
    >
      <label class="font-bold">
        Username
      </label>
      <Input
        type="text"
        name="username"
        required
        value={loggedInUser.username}
      />
      <FlashMessage messages={messages} />
      <Button type="submit">Update username</Button>
    </form>
  );
};

export const PasswordForm = ({ messages }: { messages?: Flash[] }) => {
  return (
    <form
      hx-patch="/users/password"
      hx-swap="outerHTML"
      hx-target="this"
      class="space-y-2"
    >
      <label class="font-bold">
        Current password
      </label>
      <Input type="password" name="currentPassword" required />
      <label class="font-bold">
        New password
      </label>
      <Input type="password" name="newPassword" required />
      <p class="text-sm text-gray-500">
        You will be logged out after changing your password.
      </p>
      <FlashMessage messages={messages} />
      <Button type="submit">Update password</Button>
    </form>
  );
};

export const EmailForm = (
  { loggedInUser, messages }: { loggedInUser: User; messages?: Flash[] },
) => {
  return (
    <form
      hx-patch="/users/email"
      hx-swap="outerHTML"
      hx-target="this"
      class="space-y-2"
    >
      <label class="font-bold">
        Email
      </label>
      <Input
        type="email"
        name="email"
        required
        value={loggedInUser.email}
      />
      <p class="text-sm text-gray-500">
        You will need to verify your new email address.
      </p>
      <FlashMessage messages={messages} />
      <Button type="submit">Update email</Button>
    </form>
  );
};

export const PostingFrequencyForm = (
  { loggedInUser, messages }: { loggedInUser?: User; messages?: Flash[] },
) => {
  if (!loggedInUser) {
   // Otherwise Hono complains because it doesn't expect null
    // deno-lint-ignore jsx-no-useless-fragment
    return <></>;
  }

  const options = [
    { id: "quiet", name: "Quiet", description: "Blogs with 0-4 posts/month" },
    { id: "occasional", name: "Occasional", description: "Blogs with 0-8 posts/month" },
    { id: "frequent", name: "Frequent", description: "See all blogs" },
  ];

  const selectedOptions = options.filter((option) => {
    switch (loggedInUser.setting_posting_frequency) {
      case "frequent":
        return true;
      case "occasional":
        return option.id === "occasional" || option.id === "quiet";
      case "quiet":
        return option.id === "quiet";
      default:
        return false;
    }
  });

  const roundedAndBorderClasses = (index: number, selected: boolean) => {
    if (index === 0) {
      return "rounded-l-lg border-l border-r";
    }
    if (index === options.length - 1) {
      return selected ? "rounded-r-lg border-r" : "rounded-r-lg border-r";
    }
    return "border-r";
  };

  return (
    <form
      id="posting-frequency-form"
      hx-patch="/users/settings"
      hx-swap="outerHTML"
      hx-target="#posting-frequency-form"
      hx-trigger="change"
    >
      <div class="grid grid-cols-3 justify-center">
        {options.map((option, index) => (
          <label
            key={option.id}
            class={`cursor-pointer relative border-t border-b ${roundedAndBorderClasses(index, selectedOptions.includes(option))} p-2 text-center hover:bg-orange-50 ${
              selectedOptions.includes(option) ? "bg-orange-100 border-orange-600 text-black" : "bg-stone-50 border-stone-200 text-gray-500"
            }`}
            for={`setting_posting_frequency_${option.id}`}
          >
            <h3 class="font-medium mb-0.5">{option.name}</h3>
            <p class="text-xs">{option.description}</p>
            <input 
              id={`setting_posting_frequency_${option.id}`}
              type="radio" 
              name="setting_posting_frequency" 
              value={option.id} 
              checked={selectedOptions.includes(option)} 
              class="sr-only"
            />
          </label>
        ))}
      </div>
      
      <FlashMessage messages={messages} />
    </form>
  );
};

export const SettingsPage = ({ loggedInUser }: { loggedInUser: User }) => {
  return (
    <BaseLayout loggedInUser={loggedInUser}>
      <div class="flex flex-col gap-4 w-full max-w-[1200px] mx-auto px-4">
        <Card title="Settings">
          <BioForm loggedInUser={loggedInUser} />
          <UsernameForm loggedInUser={loggedInUser} />
          <PasswordForm />
          <EmailForm loggedInUser={loggedInUser} />
          <h3 class="font-bold">Posting frequency</h3>
          <p class="text-sm text-gray-500 mb-2">
            This controls which blogs you see in your home feed. Reduce the frequency to see posts from quieter blogs more often.
          </p>
          <PostingFrequencyForm loggedInUser={loggedInUser} />
        </Card>
      </div>
    </BaseLayout>
  );
};
