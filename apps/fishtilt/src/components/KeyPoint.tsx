/**
 * `KeyPoint` — the "핵심 정리" box: `Callout` in its `key` variant under the name the
 * article component list uses (D-S3-13). One primitive, two names — the second exists so
 * an MDX author writes `<KeyPoint>` and gets the summary treatment without knowing there is
 * a `variant` prop to set.
 */
import { Callout, type CalloutProps } from './Callout.js';

export type KeyPointProps = Omit<CalloutProps, 'variant'>;

const DEFAULT_TITLE = '핵심 정리';

export function KeyPoint({ title = DEFAULT_TITLE, ...rest }: KeyPointProps) {
  return <Callout {...rest} title={title} variant="key" />;
}
