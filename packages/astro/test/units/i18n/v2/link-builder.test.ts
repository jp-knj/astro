import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import type { I18nConfig, Locale } from './helpers/arbitraries';
import {
  routeKeyArbitrary,
  localeArbitrary,
  i18nConfigArbitrary,
  hrefInputArbitrary
} from './helpers/arbitraries';
import {
  CONFIGS,
  TEST_ROUTE_KEYS,
  TEST_HREF_PARAMS,
  COMMON_LOCALES
} from './helpers/fixtures';

// Mock implementation - replace with actual implementation
function href(
  routeKey: string,
  opts: {
    params?: Record<string, string>;
    locale?: Locale;
    canonical?: boolean;
  },
  config: I18nConfig
): string {
  // This is a mock implementation for testing structure
  // The actual implementation will be provided
  
  const { params = {}, locale = config.defaultLocale, canonical = false } = opts;
  const { routing, domains } = config;
  
  // Build base path from route key
  let path = routeKey.startsWith('/') ? routeKey : `/${routeKey}`;
  
  // Replace parameters in path
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`[${key}]`, encodeURIComponent(value));
  }
  
  // Determine if we need locale prefix
  const needsPrefix = 
    (locale !== config.defaultLocale) ||
    (routing?.prefixDefaultLocale === true);
  
  // Build URL
  let url = '';
  
  if (canonical && domains && domains[locale]) {
    // Use domain for canonical URLs
    url = domains[locale];
    if (!url.endsWith('/')) url += '/';
    url += path.startsWith('/') ? path.slice(1) : path;
  } else {
    // Use path-based locale
    if (needsPrefix) {
      url = `/${locale}${path}`;
    } else {
      url = path;
    }
  }
  
  // Normalize slashes
  url = url.replace(/\/+/g, '/');
  
  // Ensure we don't have trailing slash for non-root paths
  if (url !== '/' && url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  
  return url;
}

// Mock router function to extract route key from URL
function routeKey(url: string, config: I18nConfig): string | null {
  // This would be the inverse of href
  // Extract the route key from a URL
  
  // Remove domain if present
  let path = url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const urlObj = new URL(url);
    path = urlObj.pathname;
  }
  
  // Remove locale prefix if present
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 0 && config.locales.includes(segments[0])) {
    segments.shift();
  }
  
  // Reconstruct route key
  if (segments.length === 0) {
    return 'home';
  }
  
  // Replace dynamic segments with placeholders
  const routeSegments = segments.map(segment => {
    // Simple heuristic: if segment looks like a parameter value, replace with [param]
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(segment)) {
      return '[id]';
    }
    if (/^\d{4}$/.test(segment)) {
      return '[year]';
    }
    if (/^[a-z0-9-]+$/.test(segment) && segment.length > 20) {
      return '[slug]';
    }
    return segment;
  });
  
  return routeSegments.join('/');
}

