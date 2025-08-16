import fc from 'fast-check';

// Type definitions (conceptual - implementation will provide actual types)
export type Locale = string;
export type Resolution = {
  locale: Locale;
  representation: 'prefix' | 'domain' | 'none';
  reason: string;
};

export type I18nConfig = {
  defaultLocale: Locale;
  locales: Locale[];
  domains?: Record<Locale, string>;
  fallback?: Partial<Record<Locale, Locale[]>>;
  routing?: {
    prefixDefaultLocale?: boolean;
    redirectToDefaultLocale?: boolean;
  };
};

export type Manifest = {
  routes: Record<string, {
    pattern: string;
    locales?: Locale[];
  }>;
};

// Locale arbitraries
export const localeArbitrary = (): fc.Arbitrary<Locale> =>
  fc.oneof(
    fc.constantFrom('en', 'fr', 'es', 'de', 'it', 'pt', 'ja', 'zh', 'ko'),
    fc.constantFrom('en-US', 'en-GB', 'fr-FR', 'fr-CA', 'es-ES', 'es-MX'),
    fc.stringMatching(/^[a-z]{2}(-[A-Z]{2})?$/).filter(s => s.length >= 2 && s.length <= 5)
  );

export const localesArrayArbitrary = (): fc.Arbitrary<Locale[]> =>
  fc.uniqueArray(localeArbitrary(), { minLength: 1, maxLength: 10 });

// URL arbitraries
export const pathSegmentArbitrary = (): fc.Arbitrary<string> =>
  fc.stringMatching(/^[a-zA-Z0-9-_]+$/).filter(s => s.length > 0 && s.length <= 20);

export const pathArbitrary = (): fc.Arbitrary<string> =>
  fc.array(pathSegmentArbitrary(), { minLength: 0, maxLength: 5 })
    .map(segments => '/' + segments.join('/'));

export const queryParamsArbitrary = (): fc.Arbitrary<string> =>
  fc.option(
    fc.dictionary(
      fc.stringMatching(/^[a-zA-Z0-9_]+$/),
      fc.stringMatching(/^[a-zA-Z0-9-_]+$/),
      { minKeys: 0, maxKeys: 3 }
    ).map(params => {
      const entries = Object.entries(params);
      return entries.length > 0
        ? '?' + entries.map(([k, v]) => `${k}=${v}`).join('&')
        : '';
    }),
    { nil: '' }
  );

export const urlArbitrary = (): fc.Arbitrary<URL> =>
  fc.tuple(
    fc.constantFrom('http', 'https'),
    fc.constantFrom('example.com', 'test.org', 'app.io', 'site.dev'),
    fc.option(fc.integer({ min: 3000, max: 9000 }), { nil: undefined }),
    pathArbitrary(),
    queryParamsArbitrary()
  ).map(([protocol, domain, port, path, query]) => {
    const portStr = port ? `:${port}` : '';
    return new URL(`${protocol}://${domain}${portStr}${path}${query}`);
  });

// Context arbitraries
export const cookieArbitrary = (): fc.Arbitrary<string | undefined> =>
  fc.option(
    fc.tuple(localeArbitrary()).map(([locale]) => `locale=${locale}`),
    { freq: 50 }
  );

export const acceptLanguageArbitrary = (): fc.Arbitrary<string | undefined> =>
  fc.option(
    fc.array(
      fc.tuple(
        localeArbitrary(),
        fc.option(fc.float({ min: 0.1, max: 1.0, noNaN: true }), { nil: undefined })
      ),
      { minLength: 1, maxLength: 5 }
    ).map(locales =>
      locales.map(([locale, q]) =>
        q !== undefined ? `${locale};q=${q.toFixed(1)}` : locale
      ).join(', ')
    ),
    { freq: 50 }
  );

export const contextArbitrary = (): fc.Arbitrary<{ cookie?: string; al?: string }> =>
  fc.record({
    cookie: cookieArbitrary(),
    al: acceptLanguageArbitrary()
  });

// I18n Config arbitraries
export const fallbackArbitrary = (locales: Locale[]): fc.Arbitrary<Partial<Record<Locale, Locale[]>> | undefined> =>
  fc.option(
    fc.dictionary(
      fc.constantFrom(...locales),
      fc.shuffledSubarray(locales, { minLength: 1, maxLength: Math.min(3, locales.length - 1) }),
      { minKeys: 0, maxKeys: Math.min(5, locales.length) }
    ).filter(fallback => {
      // Ensure no self-references or cycles
      for (const [locale, targets] of Object.entries(fallback)) {
        if (targets.includes(locale)) return false;
      }
      return true;
    }),
    { freq: 70 }
  );

