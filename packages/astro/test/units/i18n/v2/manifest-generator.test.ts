import { describe, expect, test } from 'vitest';

// Types
type Locale = string;
type RouteKey = string;
type RouteDefinition = {
	path: string;
	locales: Locale[];
};

// Manifest is a map of locale to set of route keys
type Manifest = Map<Locale, Set<RouteKey>>;

// Mock implementation - replace with actual implementation
function generateManifest(routes: RouteDefinition[]): Manifest {
	const manifest = new Map<Locale, Set<RouteKey>>();

	// Process each route definition
	routes.forEach((route) => {
		// Extract route key from path
		const routeKey = extractRouteKey(route.path);

		// Add route to each locale it supports
		route.locales.forEach((locale) => {
			if (!manifest.has(locale)) {
				manifest.set(locale, new Set());
			}
			manifest.get(locale)!.add(routeKey);
		});
	});

	return manifest;
}

// Helper to extract route key from file path
function extractRouteKey(path: string): RouteKey {
	// Remove file extension and pages prefix
	let key = path.replace(/^(src\/)?pages\//, '').replace(/\.(astro|mdx|md|jsx?|tsx?)$/, '');

	// Convert index files - remove /index suffix
	key = key.replace(/\/index$/, '');

	// Convert root index to empty string
	if (key === 'index') {
		return '';
	}

	// Convert [...rest] to [rest]
	key = key.replace(/\[\.\.\.([^\]]+)\]/g, '[$1]');

	return key;
}

