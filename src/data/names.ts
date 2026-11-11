import type { Rng } from '../game/rng';

/** Kid-friendly panda names: lowercase, letters only, ≤ 12 letters. */
export const RANDOM_NAMES: string[] = [
  'bao', 'mochi', 'pip', 'sunny', 'dumpling', 'maple', 'bamboo', 'biscuit', 'button', 'cocoa',
  'cookie', 'daisy', 'fuzzy', 'ginger', 'honey', 'jelly', 'kiwi', 'lemon', 'lulu', 'mango',
  'marble', 'meimei', 'mimi', 'muffin', 'noodle', 'nori', 'olive', 'panko', 'peach', 'peanut',
  'pebble', 'pepper', 'pixel', 'pudding', 'puffin', 'pumpkin', 'rosie', 'sesame', 'sprout', 'sushi',
  'taro', 'tofu', 'toffee', 'waffle', 'willow', 'yuki', 'zippy', 'bean', 'berry', 'bubbles',
  'butterscotch', 'caramel', 'clover', 'coco', 'cupcake', 'dot', 'dango', 'fig', 'fluffy', 'fudge',
  'gizmo', 'gumdrop', 'hazel', 'hugo', 'ivy', 'jasper', 'jojo', 'juju', 'kai', 'kiki',
  'koko', 'latte', 'lily', 'luna', 'mabel', 'milo', 'minty', 'misty', 'momo', 'moss',
  'nacho', 'nutmeg', 'oreo', 'ollie', 'otto', 'pancake', 'penny', 'pippa', 'poppy', 'pretzel',
  'quincy', 'rascal', 'ricky', 'rolo', 'ruby', 'sage', 'sandy', 'scout', 'snowy', 'sparkle',
  'sprinkles', 'squish', 'sundae', 'tango', 'teddy', 'tilly', 'tinker', 'toby', 'truffle', 'twinkle',
  'wiggles', 'winnie', 'wombat', 'yoyo', 'ziggy', 'zuzu', 'acorn', 'blossom', 'breezy', 'cherry',
  'cloud', 'comet', 'dewdrop', 'ember', 'fern', 'flicker', 'gigi', 'happy', 'jade', 'moon',
  'pearl', 'petal', 'rain', 'star', 'sky', 'wisp',
];

export function randomName(rng: Rng): string {
  return RANDOM_NAMES[Math.floor(rng() * RANDOM_NAMES.length)];
}
