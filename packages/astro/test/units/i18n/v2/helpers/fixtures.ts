import type { I18nConfig, Locale, Manifest, Resolution } from './arbitraries';

// Common locale configurations
export const COMMON_LOCALES = {
  simple: ['en', 'fr', 'es', 'de'],
  withRegions: ['en-US', 'en-GB', 'fr-FR', 'fr-CA', 'es-ES', 'es-MX'],
  mixed: ['en', 'en-US', 'fr', 'fr-CA', 'es', 'de', 'ja', 'zh-CN'],
  minimal: ['en', 'fr'],
  extensive: ['en', 'fr', 'es', 'de', 'it', 'pt', 'ja', 'zh', 'ko', 'ar', 'ru', 'nl']
};

// Sample I18n configurations
export const CONFIGS: Record<string, I18nConfig> = {
  basic: {
    defaultLocale: 'en',
    locales: COMMON_LOCALES.simple,
  },

  withFallback: {
    defaultLocale: 'en',
    locales: COMMON_LOCALES.withRegions,
    fallback: {
      'fr-CA': ['fr-FR', 'en'],
      'es-MX': ['es-ES', 'en'],
      'en-GB': ['en-US']
    }
  },

  withDomains: {
    defaultLocale: 'en',
    locales: COMMON_LOCALES.simple,
    domains: {
      'en': 'https://example.com',
      'fr': 'https://example.fr',
      'es': 'https://example.es',
      'de': 'https://example.de'
    }
  },

  withRouting: {
    defaultLocale: 'en',
    locales: COMMON_LOCALES.simple,
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: true
    }
  },

  alwaysPrefix: {
    defaultLocale: 'en',
    locales: COMMON_LOCALES.simple,
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true
    }
  },

  noRedirect: {
    defaultLocale: 'en',
    locales: COMMON_LOCALES.simple,
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false
    }
  },

  complex: {
    defaultLocale: 'en-US',
    locales: COMMON_LOCALES.mixed,
    domains: {
      'en': 'https://www.example.com',
      'en-US': 'https://us.example.com',
      'fr': 'https://fr.example.com',
      'fr-CA': 'https://ca.example.com',
      'ja': 'https://jp.example.com',
      'zh-CN': 'https://cn.example.com'
    },
    fallback: {
      'en-US': ['en'],
      'fr-CA': ['fr', 'en'],
      'es': ['en'],
      'de': ['en'],
      'ja': ['en'],
      'zh-CN': ['en']
    },
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: true
    }
  }
};

// Sample URLs for testing
export const TEST_URLS = {
  root: new URL('https://example.com/'),
  withPrefix: new URL('https://example.com/fr/'),
  withPath: new URL('https://example.com/about'),
  withPrefixAndPath: new URL('https://example.com/fr/about'),
  withQuery: new URL('https://example.com/products?id=123'),
  withPrefixAndQuery: new URL('https://example.com/es/products?id=123&lang=es'),
  withHash: new URL('https://example.com/docs#section'),
  withPrefixAndHash: new URL('https://example.com/de/docs#section'),
  complex: new URL('https://example.com/en-US/blog/post-123?ref=home#comments'),
  subdomain: new URL('https://fr.example.com/'),
  subdomainWithPath: new URL('https://fr.example.com/about'),
  customPort: new URL('http://localhost:3000/'),
  customPortWithPrefix: new URL('http://localhost:3000/ja/products')
};

// Sample resolutions for testing
export const TEST_RESOLUTIONS: Record<string, Resolution> = {
  urlPrefix: {
    locale: 'fr',
    representation: 'prefix',
    reason: 'url-prefix'
  },
  
  cookie: {
    locale: 'es',
    representation: 'none',
    reason: 'cookie'
  },
  
  acceptLanguage: {
    locale: 'de',
    representation: 'none',
    reason: 'accept-language'
  },
  
  domain: {
    locale: 'fr',
    representation: 'domain',
    reason: 'domain'
  },
  
  default: {
    locale: 'en',
    representation: 'none',
    reason: 'default'
  },
  
  fallback: {
    locale: 'en',
    representation: 'prefix',
    reason: 'fallback'
  }
};

// Sample contexts for testing
export const TEST_CONTEXTS = {
  empty: {},
  
  withCookie: {
    cookie: 'locale=fr'
  },
  
  withAcceptLanguage: {
    al: 'fr-FR,fr;q=0.9,en;q=0.8'
  },
  
  withBoth: {
    cookie: 'locale=es',
    al: 'fr-FR,fr;q=0.9,en;q=0.8'
  },
  
  complexAcceptLanguage: {
    al: 'fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5'
  },
  
  wildcardAcceptLanguage: {
    al: '*'
  }
};