describe('Manifest Generator', () => {
	describe('Basic manifest generation', () => {
		test('generates manifest from route definitions', () => {
			const routes: RouteDefinition[] = [
				{ path: 'pages/index.astro', locales: ['en', 'fr', 'ja'] },
				{ path: 'pages/about.astro', locales: ['en', 'fr'] },
				{ path: 'pages/blog/[slug].astro', locales: ['en'] },
			];

			const manifest = generateManifest(routes);

			// Verify English has all routes
			expect(manifest.get('en')).toEqual(new Set(['', 'about', 'blog/[slug]']));

			// Verify French has subset
			expect(manifest.get('fr')).toEqual(new Set(['', 'about']));

			// Verify Japanese has only index
			expect(manifest.get('ja')).toEqual(new Set(['']));
		});

		test('handles empty route list', () => {
			const routes: RouteDefinition[] = [];
			const manifest = generateManifest(routes);

			expect(manifest.size).toBe(0);
		});

		test('handles routes with no locales', () => {
			const routes: RouteDefinition[] = [{ path: 'pages/test.astro', locales: [] }];

			const manifest = generateManifest(routes);

			expect(manifest.size).toBe(0);
		});
	});

	describe('Route key extraction', () => {
		test('converts file paths to route keys correctly', () => {
			const testCases = [
				{ path: 'pages/index.astro', expected: '' },
				{ path: 'pages/about.astro', expected: 'about' },
				{ path: 'pages/blog/index.astro', expected: 'blog' },
				{ path: 'pages/blog/[slug].astro', expected: 'blog/[slug]' },
				{ path: 'pages/shop/[...path].astro', expected: 'shop/[path]' },
				{ path: 'src/pages/contact.mdx', expected: 'contact' },
				{ path: 'pages/api/v1/users.ts', expected: 'api/v1/users' },
			];

			testCases.forEach(({ path, expected }) => {
				expect(extractRouteKey(path)).toBe(expected, `Failed to extract route key from ${path}`);
			});
		});
	});

	describe('Complex scenarios', () => {
		test('handles nested routes with parameters', () => {
			const routes: RouteDefinition[] = [
				{ path: 'pages/blog/[year]/[month]/[slug].astro', locales: ['en', 'fr'] },
				{ path: 'pages/users/[username]/profile.astro', locales: ['en'] },
				{ path: 'pages/products/[category]/[id].astro', locales: ['en', 'fr', 'de'] },
			];

			const manifest = generateManifest(routes);

			expect(manifest.get('en')).toEqual(
				new Set([
					'blog/[year]/[month]/[slug]',
					'users/[username]/profile',
					'products/[category]/[id]',
				]),
			);

			expect(manifest.get('fr')).toEqual(
				new Set(['blog/[year]/[month]/[slug]', 'products/[category]/[id]']),
			);

			expect(manifest.get('de')).toEqual(new Set(['products/[category]/[id]']));
		});

		test('handles duplicate routes (should deduplicate)', () => {
			const routes: RouteDefinition[] = [
				{ path: 'pages/about.astro', locales: ['en'] },
				{ path: 'pages/about.mdx', locales: ['en'] }, // Same route key
			];

			const manifest = generateManifest(routes);

			// Should only have one 'about' entry
			expect(manifest.get('en')).toEqual(new Set(['about']));
			expect(manifest.get('en')!.size).toBe(1);
		});

		test('handles catch-all routes', () => {
			const routes: RouteDefinition[] = [
				{ path: 'pages/docs/[...path].astro', locales: ['en', 'fr'] },
				{ path: 'pages/api/[...rest].ts', locales: ['en'] },
			];

			const manifest = generateManifest(routes);

			expect(manifest.get('en')).toEqual(new Set(['docs/[path]', 'api/[rest]']));
			expect(manifest.get('fr')).toEqual(new Set(['docs/[path]']));
		});
	});

	describe('Manifest usage patterns', () => {
		test('can check if route exists for locale', () => {
			const routes: RouteDefinition[] = [
				{ path: 'pages/about.astro', locales: ['en', 'fr'] },
				{ path: 'pages/contact.astro', locales: ['en'] },
			];

			const manifest = generateManifest(routes);

			// Check route availability
			expect(manifest.get('en')?.has('about')).toBe(true);
			expect(manifest.get('fr')?.has('about')).toBe(true);
			expect(manifest.get('fr')?.has('contact')).toBe(false);
			expect(manifest.get('ja')?.has('about')).toBe(undefined); // Locale doesn't exist
		});

		test('can list all routes for a locale', () => {
			const routes: RouteDefinition[] = [
				{ path: 'pages/index.astro', locales: ['en', 'fr'] },
				{ path: 'pages/about.astro', locales: ['en', 'fr'] },
				{ path: 'pages/blog.astro', locales: ['en'] },
			];

			const manifest = generateManifest(routes);

			const enRoutes = Array.from(manifest.get('en') || []).sort();
			const frRoutes = Array.from(manifest.get('fr') || []).sort();

			expect(enRoutes).toEqual(['', 'about', 'blog']);
			expect(frRoutes).toEqual(['', 'about']);
		});

		test('can find locales that have a specific route', () => {
			const routes: RouteDefinition[] = [
				{ path: 'pages/about.astro', locales: ['en', 'fr', 'de'] },
				{ path: 'pages/contact.astro', locales: ['en'] },
			];

			const manifest = generateManifest(routes);

			// Find locales with 'about' route
			const localesWithAbout = Array.from(manifest.entries())
				.filter(([_, routes]) => routes.has('about'))
				.map(([locale]) => locale);

			expect(localesWithAbout).toEqual(['en', 'fr', 'de']);

			// Find locales with 'contact' route
			const localesWithContact = Array.from(manifest.entries())
				.filter(([_, routes]) => routes.has('contact'))
				.map(([locale]) => locale);

			expect(localesWithContact).toEqual(['en']);
		});
	});

	describe('Serialization for build-time', () => {
		test('can be serialized to JSON', () => {
			const routes: RouteDefinition[] = [
				{ path: 'pages/index.astro', locales: ['en', 'fr'] },
				{ path: 'pages/about.astro', locales: ['en'] },
			];

			const manifest = generateManifest(routes);

			// Convert to serializable format
			const serializable = Object.fromEntries(
				Array.from(manifest.entries()).map(([locale, routes]) => [locale, Array.from(routes)]),
			);

			const json = JSON.stringify(serializable);
			const parsed = JSON.parse(json);

			// Verify roundtrip
			expect(parsed).toEqual({
				en: ['', 'about'],
				fr: [''],
			});
		});
	});
});
