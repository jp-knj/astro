/**
 * i18n V2 Public API
 * Pure function implementation for Astro's internationalization
 */

// Export core functions
export { canonicalize, needsCanonicalization } from './canonicalizer.js';
export {
	buildManifest,
	createFallbackChains,
	getLocalesForRoute,
	hasRoute,
	pickLocale,
} from './fallback.js';
export { absoluteHref, getAlternateUrls, href, routeKey } from './link-builder.js';
export { resolveLocale } from './resolver.js';

// Export types
export type {
	CanonicalizeResult,
	FallbackChains,
	HrefOptions,
	I18nConfig,
	I18nStrategy,
	Locale,
	Manifest,
	RequestContext,
	Resolution,
	RouteKey,
} from './types.js';

// Export type guards
export { isRedirect, isRender, isRewrite } from './types.js';

/**
 * i18n V2 API Summary
 * 
 * Core Functions:
 * - resolveLocale: Detects locale from request (path/cookie/accept-language/domain)
 * - canonicalize: Ensures URLs are in canonical form (idempotent)
 * - pickLocale: Selects best available locale for a route (O(1) lookup)
 * - href: Generates i18n URLs with proper encoding
 * 
 * Invariants:
 * 1. Idempotence: canonicalize(canonicalize(url)) === canonicalize(url)
 * 2. No self-redirect: Never redirects to the same URL
 * 3. Single-step fallback: Fallback resolution in one pass
 * 4. Duality: routeKey(href(key, opts)) === key
 * 
 * Usage Flow:
 * 1. Request arrives → resolveLocale detects locale
 * 2. canonicalize checks if URL needs normalization
 * 3. If route missing → pickLocale finds fallback
 * 4. href generates links for navigation
 * 
 * Example:
 * ```typescript
 * import { resolveLocale, canonicalize, pickLocale, href } from 'astro:i18n/v2';
 * 
 * // Detect locale from request
 * const resolution = resolveLocale(url, { cookie, acceptLanguage }, config);
 * 
 * // Check if URL needs redirect
 * const result = canonicalize(url, resolution, config);
 * if (result.action === 'redirect') {
 *   return Response.redirect(result.url, result.status);
 * }
 * 
 * // Find best locale for route
 * const locale = pickLocale(routeKey, resolution.locale, fallbackChains, manifest);
 * 
 * // Generate links
 * const link = href('blog/[slug]', { 
 *   params: { slug: 'hello-world' },
 *   locale: 'fr'
 * }, config);
 * ```
 */

// Version marker for feature detection
export const VERSION = '2.0.0';

// Feature flags
export const FEATURES = {
	idempotentCanonicalization: true,
	singleStepFallback: true,
	parameterEncoding: true,
	domainStrategy: true,
	configurableDetectionOrder: true,
} as const;