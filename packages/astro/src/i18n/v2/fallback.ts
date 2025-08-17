/**
 * i18n V2 Fallback Module
 * Handles locale fallback resolution with O(1) lookups
 */

import type { FallbackChains, Locale, Manifest, RouteKey } from './types.js';

/**
 * Picks the best available locale for a route using fallback chains
 * 
 * Invariant:
 * - Single-step fallback: Resolution completes in one pass
 * - O(1) lookups using Map and Set data structures
 * 
 * @param routeKey - The route key to check availability for
 * @param requestedLocale - The originally requested locale
 * @param fallbackChains - Map of locale to fallback chain
 * @param manifest - Map of locale to available route keys
 * @returns Object with selected locale or null if route not available
 */
export function pickLocale(
	routeKey: RouteKey,
	requestedLocale: Locale,
	fallbackChains: FallbackChains,
	manifest: Manifest,
): { locale: Locale } | null {
	// Get fallback chain for requested locale
	// If no chain defined, use just the requested locale
	const chain = fallbackChains.get(requestedLocale) || [requestedLocale];

	// Walk through fallback chain (single pass)
	for (const locale of chain) {
		const routes = manifest.get(locale);
		
		// O(1) Set lookup
		if (routes?.has(routeKey)) {
			return { locale };
		}
	}

	// Route not available in any locale in the chain
	return null;
}

/**
 * Creates fallback chains from configuration
 * 
 * @param fallbackConfig - Object mapping locales to their fallback locales
 * @param locales - List of all available locales
 * @returns FallbackChains map for use with pickLocale
 */
export function createFallbackChains(
	fallbackConfig: Record<string, string> | undefined,
	locales: Locale[],
): FallbackChains {
	const chains = new Map<Locale, Locale[]>();

	if (!fallbackConfig) {
		// No fallback configured - each locale only falls back to itself
		for (const locale of locales) {
			chains.set(locale, [locale]);
		}
		return chains;
	}

	// Build chains from configuration
	for (const locale of locales) {
		const chain: Locale[] = [locale];
		let current = locale;

		// Build chain by following fallbacks
		// Limit iterations to prevent infinite loops
		const maxDepth = locales.length;
		let depth = 0;

		while (depth < maxDepth) {
			const fallback = fallbackConfig[current];
			
			if (!fallback) {
				// No more fallbacks
				break;
			}

			if (chain.includes(fallback)) {
				// Circular reference detected, stop
				console.warn(`Circular fallback detected: ${chain.join(' -> ')} -> ${fallback}`);
				break;
			}

			chain.push(fallback);
			current = fallback;
			depth++;
		}

		chains.set(locale, chain);
	}

	return chains;
}

/**
 * Builds a manifest from route definitions
 * Used at build time to create the locale -> routes mapping
 * 
 * @param routes - Array of route definitions with paths and supported locales
 * @returns Manifest map for use with pickLocale
 */
export function buildManifest(
	routes: Array<{ path: string; locales: Locale[] }>,
): Manifest {
	const manifest = new Map<Locale, Set<RouteKey>>();

	for (const route of routes) {
		const routeKey = extractRouteKey(route.path);

		for (const locale of route.locales) {
			if (!manifest.has(locale)) {
				manifest.set(locale, new Set());
			}
			manifest.get(locale)!.add(routeKey);
		}
	}

	return manifest;
}

/**
 * Extracts a route key from a file path
 * Converts file paths to normalized route keys
 * 
 * @param path - File path (e.g., "pages/blog/[slug].astro")
 * @returns Normalized route key (e.g., "blog/[slug]")
 */
function extractRouteKey(path: string): RouteKey {
	// Remove file extension and pages prefix
	let key = path
		.replace(/^(src\/)?pages\//, '')
		.replace(/\.(astro|mdx|md|jsx?|tsx?)$/, '');

	// Convert index files
	key = key.replace(/\/index$/, '');
	
	// Root index becomes empty string
	if (key === 'index') {
		return '';
	}

	// Convert [...rest] to [rest]
	key = key.replace(/\[\.\.\.([^\]]+)\]/g, '[$1]');

	return key;
}

/**
 * Checks if a route is available for a specific locale
 * Direct lookup without fallback
 * 
 * @param routeKey - The route key to check
 * @param locale - The locale to check for
 * @param manifest - The manifest to check against
 * @returns true if route is available for the locale
 */
export function hasRoute(
	routeKey: RouteKey,
	locale: Locale,
	manifest: Manifest,
): boolean {
	return manifest.get(locale)?.has(routeKey) ?? false;
}

/**
 * Gets all available locales for a specific route
 * 
 * @param routeKey - The route key to check
 * @param manifest - The manifest to check against
 * @returns Array of locales that have this route
 */
export function getLocalesForRoute(
	routeKey: RouteKey,
	manifest: Manifest,
): Locale[] {
	const locales: Locale[] = [];

	for (const [locale, routes] of manifest) {
		if (routes.has(routeKey)) {
			locales.push(locale);
		}
	}

	return locales;
}