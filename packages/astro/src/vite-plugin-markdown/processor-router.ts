import type { AstroMarkdownProcessorOptions, MarkdownProcessor } from '@astrojs/markdown-remark';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import type { AstroConfig } from '../types/public/config.js';
import type { Logger } from '../core/logger/core.js';
import { createMdxRsProcessor } from './processors/mdx-rs.js';

export interface ProcessorRouterOptions {
  markdownOptions: AstroMarkdownProcessorOptions;
  config: AstroConfig;
  logger: Logger;
}

let jsProcessor: Promise<MarkdownProcessor> | undefined;
let rsProcessor: Promise<MarkdownProcessor> | undefined;

export async function createProcessorRouter(
  options: ProcessorRouterOptions
): Promise<MarkdownProcessor> {
  const { markdownOptions, config, logger } = options;
  
  // If markdownRS is not enabled, use the JS processor
  if (!config.markdownRS) {
    if (!jsProcessor) {
      jsProcessor = createMarkdownProcessor(markdownOptions);
    }
    return jsProcessor;
  }

  // Try to use the RS processor
  try {
    if (!rsProcessor) {
      rsProcessor = createMdxRsProcessor({
        markdownOptions,
        config,
        logger,
      });
    }
    return await rsProcessor;
  } catch (error) {
    // If fallback is enabled and RS processor fails, use JS processor
    if (config.markdownRSOptions?.fallbackToJs !== false) {
      logger.warn(
        'markdown',
        `Failed to initialize MDX-RS processor: ${error instanceof Error ? error.message : String(error)}. Falling back to JavaScript processor.`
      );
      
      if (!jsProcessor) {
        jsProcessor = createMarkdownProcessor(markdownOptions);
      }
      return jsProcessor;
    }
    
    // If fallback is disabled, throw the error
    throw error;
  }
}

export function resetProcessors(): void {
  jsProcessor = undefined;
  rsProcessor = undefined;
}