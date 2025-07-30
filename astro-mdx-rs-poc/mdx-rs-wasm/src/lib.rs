use wasm_bindgen::prelude::*;
use mdxjs::{compile, Options};

#[wasm_bindgen]
pub fn compile_mdx(source: &str) -> Result<String, JsValue> {
    let mut options = Options::default();
    
    // Set JSX import source to 'astro' for Astro compatibility
    options.jsx_import_source = Some("astro".to_string());
    
    // Compile MDX to JavaScript module
    match compile(source, &options) {
        Ok(result) => {
            // Wrap the compiled output to match Astro's expected format
            let wrapped = format!(
                r#"
import {{ jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment }} from 'astro/jsx-runtime';

{}

// Mark as MDX component for Astro
MDXContent[Symbol.for('mdx-component')] = true;

// Export frontmatter (will be injected by Vite plugin)
export const frontmatter = {{}};

export default MDXContent;
"#,
                result
            );
            Ok(wrapped)
        }
        Err(e) => Err(JsValue::from_str(&format!("MDX compilation error: {}", e))),
    }
}