export const domainsArbitrary = (locales: Locale[]): fc.Arbitrary<Record<Locale, string> | undefined> =>
  fc.option(
    fc.dictionary(
      fc.constantFrom(...locales),
      fc.tuple(
        fc.constantFrom('http', 'https'),
        fc.stringMatching(/^[a-z0-9-]+\.[a-z]{2,}$/)
      ).map(([protocol, domain]) => `${protocol}://${domain}`),
      { minKeys: 0, maxKeys: Math.min(5, locales.length) }
    ),
    { freq: 30 }
  );

export const i18nConfigArbitrary = (): fc.Arbitrary<I18nConfig> =>
  localesArrayArbitrary().chain(locales =>
    fc.record({
      defaultLocale: fc.constantFrom(...locales),
      locales: fc.constant(locales),
      domains: domainsArbitrary(locales),
      fallback: fallbackArbitrary(locales),
      routing: fc.option(
        fc.record({
          prefixDefaultLocale: fc.boolean(),
          redirectToDefaultLocale: fc.boolean()
        }),
        { freq: 80 }
      )
    })
  );

// Resolution arbitraries
export const resolutionArbitrary = (config: I18nConfig): fc.Arbitrary<Resolution> =>
  fc.record({
    locale: fc.constantFrom(...config.locales),
    representation: fc.constantFrom<'prefix' | 'domain' | 'none'>('prefix', 'domain', 'none'),
    reason: fc.constantFrom(
      'url-prefix',
      'cookie',
      'accept-language',
      'domain',
      'default',
      'fallback'
    )
  });

// Route key arbitraries
export const routeKeyArbitrary = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constantFrom('home', 'about', 'contact', 'blog', 'products'),
    fc.tuple(
      fc.constantFrom('blog', 'products', 'docs'),
      fc.stringMatching(/^[a-z0-9-]+$/).filter(s => s.length > 0 && s.length <= 20)
    ).map(([prefix, suffix]) => `${prefix}/${suffix}`),
    fc.stringMatching(/^[a-z0-9/\-]+$/).filter(s => s.length > 0 && s.length <= 50)
  );

// Manifest arbitraries
export const manifestArbitrary = (locales: Locale[]): fc.Arbitrary<Manifest> =>
  fc.array(
    fc.tuple(
      routeKeyArbitrary(),
      fc.record({
        pattern: fc.stringMatching(/^\/[a-z0-9/\[\]\-]*$/),
        locales: fc.option(
          fc.shuffledSubarray(locales, { minLength: 1 }),
          { freq: 70 }
        )
      })
    ),
    { minLength: 1, maxLength: 20 }
  ).map(entries => ({
    routes: Object.fromEntries(entries)
  }));

// Composite arbitraries for property testing
export const canonicalizeInputArbitrary = (): fc.Arbitrary<{
  url: URL;
  resolution: Resolution;
  config: I18nConfig;
}> =>
  i18nConfigArbitrary().chain(config =>
    fc.record({
      url: urlArbitrary(),
      resolution: resolutionArbitrary(config),
      config: fc.constant(config)
    })
  );

export const pickLocaleInputArbitrary = (): fc.Arbitrary<{
  routeKey: string;
  requested: Locale;
  fallback: Partial<Record<Locale, Locale[]>>;
  manifest: Manifest;
}> =>
  localesArrayArbitrary().chain(locales =>
    fc.record({
      routeKey: routeKeyArbitrary(),
      requested: fc.constantFrom(...locales),
      fallback: fallbackArbitrary(locales) || {},
      manifest: manifestArbitrary(locales)
    })
  );

export const hrefInputArbitrary = (): fc.Arbitrary<{
  routeKey: string;
  opts: {
    params?: Record<string, string>;
    locale?: Locale;
    canonical?: boolean;
  };
  config: I18nConfig;
}> =>
  i18nConfigArbitrary().chain(config =>
    fc.record({
      routeKey: routeKeyArbitrary(),
      opts: fc.record({
        params: fc.option(
          fc.dictionary(
            fc.stringMatching(/^[a-zA-Z0-9_]+$/),
            fc.stringMatching(/^[a-zA-Z0-9-_]+$/),
            { minKeys: 0, maxKeys: 3 }
          ),
          { freq: 50 }
        ),
        locale: fc.option(fc.constantFrom(...config.locales), { freq: 70 }),
        canonical: fc.option(fc.boolean(), { freq: 30 })
      }),
      config: fc.constant(config)
    })
  );