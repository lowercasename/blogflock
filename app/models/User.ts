import { RowObject } from "https://deno.land/x/sqlite@v3.8/mod.ts";
import { compare, hash } from "https://deno.land/x/bcrypt/mod.ts";
import { db } from "../lib/db.ts";
import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { encode } from "../lib/hashids.ts";
import { init, transform } from "https://deno.land/x/goldmark/mod.ts";

await init();

export const PublicUserFieldsSchema = z.object({
    id: z.number(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    hashId: z.string(),
});

export const PublicUserFieldsWithRenderedBioSchema = PublicUserFieldsSchema
    .transform(async (data) => ({
        ...data,
        renderedBio: data.bio
            ? (await transform(data.bio, { extensions: { autolinks: true } }))
                .content
            : "",
    }));

export type PublicUserFields = z.infer<typeof PublicUserFieldsSchema>;
export type PublicUserFieldsWithRenderedBio = z.infer<
    typeof PublicUserFieldsWithRenderedBioSchema
>;

export const UserSchema = z.object({
    id: z.number(),
    username: z.string(),
    email: z.string().email(),
    passwordHash: z.string(),
    createdAt: z.coerce.date(),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    passwordResetToken: z.string().nullable(),
    passwordResetTokenExpiresAt: z.coerce.date().nullable(),
    emailVerified: z.boolean(),
    emailVerificationToken: z.string().nullable(),
    emailVerificationTokenExpiresAt: z.coerce.date().nullable(),
});

export type UserObject = z.infer<typeof UserSchema>;

export interface User extends UserObject, RowObject {}

export type CreateUser = Pick<
    User,
    "username" | "email" | "passwordHash" | "emailVerificationToken"
>;

export type UpdateUser = Pick<
    User,
    "username" | "email" | "avatarUrl" | "bio" | "passwordHash"
>;

export type JWTUser = Pick<User, "id" | "email">;

export const verifyPassword = async (
    { email, password }: { email: string; password: string },
): Promise<User | null> => {
    const user = db.queryEntries<User>(`SELECT * FROM users WHERE email = ?`, [
        email,
    ])?.[0];
    if (!user) {
        return null;
    }

    // Is email verified?
    if (!user.emailVerified) {
        return null;
    }

    // Verify password
    if (await compare(password, user.passwordHash)) {
        return user;
    }

    return null;
};

// Check if the username is already taken. Returns true if the username is available.
export const usernameIsAvailable = (username: string): boolean => {
    return !db.queryEntries<User>(`SELECT * FROM users WHERE username = ?`, [
        username,
    ])?.[0];
};

export const emailIsAvailable = (email: string): boolean => {
    return !db.queryEntries<User>(`SELECT * FROM users WHERE email = ?`, [
        email,
    ])?.[0];
};

export const createUser = async (user: CreateUser): Promise<User> => {
    const passwordHash = await hash(user.passwordHash);
    db.query(
        `
        INSERT INTO users (username, email, passwordHash, emailVerificationToken, emailVerificationTokenExpiresAt)
        VALUES (:username, :email, :passwordHash, :emailVerificationToken, :emailVerificationTokenExpiresAt)
        `,
        {
            ...user,
            passwordHash,
            emailVerificationTokenExpiresAt: new Date(
                Date.now() + 1000 * 60 * 60 * 24,
            ), // 24 hours
        },
    );
    db.query("UPDATE users SET hashId = ? WHERE id = ?", [
        encode(db.lastInsertRowId),
        db.lastInsertRowId,
    ]);
    return db.queryEntries<User>(`SELECT * FROM users WHERE id = ?`, [
        db.lastInsertRowId,
    ])[0];
};

export const resetEmailVerificationToken = (
    email: string,
    token: string,
): User | null => {
    const user = db.queryEntries<User>(`SELECT * FROM users WHERE email = ?`, [
        email,
    ])?.[0];
    if (!user) {
        return null;
    }

    db.query(
        `UPDATE users SET emailVerificationToken = ?, emailVerificationTokenExpiresAt = ? WHERE id = ?`,
        [token, new Date(Date.now() + 1000 * 60 * 60 * 24), user.id],
    );
    return user;
};

export const verifyEmailToken = (token: string): User | null => {
    const user = db.queryEntries<User>(
        `SELECT * FROM users WHERE emailVerificationToken = ? AND emailVerificationTokenExpiresAt > ?`,
        [token, new Date()],
    )?.[0];
    if (!user) {
        return null;
    }

    db.query(
        `UPDATE users SET emailVerified = 1, emailVerificationToken = NULL, emailVerificationTokenExpiresAt = NULL WHERE id = ?`,
        [user.id],
    );
    return user;
};

export const setForgotPasswordToken = (
    email: string,
    token: string,
): User | null => {
    const user = db.queryEntries<User>(`SELECT * FROM users WHERE email = ?`, [
        email,
    ])?.[0];
    if (!user) {
        return null;
    }

    db.query(
        `UPDATE users SET passwordResetToken = ?, passwordResetTokenExpiresAt = ? WHERE id = ?`,
        [
            token,
            new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
            user.id,
        ],
    );

    return user;
};

export const validateForgotPasswordToken = (
    token: string,
): User | null => {
    const user = db.queryEntries<User>(
        `SELECT * FROM users WHERE passwordResetToken = ? AND passwordResetTokenExpiresAt > ?`,
        [token, new Date()],
    )?.[0];
    return user;
};

export const resetPassword = async (
    token: string,
    password: string,
): Promise<User | null> => {
    const user = validateForgotPasswordToken(token);
    if (!user) {
        return null;
    }

    const passwordHash = await hash(password);
    // Resetting the password is also a kind of email verification, so we'll mark the email as verified.
    db.query(
        `UPDATE users SET passwordHash = ?, passwordResetToken = NULL, passwordResetTokenExpiresAt = NULL, emailVerified = 1, emailVerificationToken = NULL, emailVerificationTokenExpiresAt = NULL WHERE id = ?`,
        [passwordHash, user.id],
    );

    return user;
};

export const updateEmail = (
    id: number,
    email: string,
    token: string,
): User | null => {
    db.query(
        `UPDATE users SET email = ?, emailVerified = 0, emailVerificationToken = ?, emailVerificationTokenExpiresAt = ? WHERE id = ?`,
        [
            email,
            token,
            new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
            id,
        ],
    );
    return getUserById(id);
};

export const getUserById = (id: number): User | null => {
    return db.queryEntries<User>(`SELECT * FROM users WHERE id = ?`, [id])?.[0];
};

export const getUserByUsername = async (
    username: string,
): Promise<PublicUserFieldsWithRenderedBio | null> => {
    const user = db.queryEntries<User>(
        `SELECT * FROM users WHERE username = ?`,
        [
            username,
        ],
    )?.[0];
    if (!user) {
        return null;
    }
    return await PublicUserFieldsWithRenderedBioSchema.parseAsync(user);
};

export const updateUser = (id: number, user: UpdateUser): User | null => {
    db.query(
        `UPDATE users SET username = ?, email = ?, avatarUrl = ?, bio = ? WHERE id = ?`,
        [user.username, user.email, user.avatarUrl, user.bio, id],
    );
    return getUserById(id);
};
