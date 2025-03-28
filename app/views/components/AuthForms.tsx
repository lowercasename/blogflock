import { Button } from "./Button.tsx";
import { Input } from "./Input.tsx";
import { Link } from "./Link.tsx";

export function LoginForm() {
  return (
    <>
      <form
        hx-post="/auth/login"
        class="space-y-2"
        hx-swap="outerHTML"
        hx-target="body"
      >
        <Input type="email" name="email" placeholder="Email" required />
        <Input
          type="password"
          name="password"
          placeholder="Password"
          required
        />
        <Button type="submit">Login</Button>
      </form>
      <div class="flex flex-col gap-2">
        <Link href="/register">Register</Link>
        <Link href="/forgot-password">Forgot Password</Link>
      </div>
    </>
  );
}

export function RegisterForm() {
  return (
    <>
      <form
        hx-post="/auth/register"
        class="space-y-2"
        hx-swap="outerHTML"
        hx-target="body"
      >
        <Input
          type="text"
          name="username"
          placeholder="Username"
          required
        />
        <div class="text-sm text-gray-500 pb-2">
          Letters, numbers, underscores (_) and dashes (-) only. At least 3
          characters long.
        </div>
        <Input type="email" name="email" placeholder="Email" required />
        <Input
          type="password"
          name="password"
          placeholder="Password"
          required
        />
        <div class="text-sm text-gray-500 pb-2">
          At least 8 characters long.
        </div>
        <Button type="submit">Register</Button>
      </form>
      <div class="flex flex-col gap-2">
        <Link href="/login">Login</Link>
      </div>
    </>
  );
}

export const VerifyEmailForm = () => {
  return (
    <>
      <form
        hx-post="/auth/verify-email"
        class="space-y-2"
        hx-swap="outerHTML"
        hx-target="body"
      >
        <Input type="text" name="token" placeholder="Token" required />
        <Button type="submit">Verify Email</Button>
      </form>
      <div class="flex flex-col gap-2">
        <Link href="/resend-verification-email">
          Resend Verification Email
        </Link>
      </div>
    </>
  );
};

export function ResendVerificationEmailForm() {
  return (
    <>
      <form
        hx-post="/auth/resend-verification-email"
        class="space-y-2"
        hx-swap="outerHTML"
        hx-target="body"
      >
        <Input type="email" name="email" placeholder="Email" required />
        <Button type="submit">Resend Verification Email</Button>
      </form>
    </>
  );
}

export function ForgotPasswordForm() {
  return (
    <>
      <form
        hx-post="/auth/forgot-password"
        class="space-y-2"
        hx-swap="outerHTML"
        hx-target="body"
      >
        <Input type="email" name="email" placeholder="Email" required />
        <Button type="submit">Reset Password</Button>
      </form>
      <div class="flex flex-col gap-2">
        <Link href="/login">Login</Link>
      </div>
    </>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <form
      hx-post="/auth/reset-password"
      class="space-y-2"
      hx-swap="outerHTML"
      hx-target="body"
    >
      <Input type="hidden" name="token" value={token} />
      <Input
        type="password"
        name="password"
        placeholder="New password"
        required
      />
      <Button type="submit">Reset Password</Button>
    </form>
  );
}
