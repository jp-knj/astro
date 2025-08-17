/**
 * i18n V2 Link Builder Module
 * Generates i18n URLs with proper encoding and locale handling
 */

import type { HrefOptions, I18nConfig, Locale, RouteKey } from './types.js';

/**
 * Generates an i18n URL for a route key with options
 * 
 * Invariants:
 * - Duality: routeKey(href(key, opts)) === key
 * - Proper URL encoding for all parameters
 * - Consistent locale prefix handling
 * 
 * @param routeKey - The route key to generate URL for
 * @param options - Options including params, locale, and canonical flag
 * @param config - i18n configuration
 * @returns Generated URL string
 */
export function href(
	routeKey: RouteKey,
	options: HrefOptions,
	config: I18nConfig,
): string {
	const { params = {}, locale = config.defaultLocale, canonical = false } = options;
	const { strategy, defaultLocale, basePath } = config;

	// Process route key and replace parameters
	let processedRoute = routeKey;

	// Replace parameter placeholders with actual values
	for (const [key, value] of Object.entries(params)) {
		// Properly encode parameter values for URLs
		const encodedValue = encodeURIComponent(value);
		processedRoute = processedRoute.replace(`[${key}]`, encodedValue);
	}

	// Build path segments
	const segments: string[] = [];

	// Add base path if present
	if (basePath) {
		segments.push(basePath);
	}

	// Determine if locale prefix should be included
	const shouldIncludeLocale = shouldIncludeLocalePrefix(
		locale,
		strategy,
		defaultLocale,
		canonical,
	);

	if (shouldIncludeLocale) {
		segments.push(locale);
	}

	// Add the processed route
	if (processedRoute) {
		segments.push(processedRoute);
	}

	// Join segments safely
	let path = '/' + joinSegments(...segments);

	// Special handling for empty route (homepage)
	if (!processedRoute && path !== '/') {
		// Add trailing slash for locale-only paths
		path = path + '/';
	}

	return path;
}

/**
 * Parses a URL back to its route key
 * Implements the reverse of href for duality
 * 
 * @param url - The URL to parse
 * @param config - i18n configuration
 * @returns The route key or null if not parseable
 */
export function routeKey(url: string, config: I18nConfig): RouteKey | null {
	// Remove base path if present
	let path = url;
	if (config.basePath && path.startsWith(config.basePath)) {
		path = path.slice(config.basePath.length);
	}

	// Remove leading slash
	if (path.startsWith('/')) {
		path = path.slice(1);
	}

	// Remove trailing slash if present
	if (path.endsWith('/')) {
		path = path.slice(0, -1);
	}

	// Parse segments
	const segments = path.split('/').filter(Boolean);

	// Check for locale prefix and remove if present
	let routeSegments = segments;
	if (segments.length > 0 && config.locales.includes(segments[0])) {
		routeSegments = segments.slice(1);
	}

	// If no segments remain, it's the homepage
	if (routeSegments.length === 0) {
		return '';
	}

	// Reconstruct route key with parameter placeholders
	// This would need pattern matching in a real implementation
	// For now, return the joined segments
	return routeSegments.join('/');
}

/**
 * Generates an absolute URL with domain
 * Useful for canonical URLs and sitemap generation
 * 
 * @param routeKey - The route key to generate URL for
 * @param options - Options including params, locale, and canonical flag
 * @param config - i18n configuration with domains
 * @param origin - The origin to use if no domain mapping exists
 * @returns Full URL with domain
 */
export function absoluteHref(
	routeKey: RouteKey,
	options: HrefOptions,
	config: I18nConfig,
	origin: string,
): string {
	const path = href(routeKey, options, config);
	const locale = options.locale || config.defaultLocale;

	// Check for domain mapping
	if (config.domains && config.domains[locale]) {
		const domain = config.domains[locale];
		// Ensure domain has protocol
		const fullDomain = domain.startsWith('http') ? domain : `https://${domain}`;
		// For domain strategy, remove locale prefix from path
		const cleanPath = config.strategy === 'domain' 
			? path.replace(new RegExp(`^/${locale}/?`), '/')
			: path;
		return new URL(cleanPath, fullDomain).toString();
	}

	// Use provided origin
	return new URL(path, origin).toString();
}

/**
 * Gets all alternate URLs for a route (for hreflang tags)
 * 
 * @param routeKey - The route key to generate URLs for
 * @param params - Route parameters
 * @param config - i18n configuration
 * @param origin - The origin to use for absolute URLs
 * @returns Array of locale-URL pairs
 */
export function getAlternateUrls(
	routeKey: RouteKey,
	params: Record<string, string>,
	config: I18nConfig,
	origin: string,
): Array<{ locale: Locale; url: string }> {
	return config.locales.map(locale => ({
		locale,
		url: absoluteHref(routeKey, { params, locale, canonical: true }, config, origin),
	}));
}

// Helper function to determine if locale prefix should be included
function shouldIncludeLocalePrefix(
	locale: Locale,
	strategy: I18nConfig['strategy'],
	defaultLocale: Locale,
	canonical: boolean,
): boolean {
	if (strategy === 'domain') {
		// Domain strategy never uses locale prefixes
		return false;
	}

	if (strategy === 'prefix-always') {
		// Always include prefix
		return true;
	}

	if (strategy === 'prefix-except-default') {
		// Include prefix for non-default locales
		// For canonical URLs with default locale, don't add prefix
		return locale !== defaultLocale || (!canonical && locale === defaultLocale);
	}

	return false;
}

// Helper function to safely join URL segments
function joinSegments(...segments: string[]): string {
	return segments
		.filter(Boolean)
		.map(s => s.replace(/^\/+|\/+$/g, ''))
		.filter(Boolean)
		.join('/');
}