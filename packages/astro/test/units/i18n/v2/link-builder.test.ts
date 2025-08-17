import { describe, expect, test } from 'vitest';
import { href, routeKey } from '../../../../src/i18n/v2/link-builder.js';
import type { I18nConfig } from '../../../../src/i18n/v2/types.js';

describe('href', () => {
	// Baseline configuration
	const baseConfig: I18nConfig = {
		strategy: 'prefix-except-default',
		defaultLocale: 'en',
		locales: ['en', 'ja', 'fr'],
		trailingSlash: 'never',
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

	describe('Link Builder Integration with Resolver and Canonicalizer', () => {
		// Simple mock implementations for integration testing
		function mockResolveLocale(
			url: URL,
			_ctx: { cookie?: string; al?: string },
			config: I18nConfig,
		): { locale: string; representation: 'prefix' | 'none'; reason: string } {
			const pathSegments = url.pathname.split('/').filter(Boolean);
			if (pathSegments.length > 0 && config.locales.includes(pathSegments[0])) {
				return {
					locale: pathSegments[0],
					representation: 'prefix',
					reason: 'path',
				};
			}
			return {
				locale: config.defaultLocale,
				representation: 'none',
				reason: 'default',
			};
		}

		function mockCanonicalizeSimple(
			url: URL,
			resolution: { locale: string; representation: string; reason: string },
			config: I18nConfig,
		): { action: 'render' | 'redirect'; url: URL; status?: number } {
			const { locale } = resolution;
			const { strategy, defaultLocale } = config;
			const newUrl = new URL(url.toString());

			// Check if URL needs modification
			const pathSegments = newUrl.pathname.split('/').filter(Boolean);
			const hasLocalePrefix = pathSegments[0] && config.locales.includes(pathSegments[0]);

			if (strategy === 'prefix-except-default' && locale === defaultLocale && hasLocalePrefix) {
				// Remove default locale prefix
				pathSegments.shift();
				newUrl.pathname = '/' + pathSegments.join('/') || '/';
				return { action: 'redirect', url: newUrl, status: 308 };
			}

			if (strategy === 'prefix-except-default' && locale !== defaultLocale && !hasLocalePrefix) {
				// Add non-default locale prefix
				newUrl.pathname = `/${locale}${newUrl.pathname}`;
				return { action: 'redirect', url: newUrl, status: 308 };
			}

			return { action: 'render', url: newUrl };
		}

		test('generated links are already canonical', () => {
			// Generate a link
			const url = href('about', { locale: 'fr' }, baseConfig);
			expect(url).toBe('/fr/about');

			// Parse as full URL
			const fullUrl = new URL(`https://example.com${url}`);

			// Resolve locale from the generated URL
			const resolution = mockResolveLocale(fullUrl, {}, baseConfig);
			expect(resolution.locale).toBe('fr');

			// Canonicalize should return 'render' since it's already correct
			const result = mockCanonicalizeSimple(fullUrl, resolution, baseConfig);
			expect(result.action).toBe('render', 'Generated URL should already be canonical');
		});

		test('generated links resolve to correct locale', () => {
			const testCases = [
				{ locale: 'en', expected: '/about' },
				{ locale: 'fr', expected: '/fr/about' },
				{ locale: 'ja', expected: '/ja/about' },
			];

			testCases.forEach(({ locale, expected }) => {
				// Generate link
				const url = href('about', { locale }, baseConfig);
				expect(url).toBe(expected);

				// Verify it resolves back to the same locale
				const fullUrl = new URL(`https://example.com${url}`);
				const resolution = mockResolveLocale(fullUrl, {}, baseConfig);

				expect(resolution.locale).toBe(locale, `URL ${url} should resolve to locale ${locale}`);
			});
		});

		test('canonical links work with resolver', () => {
			// Generate canonical link for default locale
			const url = href('products', { locale: 'en', canonical: true }, baseConfig);
			expect(url).toBe('/products'); // No prefix for default

			// Verify resolver understands it as default locale
			const fullUrl = new URL(`https://example.com${url}`);
			const resolution = mockResolveLocale(fullUrl, {}, baseConfig);

			expect(resolution.locale).toBe('en');
			expect(resolution.reason).toBe('default');
		});

		test('links with basePath work with canonicalizer', () => {
			const configWithBase: I18nConfig = {
				...baseConfig,
				basePath: '/app',
			};

			// Generate link with basePath
			const url = href('blog', { locale: 'ja' }, configWithBase);
			expect(url).toBe('/app/ja/blog');

			// Remove basePath for resolver (simulating real flow)
			const pathWithoutBase = url.slice(configWithBase.basePath!.length);
			const fullUrl = new URL(`https://example.com${pathWithoutBase}`);

			const resolution = mockResolveLocale(fullUrl, {}, configWithBase);
			expect(resolution.locale).toBe('ja');

			// Canonicalizer should accept it as-is
			const result = mockCanonicalizeSimple(fullUrl, resolution, configWithBase);
			expect(result.action).toBe('render');
		});

		test('prefix-always strategy links are canonical', () => {
			const configAlways: I18nConfig = {
				...baseConfig,
				strategy: 'prefix-always',
			};

			// Generate link for default locale with prefix-always
			const url = href('home', { locale: 'en' }, configAlways);
			expect(url).toBe('/en/home'); // Always has prefix

			// Verify it's canonical
			const fullUrl = new URL(`https://example.com${url}`);
			const resolution = mockResolveLocale(fullUrl, {}, configAlways);

			expect(resolution.locale).toBe('en');
			expect(resolution.representation).toBe('prefix');

			// Should not need redirect
			const result = mockCanonicalizeSimple(fullUrl, resolution, configAlways);
			expect(result.action).toBe('render');
		});

		test('encoded parameters work through full flow', () => {
			// Generate link with special characters
			const params = { query: 'hello world', tag: '日本語' };
			const url = href('search/[query]/[tag]', { locale: 'ja', params }, baseConfig);

			// URL should have encoded parameters
			expect(url).toContain('hello%20world');
			expect(url).toContain('%E6%97%A5%E6%9C%AC%E8%AA%9E');

			// Parse and resolve
			const fullUrl = new URL(`https://example.com${url}`);
			const resolution = mockResolveLocale(fullUrl, {}, baseConfig);

			expect(resolution.locale).toBe('ja');

			// Should be canonical
			const result = mockCanonicalizeSimple(fullUrl, resolution, baseConfig);
			expect(result.action).toBe('render');
		});

		test('empty route (homepage) works with resolver', () => {
			// Generate homepage link
			const url = href('', { locale: 'fr' }, baseConfig);
			expect(url).toBe('/fr/');

			// Resolve locale
			const fullUrl = new URL(`https://example.com${url}`);
			const resolution = mockResolveLocale(fullUrl, {}, baseConfig);

			expect(resolution.locale).toBe('fr');
			expect(resolution.representation).toBe('prefix');
		});

		test('link generation respects canonicalizer rules', () => {
			// Test that link builder produces URLs that canonicalizer accepts
			const patterns = ['about', 'blog/[id]', 'shop/[category]/[product]'];
			const locales = ['en', 'fr', 'ja'];

			patterns.forEach((pattern) => {
				locales.forEach((locale) => {
					// Generate link
					const params = pattern.includes('[')
						? { id: '123', category: 'electronics', product: 'phone' }
						: {};
					const url = href(pattern, { locale, params }, baseConfig);

					// Parse and check with canonicalizer
					const fullUrl = new URL(`https://example.com${url}`);
					const resolution = mockResolveLocale(fullUrl, {}, baseConfig);
					const result = mockCanonicalizeSimple(fullUrl, resolution, baseConfig);

					expect(result.action).toBe(
						'render',
						`Generated URL ${url} for locale ${locale} should be canonical`,
					);
				});
			});
		});
	});
});
