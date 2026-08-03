// OpenCvModule is intentionally loosely typed: this whole module is a
// browser/WASM adapter with no automated test coverage (see Global
// Constraints) — callers should treat it as `any`-shaped and rely on manual
// verification, not the type checker, to catch misuse here.
type OpenCvModule = any;

// Loaded via a plain <script> tag against the vendored /opencv.js static
// asset (see public/opencv.js), NOT via `import('@techstark/opencv-js')`.
// A dynamic import of that package hangs indefinitely when it goes through
// Vite's dependency pre-bundling (esbuild) — the Emscripten-generated
// UMD/CJS glue code's Node-vs-browser environment detection appears to
// misfire under esbuild's CJS interop shims (Vite's build step separately
// externalizes this package's `fs`/`path`/`crypto` requires for browser
// compatibility, which are consistent with it taking a broken Node-style
// code path). Loading the same file via a real <script> tag — bypassing
// the bundler's module system entirely — was verified to work reliably.
const OPENCV_SCRIPT_URL = '/opencv.js';

let cvPromise: Promise<OpenCvModule> | null = null;

export function loadOpenCv(): Promise<OpenCvModule> {
  if (!cvPromise) {
    cvPromise = new Promise<OpenCvModule>((resolve, reject) => {
      const existing = (window as unknown as { cv?: OpenCvModule }).cv;
      if (existing && existing.Mat) {
        resolve(existing);
        return;
      }

      const script = document.createElement('script');
      script.src = OPENCV_SCRIPT_URL;
      script.onerror = () => reject(new Error(`loadOpenCv: failed to load ${OPENCV_SCRIPT_URL}`));
      script.onload = () => {
        const cv = (window as unknown as { cv?: OpenCvModule }).cv;
        if (!cv) {
          reject(new Error('loadOpenCv: script loaded but did not set window.cv'));
          return;
        }
        if (cv.Mat) {
          resolve(cv);
        } else {
          cv.onRuntimeInitialized = () => resolve(cv);
        }
      };
      document.head.appendChild(script);
    });
  }
  return cvPromise;
}
