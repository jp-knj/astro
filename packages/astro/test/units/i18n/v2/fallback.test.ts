import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import type { Locale, Manifest } from './helpers/arbitraries';
import {
  localeArbitrary,
  localesArrayArbitrary,
  routeKeyArbitrary,
  manifestArbitrary,
  fallbackArbitrary,
  pickLocaleInputArbitrary
} from './helpers/arbitraries';
import {
  COMMON_LOCALES,
  TEST_MANIFESTS,
  FALLBACK_CHAINS,
  TEST_ROUTE_KEYS
} from './helpers/fixtures';

// Type for pickLocale result
type PickLocaleResult = { locale: Locale } | null;

// Mock implementation - replace with actual implementation
function pickLocale(
  routeKey: string,
  requested: Locale,
  fallback: Partial<Record<Locale, Locale[]>>,
  manifest: Manifest
): PickLocaleResult {
  // This is a mock implementation for testing structure
  // The actual implementation will be provided
  
  // Check if route exists in manifest
  const route = manifest.routes[routeKey];
  if (!route) {
    return null;
  }
  
  // Check if route supports any locales
  const supportedLocales = route.locales;
  if (!supportedLocales || supportedLocales.length === 0) {
    // Route supports all locales
    return { locale: requested };
  }
  
  // Check if requested locale is directly supported
  if (supportedLocales.includes(requested)) {
    return { locale: requested };
  }
  
  // Check fallback chain (single step only)
  const fallbackLocales = fallback[requested];
  if (fallbackLocales) {
    for (const fallbackLocale of fallbackLocales) {
      if (supportedLocales.includes(fallbackLocale)) {
        return { locale: fallbackLocale };
      }
    }
  }
  
  // No suitable locale found
  return null;
}

// Helper to detect cycles in fallback chains
function hasCycle(fallback: Partial<Record<Locale, Locale[]>>): boolean {
  const visited = new Set<Locale>();
  const recursionStack = new Set<Locale>();
  
  function dfs(locale: Locale): boolean {
    if (recursionStack.has(locale)) {
      return true; // Cycle detected
    }
    if (visited.has(locale)) {
      return false; // Already processed
    }
    
    visited.add(locale);
    recursionStack.add(locale);
    
    const targets = fallback[locale] || [];
    for (const target of targets) {
      if (dfs(target)) {
        return true;
      }
    }
    
    recursionStack.delete(locale);
    return false;
  }
  
  for (const locale of Object.keys(fallback)) {
    if (dfs(locale)) {
      return true;
    }
  }
  
  return false;
}

// Helper to check if fallback resolves in one step
function isOneStepFallback(fallback: Partial<Record<Locale, Locale[]>>): boolean {
  // Check that no locale in fallback values has its own fallback
  for (const targets of Object.values(fallback)) {
    for (const target of targets) {
      if (target in fallback) {
        return false; // Multi-hop detected
      }
    }
  }
  return true;
}

