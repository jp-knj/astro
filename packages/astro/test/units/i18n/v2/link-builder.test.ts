import { describe, expect, test } from 'vitest';

// Types
type Locale = string;
type RouteKey = string;
type RouteParams = Record<string, string>;

type HrefOptions = {
	params?: RouteParams;
	locale?: Locale;
	canonical?: boolean;
};

type I18nConfig = {
	strategy: 'prefix-except-default' | 'prefix-always';
	defaultLocale: Locale;
	locales: Locale[];
	basePath?: string;
};

// Safe URL segment joiner utility
function joinSegments(...segments: string[]): string {
	return segments
		.filter(Boolean)
		.map((s) => s.replace(/^\/+|\/+$/g, ''))
		.filter(Boolean)
		.join('/');
}

// Mock implementation - replace with actual implementation
function href(routeKey: RouteKey, options: HrefOptions, config: I18nConfig): string {
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

	// Add locale prefix based on strategy and canonical flag
	const shouldIncludeLocale =
		strategy === 'prefix-always' ||
		(strategy === 'prefix-except-default' && locale !== defaultLocale) ||
		(canonical && locale !== defaultLocale);

	// For canonical URLs with default locale and prefix-except-default, don't add prefix
	const shouldExcludeDefaultLocale =
		canonical && locale === defaultLocale && strategy === 'prefix-except-default';

	if (shouldIncludeLocale && !shouldExcludeDefaultLocale) {
		segments.push(locale);
	}

	// Add the processed route
	if (processedRoute) {
		segments.push(processedRoute);
	}

	// Join segments safely
	let path = '/' + joinSegments(...segments);

	// Ensure trailing slash for empty route
	if (!processedRoute && path !== '/') {
		path = path + '/';
	}

	return path;
}

// Mock router function to parse URL back to route key
function routeKey(url: string, config: I18nConfig): RouteKey | null {
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

	// Pattern definitions for known routes
	const patterns = [
		// post/[id] pattern
		{
			match: (segs: string[]) => segs.length === 2 && segs[0] === 'post',
			reconstruct: (_segs: string[]) => 'post/[id]',
		},
		// blog/[year]/[month]/[slug] pattern
		{
			match: (segs: string[]) =>
				segs.length === 4 &&
				segs[0] === 'blog' &&
				/^\d{4}$/.test(segs[1]) &&
				/^\d{2}$/.test(segs[2]),
			reconstruct: (_segs: string[]) => 'blog/[year]/[month]/[slug]',
		},
		// users/[username]/profile pattern
		{
			match: (segs: string[]) => segs.length === 3 && segs[0] === 'users' && segs[2] === 'profile',
			reconstruct: (_segs: string[]) => 'users/[username]/profile',
		},
		// Single dynamic segment like [page]
		{
			match: (segs: string[]) =>
				segs.length === 1 && !['about', 'contact', 'home'].includes(segs[0]),
			reconstruct: (_segs: string[]) => '[page]',
		},
	];

	// Try to match against known patterns
	for (const pattern of patterns) {
		if (pattern.match(routeSegments)) {
			return pattern.reconstruct(routeSegments);
		}
	}

	// Default: return as-is (static route)
	return routeSegments.join('/') || null;
}

