import { describe, expect, test } from 'vitest';

// Types
type Locale = string;
type RouteKey = string;
type PickLocaleResult = { locale: Locale } | null;

// Manifest structure: locale -> route -> availability
type Manifest = Map<Locale, Map<RouteKey, boolean>>;

// Fallback chains
type FallbackChains = Map<Locale, Locale[]>;

// Mock implementation - replace with actual implementation
function pickLocale(
	routeKey: RouteKey,
	requested: Locale,
	fallback: FallbackChains,
	manifest: Manifest,
): PickLocaleResult {
	// Get fallback chain for requested locale
	const chain = fallback.get(requested) || [requested];

	// Try each locale in the chain (single-step resolution)
	for (const locale of chain) {
		const localeManifest = manifest.get(locale);

		if (!localeManifest) {
			// Locale not in manifest, skip
			continue;
		}

		// Check if route exists for this locale
		const routeAvailable = localeManifest.get(routeKey);

		if (routeAvailable === true) {
			return { locale };
		}
		// If routeAvailable === false, continue to next in chain
		// If routeAvailable === undefined, route doesn't exist in this locale, continue
	}

	// No suitable locale found
	return null;
}

describe('pickLocale', () => {
	// Setup manifest
	const createManifest = (): Manifest => {
		const manifest = new Map<Locale, Map<RouteKey, boolean>>();

		// manifest.en = {"post/[id]": true, "about": true}
		const enRoutes = new Map<RouteKey, boolean>();
		enRoutes.set('post/[id]', true);
		enRoutes.set('about', true);
		manifest.set('en', enRoutes);

		// manifest.fr = {"about": false}
		const frRoutes = new Map<RouteKey, boolean>();
		frRoutes.set('about', false);
		manifest.set('fr', frRoutes);

		// manifest.ja = {} (empty)
		const jaRoutes = new Map<RouteKey, boolean>();
		manifest.set('ja', jaRoutes);

		return manifest;
	};

	// Setup fallback chains
	const createFallback = (): FallbackChains => {
		const fallback = new Map<Locale, Locale[]>();
		fallback.set('fr', ['fr', 'en']);
		fallback.set('ja', ['ja', 'en']);
		return fallback;
	};

	const manifest = createManifest();
	const fallback = createFallback();

	describe('Fallback resolution', () => {
		test('Case 1: fr "about" is false → fallback to en → {locale: "en"}', () => {
			const result = pickLocale('about', 'fr', fallback, manifest);

			expect(result).toEqual({ locale: 'en' });
		});

		test('Case 2: fr missing "post/[id]" → fallback to en → {locale: "en"}', () => {
			const result = pickLocale('post/[id]', 'fr', fallback, manifest);

			expect(result).toEqual({ locale: 'en' });
		});

		test('Case 3: ja missing "about" → fallback to en → {locale: "en"}', () => {
			const result = pickLocale('about', 'ja', fallback, manifest);

			expect(result).toEqual({ locale: 'en' });
		});

		test('Case 4: Missing in all locales → return null', () => {
			const result = pickLocale('contact', 'fr', fallback, manifest);

			expect(result).toBe(null);
		});

		test('Case 5: Single-step resolution (no multi-hop chaining)', () => {
			// Create a scenario that would require multi-hop if allowed
			const multiHopFallback = new Map<Locale, Locale[]>();
			multiHopFallback.set('es', ['es', 'fr']); // es falls back to fr
			multiHopFallback.set('fr', ['fr', 'en']); // fr falls back to en

			// Add es to manifest with empty routes
			const esRoutes = new Map<RouteKey, boolean>();
			manifest.set('es', esRoutes);

			// Request 'about' for 'es'
			// Single-step: es -> fr (fr has about=false, so stops)
			// Multi-hop would be: es -> fr -> en
			const result = pickLocale('about', 'es', multiHopFallback, manifest);

			// Should return null because fr has about=false and we don't chain to en
			expect(result).toBe(null);
		});
	});

	describe('Direct locale resolution (no fallback needed)', () => {
		test('Requested locale has route available', () => {
			const result = pickLocale('post/[id]', 'en', fallback, manifest);

			expect(result).toEqual({ locale: 'en' });
		});

		test('Locale without fallback chain uses only itself', () => {
			// 'en' has no fallback chain defined
			const result = pickLocale('about', 'en', fallback, manifest);

			expect(result).toEqual({ locale: 'en' });
		});
	});

	describe('Route availability states', () => {
		test('Distinguishes between false (disabled) and undefined (missing)', () => {
			// fr has 'about' = false (explicitly disabled)
			const frAbout = manifest.get('fr')?.get('about');
			expect(frAbout).toBe(false);

			// fr doesn't have 'post/[id]' (missing/undefined)
			const frPost = manifest.get('fr')?.get('post/[id]');
			expect(frPost).toBeUndefined();

			// Both cases should trigger fallback
			expect(pickLocale('about', 'fr', fallback, manifest)).toEqual({ locale: 'en' });
			expect(pickLocale('post/[id]', 'fr', fallback, manifest)).toEqual({ locale: 'en' });
		});

		test('Only returns locale when route is explicitly true', () => {
			// Create a test manifest where route is present but not true
			const testManifest = new Map<Locale, Map<RouteKey, boolean>>();
			const testRoutes = new Map<RouteKey, boolean>();
			testRoutes.set('test-route', false);
			testManifest.set('test-locale', testRoutes);

			const result = pickLocale('test-route', 'test-locale', new Map(), testManifest);

			expect(result).toBe(null);
		});
	});

	describe('Edge cases', () => {
		test('Empty manifest returns null', () => {
			const emptyManifest = new Map<Locale, Map<RouteKey, boolean>>();

			const result = pickLocale('any-route', 'any-locale', fallback, emptyManifest);

			expect(result).toBe(null);
		});

		test('Empty fallback chain uses only requested locale', () => {
			const emptyFallback = new Map<Locale, Locale[]>();

			// en has the route
			const result1 = pickLocale('about', 'en', emptyFallback, manifest);
			expect(result1).toEqual({ locale: 'en' });

			// fr has about=false, no fallback
			const result2 = pickLocale('about', 'fr', emptyFallback, manifest);
			expect(result2).toBe(null);
		});

		test('Locale not in manifest returns null', () => {
			const result = pickLocale('about', 'de', fallback, manifest);

			expect(result).toBe(null);
		});

		test('Fallback chain with non-existent locales', () => {
			const badFallback = new Map<Locale, Locale[]>();
			badFallback.set('fr', ['fr', 'de', 'es', 'en']); // de and es don't exist

			// Should skip non-existent locales and reach en
			const result = pickLocale('about', 'fr', badFallback, manifest);

			expect(result).toEqual({ locale: 'en' });
		});
	});

	describe('Performance characteristics', () => {
		test('Uses O(1) Map lookups', () => {
			// This test verifies the implementation uses Maps for O(1) access
			const largeManifest = new Map<Locale, Map<RouteKey, boolean>>();

			// Create a large manifest
			for (let i = 0; i < 1000; i++) {
				const routes = new Map<RouteKey, boolean>();
				for (let j = 0; j < 100; j++) {
					routes.set(`route-${j}`, true);
				}
				largeManifest.set(`locale-${i}`, routes);
			}

			// Add our test case
			const testRoutes = new Map<RouteKey, boolean>();
			testRoutes.set('target-route', true);
			largeManifest.set('target-locale', testRoutes);

			// Should still be fast with O(1) lookups
			const start = performance.now();
			const result = pickLocale('target-route', 'target-locale', new Map(), largeManifest);
			const duration = performance.now() - start;

			expect(result).toEqual({ locale: 'target-locale' });
			expect(duration).toBeLessThan(1); // Should be sub-millisecond
		});
	});

	describe('Fallback chain validation', () => {
		test('Fallback chains are processed in order', () => {
			// Create a manifest where order matters
			const orderedManifest = new Map<Locale, Map<RouteKey, boolean>>();

			// First locale in chain has route disabled
			const firstRoutes = new Map<RouteKey, boolean>();
			firstRoutes.set('ordered-route', false);
			orderedManifest.set('first', firstRoutes);

			// Second locale has route enabled
			const secondRoutes = new Map<RouteKey, boolean>();
			secondRoutes.set('ordered-route', true);
			orderedManifest.set('second', secondRoutes);

			// Third locale also has route enabled
			const thirdRoutes = new Map<RouteKey, boolean>();
			thirdRoutes.set('ordered-route', true);
			orderedManifest.set('third', thirdRoutes);

			const orderedFallback = new Map<Locale, Locale[]>();
			orderedFallback.set('test', ['first', 'second', 'third']);

			// Should return 'second' (first valid in chain)
			const result = pickLocale('ordered-route', 'test', orderedFallback, orderedManifest);

			expect(result).toEqual({ locale: 'second' });
		});

		test('Self-reference in fallback chain works correctly', () => {
			// Fallback chain includes the locale itself
			const selfFallback = new Map<Locale, Locale[]>();
			selfFallback.set('en', ['en']); // en falls back to itself

			const result = pickLocale('about', 'en', selfFallback, manifest);

			expect(result).toEqual({ locale: 'en' });
		});
	});
});
