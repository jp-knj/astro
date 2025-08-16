import { describe, expect, test } from 'vitest';

// Types
type Locale = string;
type Resolution = {
	locale: Locale;
	representation: 'prefix' | 'domain' | 'none';
	reason: string;
};

type CanonicalizeResult =
	| { action: 'render'; url: URL }
	| { action: 'redirect'; url: URL; status: number }
	| { action: 'rewrite'; url: URL };

type I18nConfig = {
	strategy: 'prefix-except-default' | 'prefix-always' | 'domain';
	defaultLocale: Locale;
	locales: Locale[];
	trailingSlash: 'always' | 'never' | 'ignore';
	basePath?: string;
};

// Type guard helper for redirect results
function isRedirect(
	result: CanonicalizeResult,
): result is { action: 'redirect'; url: URL; status: number } {
	return result.action === 'redirect';
}

// Mock implementation - replace with actual implementation
function canonicalize(url: URL, resolution: Resolution, config: I18nConfig): CanonicalizeResult {
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
	if (!path.startsWith('/')) path = '/' + path;

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
				if (expectedPath === '') expectedPath = '/';
				modified = true;
			}
		} else {
			// Non-default locale should have prefix
			if (!hasLocalePrefix || pathLocale !== locale) {
				expectedPath = `/${locale}${path}`;
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
				expectedPath = `/${locale}${path}`;
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

	if (modified) {
		return {
			action: 'redirect',
			url: newUrl,
			status: 308,
		};
	}

	return {
		action: 'render',
		url: newUrl,
	};
}

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
		test('redirects /en/about to /about', () => {
			const url = new URL('https://example.com/en/about');
			const resolution: Resolution = {
				locale: 'en',
				representation: 'prefix',
				reason: 'path',
			};

			const result = canonicalize(url, resolution, cfgPrefixExceptDefault);

			expect(result.action).toBe('redirect');
			if (isRedirect(result)) {
				expect(result.status).toBe(308);
				expect(result.url.pathname).toBe('/about');
				expect(result.url.origin).toBe('https://example.com');
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
		test('redirects /base/fr to /base/fr/', () => {
			const url = new URL('https://example.com/base/fr');
			const resolution: Resolution = {
				locale: 'fr',
				representation: 'prefix',
				reason: 'path',
			};

			const result = canonicalize(url, resolution, cfgWithBase);

			expect(result.action).toBe('redirect');
			if (isRedirect(result)) {
				expect(result.status).toBe(308);
				expect(result.url.pathname).toBe('/base/fr/');
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
});
