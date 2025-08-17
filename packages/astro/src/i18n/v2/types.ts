/**
 * i18n V2 Type Definitions
 * Pure types with no runtime dependencies
 */

// Core types
export type Locale = string;
export type RouteKey = string;

// Resolution types
export type Resolution = {
	locale: Locale;
	representation: 'prefix' | 'domain' | 'none';
	reason: 'path' | 'cookie' | 'accept-language' | 'domain' | 'default';
};

// Canonicalization types
export type CanonicalizeResult =
	| { action: 'render'; url: URL }
	| { action: 'redirect'; url: URL; status: number }
	| { action: 'rewrite'; url: URL };

// Configuration types
export type I18nStrategy = 'prefix-except-default' | 'prefix-always' | 'domain';

export type I18nConfig = {
	strategy: I18nStrategy;
	defaultLocale: Locale;
	locales: Locale[];
	trailingSlash: 'always' | 'never' | 'ignore';
	basePath?: string;
	detectionOrder?: Array<'path' | 'cookie' | 'accept-language' | 'domain'>;
	domains?: Record<Locale, string>;
};

// Manifest types for build-time
export type Manifest = Map<Locale, Set<RouteKey>>;
export type FallbackChains = Map<Locale, Locale[]>;

// Link builder types
export type HrefOptions = {
	params?: Record<string, string>;
	locale?: Locale;
	canonical?: boolean;
};

// Request context for resolver
export type RequestContext = {
	cookie?: string;
	acceptLanguage?: string;
};

// Type guards
export function isRedirect(
	result: CanonicalizeResult,
): result is { action: 'redirect'; url: URL; status: number } {
	return result.action === 'redirect';
}

export function isRender(
	result: CanonicalizeResult,
): result is { action: 'render'; url: URL } {
	return result.action === 'render';
}

export function isRewrite(
	result: CanonicalizeResult,
): result is { action: 'rewrite'; url: URL } {
	return result.action === 'rewrite';
}