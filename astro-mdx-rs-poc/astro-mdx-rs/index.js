import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load WASM module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lazy load WASM to avoid initialization issues
let wasmModule = null;

async function loadWasm() {
  if (!wasmModule) {
    // Import the WASM module from the built package
    wasmModule = await import('../mdx-rs-wasm/pkg/mdx_rs_wasm.js');
  }
  return wasmModule;
}

/**
 * Compile MDX text to JavaScript module
 * @param {string} mdxText - The MDX source text
 * @returns {Promise<string>} - The compiled JavaScript module
 */
export async function compile(mdxText) {
  const wasm = await loadWasm();
  
  try {
    // Call the WASM compile function
    const result = wasm.compile_mdx(mdxText);
    return result;
  } catch (error) {
    throw new Error(`MDX compilation failed: ${error.message}`);
  }
}

// Export default for convenience
export default { compile };