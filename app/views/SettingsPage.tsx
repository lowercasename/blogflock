import { Flash } from "../lib/flash.ts";
import { User } from "../models/User.ts";
import { BIO_MAX_LENGTH } from "../routes/users.ts";
import { Button } from "./components/Button.tsx";
import { Card } from "./components/Card.tsx";
import { FlashMessage } from "./components/FlashMessage.tsx";
import { Input, MaxLengthTextarea, Textarea } from "./components/Input.tsx";
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

export const SettingsPage = ({ loggedInUser }: { loggedInUser: User }) => {
  return (
    <BaseLayout loggedInUser={loggedInUser}>
      <div class="flex flex-col gap-4 w-full max-w-[1200px] mx-auto px-4">
        <Card title="Settings">
          <BioForm loggedInUser={loggedInUser} />
          <UsernameForm loggedInUser={loggedInUser} />
          <PasswordForm />
          <EmailForm loggedInUser={loggedInUser} />
        </Card>
      </div>
    </BaseLayout>
  );
};
