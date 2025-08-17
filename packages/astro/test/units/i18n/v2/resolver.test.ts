import { describe, expect, test } from 'vitest';
import { resolveLocale } from '../../../../src/i18n/v2/resolver.js';
import type { I18nConfig, RequestContext } from '../../../../src/i18n/v2/types.js';

describe('resolveLocale', () => {
	// Base configuration
	const baseConfig: I18nConfig = {
		strategy: 'prefix-except-default',
		defaultLocale: 'en',
		locales: ['en', 'fr', 'ja'],
		trailingSlash: 'never',
	};

	describe('Detection Order 1: ["path", "cookie", "accept-language", "default"]', () => {
		const config: I18nConfig = {
			...baseConfig,
			detectionOrder: ['path', 'cookie', 'accept-language', 'default'],
		};

		test('Case 1: Path wins - /ja/about + Cookie=fr + AL=en-US → locale=ja, representation="prefix"', () => {
			const url = new URL('https://example.com/ja/about');
			const ctx: RequestContext = { cookie: 'locale=fr', acceptLanguage: 'en-US' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'ja',
				representation: 'prefix',
				reason: 'path',
			});
		});

		test('Case 2: Cookie used - /about + Cookie=fr → locale=fr, representation="none"', () => {
			const url = new URL('https://example.com/about');
			const ctx: RequestContext = { cookie: 'locale=fr' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'fr',
				representation: 'none',
				reason: 'cookie',
			});
		});

		test('Case 3: Accept-Language used - /about + AL="fr-FR, en;q=0.8" → locale=fr', () => {
			const url = new URL('https://example.com/about');
			const ctx: RequestContext = { acceptLanguage: 'fr-FR, en;q=0.8' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'fr',
				representation: 'none',
				reason: 'accept-language',
			});
		});

		test('Case 5: Unsupported locales roll down - AL="zh-TW;q=0.9, en;q=0.5" → locale=en', () => {
			const url = new URL('https://example.com/about');
			const ctx: RequestContext = { acceptLanguage: 'zh-TW;q=0.9, en;q=0.5' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'en',
				representation: 'none',
				reason: 'accept-language',
			});
		});

		test('Case 6: Conflict priority - path wins when path and cookie disagree', () => {
			const url = new URL('https://example.com/en/products');
			const ctx: RequestContext = { cookie: 'locale=fr', acceptLanguage: 'ja' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'en',
				representation: 'prefix',
				reason: 'path',
			});
		});

		test('Falls back to default when no matches', () => {
			const url = new URL('https://example.com/about');
			const ctx: RequestContext = { acceptLanguage: 'zh-CN, ko' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'en',
				representation: 'none',
				reason: 'default',
			});
		});
	});

	describe('Detection Order 2: ["domain", "path", "default"]', () => {
		const config: I18nConfig = {
			...baseConfig,
			detectionOrder: ['domain', 'path', 'default'],
			domains: {
				ja: 'ja.example.com',
				fr: 'fr.example.com',
			},
		};

		test('Case 4: Domain strategy - ja.example.com/about → locale=ja, representation="domain"', () => {
			const url = new URL('https://ja.example.com/about');
			const ctx: RequestContext = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'ja',
				representation: 'domain',
				reason: 'domain',
			});
		});

		test('Domain takes precedence over path', () => {
			const url = new URL('https://fr.example.com/en/about');
			const ctx: RequestContext = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'fr',
				representation: 'domain',
				reason: 'domain',
			});
		});

		test('Path used when domain not matched', () => {
			const url = new URL('https://example.com/ja/about');
			const ctx: RequestContext = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'ja',
				representation: 'prefix',
				reason: 'path',
			});
		});

		test('Cookie and Accept-Language ignored in domain strategy', () => {
			const url = new URL('https://example.com/about');
			const ctx: RequestContext = { cookie: 'locale=fr', acceptLanguage: 'ja' };
			const result = resolveLocale(url, ctx, config);

			// Should fall back to default since cookie/al not in detection order
			expect(result).toEqual({
				locale: 'en',
				representation: 'none',
				reason: 'default',
			});
		});
	});

	describe('Edge cases', () => {
		const config: I18nConfig = {
			...baseConfig,
			detectionOrder: ['path', 'cookie', 'accept-language', 'default'],
		};

		test('Empty context falls back correctly', () => {
			const url = new URL('https://example.com/about');
			const ctx: RequestContext = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'en',
				representation: 'none',
				reason: 'default',
			});
		});

		test('Invalid cookie format is ignored', () => {
			const url = new URL('https://example.com/about');
			const ctx: RequestContext = { cookie: 'invalid-cookie-format' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'en',
				representation: 'none',
				reason: 'default',
			});
		});

		test('Multiple cookies with locale', () => {
			const url = new URL('https://example.com/about');
			const ctx: RequestContext = { cookie: 'session=abc123; locale=fr; theme=dark' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'fr',
				representation: 'none',
				reason: 'cookie',
			});
		});

		test('Complex Accept-Language with quality values', () => {
			const url = new URL('https://example.com/about');
			const ctx: RequestContext = { acceptLanguage: 'zh-CN;q=1.0, ja;q=0.9, fr;q=0.8, en;q=0.5' };
			const result = resolveLocale(url, ctx, config);

			// Should pick ja (highest q-value that's supported)
			expect(result).toEqual({
				locale: 'ja',
				representation: 'none',
				reason: 'accept-language',
			});
		});

		test('Accept-Language with region codes', () => {
			const url = new URL('https://example.com/about');
			const ctx: RequestContext = { acceptLanguage: 'en-US, en-GB;q=0.9, fr-CA;q=0.8' };
			const result = resolveLocale(url, ctx, config);

			// Should match 'en' from 'en-US'
			expect(result).toEqual({
				locale: 'en',
				representation: 'none',
				reason: 'accept-language',
			});
		});

		test('Root path with locale', () => {
			const url = new URL('https://example.com/fr');
			const ctx: RequestContext = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'fr',
				representation: 'prefix',
				reason: 'path',
			});
		});

		test('Trailing slash handling', () => {
			const url = new URL('https://example.com/ja/');
			const ctx: RequestContext = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'ja',
				representation: 'prefix',
				reason: 'path',
			});
		});
	});
});