describe('href', () => {
  describe('Table-driven tests', () => {
    const testCases = [
      {
        name: 'generates simple route without locale prefix',
        routeKey: 'home',
        opts: {},
        config: CONFIGS.basic,
        expected: '/home'
      },
      {
        name: 'generates route with locale prefix',
        routeKey: 'about',
        opts: { locale: 'fr' },
        config: CONFIGS.basic,
        expected: '/fr/about'
      },
      {
        name: 'handles default locale without prefix',
        routeKey: 'contact',
        opts: { locale: 'en' },
        config: CONFIGS.withRouting,
        expected: '/contact'
      },
      {
        name: 'handles default locale with prefix when required',
        routeKey: 'blog',
        opts: { locale: 'en' },
        config: CONFIGS.alwaysPrefix,
        expected: '/en/blog'
      },
      {
        name: 'interpolates parameters',
        routeKey: 'blog/[slug]',
        opts: { params: { slug: 'hello-world' } },
        config: CONFIGS.basic,
        expected: '/blog/hello-world'
      },
      {
        name: 'interpolates multiple parameters',
        routeKey: 'blog/[year]/[month]/[slug]',
        opts: {
          params: { year: '2024', month: '01', slug: 'new-year' },
          locale: 'fr'
        },
        config: CONFIGS.basic,
        expected: '/fr/blog/2024/01/new-year'
      },
      {
        name: 'encodes parameter values',
        routeKey: 'search/[query]',
        opts: { params: { query: 'hello world' } },
        config: CONFIGS.basic,
        expected: '/search/hello%20world'
      },
      {
        name: 'generates canonical URL with domain',
        routeKey: 'products',
        opts: { locale: 'fr', canonical: true },
        config: CONFIGS.withDomains,
        expected: 'https://example.fr/products'
      },
      {
        name: 'generates canonical URL without domain',
        routeKey: 'services',
        opts: { locale: 'ja', canonical: true },
        config: CONFIGS.basic,
        expected: '/ja/services'
      },
      {
        name: 'handles nested routes',
        routeKey: 'docs/api/reference',
        opts: { locale: 'es' },
        config: CONFIGS.basic,
        expected: '/es/docs/api/reference'
      },
      {
        name: 'handles root route',
        routeKey: '',
        opts: {},
        config: CONFIGS.basic,
        expected: '/'
      },
      {
        name: 'handles route starting with slash',
        routeKey: '/about',
        opts: { locale: 'fr' },
        config: CONFIGS.basic,
        expected: '/fr/about'
      },
      {
        name: 'complex route with params and canonical',
        routeKey: 'shop/[category]/[product]',
        opts: {
          params: { category: 'electronics', product: 'laptop-123' },
          locale: 'de',
          canonical: true
        },
        config: CONFIGS.withDomains,
        expected: 'https://example.de/shop/electronics/laptop-123'
      }
    ];

    test.each(testCases)('$name', ({ routeKey, opts, config, expected }) => {
      const result = href(routeKey, opts, config);
      expect(result).toBe(expected);
    });
  });

  describe('Locale handling', () => {
    test('uses default locale when not specified', () => {
      const result = href('page', {}, CONFIGS.basic);
      expect(result).toBe('/page');
    });

    test('respects locale option', () => {
      const result = href('page', { locale: 'fr' }, CONFIGS.basic);
      expect(result).toBe('/fr/page');
    });

    test('handles locale with region', () => {
      const config: I18nConfig = {
        defaultLocale: 'en-US',
        locales: ['en-US', 'en-GB', 'fr-FR', 'fr-CA']
      };
      
      expect(href('page', { locale: 'fr-CA' }, config)).toBe('/fr-CA/page');
      expect(href('page', { locale: 'en-US' }, config)).toBe('/page');
      expect(href('page', { locale: 'en-GB' }, config)).toBe('/en-GB/page');
    });
  });

  describe('Parameter interpolation', () => {
    test('handles single parameter', () => {
      const result = href('user/[id]', { params: { id: '123' } }, CONFIGS.basic);
      expect(result).toBe('/user/123');
    });

    test('handles multiple parameters', () => {
      const result = href(
        'posts/[year]/[month]/[day]/[slug]',
        { params: { year: '2024', month: '01', day: '15', slug: 'post' } },
        CONFIGS.basic
      );
      expect(result).toBe('/posts/2024/01/15/post');
    });

    test('encodes special characters in parameters', () => {
      const params = {
        query: 'hello world',
        tag: 'c++',
        email: 'user@example.com',
        path: 'some/nested/path'
      };
      
      expect(href('search/[query]', { params: { query: params.query } }, CONFIGS.basic))
        .toBe('/search/hello%20world');
      
      expect(href('tag/[tag]', { params: { tag: params.tag } }, CONFIGS.basic))
        .toBe('/tag/c%2B%2B');
      
      expect(href('user/[email]', { params: { email: params.email } }, CONFIGS.basic))
        .toBe('/user/user%40example.com');
      
      expect(href('browse/[path]', { params: { path: params.path } }, CONFIGS.basic))
        .toBe('/browse/some%2Fnested%2Fpath');
    });

    test('handles missing parameters gracefully', () => {
      const result = href('post/[id]/comments', { params: {} }, CONFIGS.basic);
      expect(result).toBe('/post/[id]/comments'); // Placeholder remains
    });
  });

  describe('Canonical URLs', () => {
    test('uses domain for canonical when available', () => {
      const result = href(
        'page',
        { locale: 'fr', canonical: true },
        CONFIGS.withDomains
      );
      expect(result).toBe('https://example.fr/page');
    });

    test('falls back to path when domain not available', () => {
      const result = href(
        'page',
        { locale: 'ja', canonical: true },
        CONFIGS.withDomains
      );
      expect(result).toBe('/ja/page'); // No domain for 'ja'
    });

    test('canonical respects parameters', () => {
      const result = href(
        'product/[id]',
        { params: { id: 'abc123' }, locale: 'es', canonical: true },
        CONFIGS.withDomains
      );
      expect(result).toBe('https://example.es/product/abc123');
    });

    test('canonical with complex domain config', () => {
      const result = href(
        'blog/post',
        { locale: 'fr-CA', canonical: true },
        CONFIGS.complex
      );
      expect(result).toBe('https://ca.example.com/blog/post');
    });
  });

  describe('Routing strategies', () => {
    test('prefixDefaultLocale: false', () => {
      const config = CONFIGS.withRouting;
      expect(href('page', { locale: 'en' }, config)).toBe('/page');
      expect(href('page', { locale: 'fr' }, config)).toBe('/fr/page');
    });

    test('prefixDefaultLocale: true', () => {
      const config = CONFIGS.alwaysPrefix;
      expect(href('page', { locale: 'en' }, config)).toBe('/en/page');
      expect(href('page', { locale: 'fr' }, config)).toBe('/fr/page');
    });

    test('no redirect strategy', () => {
      const config = CONFIGS.noRedirect;
      expect(href('page', { locale: 'en' }, config)).toBe('/page');
      expect(href('page', { locale: 'fr' }, config)).toBe('/fr/page');
    });
  });

  describe('Link Builder and Router duality', () => {
    test('routeKey(href(routeKey)) identity for simple routes', () => {
      const routes = ['home', 'about', 'contact', 'blog', 'products'];
      
      for (const route of routes) {
        const url = href(route, {}, CONFIGS.basic);
        const extracted = routeKey(url, CONFIGS.basic);
        expect(extracted).toBe(route);
      }
    });

    test('duality with locale prefix', () => {
      const route = 'blog/posts';
      const url = href(route, { locale: 'fr' }, CONFIGS.basic);
      expect(url).toBe('/fr/blog/posts');
      
      const extracted = routeKey(url, CONFIGS.basic);
      expect(extracted).toBe(route);
    });

    test('duality with parameters', () => {
      // Note: This is approximate since we lose parameter names
      const route = 'blog/[slug]';
      const url = href(route, { params: { slug: 'hello-world-2024' } }, CONFIGS.basic);
      expect(url).toBe('/blog/hello-world-2024');
      
      // Router would need context to know this is a [slug]
      const extracted = routeKey(url, CONFIGS.basic);
      expect(extracted).toBe('blog/[slug]');
    });

    test('property: href produces valid URLs', () => {
      fc.assert(
        fc.property(
          hrefInputArbitrary(),
          ({ routeKey, opts, config }) => {
            const url = href(routeKey, opts, config);
            
            // Should start with / or http
            expect(url).toMatch(/^(\/|https?:\/\/)/);
            
            // Should not have double slashes (except after protocol)
            expect(url.replace(/^https?:\/\//, '')).not.toMatch(/\/\//);
            
            // Should not end with slash unless root
            if (url !== '/' && !url.startsWith('http')) {
              expect(url).not.toMatch(/\/$/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    test('handles empty route key', () => {
      expect(href('', {}, CONFIGS.basic)).toBe('/');
      expect(href('', { locale: 'fr' }, CONFIGS.basic)).toBe('/fr/');
    });

    test('handles very long paths', () => {
      const longRoute = 'a/'.repeat(50) + 'page';
      const result = href(longRoute, { locale: 'fr' }, CONFIGS.basic);
      expect(result).toContain('/fr/a/');
      expect(result).toEndWith('/page');
    });

    test('handles routes with special characters', () => {
      expect(href('api/v1/users', {}, CONFIGS.basic)).toBe('/api/v1/users');
      expect(href('page-with-dash', {}, CONFIGS.basic)).toBe('/page-with-dash');
      expect(href('page_with_underscore', {}, CONFIGS.basic)).toBe('/page_with_underscore');
    });

    test('normalizes multiple slashes', () => {
      expect(href('//page//section//', {}, CONFIGS.basic)).toBe('/page/section');
      expect(href('/page/', { locale: 'fr' }, CONFIGS.basic)).toBe('/fr/page');
    });

    test('handles mixed case in route keys', () => {
      expect(href('Blog/Post', {}, CONFIGS.basic)).toBe('/Blog/Post');
      expect(href('API/v2/Users', { locale: 'fr' }, CONFIGS.basic)).toBe('/fr/API/v2/Users');
    });
  });

  describe('Property-based tests', () => {
    test('always returns a string', () => {
      fc.assert(
        fc.property(
          hrefInputArbitrary(),
          ({ routeKey, opts, config }) => {
            const result = href(routeKey, opts, config);
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('locale prefix consistency', () => {
      fc.assert(
        fc.property(
          routeKeyArbitrary(),
          i18nConfigArbitrary(),
          (route, config) => {
            const defaultUrl = href(route, { locale: config.defaultLocale }, config);
            const otherLocale = config.locales.find(l => l !== config.defaultLocale);
            
            if (otherLocale) {
              const otherUrl = href(route, { locale: otherLocale }, config);
              
              if (config.routing?.prefixDefaultLocale) {
                // Both should have prefixes
                expect(defaultUrl).toContain(`/${config.defaultLocale}/`);
                expect(otherUrl).toContain(`/${otherLocale}/`);
              } else {
                // Only non-default should have prefix
                expect(defaultUrl).not.toContain(`/${config.defaultLocale}/`);
                expect(otherUrl).toContain(`/${otherLocale}/`);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('canonical URLs are absolute when domains configured', () => {
      fc.assert(
        fc.property(
          routeKeyArbitrary(),
          (route) => {
            const config = CONFIGS.withDomains;
            const result = href(route, { locale: 'fr', canonical: true }, config);
            
            if (config.domains && config.domains['fr']) {
              expect(result).toMatch(/^https?:\/\//);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    test('parameter substitution is consistent', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            slug: fc.string({ minLength: 1, maxLength: 20 })
          }),
          (params) => {
            const route = 'posts/[id]/[slug]';
            const result = href(route, { params }, CONFIGS.basic);
            
            expect(result).toContain(encodeURIComponent(params.id));
            expect(result).toContain(encodeURIComponent(params.slug));
            expect(result).not.toContain('[id]');
            expect(result).not.toContain('[slug]');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});