// Sample manifests for testing
export const TEST_MANIFESTS: Record<string, Manifest> = {
  simple: {
    routes: {
      'home': {
        pattern: '/',
        locales: ['en', 'fr', 'es', 'de']
      },
      'about': {
        pattern: '/about',
        locales: ['en', 'fr', 'es', 'de']
      },
      'contact': {
        pattern: '/contact',
        locales: ['en', 'fr', 'es']
      }
    }
  },
  
  partial: {
    routes: {
      'home': {
        pattern: '/',
        locales: ['en', 'fr', 'es', 'de']
      },
      'blog': {
        pattern: '/blog',
        locales: ['en', 'fr']
      },
      'products': {
        pattern: '/products',
        locales: ['en', 'es', 'de']
      },
      'docs': {
        pattern: '/docs',
        locales: ['en']
      }
    }
  },
  
  dynamic: {
    routes: {
      'home': {
        pattern: '/'
      },
      'blog-post': {
        pattern: '/blog/[slug]',
        locales: ['en', 'fr', 'es']
      },
      'product-detail': {
        pattern: '/products/[id]',
        locales: ['en', 'fr', 'es', 'de']
      },
      'user-profile': {
        pattern: '/users/[username]'
      }
    }
  },
  
  nested: {
    routes: {
      'dashboard': {
        pattern: '/dashboard',
        locales: ['en', 'fr']
      },
      'dashboard-settings': {
        pattern: '/dashboard/settings',
        locales: ['en', 'fr']
      },
      'dashboard-profile': {
        pattern: '/dashboard/profile',
        locales: ['en']
      },
      'admin': {
        pattern: '/admin',
        locales: ['en']
      },
      'admin-users': {
        pattern: '/admin/users',
        locales: ['en']
      }
    }
  }
};

// Edge case URLs for testing
export const EDGE_CASE_URLS = {
  emptyPath: new URL('https://example.com'),
  doubleSlash: new URL('https://example.com//'),
  trailingSlash: new URL('https://example.com/fr/'),
  noTrailingSlash: new URL('https://example.com/fr'),
  encodedChars: new URL('https://example.com/caf%C3%A9'),
  multipleSlashes: new URL('https://example.com///fr///about///'),
  veryLongPath: new URL('https://example.com/' + 'a/'.repeat(50)),
  specialChars: new URL('https://example.com/page-with-dash_and_underscore'),
  numbersInPath: new URL('https://example.com/2024/01/15/post'),
  mixedCase: new URL('https://example.com/Fr/About'), // Should be normalized
};

// Fallback chain test cases
export const FALLBACK_CHAINS = {
  simple: {
    'fr-CA': ['fr-FR'],
    'es-MX': ['es-ES']
  },
  
  multiStep: {
    'fr-CA': ['fr-FR', 'en'],
    'es-MX': ['es-ES', 'en'],
    'de-AT': ['de-DE', 'en']
  },
  
  // Invalid - contains cycle (for negative testing)
  withCycle: {
    'fr': ['es'],
    'es': ['de'],
    'de': ['fr']
  },
  
  // Invalid - self-reference (for negative testing)
  selfReference: {
    'fr': ['fr', 'en']
  },
  
  complex: {
    'en-GB': ['en-US'],
    'en-AU': ['en-GB'],
    'en-NZ': ['en-AU'],
    'fr-CA': ['fr-FR'],
    'fr-BE': ['fr-FR'],
    'fr-CH': ['fr-FR'],
    'es-MX': ['es-ES'],
    'es-AR': ['es-ES'],
    'pt-BR': ['pt-PT'],
    'zh-TW': ['zh-CN']
  }
};

// Route key test cases
export const TEST_ROUTE_KEYS = {
  simple: ['home', 'about', 'contact', 'blog', 'products'],
  nested: ['blog/post', 'products/category', 'docs/api/reference'],
  dynamic: ['blog/[slug]', 'products/[id]', 'users/[username]/profile'],
  mixed: ['blog/2024/[month]/[slug]', 'shop/[category]/[product]'],
  special: ['api/v1/users', 'auth/login', 'auth/logout', 'admin/dashboard']
};

// Test parameters for href generation
export const TEST_HREF_PARAMS = {
  empty: {},
  simple: { id: '123' },
  multiple: { category: 'electronics', id: '456', sort: 'price' },
  encoded: { query: 'hello world', tag: 'c++' },
  special: { email: 'user@example.com', path: '/nested/path' }
};

// Helper function to create test scenarios
export function createTestScenario(
  name: string,
  config: I18nConfig,
  url: URL,
  context: { cookie?: string; al?: string } = {},
  expected: Partial<Resolution>
): { name: string; config: I18nConfig; url: URL; context: typeof context; expected: Partial<Resolution> } {
  return { name, config, url, context, expected };
}

// Common test scenarios
export const COMMON_SCENARIOS = [
  createTestScenario(
    'Default locale without prefix',
    CONFIGS.withRouting,
    TEST_URLS.withPath,
    {},
    { locale: 'en', representation: 'none' }
  ),
  
  createTestScenario(
    'Non-default locale with prefix',
    CONFIGS.withRouting,
    TEST_URLS.withPrefixAndPath,
    {},
    { locale: 'fr', representation: 'prefix' }
  ),
  
  createTestScenario(
    'Cookie overrides URL',
    CONFIGS.basic,
    TEST_URLS.withPath,
    TEST_CONTEXTS.withCookie,
    { locale: 'fr', representation: 'none', reason: 'cookie' }
  ),
  
  createTestScenario(
    'Domain-based resolution',
    CONFIGS.withDomains,
    new URL('https://example.fr/about'),
    {},
    { locale: 'fr', representation: 'domain', reason: 'domain' }
  ),
  
  createTestScenario(
    'Accept-Language fallback',
    CONFIGS.basic,
    TEST_URLS.root,
    TEST_CONTEXTS.withAcceptLanguage,
    { locale: 'fr', representation: 'none', reason: 'accept-language' }
  ),
  
  createTestScenario(
    'Always prefix default locale',
    CONFIGS.alwaysPrefix,
    TEST_URLS.root,
    {},
    { locale: 'en', representation: 'prefix' }
  )
];