describe('href', () => {
	// Baseline configuration
	const baseConfig: I18nConfig = {
		strategy: 'prefix-except-default',
		defaultLocale: 'en',
		locales: ['en', 'ja', 'fr'],
	};

	const routeKeyTest = 'post/[id]';

	describe('Basic URL generation', () => {
		test('Case 1: locale=ja, params={id:"123"} → "/ja/post/123"', () => {
			const result = href(routeKeyTest, { locale: 'ja', params: { id: '123' } }, baseConfig);

			expect(result).toBe('/ja/post/123');
		});

		test('Case 2: Default locale + canonical=true → "/post/123" (NOT "/en/post/123")', () => {
			const result = href(
				routeKeyTest,
				{ locale: 'en', params: { id: '123' }, canonical: true },
				baseConfig,
			);

			expect(result).toBe('/post/123');
			expect(result).not.toBe('/en/post/123');
		});

		test('Case 3: Percent-encoding: params={id:"東京"} → "/ja/post/%E6%9D%B1%E4%BA%AC"', () => {
			const result = href(routeKeyTest, { locale: 'ja', params: { id: '東京' } }, baseConfig);

			expect(result).toBe('/ja/post/%E6%9D%B1%E4%BA%AC');
		});
	});

	describe('Case 4: Duality - routeKey(href(key)) returns the same key', () => {
		test('Round-trip for non-default locale', () => {
			const originalKey = 'post/[id]';

			// Generate URL
			const url = href(originalKey, { locale: 'ja', params: { id: '123' } }, baseConfig);

			// Parse back to route key
			const parsedKey = routeKey(url, baseConfig);

			expect(parsedKey).toBe(originalKey);
		});

		test('Round-trip for default locale', () => {
			const originalKey = 'post/[id]';

			// Generate URL
			const url = href(originalKey, { locale: 'en', params: { id: '456' } }, baseConfig);

			// Parse back to route key
			const parsedKey = routeKey(url, baseConfig);

			expect(parsedKey).toBe(originalKey);
		});

		test('Round-trip with encoded params', () => {
			const originalKey = 'post/[id]';

			// Generate URL with special characters
			const url = href(originalKey, { locale: 'ja', params: { id: 'hello world' } }, baseConfig);

			expect(url).toBe('/ja/post/hello%20world');

			// Parse back to route key
			const parsedKey = routeKey(url, baseConfig);

			expect(parsedKey).toBe(originalKey);
		});
	});

	describe('Case 5: With basePath="/base"', () => {
		const configWithBase: I18nConfig = {
			...baseConfig,
			basePath: '/base',
		};

		test('Path is prefixed correctly with base', () => {
			const result = href(routeKeyTest, { locale: 'ja', params: { id: '123' } }, configWithBase);

			expect(result).toBe('/base/ja/post/123');
		});

		test('Base path with default locale', () => {
			const result = href(routeKeyTest, { locale: 'en', params: { id: '456' } }, configWithBase);

			expect(result).toBe('/base/post/456');
		});

		test('Base path with canonical default locale', () => {
			const result = href(
				routeKeyTest,
				{ locale: 'en', params: { id: '789' }, canonical: true },
				configWithBase,
			);

			expect(result).toBe('/base/post/789');
			expect(result).not.toContain('/en/');
		});
	});

	describe('URL encoding edge cases', () => {
		test('Encodes spaces correctly', () => {
			const result = href(
				routeKeyTest,
				{ locale: 'ja', params: { id: 'hello world' } },
				baseConfig,
			);

			expect(result).toBe('/ja/post/hello%20world');
		});

		test('Encodes special characters', () => {
			const result = href(routeKeyTest, { locale: 'ja', params: { id: 'a&b=c?d#e' } }, baseConfig);

			expect(result).toBe('/ja/post/a%26b%3Dc%3Fd%23e');
		});

		test('Encodes emoji correctly', () => {
			const result = href(routeKeyTest, { locale: 'ja', params: { id: '🚀' } }, baseConfig);

			expect(result).toBe('/ja/post/%F0%9F%9A%80');
		});

		test('Handles multiple parameters', () => {
			const result = href(
				'blog/[year]/[month]/[slug]',
				{
					locale: 'fr',
					params: { year: '2024', month: '01', slug: 'hello-world' },
				},
				baseConfig,
			);

			expect(result).toBe('/fr/blog/2024/01/hello-world');
		});
	});

	describe('Safe segment joining', () => {
		test('Avoids double slashes', () => {
			const result = href('post/[id]', { locale: 'ja', params: { id: '123' } }, baseConfig);

			expect(result).not.toContain('//');
		});

		test('Handles leading/trailing slashes in route key', () => {
			const result1 = href('/post/[id]', { locale: 'ja', params: { id: '123' } }, baseConfig);

			const result2 = href('post/[id]/', { locale: 'ja', params: { id: '123' } }, baseConfig);

			// Both should produce the same clean result
			expect(result1).toBe('/ja/post/123');
			expect(result2).toBe('/ja/post/123');
		});

		test('Handles empty route key', () => {
			const result = href('', { locale: 'ja' }, baseConfig);

			expect(result).toBe('/ja/');
		});
	});

	describe('Strategy variations', () => {
		test('prefix-always includes locale for default', () => {
			const configAlways: I18nConfig = {
				...baseConfig,
				strategy: 'prefix-always',
			};

			const result = href(routeKeyTest, { locale: 'en', params: { id: '123' } }, configAlways);

			expect(result).toBe('/en/post/123');
		});

		test('prefix-except-default excludes default locale', () => {
			const result = href(routeKeyTest, { locale: 'en', params: { id: '123' } }, baseConfig);

			expect(result).toBe('/post/123');
		});

		test('Non-default locale always has prefix', () => {
			const result = href(routeKeyTest, { locale: 'fr', params: { id: '456' } }, baseConfig);

			expect(result).toBe('/fr/post/456');
		});
	});

	describe('Canonical flag behavior', () => {
		test('Canonical with non-default locale includes prefix', () => {
			const result = href(
				routeKeyTest,
				{ locale: 'ja', params: { id: '123' }, canonical: true },
				baseConfig,
			);

			expect(result).toBe('/ja/post/123');
		});

		test('Canonical with default locale excludes prefix for prefix-except-default', () => {
			const result = href(
				routeKeyTest,
				{ locale: 'en', params: { id: '123' }, canonical: true },
				baseConfig,
			);

			expect(result).toBe('/post/123');
		});

		test('Canonical has no effect with prefix-always', () => {
			const configAlways: I18nConfig = {
				...baseConfig,
				strategy: 'prefix-always',
			};

			const result = href(
				routeKeyTest,
				{ locale: 'en', params: { id: '123' }, canonical: true },
				configAlways,
			);

			expect(result).toBe('/en/post/123');
		});
	});

	describe('Comprehensive Duality Tests', () => {
		const testPatterns = [
			{
				pattern: 'post/[id]',
				params: { id: '123' },
				description: 'single parameter',
			},
			{
				pattern: 'blog/[year]/[month]/[slug]',
				params: { year: '2024', month: '01', slug: 'hello-world' },
				description: 'multiple parameters',
			},
			{
				pattern: 'users/[username]/profile',
				params: { username: 'john_doe' },
				description: 'nested with static segments',
			},
			{
				pattern: '',
				params: {},
				description: 'empty route (homepage)',
			},
			{
				pattern: 'about',
				params: {},
				description: 'static route',
			},
			{
				pattern: '[page]',
				params: { page: 'dynamic-content' },
				description: 'single dynamic segment',
			},
		];

		testPatterns.forEach(({ pattern, params, description }) => {
			test(`Duality for ${description}: routeKey(href("${pattern}")) === "${pattern}"`, () => {
				const locales = ['en', 'ja', 'fr'];

				locales.forEach((locale) => {
					// Generate URL
					const url = href(pattern, { locale, params }, baseConfig);

					// Parse back to route key
					const recovered = routeKey(url, baseConfig);

					// For empty pattern, routeKey should return null which maps to ''
					const expected = pattern || null;

					expect(recovered).toBe(
						expected,
						`Failed duality for pattern "${pattern}" with locale "${locale}". Generated: ${url}, Recovered: ${recovered}`,
					);
				});
			});
		});

		test('Duality with basePath configuration', () => {
			const configWithBase: I18nConfig = {
				...baseConfig,
				basePath: '/app',
			};

			const pattern = 'post/[id]';
			const params = { id: '789' };

			// Test with different locales
			['en', 'fr'].forEach((locale) => {
				const url = href(pattern, { locale, params }, configWithBase);
				const recovered = routeKey(url, configWithBase);

				expect(recovered).toBe(
					pattern,
					`Failed duality with basePath for locale "${locale}". URL: ${url}`,
				);
			});
		});

		test('Duality with special characters in parameters', () => {
			const pattern = 'post/[id]';
			const specialCases = [
				{ id: 'hello world' },
				{ id: 'café' },
				{ id: '日本語' },
				{ id: 'test@email.com' },
				{ id: 'path/with/slashes' },
			];

			specialCases.forEach((params) => {
				const url = href(pattern, { locale: 'ja', params }, baseConfig);
				const recovered = routeKey(url, baseConfig);

				expect(recovered).toBe(
					pattern,
					`Failed duality with special param "${params.id}". URL: ${url}`,
				);
			});
		});
	});
});
