// Store listing URL for the force-update screen. The owner supplies the real URL before release;
// the "Update" button is hidden while this returns an empty string.
export function storeUrl(): string {
  return '';
}

// Apex only: `www` redirects, and the redirect drops the Bearer header on API calls.
export const WEB_URL = 'https://bookhushly.com';
export const TERMS_URL = `${WEB_URL}/terms`;
export const PRIVACY_URL = `${WEB_URL}/privacy`;
