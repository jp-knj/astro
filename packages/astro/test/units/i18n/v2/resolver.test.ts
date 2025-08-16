import { describe, expect, test } from 'vitest';

// Types
type Locale = string;
type Resolution = {
	locale: Locale;
	representation: 'prefix' | 'domain' | 'none';
	reason: string;
};

type I18nConfig = {
	defaultLocale: Locale;
	locales: Locale[];
	detectionOrder?: string[];
	domains?: Record<Locale, string>;
};

// Mock implementation with configurable detection order
function resolveLocale(
	url: URL,
	ctx: { cookie?: string; al?: string },
	cfg: I18nConfig,
): Resolution {
	const detectionOrder = cfg.detectionOrder || ['path', 'cookie', 'accept-language', 'default'];

	for (const method of detectionOrder) {
		const result = detectByMethod(method, url, ctx, cfg);
		if (result) return result;
	}

	// Fallback to default (should not reach here if 'default' is in order)
	return {
		locale: cfg.defaultLocale,
		representation: 'none',
		reason: 'default',
	};
}

function detectByMethod(
	method: string,
	url: URL,
	ctx: { cookie?: string; al?: string },
	cfg: I18nConfig,
): Resolution | null {
	switch (method) {
		case 'path': {
			const pathSegments = url.pathname.split('/').filter(Boolean);
			if (pathSegments.length > 0) {
				const firstSegment = pathSegments[0];
				if (cfg.locales.includes(firstSegment)) {
					return {
						locale: firstSegment,
						representation: 'prefix',
						reason: 'path',
					};
				}
			}
			return null;
		}

		case 'cookie': {
			if (ctx.cookie) {
				const match = ctx.cookie.match(/locale=([^;]+)/);
				if (match && cfg.locales.includes(match[1])) {
					return {
						locale: match[1],
						representation: 'none',
						reason: 'cookie',
					};
				}
			}
			return null;
		}

		case 'accept-language': {
			if (ctx.al) {
				const languages = parseAcceptLanguage(ctx.al);
				for (const lang of languages) {
					// Check exact match first
					if (cfg.locales.includes(lang)) {
						return {
							locale: lang,
							representation: 'none',
							reason: 'accept-language',
						};
					}
					// Check language without region (e.g., fr from fr-FR)
					const langBase = lang.split('-')[0];
					if (cfg.locales.includes(langBase)) {
						return {
							locale: langBase,
							representation: 'none',
							reason: 'accept-language',
						};
					}
				}
			}
			return null;
		}

		case 'domain': {
			if (cfg.domains) {
				for (const [locale, domain] of Object.entries(cfg.domains)) {
					// Extract hostname from domain string
					const domainHost = domain.replace(/^https?:\/\//, '').split('/')[0];
					if (url.hostname === domainHost) {
						return {
							locale,
							representation: 'domain',
							reason: 'domain',
						};
					}
				}
			}
			return null;
		}

		case 'default': {
			return {
				locale: cfg.defaultLocale,
				representation: 'none',
				reason: 'default',
			};
		}

		default:
			return null;
	}
}

// Helper function to parse Accept-Language header
function parseAcceptLanguage(header: string): string[] {
	if (header === '*') return [];

	const languages: Array<{ locale: string; q: number }> = [];
	const parts = header.split(',').map((s) => s.trim());

	for (const part of parts) {
		const [locale, qPart] = part.split(';').map((s) => s.trim());
		let q = 1.0;

		if (qPart && qPart.startsWith('q=')) {
			q = parseFloat(qPart.substring(2));
			if (isNaN(q) || q > 1) q = 1.0;
		}

		languages.push({ locale, q });
	}

	return languages.sort((a, b) => b.q - a.q).map((l) => l.locale);
}

describe('resolveLocale', () => {
	// Base configuration
	const baseConfig: I18nConfig = {
		defaultLocale: 'en',
		locales: ['en', 'fr', 'ja'],
	};

	describe('Detection Order 1: ["path", "cookie", "accept-language", "default"]', () => {
		const config: I18nConfig = {
			...baseConfig,
			detectionOrder: ['path', 'cookie', 'accept-language', 'default'],
		};

		test('Case 1: Path wins - /ja/about + Cookie=fr + AL=en-US → locale=ja, representation="prefix"', () => {
			const url = new URL('https://example.com/ja/about');
			const ctx = { cookie: 'locale=fr', al: 'en-US' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'ja',
				representation: 'prefix',
				reason: 'path',
			});
		});

		test('Case 2: Cookie used - /about + Cookie=fr → locale=fr, representation="none"', () => {
			const url = new URL('https://example.com/about');
			const ctx = { cookie: 'locale=fr' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'fr',
				representation: 'none',
				reason: 'cookie',
			});
		});

		test('Case 3: Accept-Language used - /about + AL="fr-FR, en;q=0.8" → locale=fr', () => {
			const url = new URL('https://example.com/about');
			const ctx = { al: 'fr-FR, en;q=0.8' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'fr',
				representation: 'none',
				reason: 'accept-language',
			});
		});

		test('Case 5: Unsupported locales roll down - AL="zh-TW;q=0.9, en;q=0.5" → locale=en', () => {
			const url = new URL('https://example.com/about');
			const ctx = { al: 'zh-TW;q=0.9, en;q=0.5' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'en',
				representation: 'none',
				reason: 'accept-language',
			});
		});

		test('Case 6: Conflict priority - path wins when path and cookie disagree', () => {
			const url = new URL('https://example.com/en/products');
			const ctx = { cookie: 'locale=fr', al: 'ja' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'en',
				representation: 'prefix',
				reason: 'path',
			});
		});

		test('Falls back to default when no matches', () => {
			const url = new URL('https://example.com/about');
			const ctx = { al: 'zh-CN, ko' };
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
			const ctx = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'ja',
				representation: 'domain',
				reason: 'domain',
			});
		});

		test('Domain takes precedence over path', () => {
			const url = new URL('https://fr.example.com/en/about');
			const ctx = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'fr',
				representation: 'domain',
				reason: 'domain',
			});
		});

		test('Path used when domain not matched', () => {
			const url = new URL('https://example.com/ja/about');
			const ctx = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'ja',
				representation: 'prefix',
				reason: 'path',
			});
		});

		test('Cookie and Accept-Language ignored in domain strategy', () => {
			const url = new URL('https://example.com/about');
			const ctx = { cookie: 'locale=fr', al: 'ja' };
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
			const ctx = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'en',
				representation: 'none',
				reason: 'default',
			});
		});

		test('Invalid cookie format is ignored', () => {
			const url = new URL('https://example.com/about');
			const ctx = { cookie: 'invalid-cookie-format' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'en',
				representation: 'none',
				reason: 'default',
			});
		});

		test('Multiple cookies with locale', () => {
			const url = new URL('https://example.com/about');
			const ctx = { cookie: 'session=abc123; locale=fr; theme=dark' };
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'fr',
				representation: 'none',
				reason: 'cookie',
			});
		});

		test('Complex Accept-Language with quality values', () => {
			const url = new URL('https://example.com/about');
			const ctx = { al: 'zh-CN;q=1.0, ja;q=0.9, fr;q=0.8, en;q=0.5' };
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
			const ctx = { al: 'en-US, en-GB;q=0.9, fr-CA;q=0.8' };
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
			const ctx = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'fr',
				representation: 'prefix',
				reason: 'path',
			});
		});

		test('Trailing slash handling', () => {
			const url = new URL('https://example.com/ja/');
			const ctx = {};
			const result = resolveLocale(url, ctx, config);

			expect(result).toEqual({
				locale: 'ja',
				representation: 'prefix',
				reason: 'path',
			});
		});
	});
});
