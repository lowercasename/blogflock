import { Context, Hono } from "hono";
import { z } from "https://deno.land/x/zod/mod.ts";
import {
    createUser,
    emailIsAvailable,
    resetEmailVerificationToken,
    resetPassword,
    setForgotPasswordToken,
    usernameIsAvailable,
    verifyEmailToken,
    verifyPassword,
} from "../models/User.ts";
import { sign } from "hono/jwt";
import { deleteCookie, setSignedCookie } from "hono/cookie";
import { generateOTP } from "../lib/crypto.ts";
import { sendEmail } from "../lib/email.ts";
import { validateRequest } from "../lib/validateRequest.ts";
import { AuthFormLayout } from "../views/layouts/AuthFormPage.tsx";
import {
    ForgotPasswordForm,
    LoginForm,
    RegisterForm,
    ResetPasswordForm,
    VerifyEmailForm,
} from "../views/components/AuthForms.tsx";

const app = new Hono();

export const emailSchema = z.string().toLowerCase().trim().email({
    message: "Invalid email address",
});
export const passwordSchema = z.string();
export const newPasswordSchema = z.string().min(8, {
    message: "Password must be at least 8 characters long",
}).max(120, { message: "Password must be at most 120 characters long" });
export const newUsernameSchema = z.string().trim().min(3, {
    message: "Username must be at least 3 characters long",
}).max(50, { message: "Username must be at most 50 characters long" })
    .regex(/^[a-zA-Z0-9_-]*$/, {
        message:
            "Username must only contain letters, numbers, underscores and dashes",
    });
const tokenSchema = z.string();

const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
});

const verifyEmailSchema = z.object({
    token: tokenSchema,
});

const forgotPasswordSchema = z.object({
    email: emailSchema,
});

const createUserSchema = z.object({
    username: newUsernameSchema,
    email: emailSchema,
    password: newPasswordSchema,
});

const resetPasswordSchema = z.object({
    password: newPasswordSchema,
    token: tokenSchema,
});

const resendVerificationEmailSchema = z.object({
    email: emailSchema,
});

app.post(
    "/register",
    validateRequest(createUserSchema, {
        parseBody: true,
    }),
    async (c: Context) => {
        const data = c.get("formData");

        try {
            const emailValid = emailIsAvailable(data.email);
            if (!emailValid) {
                return c.html(
                    AuthFormLayout({
                        title: "Register",
                        children: RegisterForm(),
                        messages: [{
                            message:
                                "This email address is already taken. Try logging in.",
                            type: "error",
                        }],
                    }),
                );
            }

            const usernameValid = usernameIsAvailable(data.username);
            if (!usernameValid) {
                return c.html(
                    AuthFormLayout({
                        title: "Register",
                        children: RegisterForm(),
                        messages: [{
                            message:
                                "This username is already taken. Try another one.",
                            type: "error",
                        }],
                    }),
                );
            }

            const emailVerificationToken = generateOTP();
            await createUser({
                username: data.username,
                email: data.email,
                passwordHash: data.password,
                emailVerificationToken,
            });

            await sendEmail({
                to: data.email,
                subject: "Verify your email",
                text:
                    `Hi! Welcome to Blogflock. We're delighted to see you. Enter this token at https://blogflock.com/verify-email to verify your email: ${emailVerificationToken}`,
            });

            c.header("HX-Push-Url", "/verify-email");
            return c.html(AuthFormLayout({
                title: "Verify Email",
                children: VerifyEmailForm(),
                messages: [{
                    message:
                        "We've sent you an email with a token to verify your email address. Check your inbox!",
                    type: "success",
                }],
            }));
        } catch (e: unknown) {
            console.error(e);
            return c.html(
                AuthFormLayout({
                    title: "Register",
                    children: RegisterForm(),
                    messages: [{
                        message:
                            "An unexpected error occurred. Please try again later.",
                        type: "error",
                    }],
                }),
            );
        }
    },
);

app.post(
    "/login",
    validateRequest(loginSchema, { parseBody: true }),
    async (c: Context) => {
        const data = c.get("formData");
        const validationErrors = c.get("flash");

        if (validationErrors) {
            return c.html(
                AuthFormLayout({
                    title: "Login",
                    children: LoginForm(),
                    messages: validationErrors,
                }),
            );
        }

        const user = await verifyPassword({
            email: data.email,
            password: data.password,
        });

        if (!user) {
            return c.html(
                AuthFormLayout({
                    title: "Login",
                    children: LoginForm(),
                    messages: [{
                        message:
                            "We couldn't log you in. If you have an account with this email address, try resetting your password.",
                        type: "error",
                    }],
                }),
            );
        }

        const tokenExpiry = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90;
        const cookieMaxAge = 60 * 60 * 24 * 90;
        const token = await sign({
            id: user.id,
            email: user.email,
            exp: tokenExpiry,
            iat: Math.floor(Date.now() / 1000),
        }, Deno.env.get("JWT_SECRET")!);

        await setSignedCookie(
            c,
            "auth",
            token,
            Deno.env.get("SIGNED_COOKIE_SECRET")!,
            {
                path: "/",
                secure: true,
                domain: Deno.env.get("DENO_ENV") === "development"
                    ? "localhost"
                    : Deno.env.get("APP_DOMAIN"),
                httpOnly: true,
                maxAge: cookieMaxAge,
                expires: new Date(Date.now() + cookieMaxAge),
                sameSite: "Strict",
            },
        );

        c.header("HX-Redirect", "/");
        return c.text("", 200);
    },
);