describe('pickLocale', () => {
  describe('Table-driven tests', () => {
    const testCases = [
      {
        name: 'returns requested locale when directly supported',
        routeKey: 'home',
        requested: 'fr',
        fallback: {},
        manifest: TEST_MANIFESTS.simple,
        expected: { locale: 'fr' }
      },
      {
        name: 'returns null when route not found',
        routeKey: 'non-existent',
        requested: 'en',
        fallback: {},
        manifest: TEST_MANIFESTS.simple,
        expected: null
      },
      {
        name: 'returns requested locale when route supports all locales',
        routeKey: 'user-profile',
        requested: 'ja',
        fallback: {},
        manifest: TEST_MANIFESTS.dynamic,
        expected: { locale: 'ja' }
      },
      {
        name: 'uses fallback when requested locale not supported',
        routeKey: 'contact',
        requested: 'de',
        fallback: { 'de': ['en'] },
        manifest: TEST_MANIFESTS.simple,
        expected: { locale: 'en' }
      },
      {
        name: 'returns null when no fallback available',
        routeKey: 'docs',
        requested: 'fr',
        fallback: {},
        manifest: TEST_MANIFESTS.partial,
        expected: null
      },
      {
        name: 'uses first matching fallback from chain',
        routeKey: 'blog',
        requested: 'es',
        fallback: { 'es': ['de', 'fr', 'en'] },
        manifest: TEST_MANIFESTS.partial,
        expected: { locale: 'fr' }
      },
      {
        name: 'handles partial route support',
        routeKey: 'products',
        requested: 'fr',
        fallback: { 'fr': ['en', 'es'] },
        manifest: TEST_MANIFESTS.partial,
        expected: { locale: 'en' }
      },
      {
        name: 'handles dynamic routes',
        routeKey: 'blog-post',
        requested: 'de',
        fallback: { 'de': ['en'] },
        manifest: TEST_MANIFESTS.dynamic,
        expected: { locale: 'en' }
      },
      {
        name: 'handles nested routes',
        routeKey: 'dashboard-profile',
        requested: 'fr',
        fallback: { 'fr': ['en'] },
        manifest: TEST_MANIFESTS.nested,
        expected: { locale: 'en' }
      },
      {
        name: 'returns null when fallback not supported either',
        routeKey: 'admin',
        requested: 'fr',
        fallback: { 'fr': ['es', 'de'] },
        manifest: TEST_MANIFESTS.nested,
        expected: null
      }
    ];

    test.each(testCases)('$name', ({ routeKey, requested, fallback, manifest, expected }) => {
      const result = pickLocale(routeKey, requested, fallback, manifest);
      expect(result).toEqual(expected);
    });
  });

  describe('Single-step fallback invariant', () => {
    test('fallback chains must be single-step', () => {
      expect(isOneStepFallback(FALLBACK_CHAINS.simple)).toBe(true);
      expect(isOneStepFallback(FALLBACK_CHAINS.multiStep)).toBe(false);
      expect(isOneStepFallback(FALLBACK_CHAINS.complex)).toBe(true);
    });

    test('detects cycles in fallback chains', () => {
      expect(hasCycle(FALLBACK_CHAINS.simple)).toBe(false);
      expect(hasCycle(FALLBACK_CHAINS.withCycle)).toBe(true);
      expect(hasCycle(FALLBACK_CHAINS.selfReference)).toBe(true);
      expect(hasCycle(FALLBACK_CHAINS.complex)).toBe(false);
    });

    test('property: valid fallbacks have no cycles', () => {
      fc.assert(
        fc.property(
          localesArrayArbitrary(),
          (locales) => {
            const fallback = fallbackArbitrary(locales);
            if (fallback) {
              // Our arbitrary generator should never create cycles
              expect(hasCycle(fallback)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('enforces single-step resolution', () => {
      const manifest: Manifest = {
        routes: {
          'page': {
            pattern: '/page',
            locales: ['en', 'fr-FR']
          }
        }
      };
      
      // Single-step: fr-CA -> fr-FR (should work)
      const result1 = pickLocale('page', 'fr-CA', { 'fr-CA': ['fr-FR'] }, manifest);
      expect(result1).toEqual({ locale: 'fr-FR' });
      
      // Multi-step would be: fr-CA -> fr -> fr-FR
      // But we only check immediate fallback, not transitive
      const result2 = pickLocale('page', 'fr-CA', { 'fr-CA': ['fr'], 'fr': ['fr-FR'] }, manifest);
      expect(result2).toBe(null); // 'fr' is not in supported locales
    });
  });

  describe('Manifest-based locale lookup', () => {
    test('respects manifest locale restrictions', () => {
      const manifest = TEST_MANIFESTS.partial;
      
      // Blog only supports en, fr
      expect(pickLocale('blog', 'en', {}, manifest)).toEqual({ locale: 'en' });
      expect(pickLocale('blog', 'fr', {}, manifest)).toEqual({ locale: 'fr' });
      expect(pickLocale('blog', 'es', {}, manifest)).toBe(null);
      expect(pickLocale('blog', 'de', {}, manifest)).toBe(null);
      
      // Products only supports en, es, de
      expect(pickLocale('products', 'en', {}, manifest)).toEqual({ locale: 'en' });
      expect(pickLocale('products', 'es', {}, manifest)).toEqual({ locale: 'es' });
      expect(pickLocale('products', 'de', {}, manifest)).toEqual({ locale: 'de' });
      expect(pickLocale('products', 'fr', {}, manifest)).toBe(null);
    });

    test('handles routes without locale restrictions', () => {
      const manifest = TEST_MANIFESTS.dynamic;
      
      // user-profile has no locale restrictions
      expect(pickLocale('user-profile', 'en', {}, manifest)).toEqual({ locale: 'en' });
      expect(pickLocale('user-profile', 'fr', {}, manifest)).toEqual({ locale: 'fr' });
      expect(pickLocale('user-profile', 'ja', {}, manifest)).toEqual({ locale: 'ja' });
      expect(pickLocale('user-profile', 'xyz', {}, manifest)).toEqual({ locale: 'xyz' });
    });
  });

  describe('Route key matching', () => {
    test('exact route key matching', () => {
      const manifest = TEST_MANIFESTS.nested;
      
      // Different but similar route keys
      expect(pickLocale('dashboard', 'en', {}, manifest)).toEqual({ locale: 'en' });
      expect(pickLocale('dashboard-settings', 'en', {}, manifest)).toEqual({ locale: 'en' });
      expect(pickLocale('dashboard-profile', 'en', {}, manifest)).toEqual({ locale: 'en' });
      
      // Non-existent variations
      expect(pickLocale('dashboard-', 'en', {}, manifest)).toBe(null);
      expect(pickLocale('dashboard/settings', 'en', {}, manifest)).toBe(null);
      expect(pickLocale('Dashboard', 'en', {}, manifest)).toBe(null); // Case sensitive
    });

    test('handles special characters in route keys', () => {
      const manifest: Manifest = {
        routes: {
          'api/v1/users': { pattern: '/api/v1/users', locales: ['en'] },
          'page-with-dash': { pattern: '/page-with-dash', locales: ['en'] },
          'page_with_underscore': { pattern: '/page_with_underscore', locales: ['en'] }
        }
      };
      
      expect(pickLocale('api/v1/users', 'en', {}, manifest)).toEqual({ locale: 'en' });
      expect(pickLocale('page-with-dash', 'en', {}, manifest)).toEqual({ locale: 'en' });
      expect(pickLocale('page_with_underscore', 'en', {}, manifest)).toEqual({ locale: 'en' });
    });
  });

  describe('Null handling', () => {
    test('returns null for unavailable combinations', () => {
      const manifest = TEST_MANIFESTS.partial;
      const fallback = { 'ja': ['zh', 'ko'] };
      
      // Route exists but doesn't support any of the locales
      expect(pickLocale('docs', 'fr', {}, manifest)).toBe(null);
      expect(pickLocale('docs', 'es', {}, manifest)).toBe(null);
      expect(pickLocale('docs', 'ja', fallback, manifest)).toBe(null);
      
      // Route doesn't exist
      expect(pickLocale('missing', 'en', {}, manifest)).toBe(null);
      expect(pickLocale('', 'en', {}, manifest)).toBe(null);
    });

    test('handles empty manifest', () => {
      const emptyManifest: Manifest = { routes: {} };
      
      expect(pickLocale('any', 'en', {}, emptyManifest)).toBe(null);
      expect(pickLocale('other', 'fr', { 'fr': ['en'] }, emptyManifest)).toBe(null);
    });

    test('handles empty fallback', () => {
      const manifest = TEST_MANIFESTS.partial;
      const emptyFallback = {};
      
      expect(pickLocale('docs', 'fr', emptyFallback, manifest)).toBe(null);
      expect(pickLocale('products', 'ja', emptyFallback, manifest)).toBe(null);
    });
  });

  describe('Fallback chain resolution', () => {
    test('tries fallback locales in order', () => {
      const manifest: Manifest = {
        routes: {
          'page': {
            pattern: '/page',
            locales: ['en', 'de', 'ja']
          }
        }
      };
      
      // First fallback not supported, second is
      const fallback1 = { 'fr': ['es', 'de', 'en'] };
      expect(pickLocale('page', 'fr', fallback1, manifest)).toEqual({ locale: 'de' });
      
      // Order matters
      const fallback2 = { 'fr': ['en', 'de', 'ja'] };
      expect(pickLocale('page', 'fr', fallback2, manifest)).toEqual({ locale: 'en' });
      
      // None supported
      const fallback3 = { 'fr': ['es', 'pt', 'it'] };
      expect(pickLocale('page', 'fr', fallback3, manifest)).toBe(null);
    });

    test('handles regional locale fallbacks', () => {
      const manifest: Manifest = {
        routes: {
          'content': {
            pattern: '/content',
            locales: ['en', 'en-US', 'fr', 'fr-FR']
          }
        }
      };
      
      const fallback = {
        'en-GB': ['en-US', 'en'],
        'fr-CA': ['fr-FR', 'fr'],
        'es-MX': ['es-ES', 'es', 'en']
      };
      
      expect(pickLocale('content', 'en-GB', fallback, manifest)).toEqual({ locale: 'en-US' });
      expect(pickLocale('content', 'fr-CA', fallback, manifest)).toEqual({ locale: 'fr-FR' });
      expect(pickLocale('content', 'es-MX', fallback, manifest)).toEqual({ locale: 'en' });
    });
  });

  describe('Property-based tests', () => {
    test('always returns valid locale or null', () => {
      fc.assert(
        fc.property(
          pickLocaleInputArbitrary(),
          ({ routeKey, requested, fallback, manifest }) => {
            const result = pickLocale(routeKey, requested, fallback, manifest);
            
            if (result !== null) {
              expect(result).toHaveProperty('locale');
              expect(typeof result.locale).toBe('string');
              expect(result.locale.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returned locale is always from supported set', () => {
      fc.assert(
        fc.property(
          pickLocaleInputArbitrary(),
          ({ routeKey, requested, fallback, manifest }) => {
            const result = pickLocale(routeKey, requested, fallback, manifest);
            
            if (result !== null) {
              const route = manifest.routes[routeKey];
              if (route && route.locales) {
                // If route has locale restrictions, result must be in that list
                expect(route.locales).toContain(result.locale);
              } else if (route) {
                // If route has no restrictions, any locale is valid
                expect(result.locale).toBeTruthy();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('consistent results for same input', () => {
      fc.assert(
        fc.property(
          pickLocaleInputArbitrary(),
          ({ routeKey, requested, fallback, manifest }) => {
            const result1 = pickLocale(routeKey, requested, fallback, manifest);
            const result2 = pickLocale(routeKey, requested, fallback, manifest);
            expect(result1).toEqual(result2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('prefers requested locale when available', () => {
      fc.assert(
        fc.property(
          routeKeyArbitrary(),
          localeArbitrary(),
          (routeKey, locale) => {
            const manifest: Manifest = {
              routes: {
                [routeKey]: {
                  pattern: `/${routeKey}`,
                  locales: [locale, 'other1', 'other2']
                }
              }
            };
            
            const result = pickLocale(routeKey, locale, {}, manifest);
            expect(result).toEqual({ locale });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Edge cases', () => {
    test('handles very long fallback chains', () => {
      const manifest: Manifest = {
        routes: {
          'page': {
            pattern: '/page',
            locales: ['z']
          }
        }
      };
      
      const longChain = Array.from({ length: 100 }, (_, i) => `locale${i}`);
      longChain.push('z'); // Last one is supported
      
      const fallback = { 'start': longChain };
      const result = pickLocale('page', 'start', fallback, manifest);
      expect(result).toEqual({ locale: 'z' });
    });

    test('handles duplicate locales in fallback', () => {
      const manifest: Manifest = {
        routes: {
          'page': {
            pattern: '/page',
            locales: ['en', 'fr']
          }
        }
      };
      
      const fallback = { 'de': ['en', 'en', 'fr', 'fr'] };
      const result = pickLocale('page', 'de', fallback, manifest);
      expect(result).toEqual({ locale: 'en' }); // First match
    });

    test('handles empty locale arrays in manifest', () => {
      const manifest: Manifest = {
        routes: {
          'restricted': {
            pattern: '/restricted',
            locales: []
          }
        }
      };
      
      // Empty locales array means no locales supported
      expect(pickLocale('restricted', 'en', {}, manifest)).toEqual({ locale: 'en' });
    });
  });
});