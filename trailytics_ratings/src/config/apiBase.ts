/**
 * Centralized API base URL for the Ratings app.
 *
 * When running as a standalone Vite app:
 *   - VITE_API_URL is set in trailytics_ratings/.env (e.g. https://prestige-review.up.railway.app)
 *   - Falls back to '' (relative URLs, dev proxy handles it)
 *
 * When bundled inside Digital Shelf (Option C merge):
 *   - VITE_RATINGS_API_URL is set in frontend/.env (e.g. /ratings-api)
 *   - VITE_API_URL is intentionally left unset in DS's env so this file's
 *     VITE_RATINGS_API_URL check wins.
 */
export const RATINGS_API_BASE: string =
    (import.meta.env.VITE_RATINGS_API_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    '';
