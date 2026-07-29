declare global {
  interface Window {
    OTOKOGI_CONFIG?: {
      apiUrl?: string
      legacyApiUrl?: string
    }
  }
}

const runtimeConfig =
  typeof window === 'undefined' ? undefined : window.OTOKOGI_CONFIG

export const API_URL = runtimeConfig?.apiUrl?.trim() ?? ''
export const LEGACY_API_URL = runtimeConfig?.legacyApiUrl?.trim() ?? ''

const hostedApiPattern =
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/otokogi-api\/?$/i
const localApiPattern =
  /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/functions\/v1\/otokogi-api\/?$/i

export const isApiConfigured =
  hostedApiPattern.test(API_URL) || localApiPattern.test(API_URL)

export const isLegacyApiConfigured =
  /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(LEGACY_API_URL)
