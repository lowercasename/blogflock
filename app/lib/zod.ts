import { Context } from "hono";
import { Flash } from "./flash.ts";
import { SafeParseError } from "https://deno.land/x/zod/mod.ts";

export const zodSafeParseErrorToFlash = (_: Context, parseResult: SafeParseError<unknown>): Flash[] => {
    return parseResult.error.errors.map((e) => ({
        message: e.message,
        type: "error",
    }));
}