/**
 * src/utils/video.js
 *
 * Video URL and provider validation utility.
 * Validates domain and protocol syntactically without executing server-side HTTP requests (preventing SSRF).
 */

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

const VIMEO_HOSTS = new Set([
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
]);

const CLOUDINARY_HOSTS = new Set([
  'res.cloudinary.com',
  'cloudinary.com',
]);

/**
 * Validates a video URL and provider against firm-allowed providers.
 *
 * @param {string} url - Candidate video URL
 * @param {'youtube'|'vimeo'|'cloudinary'|null} [provider=null] - Optional stated provider
 * @param {string[]} [allowedProviders=['youtube', 'vimeo', 'cloudinary']] - Firm's allowed providers
 * @returns {{ valid: boolean, provider?: 'youtube'|'vimeo'|'cloudinary', error?: string }}
 */
export function validateVideoUrl(url, provider = null, allowedProviders = ['youtube', 'vimeo', 'cloudinary']) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Video URL is required' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: 'Malformed video URL format' };
  }

  // Enforce HTTP / HTTPS protocol
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Video URL must use HTTP or HTTPS protocol' };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  let detectedProvider = null;

  if (YOUTUBE_HOSTS.has(hostname)) {
    detectedProvider = 'youtube';
  } else if (VIMEO_HOSTS.has(hostname)) {
    detectedProvider = 'vimeo';
  } else if (CLOUDINARY_HOSTS.has(hostname) || hostname.endsWith('.cloudinary.com')) {
    detectedProvider = 'cloudinary';
  } else {
    return {
      valid: false,
      error: `Video URL host '${hostname}' is not a supported video provider`,
    };
  }

  if (provider && provider !== detectedProvider) {
    return {
      valid: false,
      error: `URL host '${hostname}' does not match provider '${provider}'`,
    };
  }

  const effectiveProvider = provider || detectedProvider;

  if (!allowedProviders.includes(effectiveProvider)) {
    return {
      valid: false,
      error: `Video provider '${effectiveProvider}' is not permitted by your firm settings`,
    };
  }

  return { valid: true, provider: effectiveProvider };
}

export default {
  validateVideoUrl,
};
