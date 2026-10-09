import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { defineCollection } from '../../../dist/content/config.js';
import { ContentLayer } from '../../../dist/content/content-layer.js';
import { CONTENT_IMAGE_RESOLVER } from '../../../dist/content/image.js';
import { MutableDataStore } from '../../../dist/content/mutable-data-store.js';
import { AstroLogger } from '../../../dist/core/logger/core.js';
import { createMinimalSettings, createTempDir, createTestConfigObserver } from './test-helpers.ts';

/**
 * `image()` reads its resolver off the schema context, which the content layer builds per
 * entry. These check that each sync hands its entries its own resolver, including when syncs
 * from separate `ContentLayer` instances overlap, and that nothing is installed globally.
 */

/** A Vite server stub that records which server a resolver went through. */
function createFakeViteServer(name: string, calls: string[]): any {
	return {
		environments: {
			ssr: {
				pluginContainer: {
					resolveId: async () => {
						calls.push(name);
						return null;
					},
				},
			},
		},
	};
}

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

/**
 * A layer with one entry whose schema function captures the resolver from its context.
 * `beforeParse` runs inside the loader, so callers can hold the sync open.
 */
function createLayer(
	onResolver: (resolver: unknown) => void,
	viteServer?: any,
	beforeParse: () => Promise<void> = async () => {},
) {
	return new ContentLayer({
		settings: createMinimalSettings(createTempDir()),
		logger: new AstroLogger({ destination: { write: () => true }, level: 'silent' }),
		store: new MutableDataStore(),
		contentConfigObserver: createTestConfigObserver({
			posts: defineCollection({
				loader: {
					name: 'test',
					load: async (context: any) => {
						await beforeParse();
						await context.parseData({ id: 'one', data: { title: 'One' }, filePath: '/one.md' });
					},
				},
				schema: (context: any) => {
					onResolver(context[CONTENT_IMAGE_RESOLVER]);
					return z.object({ title: z.string() });
				},
			}),
		}),
		viteServer,
	});
}

describe('Content Layer - image resolver scope', () => {
	it('passes a resolver to the schema context when there is a vite server', async () => {
		const calls: string[] = [];
		let resolver: any;
		await createLayer(
			(r) => {
				resolver = r;
			},
			createFakeViteServer('a', calls),
		).sync();

		assert.equal(typeof resolver, 'function');
		await resolver('~/cover.png', '/one.md');
		assert.deepEqual(calls, ['a']);
		assert.equal((globalThis as any).astroAsset?.contentImageResolver, undefined);
	});

	it('passes no resolver when there is no vite server', async () => {
		let resolver: unknown = 'unset';
		await createLayer((r) => {
			resolver = r;
		}).sync();

		assert.equal(resolver, undefined);
	});

	it('keeps overlapping syncs on their own resolvers', async () => {
		const calls: string[] = [];
		const firstStarted = deferred();
		const secondStarted = deferred();
		let firstResolver: any;
		let secondResolver: any;

		// The first sync only parses once the second is in flight, so the two overlap.
		const first = createLayer(
			(r) => {
				firstResolver = r;
			},
			createFakeViteServer('first', calls),
			async () => {
				firstStarted.resolve();
				await secondStarted.promise;
			},
		);
		const second = createLayer(
			(r) => {
				secondResolver = r;
			},
			createFakeViteServer('second', calls),
			async () => {
				secondStarted.resolve();
			},
		);

		const firstSync = first.sync();
		await firstStarted.promise;
		await Promise.all([firstSync, second.sync()]);

		await firstResolver('~/a.png', '/one.md');
		await secondResolver('~/b.png', '/one.md');
		assert.deepEqual(calls, ['first', 'second']);
	});
});
