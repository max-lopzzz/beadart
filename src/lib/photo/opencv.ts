// OpenCvModule is intentionally loosely typed: @techstark/opencv-js's shipped
// types cover most of the OpenCV API but not every method this plan uses, and
// this whole module is a browser/WASM adapter with no automated test coverage
// (see Global Constraints) — callers should treat it as `any`-shaped and rely
// on manual verification, not the type checker, to catch misuse here.
type OpenCvModule = typeof import('@techstark/opencv-js');

let cvPromise: Promise<OpenCvModule> | null = null;

export function loadOpenCv(): Promise<OpenCvModule> {
  if (!cvPromise) {
    cvPromise = import('@techstark/opencv-js').then(
      (mod) =>
        new Promise<OpenCvModule>((resolve) => {
          const cv = (mod as { default?: OpenCvModule }).default ?? (mod as unknown as OpenCvModule);
          // Some builds finish initializing before this callback is even
          // attached (e.g. if a previous call already resolved cvPromise and
          // the WASM runtime was cached); guard for that rather than hanging.
          if ((cv as unknown as { Mat?: unknown }).Mat) {
            resolve(cv);
          } else {
            (cv as unknown as { onRuntimeInitialized: () => void }).onRuntimeInitialized = () =>
              resolve(cv);
          }
        }),
    );
  }
  return cvPromise;
}
