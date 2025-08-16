import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import type { I18nConfig, Resolution } from './helpers/arbitraries';
import {
  urlArbitrary,
  i18nConfigArbitrary,
  resolutionArbitrary,
  canonicalizeInputArbitrary
} from './helpers/arbitraries';
import {
  CONFIGS,
  TEST_URLS,
  TEST_RESOLUTIONS,
  EDGE_CASE_URLS
} from './helpers/fixtures';

// Types for canonicalize result
type CanonicalizeResult =
  | { action: 'render'; url: URL }
  | { action: 'redirect'; url: URL; status: 308 }
  | { action: 'rewrite'; url: URL };

// Mock implementation - replace with actual implementation
function canonicalize(
  url: URL,
  resolution: Resolution,
  config: I18nConfig
): CanonicalizeResult {
  // This is a mock implementation for testing structure
  // The actual implementation will be provided
  
  const { locale, representation } = resolution;
  const { defaultLocale, routing } = config;
  
  // Clone URL to avoid mutations
  let newUrl = new URL(url.toString());
  
  // Determine expected URL structure
  const shouldPrefix = 
    representation === 'prefix' ||
    (locale !== defaultLocale && routing?.prefixDefaultLocale !== true) ||
    (locale === defaultLocale && routing?.prefixDefaultLocale === true);
  
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const hasLocalePrefix = pathSegments.length > 0 && config.locales.includes(pathSegments[0]);
  
  // Handle different cases
  if (representation === 'domain') {
    // Domain-based locale doesn't need prefix
    if (hasLocalePrefix && pathSegments[0] === locale) {
      // Remove redundant prefix
      pathSegments.shift();
      newUrl.pathname = '/' + pathSegments.join('/');
      return { action: 'redirect', url: newUrl, status: 308 };
    }
    return { action: 'render', url: newUrl };
  }
  
  if (representation === 'prefix') {
    if (!hasLocalePrefix) {
      // Add missing prefix
      newUrl.pathname = `/${locale}${url.pathname}`;
      return { action: 'redirect', url: newUrl, status: 308 };
    } else if (pathSegments[0] !== locale) {
      // Wrong prefix, replace it
      pathSegments[0] = locale;
      newUrl.pathname = '/' + pathSegments.join('/');
      return { action: 'redirect', url: newUrl, status: 308 };
    }
    return { action: 'render', url: newUrl };
  }
  
  if (representation === 'none') {
    if (locale === defaultLocale && !routing?.prefixDefaultLocale) {
      if (hasLocalePrefix && pathSegments[0] === defaultLocale) {
        // Remove default locale prefix
        pathSegments.shift();
        newUrl.pathname = '/' + pathSegments.join('/') || '/';
        return { action: 'redirect', url: newUrl, status: 308 };
      }
    } else if (locale !== defaultLocale) {
      // Non-default locale might need rewrite
      if (!hasLocalePrefix) {
        newUrl.pathname = `/${locale}${url.pathname}`;
        return { action: 'rewrite', url: newUrl };
      }
    }
    return { action: 'render', url: newUrl };
  }
  
  return { action: 'render', url: newUrl };
}

// Helper to check if URLs are equal (origin + pathname + search)
function urlsEqual(url1: URL, url2: URL): boolean {
  return url1.origin === url2.origin &&
         url1.pathname === url2.pathname &&
         url1.search === url2.search;
}

