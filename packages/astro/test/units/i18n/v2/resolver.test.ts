import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import type { I18nConfig, Locale, Resolution } from './helpers/arbitraries';
import {
  urlArbitrary,
  contextArbitrary,
  i18nConfigArbitrary,
  localeArbitrary
} from './helpers/arbitraries';
import {
  CONFIGS,
  TEST_URLS,
  TEST_CONTEXTS,
  TEST_RESOLUTIONS,
  COMMON_SCENARIOS,
  EDGE_CASE_URLS
} from './helpers/fixtures';

// Mock implementation - replace with actual implementation
function resolveLocale(
  url: URL,
  ctx: { cookie?: string; al?: string },
  cfg: I18nConfig
): Resolution {
  // This is a mock implementation for testing structure
  // The actual implementation will be provided
  
  // Priority order: URL prefix > Cookie > Accept-Language > Domain > Default
  
  // 1. Check URL prefix
  const pathSegments = url.pathname.split('/').filter(Boolean);
  if (pathSegments.length > 0) {
    const firstSegment = pathSegments[0];
    if (cfg.locales.includes(firstSegment)) {
      return {
        locale: firstSegment,
        representation: 'prefix',
        reason: 'url-prefix'
      };
    }
  }
  
  // 2. Check cookie
  if (ctx.cookie) {
    const match = ctx.cookie.match(/locale=([^;]+)/);
    if (match && cfg.locales.includes(match[1])) {
      return {
        locale: match[1],
        representation: 'none',
        reason: 'cookie'
      };
    }
  }
  
  // 3. Check Accept-Language header
  if (ctx.al) {
    const languages = parseAcceptLanguage(ctx.al);
    for (const lang of languages) {
      if (cfg.locales.includes(lang)) {
        return {
          locale: lang,
          representation: 'none',
          reason: 'accept-language'
        };
      }
    }
  }
  
  // 4. Check domain
  if (cfg.domains) {
    for (const [locale, domain] of Object.entries(cfg.domains)) {
      const domainUrl = new URL(domain);
      if (url.hostname === domainUrl.hostname) {
        return {
          locale,
          representation: 'domain',
          reason: 'domain'
        };
      }
    }
  }
  
  // 5. Default locale
  return {
    locale: cfg.defaultLocale,
    representation: cfg.routing?.prefixDefaultLocale ? 'prefix' : 'none',
    reason: 'default'
  };
}

// Helper function to parse Accept-Language header
function parseAcceptLanguage(header: string): string[] {
  if (header === '*') return [];
  
  const languages: Array<{ locale: string; q: number }> = [];
  const parts = header.split(',').map(s => s.trim());
  
  for (const part of parts) {
    const [locale, qPart] = part.split(';').map(s => s.trim());
    let q = 1.0;
    
    if (qPart && qPart.startsWith('q=')) {
      q = parseFloat(qPart.substring(2));
      if (isNaN(q) || q > 1) q = 1.0;
    }
    
    languages.push({ locale, q });
  }
  
  return languages
    .sort((a, b) => b.q - a.q)
    .map(l => l.locale);
}

