import { compile } from './index.js';
import matter from 'gray-matter';

/**
 * Vite plugin for transforming MDX files using mdx-rs WASM
 * @returns {import('vite').Plugin}
 */
export function vitePluginMdxRs() {
  return {
    name: 'astro:mdx-rs',
    enforce: 'pre',
    
    async transform(code, id) {
      // Only process .mdx files
      if (!id.endsWith('.mdx')) return;
      
      // Parse frontmatter
      const { data: frontmatter, content } = matter(code);
      
      try {
        // Compile MDX using WASM
        let compiled = await compile(content);
        
        // Inject frontmatter into the compiled output
        // Replace the empty frontmatter export with actual data
        compiled = compiled.replace(
          'export const frontmatter = {};',
          `export const frontmatter = ${JSON.stringify(frontmatter)};`
        );
        
        // Add metadata for Astro
        const meta = {
          astro: {
            frontmatter,
            source: content,
            sourcemap: false
          },
          vite: {
            lang: 'ts'
          }
        };
        
        return {
          code: compiled,
          map: null,
          meta
        };
      } catch (error) {
        // Format error for better display
        const err = new Error(error.message);
        err.id = id;
        err.name = 'MDXError';
        throw err;
      }
    }
  };
}

export default vitePluginMdxRs;