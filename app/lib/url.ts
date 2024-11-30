export const sanitizeUrl = (
    url: string,
    originOnly: boolean,
): string | null => {
    try {
        const u = new URL(url);
        if (originOnly) {
            return u.origin;
        }
        return u.toString();
    } catch (_) {
        return null;
    }
};