describe('resolveLocale', () => {
  describe('Table-driven tests', () => {
    const testCases = [
      {
        name: 'detects locale from URL prefix',
        url: TEST_URLS.withPrefix,
        context: {},
        config: CONFIGS.basic,
        expected: {
          locale: 'fr',
          representation: 'prefix',
          reason: 'url-prefix'
        }
      },
      {
        name: 'detects locale from URL prefix with path',
        url: TEST_URLS.withPrefixAndPath,
        context: {},
        config: CONFIGS.basic,
        expected: {
          locale: 'fr',
          representation: 'prefix',
          reason: 'url-prefix'
        }
      },
      {
        name: 'uses cookie when present',
        url: TEST_URLS.withPath,
        context: TEST_CONTEXTS.withCookie,
        config: CONFIGS.basic,
        expected: {
          locale: 'fr',
          representation: 'none',
          reason: 'cookie'
        }
      },
      {
        name: 'cookie overrides URL prefix',
        url: TEST_URLS.withPrefixAndPath,
        context: { cookie: 'locale=es' },
        config: CONFIGS.basic,
        expected: {
          locale: 'fr', // URL prefix takes precedence
          representation: 'prefix',
          reason: 'url-prefix'
        }
      },
      {
        name: 'uses Accept-Language header',
        url: TEST_URLS.withPath,
        context: TEST_CONTEXTS.withAcceptLanguage,
        config: CONFIGS.basic,
        expected: {
          locale: 'fr',
          representation: 'none',
          reason: 'accept-language'
        }
      },
      {
        name: 'resolves based on domain',
        url: new URL('https://example.fr/about'),
        context: {},
        config: CONFIGS.withDomains,
        expected: {
          locale: 'fr',
          representation: 'domain',
          reason: 'domain'
        }
      },
      {
        name: 'falls back to default locale',
        url: TEST_URLS.withPath,
        context: {},
        config: CONFIGS.basic,
        expected: {
          locale: 'en',
          representation: 'none',
          reason: 'default'
        }
      },
      {
        name: 'handles default locale with prefix',
        url: TEST_URLS.root,
        context: {},
        config: CONFIGS.alwaysPrefix,
        expected: {
          locale: 'en',
          representation: 'prefix',
          reason: 'default'
        }
      },
      {
        name: 'handles complex Accept-Language',
        url: TEST_URLS.root,
        context: TEST_CONTEXTS.complexAcceptLanguage,
        config: CONFIGS.basic,
        expected: {
          locale: 'fr',
          representation: 'none',
          reason: 'accept-language'
        }
      },
      {
        name: 'ignores wildcard Accept-Language',
        url: TEST_URLS.root,
        context: TEST_CONTEXTS.wildcardAcceptLanguage,
        config: CONFIGS.basic,
        expected: {
          locale: 'en',
          representation: 'none',
          reason: 'default'
        }
      },
      {
        name: 'handles query parameters',
        url: TEST_URLS.withPrefixAndQuery,
        context: {},
        config: CONFIGS.basic,
        expected: {
          locale: 'es',
          representation: 'prefix',
          reason: 'url-prefix'
        }
      },
      {
        name: 'handles hash fragments',
        url: TEST_URLS.withPrefixAndHash,
        context: {},
        config: CONFIGS.basic,
        expected: {
          locale: 'de',
          representation: 'prefix',
          reason: 'url-prefix'
        }
      },
      {
        name: 'handles subdomain with domain config',
        url: TEST_URLS.subdomain,
        context: {},
        config: CONFIGS.withDomains,
        expected: {
          locale: 'en', // No matching domain, falls back
          representation: 'none',
          reason: 'default'
        }
      },
      {
        name: 'handles custom port',
        url: TEST_URLS.customPortWithPrefix,
        context: {},
        config: CONFIGS.complex,
        expected: {
          locale: 'ja',
          representation: 'prefix',
          reason: 'url-prefix'
        }
      }
    ];

    test.each(testCases)('$name', ({ url, context, config, expected }) => {
      const result = resolveLocale(url, context, config);
      expect(result).toMatchObject(expected);
    });
  });

  describe('Priority order', () => {
    test('URL prefix takes precedence over cookie', () => {
      const result = resolveLocale(
        TEST_URLS.withPrefixAndPath,
        { cookie: 'locale=es' },
        CONFIGS.basic
      );
      expect(result.locale).toBe('fr');
      expect(result.reason).toBe('url-prefix');
    });

    test('Cookie takes precedence over Accept-Language', () => {
      const result = resolveLocale(
        TEST_URLS.withPath,
        {
          cookie: 'locale=es',
          al: 'fr-FR,fr;q=0.9'
        },
        CONFIGS.basic
      );
      expect(result.locale).toBe('es');
      expect(result.reason).toBe('cookie');
    });

    test('Accept-Language takes precedence over domain', () => {
      const result = resolveLocale(
        new URL('https://example.de/'),
        { al: 'fr-FR' },
        CONFIGS.withDomains
      );
      expect(result.locale).toBe('fr');
      expect(result.reason).toBe('accept-language');
    });

    test('Domain takes precedence over default', () => {
      const result = resolveLocale(
        new URL('https://example.fr/'),
        {},
        CONFIGS.withDomains
      );
      expect(result.locale).toBe('fr');
      expect(result.reason).toBe('domain');
    });
  });

  describe('Edge cases', () => {
    test('handles empty path', () => {
      const result = resolveLocale(
        EDGE_CASE_URLS.emptyPath,
        {},
        CONFIGS.basic
      );
      expect(result.locale).toBe('en');
      expect(result.reason).toBe('default');
    });

    test('handles double slash', () => {
      const result = resolveLocale(
        EDGE_CASE_URLS.doubleSlash,
        {},
        CONFIGS.basic
      );
      expect(result.locale).toBe('en');
      expect(result.reason).toBe('default');
    });

    test('handles multiple slashes', () => {
      const result = resolveLocale(
        EDGE_CASE_URLS.multipleSlashes,
        {},
        CONFIGS.basic
      );
      expect(result.locale).toBe('fr');
      expect(result.reason).toBe('url-prefix');
    });

    test('handles invalid cookie format', () => {
      const result = resolveLocale(
        TEST_URLS.withPath,
        { cookie: 'invalid-cookie-format' },
        CONFIGS.basic
      );
      expect(result.locale).toBe('en');
      expect(result.reason).toBe('default');
    });

    test('handles invalid Accept-Language', () => {
      const result = resolveLocale(
        TEST_URLS.withPath,
        { al: 'invalid;;q=abc' },
        CONFIGS.basic
      );
      expect(result.locale).toBe('en');
      expect(result.reason).toBe('default');
    });

    test('handles locale not in config', () => {
      const result = resolveLocale(
        new URL('https://example.com/jp/'),
        {},
        CONFIGS.basic
      );
      expect(result.locale).toBe('en');
      expect(result.reason).toBe('default');
    });

    test('handles mixed case in URL', () => {
      const result = resolveLocale(
        EDGE_CASE_URLS.mixedCase,
        {},
        CONFIGS.basic
      );
      // Should not match 'Fr' as it's case-sensitive
      expect(result.locale).toBe('en');
      expect(result.reason).toBe('default');
    });
  });

  describe('Representation types', () => {
    test('returns "prefix" for locale in URL', () => {
      const result = resolveLocale(
        TEST_URLS.withPrefixAndPath,
        {},
        CONFIGS.basic
      );
      expect(result.representation).toBe('prefix');
    });

    test('returns "domain" for domain-based locale', () => {
      const result = resolveLocale(
        new URL('https://example.fr/'),
        {},
        CONFIGS.withDomains
      );
      expect(result.representation).toBe('domain');
    });

    test('returns "none" for cookie-based locale', () => {
      const result = resolveLocale(
        TEST_URLS.withPath,
        { cookie: 'locale=fr' },
        CONFIGS.basic
      );
      expect(result.representation).toBe('none');
    });

    test('returns "none" for Accept-Language locale', () => {
      const result = resolveLocale(
        TEST_URLS.withPath,
        { al: 'fr-FR' },
        CONFIGS.basic
      );
      expect(result.representation).toBe('none');
    });

    test('returns "prefix" for default locale when prefixDefaultLocale is true', () => {
      const result = resolveLocale(
        TEST_URLS.root,
        {},
        CONFIGS.alwaysPrefix
      );
      expect(result.representation).toBe('prefix');
    });

    test('returns "none" for default locale when prefixDefaultLocale is false', () => {
      const result = resolveLocale(
        TEST_URLS.root,
        {},
        CONFIGS.withRouting
      );
      expect(result.representation).toBe('none');
    });
  });

  describe('Property-based tests', () => {
    test('always returns a valid locale from config', () => {
      fc.assert(
        fc.property(
          urlArbitrary(),
          contextArbitrary(),
          i18nConfigArbitrary(),
          (url, context, config) => {
            const result = resolveLocale(url, context, config);
            expect(config.locales).toContain(result.locale);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('always returns valid representation type', () => {
      fc.assert(
        fc.property(
          urlArbitrary(),
          contextArbitrary(),
          i18nConfigArbitrary(),
          (url, context, config) => {
            const result = resolveLocale(url, context, config);
            expect(['prefix', 'domain', 'none']).toContain(result.representation);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('always returns valid reason', () => {
      fc.assert(
        fc.property(
          urlArbitrary(),
          contextArbitrary(),
          i18nConfigArbitrary(),
          (url, context, config) => {
            const result = resolveLocale(url, context, config);
            expect([
              'url-prefix',
              'cookie',
              'accept-language',
              'domain',
              'default',
              'fallback'
            ]).toContain(result.reason);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('consistent results for same input', () => {
      fc.assert(
        fc.property(
          urlArbitrary(),
          contextArbitrary(),
          i18nConfigArbitrary(),
          (url, context, config) => {
            const result1 = resolveLocale(url, context, config);
            const result2 = resolveLocale(url, context, config);
            expect(result1).toEqual(result2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});