app.post(
    "/verify-email",
    validateRequest(verifyEmailSchema, {
        parseBody: true,
    }),
    (c: Context) => {
        const data = c.get("formData");

        const user = verifyEmailToken(data.token);
        if (!user) {
            return c.html(AuthFormLayout({
                title: "Verify Email",
                children: VerifyEmailForm(),
                messages: [{
                    message:
                        "Invalid token. You can request a new one using the link below.",
                    type: "error",
                }],
            }));
        }

        c.header("HX-Push-Url", "/login");
        return c.html(AuthFormLayout({
            title: "Login",
            children: LoginForm(),
            messages: [{
                message: "Email verified successfully. You can now log in.",
                type: "success",
            }],
        }));
    },
);

app.post(
    "/resend-verification-email",
    validateRequest(resendVerificationEmailSchema, {
        parseBody: true,
    }),
    async (c: Context) => {
        const data = c.get("formData");

        const emailVerificationToken = generateOTP();
        const user = resetEmailVerificationToken(
            data.email,
            emailVerificationToken,
        );
        if (!user) {
            // Don't reveal if email doesn't exist
            return c.html(AuthFormLayout({
                title: "Verify Email",
                children: VerifyEmailForm(),
                messages: [{
                    message:
                        "We've sent you an email with a token to verify your email address. Check your inbox!",
                    type: "success",
                }],
            }));
        }

        await sendEmail({
            to: data.email,
            subject: "Verify your email",
            text:
                `Hi! Welcome to Blogflock. We're delighted to see you. Enter this token at https://blogflock.com/verify-email to verify your email: ${emailVerificationToken}`,
        });

        c.header("HX-Push-Url", "/verify-email");
        return c.html(AuthFormLayout({
            title: "Verify Email",
            children: VerifyEmailForm(),
            messages: [{
                message:
                    "We've sent you an email with a token to verify your email address. Check your inbox!",
                type: "success",
            }],
        }));
    },
);

app.post(
    "/forgot-password",
    validateRequest(forgotPasswordSchema, {
        parseBody: true,
    }),
    async (c: Context) => {
        const data = c.get("formData");

        const token = crypto.randomUUID();
        const user = setForgotPasswordToken(data.email, token);

        if (!user) {
            // Don't reveal if email doesn't exist
            return c.html(AuthFormLayout({
                title: "Forgot Password",
                children: ForgotPasswordForm(),
                messages: [{
                    message:
                        "If you have an account with this email address, we've sent you an email with instructions to reset your password.",
                    type: "success",
                }],
            }));
        }

        await sendEmail({
            to: user.email,
            subject: "Reset your password",
            text:
                `Hi! You've asked to reset your password. Click on this link to reset your password: https://blogflock.com/reset-password?token=${token}`,
        });

        c.header("HX-Push-Url", "/forgot-password");
        return c.html(AuthFormLayout({
            title: "Forgot Password",
            children: ForgotPasswordForm(),
            messages: [{
                message:
                    "If you have an account with this email address, we've sent you an email with instructions to reset your password.",
                type: "success",
            }],
        }));
    },
);

app.post(
    "/reset-password",
    validateRequest(resetPasswordSchema, {
        parseBody: true,
    }),
    (c: Context) => {
        const data = c.get("formData");

        const user = resetPassword(data.token, data.password);
        if (!user) {
            return c.html(AuthFormLayout({
                title: "Reset Password",
                children: ResetPasswordForm({ token: data.token }),
                messages: [{
                    message:
                        "That token is invalid or has expired. Try resetting your password again.",
                    type: "error",
                }],
            }));
        }

        c.header("HX-Push-Url", "/login");
        return c.html(AuthFormLayout({
            title: "Login",
            children: LoginForm(),
            messages: [{
                message: "Password reset successfully. You can now log in.",
                type: "success",
            }],
        }));
    },
);

app.get("/logout", (c: Context) => {
    deleteCookie(c, "auth");
    return c.redirect("/");
});

export default app;
