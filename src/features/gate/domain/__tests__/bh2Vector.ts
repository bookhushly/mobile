import type { TicketKey } from '@/features/gate/domain/bh2';

export const BH2_PUB = '6kpsY-KcUgq-9VB7Ey7F-ZVHdq6-vnuSQh7qaRRG0iw';
export const BH2_AT = 1_700_000_000_000;
export const BH2_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
export const BH2_TOKEN =
  'BH2.t.PyUE4E-JEdOaDAMF6CwzAQ.xqka2.scN75wRuNrd4H0BDHL5n7_CtEpOIKFpryKIt24lKOBgrv5ZBmiOQJNQh8Mgm7CCYxyO0DbhkKTOKRvF0W3FwDw';
// The same token with one signature character flipped in the middle (web says bad_signature).
export const BH2_BAD_SIG =
  'BH2.t.PyUE4E-JEdOaDAMF6CwzAQ.xqka2.scN75wRuNrd4H0BDHL5n7_CtEpOIKFpryKIt24lKABgrv5ZBmiOQJNQh8Mgm7CCYxyO0DbhkKTOKRvF0W3FwDw';
export const BH2_KEYS: TicketKey[] = [{ kid: 't', publicKey: BH2_PUB }];
