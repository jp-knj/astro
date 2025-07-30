import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let wasmModule: any = null;

export interface CompileOptions {
  filepath?: string;
  development?: boolean;
  jsx?: boolean;
  jsxImportSource?: string;
  jsxRuntime?: 'automatic' | 'classic';
}

export interface CompileResult {
  code: string;
  map?: string;
}

async function loadWasm() {
  if (wasmModule) return wasmModule;

  try {
    // Try to find the WASM module relative to this file
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const wasmPath = join(currentDir, '../../wasm/pkg/mdx_rs_wasm_bg.wasm');
    const wasmBuffer = readFileSync(wasmPath);
    
    // Import the JS bindings
    const wasm = await import('../../wasm/pkg/mdx_rs_wasm.js');
    
    // Initialize the WASM module
    await wasm.default(wasmBuffer);
    wasmModule = wasm;
    
    return wasmModule;
  } catch (error) {
    throw new Error(`Failed to load MDX-RS WASM module: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function compile(source: string, options: CompileOptions = {}): Promise<CompileResult> {
  const wasm = await loadWasm();
  
  try {
    const result = wasm.compile(source, options);
    return result;
  } catch (error) {
    throw new Error(`MDX-RS compilation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Synchronous version for compatibility (loads WASM on first call)
export function compileSync(source: string, options: CompileOptions = {}): CompileResult {
  if (!wasmModule) {
    throw new Error('MDX-RS WASM module not loaded. Call compile() async first or use async API.');
  }
  
  try {
    const result = wasmModule.compile(source, options);
    return result;
  } catch (error) {
    throw new Error(`MDX-RS compilation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Pre-load WASM module
export async function initialize(): Promise<void> {
  await loadWasm();
}