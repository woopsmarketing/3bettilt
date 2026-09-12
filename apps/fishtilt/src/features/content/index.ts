/**
 * `features/content` — presentation-side vocabulary for the content graph.
 *
 * `src/content/` holds the records themselves and the graph over them; this holds the words
 * the UI puts on screen for a field that had no reader-facing label before. The barrel is
 * the only import surface a component or page should reach through.
 */
export * from './topic.js';
