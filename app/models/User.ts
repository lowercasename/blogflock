import { compare, hash } from "https://deno.land/x/bcrypt/mod.ts";
import { query, queryOne } from "../lib/db.ts";
import z from "https://deno.land/x/zod@v3.23.8/index.ts";
import { encode } from "../lib/hashids.ts";
import { markdownToHtml } from "../lib/text.ts";

export const PublicUserFieldsSchema = z.object({
  id: z.number(),
  username: z.string(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  hash_id: z.string(),
});

export const PublicUserFieldsWithRenderedBioSchema = PublicUserFieldsSchema
  .transform(async (data) => ({
    ...data,
    rendered_bio: data.bio ? await markdownToHtml(data.bio) : "",
  }));

export type PublicUserFields = z.infer<typeof PublicUserFieldsSchema>;
export type PublicUserFieldsWithRenderedBio = z.infer<
  typeof PublicUserFieldsWithRenderedBioSchema
>;

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  created_at: z.coerce.date(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  password_reset_token: z.string().nullable(),
  password_reset_token_expires_at: z.coerce.date().nullable(),
  email_verified: z.boolean(),
  email_verification_token: z.string().nullable(),
  email_verification_token_expires_at: z.coerce.date().nullable(),
  hash_id: z.string().nullable(),
});

export type UserObject = z.infer<typeof UserSchema>;
export type User = UserObject;

export type CreateUser = Pick<
  User,
  "username" | "email" | "password_hash" | "email_verification_token"
>;

export type UpdateUser = Pick<
  User,
  "username" | "email" | "avatar_url" | "bio" | "password_hash"
>;

export type JWTUser = Pick<User, "id" | "email">;

export const verifyPassword = async (
  { email, password }: { email: string; password: string },
): Promise<User | null> => {
  const user = await queryOne<User>`SELECT * FROM users WHERE email = ${email}`;
  if (!user) {
    return null;
  }

  // Is email verified?
  if (!user.email_verified) {
    return null;
  }

  // Verify password
  if (await compare(password, user.password_hash)) {
    return user;
  }

  return null;
};

// Check if the username is already taken. Returns true if the username is available.
export const usernameIsAvailable = async (
  username: string,
): Promise<boolean> => {
  const user = await queryOne<
    User
  >`SELECT id FROM users WHERE username = ${username}`;
  return !user;
};

export const emailIsAvailable = async (email: string): Promise<boolean> => {
  const user = await queryOne<
    User
  >`SELECT id FROM users WHERE email = ${email}`;
  return !user;
};

export const createUser = async (user: CreateUser): Promise<User | null> => {
  const passwordHash = await hash(user.password_hash);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

  const result = await queryOne<{ id: number }>`
        INSERT INTO users (
            username, 
            email, 
            password_hash, 
            email_verification_token, 
            email_verification_token_expires_at
        )
        VALUES (
            ${user.username}, 
            ${user.email}, 
            ${passwordHash}, 
            ${user.email_verification_token}, 
            ${expiresAt.toISOString()}
        )
        RETURNING id
    `;

  if (!result) {
    return null;
  }

  await query`UPDATE users SET hash_id = ${
    encode(result.id)
  } WHERE id = ${result.id}`;
  return await getUserById(result.id);
};

export const resetEmailVerificationToken = async (
  email: string,
  token: string,
): Promise<User | null> => {
  const user = await queryOne<User>`SELECT * FROM users WHERE email = ${email}`;
  if (!user) {
    return null;
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
  await query`
        UPDATE users 
        SET 
            email_verification_token = ${token}, 
            email_verification_token_expires_at = ${expiresAt.toISOString()} 
        WHERE id = ${user.id}
    `;

  return await getUserById(user.id);
};

export const verifyEmailToken = async (token: string): Promise<User | null> => {
  const now = new Date();
  const user = await queryOne<User>`
        SELECT * FROM users 
        WHERE email_verification_token = ${token} 
        AND email_verification_token_expires_at > ${now.toISOString()}
    `;

  if (!user) {
    return null;
  }

  await query`
        UPDATE users 
        SET 
            email_verified = TRUE, 
            email_verification_token = NULL, 
            email_verification_token_expires_at = NULL 
        WHERE id = ${user.id}
    `;

  return await getUserById(user.id);
};

export const setForgotPasswordToken = async (
  email: string,
  token: string,
): Promise<User | null> => {
  const user = await queryOne<User>`SELECT * FROM users WHERE email = ${email}`;
  if (!user) {
    return null;
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
  await query`
        UPDATE users 
        SET 
            password_reset_token = ${token}, 
            password_reset_token_expires_at = ${expiresAt.toISOString()} 
        WHERE id = ${user.id}
    `;

  return await getUserById(user.id);
};

export const validateForgotPasswordToken = async (
  token: string,
): Promise<User | null> => {
  const now = new Date();
  return await queryOne<User>`
        SELECT * FROM users 
        WHERE password_reset_token = ${token} 
        AND password_reset_token_expires_at > ${now.toISOString()}
    `;
};

export const resetPassword = async (
  token: string,
  password: string,
): Promise<User | null> => {
  const user = await validateForgotPasswordToken(token);
  if (!user) {
    return null;
  }

  const passwordHash = await hash(password);
  // Resetting the password is also a kind of email verification, so we'll mark the email as verified.
  await query`
        UPDATE users 
        SET 
            password_hash = ${passwordHash}, 
            password_reset_token = NULL, 
            password_reset_token_expires_at = NULL, 
            email_verified = TRUE, 
            email_verification_token = NULL, 
            email_verification_token_expires_at = NULL 
        WHERE id = ${user.id}
    `;

  return await getUserById(user.id);
};

export const updateEmail = async (
  id: number,
  email: string,
  token: string,
): Promise<User | null> => {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
  await query`
        UPDATE users 
        SET 
            email = ${email}, 
            email_verified = FALSE, 
            email_verification_token = ${token}, 
            email_verification_token_expires_at = ${expiresAt.toISOString()} 
        WHERE id = ${id}
    `;

  return await getUserById(id);
};

export const getUserById = async (id: number): Promise<User | null> => {
  return await queryOne<User>`SELECT * FROM users WHERE id = ${id}`;
};

export const getUserByUsername = async (
  username: string,
): Promise<PublicUserFieldsWithRenderedBio | null> => {
  const user = await queryOne<
    User
  >`SELECT * FROM users WHERE username = ${username}`;
  if (!user) {
    return null;
  }
  return await PublicUserFieldsWithRenderedBioSchema.parseAsync(user);
};

export const updateUser = async (
  id: number,
  user: UpdateUser,
): Promise<User | null> => {
  await query`
        UPDATE users 
        SET 
            username = ${user.username}, 
            email = ${user.email}, 
            avatar_url = ${user.avatar_url}, 
            bio = ${user.bio} 
        WHERE id = ${id}
    `;

  return await getUserById(id);
};
