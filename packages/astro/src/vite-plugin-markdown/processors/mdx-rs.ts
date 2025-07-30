import type { MarkdownProcessor, MarkdownProcessorRenderResult } from '@astrojs/markdown-remark';
import type { AstroConfig } from '../../types/public/config.js';
import type { Logger } from '../../core/logger/core.js';
import type { ProcessorRouterOptions } from '../processor-router.js';

interface MdxRsProcessorOptions {
  markdownOptions: ProcessorRouterOptions['markdownOptions'];
  config: AstroConfig;
  logger: Logger;
}

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await initialize();
    initialized = true;
  }
}

// Temporary stub for mdx-rs integration
// TODO: Import from @astrojs/mdx-rs when the package is built
async function compileMdxRs(_content: string, _options: any): Promise<{ code: string; map?: string }> {
  throw new Error('MDX-RS WASM module not yet built. Run "pnpm build:wasm" in packages/mdx-rs first.');
}

async function initialize(): Promise<void> {
  // TODO: Initialize WASM module
}

export async function createMdxRsProcessor(
  options: MdxRsProcessorOptions
): Promise<MarkdownProcessor> {
  const { logger } = options;
  
  // Ensure WASM module is loaded
  await ensureInitialized();
  
  const processor: MarkdownProcessor = {
    async render(content: string, renderOpts?: any): Promise<MarkdownProcessorRenderResult> {
      const fileURL = renderOpts?.fileURL;
      const frontmatter = renderOpts?.frontmatter || {};
      
      try {
        // Compile MDX using mdx-rs
        const result = await compileMdxRs(content, {
          filepath: fileURL ? fileURL.pathname : undefined,
          development: import.meta.env.DEV,
          jsx: true,
          jsxImportSource: 'astro',
          jsxRuntime: 'automatic',
        });
        
        // Transform the result to match the expected format
        // MDX-RS returns compiled JavaScript code, but we need to extract metadata
        // For now, we'll return a simplified version
        const metadata: MarkdownProcessorRenderResult['metadata'] = {
          headings: [], // TODO: Extract headings from MDX-RS output
          frontmatter,
          localImagePaths: [], // TODO: Extract images from MDX-RS output
          remoteImagePaths: [],
        };
        
        return {
          code: result.code,
          metadata,
        };
      } catch (error) {
        logger.error(
          'markdown',
          `MDX-RS compilation failed: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    },
  };
  
  return processor;
}