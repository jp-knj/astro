/**
 * i18n V2 Canonicalizer Module
 * Ensures URLs are in canonical form with idempotence guarantee
 */

import type { CanonicalizeResult, I18nConfig, Resolution, Manifest } from './types.js';

/**
 * Canonicalizes a URL based on locale resolution and i18n configuration
 *
 * Invariants:
 * - Idempotence: canonicalize(canonicalize(url)) === canonicalize(url)
 * - No self-redirect: Never redirects to the same URL
 * - Preserves query parameters and hash fragments
 *
 * @param url - The URL to canonicalize
 * @param resolution - The resolved locale information
 * @param config - i18n configuration
 * @param manifest - Optional manifest to check route availability
 * @returns Canonicalization result with action and URL
 */
export function canonicalize(
	url: URL,
	resolution: Resolution,
	config: I18nConfig,
	manifest?: Manifest,
): CanonicalizeResult {
	const { locale } = resolution;
	const { strategy, defaultLocale, trailingSlash, basePath = '' } = config;

	// Clone URL to avoid mutations
	const newUrl = new URL(url.toString());
	let modified = false;

	// Parse path considering basePath
	let path = newUrl.pathname;
	if (basePath && path.startsWith(basePath)) {
		path = path.slice(basePath.length);
	}
	if (!path.startsWith('/')) {
		path = '/' + path;
	}

	// Extract locale from path if present
	const segments = path.split('/').filter(Boolean);
	const hasLocalePrefix = segments.length > 0 && config.locales.includes(segments[0]);
	const pathLocale = hasLocalePrefix ? segments[0] : null;

	// Determine expected path structure
	let expectedPath = path;

	// Handle locale prefix based on strategy
	if (strategy === 'prefix-except-default') {
		if (locale === defaultLocale) {
			// Default locale should not have prefix
			if (pathLocale === defaultLocale) {
				segments.shift(); // Remove default locale prefix
				expectedPath = '/' + segments.join('/');
				if (expectedPath === '') {
					expectedPath = '/';
				}
				modified = true;
			}
		} else {
			// Non-default locale should have prefix
			if (!hasLocalePrefix || pathLocale !== locale) {
				// Add locale prefix or replace wrong locale
				if (hasLocalePrefix) {
					segments[0] = locale;
					expectedPath = '/' + segments.join('/');
				} else {
					expectedPath = `/${locale}${path === '/' ? '' : path}`;
				}
				modified = true;
			}
		}
	} else if (strategy === 'prefix-always') {
		// All locales should have prefix
		if (!hasLocalePrefix || pathLocale !== locale) {
			if (hasLocalePrefix && pathLocale !== locale) {
				segments[0] = locale; // Replace wrong locale
				expectedPath = '/' + segments.join('/');
			} else {
				expectedPath = `/${locale}${path === '/' ? '' : path}`;
			}
			modified = true;
		}
	} else if (strategy === 'domain') {
		// Domain strategy: no locale prefixes in path
		if (hasLocalePrefix) {
			segments.shift(); // Remove any locale prefix
			expectedPath = '/' + segments.join('/');
			if (expectedPath === '') {
				expectedPath = '/';
			}
			modified = true;
		}
	}

	// Apply basePath
	if (basePath) {
		expectedPath = basePath + expectedPath;
	}

	// Handle trailing slash
	const hasTrailingSlash = expectedPath.endsWith('/');
	const isRoot = expectedPath === '/' || expectedPath === basePath + '/';

	if (trailingSlash === 'always' && !isRoot && !hasTrailingSlash) {
		expectedPath += '/';
		modified = true;
	} else if (trailingSlash === 'never' && hasTrailingSlash && !isRoot) {
		expectedPath = expectedPath.slice(0, -1);
		modified = true;
	}

	// Ensure non-empty path
	if (expectedPath === '' || expectedPath === basePath) {
		expectedPath = basePath ? basePath + '/' : '/';
		modified = true;
	}

	// Check if path changed
	if (expectedPath !== newUrl.pathname) {
		newUrl.pathname = expectedPath;
		modified = true;
	}

	// Return appropriate result
	if (modified) {
		// Check for self-redirect (invariant)
		if (newUrl.href === url.href) {
			// This should never happen with correct logic
			// but we guard against it for safety
			return {
				action: 'render',
				url: newUrl,
			};
		}

		return {
			action: 'redirect',
			url: newUrl,
			status: 308, // Permanent redirect, preserves method
		};
	}

	// Check if this is a missing route that needs rewriting
	if (manifest) {
		// Extract route key from the canonical path
		const routeKey = extractRouteKey(newUrl.pathname, config);

		// Check if route exists for the locale
		const localeRoutes = manifest.get(locale);
		if (localeRoutes && !localeRoutes.has(routeKey)) {
			// Route doesn't exist for this locale, needs rewriting
			return {
				action: 'rewrite',
				url: newUrl,
			};
		}
	}

	// URL is canonical and route exists (or no manifest to check)
	return {
		action: 'render',
		url: newUrl,
	};
}

/**
 * Extracts the route key from a pathname
 *
 * @param pathname - The URL pathname
 * @param config - i18n configuration
 * @returns The route key without locale prefix or basePath
 */
function extractRouteKey(pathname: string, config: I18nConfig): string {
	let path = pathname;

	// Remove basePath if present
	if (config.basePath && path.startsWith(config.basePath)) {
		path = path.slice(config.basePath.length);
	}

	// Remove leading slash
	if (path.startsWith('/')) {
		path = path.slice(1);
	}

	// Remove trailing slash
	if (path.endsWith('/')) {
		path = path.slice(0, -1);
	}

	// Parse segments and remove locale if present
	const segments = path.split('/').filter(Boolean);
	if (segments.length > 0 && config.locales.includes(segments[0])) {
		segments.shift();
	}

	// Return the route key
	return segments.join('/');
}

/**
 * Checks if a URL needs canonicalization
 * Useful for quick checks without full canonicalization
 *
 * @param url - The URL to check
 * @param resolution - The resolved locale information
 * @param config - i18n configuration
 * @returns true if URL needs canonicalization
 */
export function needsCanonicalization(
	url: URL,
	resolution: Resolution,
	config: I18nConfig,
): boolean {
	const result = canonicalize(url, resolution, config);
	return result.action === 'redirect';
}
