import { describe, expect, test } from 'vitest';
import { canonicalize } from '../../../../src/i18n/v2/canonicalizer.js';
import { isRedirect } from '../../../../src/i18n/v2/types.js';
import type { I18nConfig, Resolution } from '../../../../src/i18n/v2/types.js';

describe('canonicalize', () => {
	// Baseline configurations
	const cfgPrefixExceptDefault: I18nConfig = {
		strategy: 'prefix-except-default',
		defaultLocale: 'en',
		locales: ['en', 'fr'],
		trailingSlash: 'never',
		basePath: undefined,
	};

	const cfgPrefixAlways: I18nConfig = {
		strategy: 'prefix-always',
		defaultLocale: 'en',
		locales: ['en', 'fr'],
		trailingSlash: 'never',
		basePath: undefined,
	};

	const cfgWithBase: I18nConfig = {
		strategy: 'prefix-except-default',
		defaultLocale: 'en',
		locales: ['en', 'fr'],
		trailingSlash: 'always',
		basePath: '/base',
	};

	describe('Case 1: prefix-except-default removes default locale prefix', () => {
		test('redirects /en/about to /about preserving query and hash', () => {
			const url = new URL('https://example.com/en/about?lang=en&page=1#content');
			const resolution: Resolution = {
				locale: 'en',
				representation: 'prefix',
				reason: 'path',
			};

			const result = canonicalize(url, resolution, cfgPrefixExceptDefault);

			expect(result.action).toBe('redirect', 'Should redirect to remove default locale prefix');
			if (isRedirect(result)) {
				expect(result.status).toBe(308);
				expect(result.url.pathname).toBe('/about');
				expect(result.url.origin).toBe('https://example.com');
				// Verify query and hash preservation
				expect(result.url.search).toBe('?lang=en&page=1');
				expect(result.url.hash).toBe('#content');
			}
		});

		test('idempotence: second canonicalize is a no-op', () => {
			const url = new URL('https://example.com/en/about');
			const resolution: Resolution = {
				locale: 'en',
				representation: 'none',
				reason: 'default',
			};

			// First canonicalize
			const result1 = canonicalize(url, resolution, cfgPrefixExceptDefault);
			expect(result1.action).toBe('redirect');

			// Second canonicalize with the result URL
			const result2 = canonicalize(result1.url, resolution, cfgPrefixExceptDefault);
			expect(result2.action).toBe('render');
			expect(result2.url.href).toBe(result1.url.href);
		});
	});

	describe('Case 2: trailingSlash=never removes trailing slash', () => {
		test('redirects /fr/about/ to /fr/about preserving query and hash', () => {
			const url = new URL('https://example.com/fr/about/?foo=bar&baz=qux#section');
			const resolution: Resolution = {
				locale: 'fr',
				representation: 'prefix',
				reason: 'path',
			};

			const result = canonicalize(url, resolution, cfgPrefixExceptDefault);

			expect(result.action).toBe('redirect');
			if (isRedirect(result)) {
				expect(result.status).toBe(308);
				expect(result.url.pathname).toBe('/fr/about');
				expect(result.url.search).toBe('?foo=bar&baz=qux');
				expect(result.url.hash).toBe('#section');
			}
		});
	});

	describe('Case 3: basePath + trailingSlash=always', () => {
		test('redirects /base/fr to /base/fr/ preserving query and hash', () => {
			const url = new URL('https://example.com/base/fr?utm_source=test#footer');
			const resolution: Resolution = {
				locale: 'fr',
				representation: 'prefix',
				reason: 'path',
			};

			const result = canonicalize(url, resolution, cfgWithBase);

			expect(result.action).toBe('redirect', 'Should add trailing slash');
			if (isRedirect(result)) {
				expect(result.status).toBe(308);
				expect(result.url.pathname).toBe('/base/fr/');
				// Verify query and hash preservation
				expect(result.url.search).toBe('?utm_source=test');
				expect(result.url.hash).toBe('#footer');
			}
		});
	});

	describe('Case 4: Non-empty Location guarantee', () => {
		test('ensures result is at least "/" when path is missing', () => {
			const url = new URL('https://example.com/fr');
			const resolution: Resolution = {
				locale: 'fr',
				representation: 'prefix',
				reason: 'path',
			};

			// Create a config that would remove the locale
			const config: I18nConfig = {
				strategy: 'prefix-except-default',
				defaultLocale: 'fr', // Make fr the default
				locales: ['en', 'fr'],
				trailingSlash: 'never',
				basePath: undefined,
			};

			const result = canonicalize(url, resolution, config);

			if (result.action === 'redirect') {
				expect(result.url.pathname).toBe('/');
				expect(result.url.pathname).not.toBe('');
				expect(result.url.href).not.toBe(url.href); // from !== to
			}
		});
	});

	describe('Case 5: Preserve query parameters', () => {
		test('keeps encoded query parameters on redirect', () => {
			const url = new URL('https://example.com/fr/search?q=a%20b&filter=new');
			const resolution: Resolution = {
				locale: 'fr',
				representation: 'prefix',
				reason: 'path',
			};

			// Use prefix-always to keep the locale
			const result = canonicalize(url, resolution, cfgPrefixAlways);

			// Whether redirect or render, query should be preserved
			expect(result.url.search).toBe('?q=a%20b&filter=new');

			// Verify the specific encoded space is preserved
			expect(result.url.searchParams.get('q')).toBe('a b');
		});
	});

	describe('Case 6: Already canonical returns render', () => {
		test('returns action: "render" for canonical URL', () => {
			const url = new URL('https://example.com/fr/about');
			const resolution: Resolution = {
				locale: 'fr',
				representation: 'prefix',
				reason: 'path',
			};

			const result = canonicalize(url, resolution, cfgPrefixExceptDefault);

			expect(result.action).toBe('render');
			expect(result.url.href).toBe(url.href);
		});
	});

	describe('Case 7: No multi-hop redirects', () => {
		test('normalization completes in one step', () => {
			// Complex case: wrong locale + trailing slash
			const url = new URL('https://example.com/en/about/');
			const resolution: Resolution = {
				locale: 'en',
				representation: 'none',
				reason: 'default',
			};

			// First canonicalize should fix both issues
			const result1 = canonicalize(url, resolution, cfgPrefixExceptDefault);
			expect(result1.action).toBe('redirect');
			expect(result1.url.pathname).toBe('/about'); // Both locale and slash fixed

			// Second canonicalize should be no-op
			const result2 = canonicalize(result1.url, resolution, cfgPrefixExceptDefault);
			expect(result2.action).toBe('render');
			expect(result2.url.href).toBe(result1.url.href);
		});
	});

	describe('Invariant: No self-redirect', () => {
		test('never redirects to the same URL', () => {
			const testCases = [
				{
					url: 'https://example.com/fr/about',
					resolution: { locale: 'fr', representation: 'prefix' as const, reason: 'path' },
					config: cfgPrefixExceptDefault,
				},
				{
					url: 'https://example.com/en/test?q=value#hash',
					resolution: { locale: 'en', representation: 'none' as const, reason: 'default' },
					config: cfgPrefixExceptDefault,
				},
				{
					url: 'https://example.com/',
					resolution: { locale: 'en', representation: 'none' as const, reason: 'default' },
					config: cfgPrefixAlways,
				},
				{
					url: 'https://example.com/base/fr/page',
					resolution: { locale: 'fr', representation: 'prefix' as const, reason: 'path' },
					config: cfgWithBase,
				},
			];

			testCases.forEach(({ url: urlStr, resolution, config }) => {
				const url = new URL(urlStr);
				const result = canonicalize(url, resolution, config);

				if (result.action === 'redirect') {
					expect(result.url.href).not.toBe(
						url.href,
						`Self-redirect detected: ${url.href} redirects to itself`,
					);
				}
			});
		});
	});

	describe.each([
		['prefix-except-default', cfgPrefixExceptDefault],
		['prefix-always', cfgPrefixAlways],
		['with-base', cfgWithBase],
	])('Config: %s', (_name, config) => {
		test('preserves origin', () => {
			const url = new URL('https://example.com:8080/test');
			const resolution: Resolution = {
				locale: 'fr',
				representation: 'prefix',
				reason: 'path',
			};

			const result = canonicalize(url, resolution, config);
			expect(result.url.origin).toBe('https://example.com:8080');
		});

		test('preserves hash fragments', () => {
			const url = new URL('https://example.com/page#section');
			const resolution: Resolution = {
				locale: 'en',
				representation: 'none',
				reason: 'default',
			};

			const result = canonicalize(url, resolution, config);
			expect(result.url.hash).toBe('#section');
		});

		test('handles root path correctly', () => {
			const url = new URL('https://example.com/');
			const resolution: Resolution = {
				locale: config.defaultLocale,
				representation: 'none',
				reason: 'default',
			};

			const result = canonicalize(url, resolution, config);

			if (config.strategy === 'prefix-always') {
				expect(result.action).toBe('redirect');
				expect(result.url.pathname).toMatch(/^(\/base)?\/en\/?$/);
			} else {
				// Root should generally be canonical for default locale
				const expectedPath = config.basePath
					? config.trailingSlash === 'always'
						? config.basePath + '/'
						: config.basePath
					: '/';

				if (url.pathname === expectedPath) {
					expect(result.action).toBe('render');
				}
			}
		});
	});

	describe('URL comparison using new URL()', () => {
		test('compares URLs with strict equality', () => {
			const url1 = new URL('https://example.com/fr/about?q=test#section');
			const url2 = new URL('https://example.com/fr/about?q=test#section');

			// These are different objects but same URL
			expect(url1).not.toBe(url2);
			expect(url1.href).toBe(url2.href);

			// Components should match
			expect(url1.origin).toBe(url2.origin);
			expect(url1.pathname).toBe(url2.pathname);
			expect(url1.search).toBe(url2.search);
			expect(url1.hash).toBe(url2.hash);
		});
	});

	describe('Matrix: Full coverage of basePath × trailingSlash × strategy', () => {
		const matrixConfigs: Array<[string, I18nConfig]> = [
			[
				'prefix-always + always + no-base',
				{
					strategy: 'prefix-always',
					defaultLocale: 'en',
					locales: ['en', 'fr'],
					trailingSlash: 'always',
					basePath: undefined,
				},
			],
			[
				'prefix-except-default + ignore + base',
				{
					strategy: 'prefix-except-default',
					defaultLocale: 'en',
					locales: ['en', 'fr'],
					trailingSlash: 'ignore',
					basePath: '/app',
				},
			],
			[
				'prefix-always + never + base',
				{
					strategy: 'prefix-always',
					defaultLocale: 'en',
					locales: ['en', 'fr'],
					trailingSlash: 'never',
					basePath: '/site',
				},
			],
			[
				'prefix-always + always + base',
				{
					strategy: 'prefix-always',
					defaultLocale: 'en',
					locales: ['en', 'fr'],
					trailingSlash: 'always',
					basePath: '/portal',
				},
			],
			[
				'domain + always + no-base',
				{
					strategy: 'domain',
					defaultLocale: 'en',
					locales: ['en', 'fr'],
					trailingSlash: 'always',
					basePath: undefined,
				},
			],
		];

		describe.each(matrixConfigs)('Config: %s', (name, config) => {
			test('handles locale prefixing correctly', () => {
				const url = new URL('https://example.com/test');
				const resolution: Resolution = {
					locale: 'fr',
					representation: 'none',
					reason: 'cookie',
				};

				const result = canonicalize(url, resolution, config);

				// Verify expected behavior based on strategy
				if (config.strategy === 'prefix-always') {
					expect(result.action).toBe('redirect', `${name} should redirect to add locale`);
					if (isRedirect(result)) {
						expect(result.url.pathname).toContain('/fr/');
					}
				} else if (config.strategy === 'domain') {
					// Domain strategy doesn't add prefixes
					const expectedAction = config.trailingSlash === 'always' ? 'redirect' : 'render';
					expect(result.action).toBe(expectedAction);
				}
			});

			test('handles trailing slash correctly', () => {
				const testPath = config.basePath ? `${config.basePath}/page` : '/page';
				const url = new URL(`https://example.com${testPath}`);
				const resolution: Resolution = {
					locale: 'en',
					representation: 'none',
					reason: 'default',
				};

				const result = canonicalize(url, resolution, config);

				if (config.trailingSlash === 'always') {
					expect(result.action).toBe('redirect', `${name} should add trailing slash`);
					if (isRedirect(result)) {
						expect(result.url.pathname).toMatch(/\/$/);
					}
				} else if (config.trailingSlash === 'never') {
					// URL already has no trailing slash, should be render
					expect(result.url.pathname).not.toMatch(/\/$/);
				} else if (config.trailingSlash === 'ignore') {
					// Should not modify trailing slash
					expect(result.url.pathname).toBe(url.pathname);
				}
			});
		});
	});
});
