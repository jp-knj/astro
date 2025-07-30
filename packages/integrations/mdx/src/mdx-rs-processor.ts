import type { VFile } from 'vfile';
// TODO: Import from '@astrojs/mdx-rs' when the package is built
// For now, we'll create a stub
import type { VitePluginMdxOptions } from './vite-plugin-mdx.js';

let initialized = false;

// Temporary stub for mdx-rs integration
async function compileMdxRs(_content: string, _options: any): Promise<{ code: string; map?: string }> {
  throw new Error('MDX-RS WASM module not yet built. Run "pnpm build:wasm" in packages/mdx-rs first.');
}

async function initialize(): Promise<void> {
  // TODO: Initialize WASM module when available
}

async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await initialize();
    initialized = true;
  }
}

export async function createMdxRsProcessor(_opts: VitePluginMdxOptions) {
  await ensureInitialized();
  
  return {
    async process(vfile: VFile): Promise<VFile> {
      const { value, path } = vfile;
      
      try {
        const result = await compileMdxRs(String(value), {
          filepath: path,
          development: process.env.NODE_ENV !== 'production',
          jsx: true,
          jsxImportSource: 'astro',
          jsxRuntime: 'automatic',
        });
        
        // Update vfile with compiled result
        vfile.value = result.code;
        // TODO: Handle source map properly when available
        // vfile.map = result.map;
        
        // Set metadata that MDX expects
        vfile.data.astro = vfile.data.astro || {};
        
        return vfile;
      } catch (error) {
        const err = error as any;
        err.file = path;
        throw err;
      }
    }
  };
}