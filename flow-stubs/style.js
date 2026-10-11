/* @flow strict */

// Stand-in for stylesheet imports, which Vite handles at build time. A CSS
// module exports its class names; a plain stylesheet exports nothing useful.
export default {} as {readonly [className: string]: string};
