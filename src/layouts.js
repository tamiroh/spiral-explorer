/* @flow strict */

import type {Layout} from './layout.js';

import {ulam} from './ulam.js';

// Every layout offered in the UI; the first one is the default.
export const LAYOUTS: Array<Layout> = [ulam];
