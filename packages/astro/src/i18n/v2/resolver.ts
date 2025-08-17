/**
 * i18n V2 Resolver Module
 * Detects locale from various sources in configurable order
 */

import type { I18nConfig, Locale, RequestContext, Resolution } from './types.js';

/**
 * Resolves the locale from a request URL and context
 * 
 * Detection order (configurable):
 * 1. Path segment (e.g., /fr/about)
 * 2. Cookie (e.g., locale=fr)
 * 3. Accept-Language header
 * 4. Domain mapping
 * 5. Default locale
 * 
 * @param url - The request URL to analyze
 * @param context - Request context containing cookies and headers
 * @param config - i18n configuration
 * @returns Resolution object with detected locale and metadata
 */
export function resolveLocale(
	url: URL,
	context: RequestContext,
	config: I18nConfig,
): Resolution {
	const detectionOrder = config.detectionOrder || ['path', 'cookie', 'accept-language', 'domain'];

	for (const method of detectionOrder) {
		const result = detectByMethod(method, url, context, config);
		if (result) {
			return result;
		}
	}

	// Fallback to default locale
	return {
		locale: config.defaultLocale,
		representation: 'none',
		reason: 'default',
	};
}

function detectByMethod(
	method: string,
	url: URL,
	context: RequestContext,
	config: I18nConfig,
): Resolution | null {
	switch (method) {
		case 'path':
			return detectFromPath(url, config);
		case 'cookie':
			return detectFromCookie(context.cookie, config);
		case 'accept-language':
			return detectFromAcceptLanguage(context.acceptLanguage, config);
		case 'domain':
			return detectFromDomain(url, config);
		default:
			return null;
	}
}

function detectFromPath(url: URL, config: I18nConfig): Resolution | null {
	const pathSegments = url.pathname.split('/').filter(Boolean);
	
	if (pathSegments.length === 0) {
		return null;
	}

	const firstSegment = pathSegments[0];
	
	// Check if first segment is a locale
	if (config.locales.includes(firstSegment)) {
		return {
			locale: firstSegment,
			representation: 'prefix',
			reason: 'path',
		};
	}

	// Check with basePath if configured
	if (config.basePath) {
		const baseSegments = config.basePath.split('/').filter(Boolean);
		// Remove base path segments from the beginning
		const remainingSegments = pathSegments.slice(baseSegments.length);
		
		if (remainingSegments.length > 0 && config.locales.includes(remainingSegments[0])) {
			return {
				locale: remainingSegments[0],
				representation: 'prefix',
				reason: 'path',
			};
		}
	}

	return null;
}

function detectFromCookie(cookieHeader: string | undefined, config: I18nConfig): Resolution | null {
	if (!cookieHeader) {
		return null;
	}

	// Parse cookie header for locale value
	const cookies = parseCookies(cookieHeader);
	const localeValue = cookies.get('locale');

	if (localeValue && config.locales.includes(localeValue)) {
		return {
			locale: localeValue,
			representation: 'none',
			reason: 'cookie',
		};
	}

	return null;
}

function detectFromAcceptLanguage(
	acceptLanguage: string | undefined,
	config: I18nConfig,
): Resolution | null {
	if (!acceptLanguage) {
		return null;
	}

	// Parse Accept-Language header
	const languages = parseAcceptLanguage(acceptLanguage);

	// Find best matching locale
	for (const { code } of languages) {
		// Exact match
		if (config.locales.includes(code)) {
			return {
				locale: code,
				representation: 'none',
				reason: 'accept-language',
			};
		}

		// Try language without region (e.g., 'en' from 'en-US')
		const language = code.split('-')[0];
		if (config.locales.includes(language)) {
			return {
				locale: language,
				representation: 'none',
				reason: 'accept-language',
			};
		}

		// Try to find locale that starts with the language
		const matchingLocale = config.locales.find(locale => 
			locale.toLowerCase().startsWith(language.toLowerCase())
		);
		if (matchingLocale) {
			return {
				locale: matchingLocale,
				representation: 'none',
				reason: 'accept-language',
			};
		}
	}

	return null;
}

function detectFromDomain(url: URL, config: I18nConfig): Resolution | null {
	if (!config.domains) {
		return null;
	}

	const hostname = url.hostname;

	// Find locale by domain
	for (const [locale, domain] of Object.entries(config.domains)) {
		if (domain === hostname || domain === `https://${hostname}` || domain === `http://${hostname}`) {
			return {
				locale,
				representation: 'domain',
				reason: 'domain',
			};
		}
	}

	return null;
}

// Helper function to parse cookies
function parseCookies(cookieHeader: string): Map<string, string> {
	const cookies = new Map<string, string>();
	
	cookieHeader.split(';').forEach(cookie => {
		const [key, value] = cookie.trim().split('=');
		if (key && value) {
			cookies.set(key, decodeURIComponent(value));
		}
	});

	return cookies;
}

// Helper function to parse Accept-Language header
function parseAcceptLanguage(acceptLanguage: string): Array<{ code: string; quality: number }> {
	return acceptLanguage
		.split(',')
		.map(lang => {
			const [code, q] = lang.trim().split(';');
			const quality = q ? parseFloat(q.replace('q=', '')) : 1.0;
			return { code: code.trim(), quality };
		})
		.sort((a, b) => b.quality - a.quality);
}