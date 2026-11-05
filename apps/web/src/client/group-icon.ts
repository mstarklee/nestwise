export type IconName =
  | 'shield' | 'pot' | 'cake' | 'book' | 'plane' | 'car' | 'wrench' | 'child' | 'food' | 'house'
  | 'bolt' | 'heart' | 'screen' | 'person' | 'savings' | 'tag';

// Ordered: the first match wins. Names, not groups: the forecast's bill lines carry a name but no group.
const TABLE: readonly (readonly [IconName, RegExp])[] = [
  ['shield', /insurance|policy/],
  ['pot', /pongal|deepavali|diwali|festival|tradition/],
  ['cake', /birthday|celebration/],
  ['book', /school|education|tuition/],
  ['plane', /tour|travel|vacation|visit|trip/],
  ['car', /\bcar\b|bike|vehicle|petrol|fuel|servic|transport/],
  ['wrench', /repair|appliance/],
  ['child', /kid|child|play|game|recreation/],
  ['food', /food|grocer|dining|restaurant|fruit|veg/],
  ['house', /hous|rent|home|clean/],
  ['bolt', /utilit|electric|internet|gas|bill/],
  ['heart', /health|medic|ayur/],
  ['screen', /subscri|ott|cloud|learning/],
  ['person', /personal|family|spouse/],
  ['savings', /saving|deposit|gold/],
];

export function iconFor(name: string): IconName {
  const n = name.toLowerCase();
  for (const [icon, re] of TABLE) if (re.test(n)) return icon;
  return 'tag';
}