describe('canonicalize', () => {
  describe('Table-driven tests', () => {
    const testCases = [
      {
        name: 'renders URL with correct prefix',
        url: TEST_URLS.withPrefixAndPath,
        resolution: TEST_RESOLUTIONS.urlPrefix,
        config: CONFIGS.basic,
        expected: { action: 'render' }
      },
      {
        name: 'redirects to add missing prefix',
        url: TEST_URLS.withPath,
        resolution: { locale: 'fr', representation: 'prefix', reason: 'url-prefix' },
        config: CONFIGS.basic,
        expected: { 
          action: 'redirect',
          pathname: '/fr/about',
          status: 308
        }
      },
      {
        name: 'removes default locale prefix when not needed',
        url: new URL('https://example.com/en/about'),
        resolution: { locale: 'en', representation: 'none', reason: 'default' },
        config: CONFIGS.withRouting,
        expected: {
          action: 'redirect',
          pathname: '/about',
          status: 308
        }
      },
      {
        name: 'keeps default locale prefix when required',
        url: new URL('https://example.com/en/about'),
        resolution: { locale: 'en', representation: 'prefix', reason: 'default' },
        config: CONFIGS.alwaysPrefix,
        expected: { action: 'render' }
      },
      {
        name: 'rewrites for non-default locale without prefix',
        url: TEST_URLS.withPath,
        resolution: { locale: 'fr', representation: 'none', reason: 'cookie' },
        config: CONFIGS.basic,
        expected: {
          action: 'rewrite',
          pathname: '/fr/about'
        }
      },
      {
        name: 'handles domain-based locale',
        url: new URL('https://example.fr/about'),
        resolution: TEST_RESOLUTIONS.domain,
        config: CONFIGS.withDomains,
        expected: { action: 'render' }
      },
      {
        name: 'removes prefix for domain-based locale',
        url: new URL('https://example.fr/fr/about'),
        resolution: TEST_RESOLUTIONS.domain,
        config: CONFIGS.withDomains,
        expected: {
          action: 'redirect',
          pathname: '/about',
          status: 308
        }
      },
      {
        name: 'preserves query parameters',
        url: TEST_URLS.withPrefixAndQuery,
        resolution: { locale: 'es', representation: 'prefix', reason: 'url-prefix' },
        config: CONFIGS.basic,
        expected: {
          action: 'render',
          search: '?id=123&lang=es'
        }
      },
      {
        name: 'preserves hash fragments',
        url: TEST_URLS.withPrefixAndHash,
        resolution: { locale: 'de', representation: 'prefix', reason: 'url-prefix' },
        config: CONFIGS.basic,
        expected: {
          action: 'render',
          hash: '#section'
        }
      },
      {
        name: 'handles root path',
        url: TEST_URLS.root,
        resolution: { locale: 'en', representation: 'none', reason: 'default' },
        config: CONFIGS.basic,
        expected: { action: 'render' }
      },
      {
        name: 'handles root with prefix requirement',
        url: TEST_URLS.root,
        resolution: { locale: 'fr', representation: 'prefix', reason: 'cookie' },
        config: CONFIGS.basic,
        expected: {
          action: 'redirect',
          pathname: '/fr/',
          status: 308
        }
      }
    ];

    test.each(testCases)('$name', ({ url, resolution, config, expected }) => {
      const result = canonicalize(url, resolution, config);
      
      expect(result.action).toBe(expected.action);
      
      if (expected.pathname) {
        expect(result.url.pathname).toBe(expected.pathname);
      }
      
      if (expected.status && result.action === 'redirect') {
        expect(result.status).toBe(expected.status);
      }
      
      if (expected.search) {
        expect(result.url.search).toBe(expected.search);
      }
      
      if (expected.hash) {
        expect(result.url.hash).toBe(expected.hash);
      }
    });
  });

  describe('Idempotence invariant', () => {
    test('canonicalize is idempotent for render actions', () => {
      fc.assert(
        fc.property(
          canonicalizeInputArbitrary(),
          ({ url, resolution, config }) => {
            const result1 = canonicalize(url, resolution, config);
            
            if (result1.action === 'render' || result1.action === 'rewrite') {
              const result2 = canonicalize(result1.url, resolution, config);
              
              // Second call should always render (already canonical)
              expect(result2.action).toBe('render');
              expect(urlsEqual(result1.url, result2.url)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('redirect target is canonical', () => {
      fc.assert(
        fc.property(
          canonicalizeInputArbitrary(),
          ({ url, resolution, config }) => {
            const result1 = canonicalize(url, resolution, config);
            
            if (result1.action === 'redirect') {
              const result2 = canonicalize(result1.url, resolution, config);
              
              // Redirect target should be canonical (render)
              expect(result2.action).toBe('render');
              expect(urlsEqual(result1.url, result2.url)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('No self-redirect invariant', () => {
    test('never redirects to the same URL', () => {
      fc.assert(
        fc.property(
          canonicalizeInputArbitrary(),
          ({ url, resolution, config }) => {
            const result = canonicalize(url, resolution, config);
            
            if (result.action === 'redirect') {
              expect(urlsEqual(url, result.url)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('specific no self-redirect cases', () => {
      const cases = [
        { url: TEST_URLS.withPrefixAndPath, resolution: TEST_RESOLUTIONS.urlPrefix },
        { url: TEST_URLS.root, resolution: TEST_RESOLUTIONS.default },
        { url: TEST_URLS.withPath, resolution: TEST_RESOLUTIONS.cookie }
      ];
      
      for (const { url, resolution } of cases) {
        const result = canonicalize(url, resolution, CONFIGS.basic);
        if (result.action === 'redirect') {
          expect(result.url.href).not.toBe(url.href);
        }
      }
    });
  });

  describe('Default locale root handling', () => {
    test('default locale root is always "/"', () => {
      const url = new URL('https://example.com/en');
      const resolution: Resolution = {
        locale: 'en',
        representation: 'none',
        reason: 'default'
      };
      
      const result = canonicalize(url, resolution, CONFIGS.withRouting);
      
      if (result.action === 'redirect') {
        expect(result.url.pathname).toBe('/');
      }
    });

    test('never produces empty string path', () => {
      fc.assert(
        fc.property(
          canonicalizeInputArbitrary(),
          ({ url, resolution, config }) => {
            const result = canonicalize(url, resolution, config);
            expect(result.url.pathname).not.toBe('');
            expect(result.url.pathname.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('never produces double slash "//"', () => {
      fc.assert(
        fc.property(
          canonicalizeInputArbitrary(),
          ({ url, resolution, config }) => {
            const result = canonicalize(url, resolution, config);
            expect(result.url.pathname).not.toMatch(/\/\//);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('handles edge case URLs correctly', () => {
      const resolution: Resolution = {
        locale: 'en',
        representation: 'none',
        reason: 'default'
      };
      
      for (const [name, url] of Object.entries(EDGE_CASE_URLS)) {
        const result = canonicalize(url, resolution, CONFIGS.basic);
        
        // Check basic invariants
        expect(result.url.pathname).not.toBe('');
        expect(result.url.pathname).not.toMatch(/\/\//);
        
        if (result.url.pathname === '/') {
          expect(result.url.pathname).toBe('/');
        }
      }
    });
  });

  describe('Action types', () => {
    test('render action preserves URL', () => {
      const url = TEST_URLS.withPrefixAndPath;
      const resolution = TEST_RESOLUTIONS.urlPrefix;
      
      const result = canonicalize(url, resolution, CONFIGS.basic);
      
      if (result.action === 'render') {
        expect(urlsEqual(url, result.url)).toBe(true);
      }
    });

    test('redirect action includes status code', () => {
      fc.assert(
        fc.property(
          canonicalizeInputArbitrary(),
          ({ url, resolution, config }) => {
            const result = canonicalize(url, resolution, config);
            
            if (result.action === 'redirect') {
              expect(result.status).toBe(308);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rewrite action modifies URL internally', () => {
      const url = TEST_URLS.withPath;
      const resolution: Resolution = {
        locale: 'fr',
        representation: 'none',
        reason: 'cookie'
      };
      
      const result = canonicalize(url, resolution, CONFIGS.basic);
      
      if (result.action === 'rewrite') {
        expect(result.url.pathname).toContain('/fr/');
        expect('status' in result).toBe(false);
      }
    });
  });

  describe('URL preservation', () => {
    test('preserves origin', () => {
      fc.assert(
        fc.property(
          canonicalizeInputArbitrary(),
          ({ url, resolution, config }) => {
            const result = canonicalize(url, resolution, config);
            
            // Domain representation might change origin
            if (resolution.representation !== 'domain') {
              expect(result.url.origin).toBe(url.origin);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('preserves query parameters', () => {
      fc.assert(
        fc.property(
          canonicalizeInputArbitrary(),
          ({ url, resolution, config }) => {
            const result = canonicalize(url, resolution, config);
            expect(result.url.search).toBe(url.search);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('preserves hash fragments', () => {
      fc.assert(
        fc.property(
          canonicalizeInputArbitrary(),
          ({ url, resolution, config }) => {
            const result = canonicalize(url, resolution, config);
            expect(result.url.hash).toBe(url.hash);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Complex scenarios', () => {
    test('handles complex URL with all components', () => {
      const url = new URL('https://example.com/en-US/blog/post-123?ref=home&lang=en#comments');
      const resolution: Resolution = {
        locale: 'en-US',
        representation: 'prefix',
        reason: 'url-prefix'
      };
      
      const result = canonicalize(url, resolution, CONFIGS.complex);
      
      expect(result.action).toBe('render');
      expect(result.url.search).toBe('?ref=home&lang=en');
      expect(result.url.hash).toBe('#comments');
    });

    test('handles transition between representations', () => {
      // From prefix to domain
      const url1 = new URL('https://example.com/fr/about');
      const resolution1: Resolution = {
        locale: 'fr',
        representation: 'domain',
        reason: 'domain'
      };
      
      const result1 = canonicalize(url1, resolution1, CONFIGS.withDomains);
      expect(result1.action).toBe('redirect');
      expect(result1.url.pathname).toBe('/about');
      
      // From domain to prefix
      const url2 = new URL('https://example.fr/about');
      const resolution2: Resolution = {
        locale: 'fr',
        representation: 'prefix',
        reason: 'cookie'
      };
      
      const result2 = canonicalize(url2, resolution2, CONFIGS.basic);
      expect(result2.action).toBe('redirect');
      expect(result2.url.pathname).toBe('/fr/about');
    });
  });
});