// Web3 1.10.4 is loaded as a classic browser script in index.html.
// This avoids Vite treating its UMD bundle as an ES module.
const Web3 = globalThis.Web3;
if (typeof Web3 !== 'function') {
  throw new Error('Web3 browser bundle failed to initialize.');
}
export default Web3;
