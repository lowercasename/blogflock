import { Context } from "hono";
import { Hono } from "hono";
import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { jwtAuthMiddleware } from "../lib/auth.ts";
import { validateRequest } from "../lib/validateRequest.ts";
import { emailIsAvailable, getUserByUsername, updateEmail, updateUser } from "../models/User.ts";
import { BioForm, EmailForm, PasswordForm, UsernameForm } from "../views/SettingsPage.tsx";
import { compare, hash } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { deleteCookie } from "hono/cookie";
import { newPasswordSchema, newUsernameSchema } from "./auth.ts";
import { emailSchema } from "./auth.ts";
import { generateOTP } from "../lib/crypto.ts";
import { sendEmail } from "../lib/email.ts";

const app = new Hono();

const updateBioSchema = z.object({
    bio: z.string().max(250, { message: "Bio must be 250 characters or less." }),
});

const updateUsernameSchema = z.object({
    username: newUsernameSchema,
});

const updatePasswordSchema = z.object({
    currentPassword: z.string(),
    newPassword: newPasswordSchema,
});

const updateEmailSchema = z.object({
    email: emailSchema,
});

app.patch(
    "/bio",
    jwtAuthMiddleware,
    validateRequest(updateBioSchema, { parseBody: true }),
    (c: Context) => {
        const formData = c.get("formData");
        const loggedInUser = c.get("user");
        const validationErrors = c.get("flash");
        if (validationErrors) {
            return c.html(
                BioForm({ loggedInUser, messages: validationErrors }),
            );
        }

        // Update the user's bio
        const updatedUser = updateUser(loggedInUser.id, {
            ...loggedInUser,
            bio: formData.bio,
        });
        if (!updatedUser) {
            return c.html(
                BioForm({
                    loggedInUser,
                    messages: [{
                        type: "error",
                        message:
                            "An unexpected error occurred. Please try again.",
                    }],
                }),
            );
        }
        return c.html(
            BioForm({
                loggedInUser: updatedUser,
                messages: [{
                    type: "success",
                    message: "Bio updated successfully.",
                }],
            }),
        );
    },
)

app.patch(
    "/username",
    jwtAuthMiddleware,
    validateRequest(updateUsernameSchema, { parseBody: true }),
    (c: Context) => {
        const formData = c.get("formData");
        const loggedInUser = c.get("user");
        const validationErrors = c.get("flash");
        if (validationErrors) {
            return c.html(
                UsernameForm({ loggedInUser, messages: validationErrors }),
            );
        }

        // Is the new username already taken?
        const existingUser = getUserByUsername(formData.username);
        if (existingUser) {
            return c.html(
                UsernameForm({
                    loggedInUser,
                    messages: [{
                        type: "error",
                        message:
                            `The username ${formData.username} is already taken.`,
                    }],
                }),
            );
        }

        // Update the user's username
        const updatedUser = updateUser(loggedInUser.id, {
            ...loggedInUser,
            username: formData.username,
        });
        if (!updatedUser) {
            return c.html(
                UsernameForm({
                    loggedInUser,
                    messages: [{
                        type: "error",
                        message:
                            "An unexpected error occurred. Please try again.",
                    }],
                }),
            );
        }
        return c.html(
            UsernameForm({
                loggedInUser: updatedUser,
                messages: [{
                    type: "success",
                    message: "Username updated successfully.",
                }],
            }),
        );
    },
);

app.patch(
    "/password",
    jwtAuthMiddleware,
    validateRequest(updatePasswordSchema, { parseBody: true }),
    async (c: Context) => {
        const formData = c.get("formData");
        const loggedInUser = c.get("user");
        const validationErrors = c.get("flash");
        if (validationErrors) {
            return c.html(PasswordForm({ messages: validationErrors }));
        }

        // Verify the current password
        if (
            !await compare(formData.currentPassword, loggedInUser.passwordHash)
        ) {
            return c.html(
                PasswordForm({
                    messages: [{
                        type: "error",
                        // Don't reveal if the password is incorrect
                        message: "An unexpected error occurred. Please try again.",
                    }],
                }),
            );
        }

        // Update the user's password
        const updatedUser = updateUser(loggedInUser.id, {
            ...loggedInUser,
            passwordHash: await hash(formData.newPassword),
        });
        if (!updatedUser) {
            return c.html(
                PasswordForm({
                    messages: [{
                        type: "error",
                        message:
                            "An unexpected error occurred. Please try again.",
                    }],
                }),
            );
        }
        deleteCookie(c, "auth");
    c.header("HX-Redirect", "/login");
    return c.text("", 200);
    },
);

app.patch("/email", jwtAuthMiddleware, validateRequest(updateEmailSchema, { parseBody: true }), async (c: Context) => {
    const formData = c.get("formData");
    const loggedInUser = c.get("user");
    const validationErrors = c.get("flash");
    if (validationErrors) {
        return c.html(EmailForm({ loggedInUser, messages: validationErrors }));
    }

    // Is this email already taken?
    const isEmailAvailable = emailIsAvailable(formData.email);
    if (!isEmailAvailable) {
        return c.html(
            EmailForm({
                loggedInUser,
                messages: [{
                    type: "error",
                    message: `The email ${formData.email} is already taken.`,
                }],
            }),
        );
    }

    // Update the user's email
    const emailVerificationToken = generateOTP();
    const updatedUser = updateEmail(loggedInUser.id, formData.email, emailVerificationToken);
    await sendEmail({
        to: formData.email,
        subject: "Verify your email",
        text:
            `You've asked to update your email on BlogFlock. Enter this token at https://blogflock.com/verify-email to verify your email: ${emailVerificationToken}`,
    });
    if (!updatedUser) {
        return c.html(
            EmailForm({
                loggedInUser,
                messages: [{
                    type: "error",
                    message: "An unexpected error occurred. Please try again.",
                }],
            }),
        );
    }
    deleteCookie(c, "auth");
    c.header("HX-Redirect", "/verify-email");
    return c.text("", 200);
});


export default app;
