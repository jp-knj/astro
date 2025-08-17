import { describe, expect, test } from 'vitest';
import { pickLocale } from '../../../../src/i18n/v2/fallback.js';
import type { FallbackChains, Locale, Manifest, RouteKey } from '../../../../src/i18n/v2/types.js';

describe('pickLocale', () => {
	// Setup manifest
	const createManifest = (): Manifest => {
		const manifest = new Map<Locale, Set<RouteKey>>();

		// manifest.en = {"post/[id]", "about"}
		const enRoutes = new Set<RouteKey>();
		enRoutes.add('post/[id]');
		enRoutes.add('about');
		manifest.set('en', enRoutes);

		// manifest.fr = {} (empty - "about" is false means not available)
		const frRoutes = new Set<RouteKey>();
		// Note: 'about' is not added, simulating it being unavailable
		manifest.set('fr', frRoutes);

		// manifest.ja = {} (empty)
		const jaRoutes = new Set<RouteKey>();
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
			const esRoutes = new Set<RouteKey>();
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
		test('Distinguishes between unavailable and missing routes', () => {
			// fr doesn't have 'about' (not in Set)
			const frHasAbout = manifest.get('fr')?.has('about');
			expect(frHasAbout).toBe(false);

			// fr doesn't have 'post/[id]' (not in Set)
			const frHasPost = manifest.get('fr')?.has('post/[id]');
			expect(frHasPost).toBe(false);

			// Both cases should trigger fallback
			expect(pickLocale('about', 'fr', fallback, manifest)).toEqual({ locale: 'en' });
			expect(pickLocale('post/[id]', 'fr', fallback, manifest)).toEqual({ locale: 'en' });
		});

		test('Only returns locale when route exists in Set', () => {
			// Create a test manifest where route is not present
			const testManifest = new Map<Locale, Set<RouteKey>>();
			const testRoutes = new Set<RouteKey>();
			// test-route is not added to the Set
			testManifest.set('test-locale', testRoutes);

			const result = pickLocale('test-route', 'test-locale', new Map(), testManifest);

			expect(result).toBe(null);
		});
	});

	describe('Edge cases', () => {
		test('Empty manifest returns null', () => {
			const emptyManifest = new Map<Locale, Set<RouteKey>>();

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
			const largeManifest = new Map<Locale, Set<RouteKey>>();

			// Create a large manifest
			for (let i = 0; i < 1000; i++) {
				const routes = new Set<RouteKey>();
				for (let j = 0; j < 100; j++) {
					routes.add(`route-${j}`);
				}
				largeManifest.set(`locale-${i}`, routes);
			}

			// Add our test case
			const testRoutes = new Set<RouteKey>();
			testRoutes.add('target-route');
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
			const orderedManifest = new Map<Locale, Set<RouteKey>>();

			// First locale in chain doesn't have the route
			const firstRoutes = new Set<RouteKey>();
			// ordered-route is not added
			orderedManifest.set('first', firstRoutes);

			// Second locale has the route
			const secondRoutes = new Set<RouteKey>();
			secondRoutes.add('ordered-route');
			orderedManifest.set('second', secondRoutes);

			// Third locale also has the route
			const thirdRoutes = new Set<RouteKey>();
			thirdRoutes.add('ordered-route');
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
