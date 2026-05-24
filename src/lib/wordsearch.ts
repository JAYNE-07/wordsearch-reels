// Word-search grid carved from a themed word pool.
//
// 18x18 grid. Words placed in 4 directions: → ↓ ↘ ↗. No reversed.
// Letter conflicts reject a placement; up to 200 attempts per word.
// Empty cells get random uppercase letters seeded from the same PRNG.

export type Dir = 0 | 1 | 2 | 3; // 0=→, 1=↓, 2=↘, 3=↗
export interface Placement {
  word: string;
  row: number;
  col: number;
  dir: Dir;
}

export interface WordSearch {
  grid: string[][];
  placements: Placement[];
  placed: string[];
  cols: number;
  rows: number;
}

const DIRS: Array<{ dr: number; dc: number }> = [
  { dr: 0, dc: 1 },   // → horizontal
  { dr: 1, dc: 0 },   // ↓ vertical
  { dr: 1, dc: 1 },   // ↘ diagonal down-right
  { dr: -1, dc: 1 },  // ↗ diagonal up-right
];

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function placeWords(
  words: string[],
  cols: number,
  rows: number,
  seed: number,
): WordSearch {
  const rng = mulberry32(seed);
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ''),
  );
  const placements: Placement[] = [];
  const placed: string[] = [];

  for (const raw of words) {
    const word = raw.toUpperCase();
    if (word.length < 2 || word.length > Math.max(cols, rows)) continue;

    let success = false;
    for (let attempt = 0; attempt < 200 && !success; attempt++) {
      const dir = Math.floor(rng() * 4) as Dir;
      const { dr, dc } = DIRS[dir];

      // valid origin ranges per direction
      const minR = dr === -1 ? word.length - 1 : 0;
      const maxR = dr === 1 ? rows - word.length : rows - 1;
      const minC = 0;
      const maxC = dc === 1 ? cols - word.length : cols - 1;
      if (maxR < minR || maxC < minC) continue;

      const r0 = minR + Math.floor(rng() * (maxR - minR + 1));
      const c0 = minC + Math.floor(rng() * (maxC - minC + 1));

      // check conflicts
      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const r = r0 + dr * i;
        const c = c0 + dc * i;
        const existing = grid[r][c];
        if (existing && existing !== word[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      // commit
      for (let i = 0; i < word.length; i++) {
        const r = r0 + dr * i;
        const c = c0 + dc * i;
        grid[r][c] = word[i];
      }
      placements.push({ word, row: r0, col: c0, dir });
      placed.push(word);
      success = true;
    }
  }

  // Fill empty cells with random uppercase letters.
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) {
        grid[r][c] = A[Math.floor(rng() * 26)];
      }
    }
  }

  return { grid, placements, placed, cols, rows };
}

// ------- themed word pools -------

const THEMES: Record<string, string[]> = {
  animals: [
    'LION', 'TIGER', 'BEAR', 'WOLF', 'FOX', 'DEER', 'ELEPHANT', 'GIRAFFE',
    'ZEBRA', 'MONKEY', 'PANDA', 'KOALA', 'RABBIT', 'SQUIRREL', 'HORSE',
    'COW', 'PIG', 'SHEEP', 'GOAT', 'DUCK', 'CHICKEN', 'EAGLE', 'OWL',
    'PARROT', 'PENGUIN', 'DOLPHIN', 'WHALE', 'SHARK', 'OCTOPUS', 'CROCODILE',
    'SNAKE', 'TURTLE', 'FROG', 'CAMEL', 'KANGAROO', 'CHEETAH',
  ],
  fruits: [
    'APPLE', 'BANANA', 'ORANGE', 'GRAPE', 'PEACH', 'PEAR', 'PLUM', 'MANGO',
    'LEMON', 'LIME', 'CHERRY', 'BERRY', 'MELON', 'PAPAYA', 'KIWI',
    'COCONUT', 'PINEAPPLE', 'APRICOT', 'GUAVA', 'FIG', 'DATE', 'LYCHEE',
    'PERSIMMON', 'NECTARINE', 'BLUEBERRY', 'RASPBERRY', 'CRANBERRY',
    'BLACKBERRY', 'STRAWBERRY', 'TANGERINE', 'POMEGRANATE', 'PASSIONFRUIT',
    'AVOCADO', 'DURIAN',
  ],
  vegetables: [
    /* legacy inline pool — superseded by the 165-keyword themes.ts dict */
    'CARROT', 'POTATO', 'TOMATO', 'ONION', 'GARLIC', 'PEPPER', 'CELERY',
    'LETTUCE', 'SPINACH', 'BROCCOLI', 'CABBAGE', 'CUCUMBER', 'PUMPKIN',
    'RADISH', 'TURNIP', 'BEET', 'CORN', 'PEAS', 'BEAN', 'KALE',
    'PARSLEY', 'CILANTRO', 'CHIVE', 'LEEK', 'ARTICHOKE', 'ASPARAGUS',
    'EGGPLANT', 'ZUCCHINI', 'OKRA', 'CAULIFLOWER', 'SQUASH', 'CHARD',
    'ARUGULA', 'YAM',
  ],
  countries: [
    'CANADA', 'BRAZIL', 'FRANCE', 'GERMANY', 'ITALY', 'SPAIN', 'JAPAN',
    'CHINA', 'INDIA', 'EGYPT', 'KENYA', 'MEXICO', 'CHILE', 'PERU',
    'CUBA', 'GREECE', 'POLAND', 'NORWAY', 'SWEDEN', 'FINLAND', 'ICELAND',
    'IRELAND', 'PORTUGAL', 'TURKEY', 'IRAN', 'IRAQ', 'NEPAL', 'THAILAND',
    'VIETNAM', 'KOREA', 'AUSTRIA', 'BELGIUM', 'CROATIA', 'HUNGARY',
    'MOROCCO', 'NIGERIA',
  ],
  space: [
    'STAR', 'MOON', 'SUN', 'PLANET', 'COMET', 'METEOR', 'GALAXY', 'NEBULA',
    'ORBIT', 'ROCKET', 'COSMOS', 'EARTH', 'MARS', 'VENUS', 'JUPITER',
    'SATURN', 'MERCURY', 'NEPTUNE', 'URANUS', 'PLUTO', 'ASTEROID',
    'ECLIPSE', 'GRAVITY', 'CRATER', 'LUNAR', 'SOLAR', 'STELLAR',
    'QUASAR', 'PULSAR', 'BLACKHOLE', 'SATELLITE', 'TELESCOPE', 'ASTRONAUT',
    'SPACESHIP', 'MILKYWAY', 'COSMIC',
  ],
  ocean: [
    'WAVE', 'TIDE', 'CORAL', 'REEF', 'SHARK', 'WHALE', 'DOLPHIN', 'OCTOPUS',
    'CRAB', 'LOBSTER', 'SHRIMP', 'STARFISH', 'JELLYFISH', 'SEAHORSE',
    'TURTLE', 'EEL', 'SQUID', 'STINGRAY', 'ANEMONE', 'PLANKTON', 'KELP',
    'BARNACLE', 'CLAM', 'OYSTER', 'MUSSEL', 'URCHIN', 'SHELL', 'PEARL',
    'SAND', 'BEACH', 'SALT', 'DEEP', 'CURRENT', 'TRENCH', 'LAGOON',
    'HARBOR',
  ],
  sports: [
    'SOCCER', 'TENNIS', 'GOLF', 'HOCKEY', 'CRICKET', 'RUGBY', 'BOXING',
    'CYCLING', 'SKIING', 'SURFING', 'DIVING', 'ROWING', 'SAILING',
    'CLIMBING', 'RUNNING', 'SWIMMING', 'JUDO', 'KARATE', 'FENCING',
    'ARCHERY', 'BOWLING', 'CURLING', 'SKATING', 'SNOWBOARD', 'BASEBALL',
    'BASKETBALL', 'FOOTBALL', 'VOLLEYBALL', 'BADMINTON', 'POLO', 'WRESTLE',
    'GYMNAST', 'SPRINT', 'HURDLE', 'JAVELIN', 'DISCUS',
  ],
  colors: [
    'RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'PINK', 'BLACK',
    'WHITE', 'BROWN', 'GRAY', 'GOLD', 'SILVER', 'BRONZE', 'CYAN', 'MAGENTA',
    'TEAL', 'MAROON', 'NAVY', 'OLIVE', 'CORAL', 'CRIMSON', 'INDIGO',
    'VIOLET', 'TURQUOISE', 'LAVENDER', 'BEIGE', 'IVORY', 'SCARLET',
    'AMBER', 'EMERALD', 'JADE', 'RUBY', 'AZURE', 'KHAKI', 'MAUVE',
  ],
  instruments: [
    'PIANO', 'GUITAR', 'VIOLIN', 'DRUM', 'FLUTE', 'TRUMPET', 'CELLO',
    'HARP', 'BANJO', 'UKULELE', 'CLARINET', 'SAXOPHONE', 'TROMBONE',
    'TUBA', 'OBOE', 'BASSOON', 'HARMONICA', 'ACCORDION', 'MANDOLIN',
    'BAGPIPES', 'XYLOPHONE', 'TAMBOURINE', 'TRIANGLE', 'CYMBAL', 'GONG',
    'BONGO', 'CONGA', 'MARACAS', 'KAZOO', 'RECORDER', 'ORGAN', 'KEYBOARD',
    'SITAR', 'LUTE', 'FIDDLE', 'CASTANETS',
  ],
  weather: [
    'RAIN', 'SNOW', 'WIND', 'STORM', 'CLOUD', 'SUNNY', 'FOG', 'MIST',
    'HAIL', 'SLEET', 'FROST', 'THUNDER', 'LIGHTNING', 'RAINBOW', 'BLIZZARD',
    'TORNADO', 'HURRICANE', 'CYCLONE', 'DRIZZLE', 'SHOWER', 'BREEZE',
    'GALE', 'GUST', 'HUMID', 'DRY', 'WARM', 'COOL', 'COLD', 'HOT',
    'CHILL', 'OVERCAST', 'CLEAR', 'MUGGY', 'ICY', 'DEW', 'BAROMETER',
  ],
  flowers: [
    'ROSE', 'TULIP', 'DAISY', 'LILY', 'ORCHID', 'POPPY', 'IRIS', 'PEONY',
    'DAHLIA', 'LOTUS', 'JASMINE', 'LILAC', 'VIOLET', 'PANSY', 'AZALEA',
    'BEGONIA', 'CARNATION', 'CHRYSANTHEMUM', 'DAFFODIL', 'GARDENIA',
    'HIBISCUS', 'HYACINTH', 'HYDRANGEA', 'MAGNOLIA', 'MARIGOLD', 'PETUNIA',
    'PRIMROSE', 'SNAPDRAGON', 'SUNFLOWER', 'ZINNIA', 'FUCHSIA', 'CROCUS',
    'BLUEBELL', 'FOXGLOVE', 'GERANIUM', 'CAMELLIA',
  ],
  gemstones: [
    'DIAMOND', 'RUBY', 'EMERALD', 'SAPPHIRE', 'PEARL', 'OPAL', 'JADE',
    'TOPAZ', 'AMBER', 'AGATE', 'AMETHYST', 'AQUAMARINE', 'CITRINE',
    'GARNET', 'JASPER', 'ONYX', 'QUARTZ', 'TURQUOISE', 'ZIRCON', 'CORAL',
    'CRYSTAL', 'TANZANITE', 'TOURMALINE', 'PERIDOT', 'MOONSTONE', 'OBSIDIAN',
    'BLOODSTONE', 'CARNELIAN', 'CHALCEDONY', 'LAPIS', 'MALACHITE',
    'SUNSTONE', 'SPINEL', 'CHROME', 'IVORY', 'CORUNDUM',
  ],
  trees: [
    'OAK', 'PINE', 'MAPLE', 'BIRCH', 'ELM', 'CEDAR', 'WILLOW', 'CHERRY',
    'ASH', 'FIR', 'SPRUCE', 'POPLAR', 'BEECH', 'ASPEN', 'WALNUT',
    'CHESTNUT', 'HICKORY', 'SYCAMORE', 'REDWOOD', 'SEQUOIA', 'CYPRESS',
    'JUNIPER', 'MAGNOLIA', 'DOGWOOD', 'OLIVE', 'PALM', 'BAOBAB', 'BAMBOO',
    'EUCALYPTUS', 'MAHOGANY', 'TEAK', 'ALDER', 'HEMLOCK', 'LARCH', 'YEW',
    'ACACIA',
  ],
  cars: [
    'SEDAN', 'COUPE', 'HATCHBACK', 'WAGON', 'TRUCK', 'VAN', 'JEEP', 'SUV',
    'CONVERTIBLE', 'ROADSTER', 'ENGINE', 'WHEEL', 'TIRE', 'BRAKE',
    'CLUTCH', 'GEAR', 'BUMPER', 'HOOD', 'TRUNK', 'MIRROR', 'WIPER',
    'AXLE', 'CHASSIS', 'EXHAUST', 'MUFFLER', 'PISTON', 'RADIATOR',
    'BATTERY', 'IGNITION', 'TURBO', 'DIESEL', 'CABRIOLET', 'COUPE',
    'PICKUP', 'LIMO', 'TAXI', 'RACING',
  ],
  general: [
    'HOUSE', 'CHAIR', 'TABLE', 'WINDOW', 'GARDEN', 'BRIDGE', 'STREET',
    'MARKET', 'CASTLE', 'TOWER', 'CIRCLE', 'SQUARE', 'BOTTLE', 'BASKET',
    'CANDLE', 'MIRROR', 'BUTTON', 'POCKET', 'PILLOW', 'BLANKET', 'KETTLE',
    'COFFEE', 'BANANA', 'PENCIL', 'PAPER', 'LETTER', 'NUMBER', 'PUZZLE',
    'RIVER', 'MOUNTAIN', 'ISLAND', 'FOREST', 'DESERT', 'MEADOW', 'VALLEY',
    'OCEAN',
  ],
};

/** Pick `n` words from the theme matching `theme` (case-insensitive),
 *  deterministically shuffled by `seed`. Uses the same 165-keyword themes
 *  dictionary as the wordsearch-generator/maze-generator. */
import { wordsForTheme as themesWordsForTheme, resolveCategory } from './themes';
export function wordsForTheme(theme: string, n: number, seed: number): string[] {
  // Re-use the generator's full dictionary. Length cap kept tight enough
  // for the small reel grid.
  return themesWordsForTheme(theme, n, seed, 10, 3);
}

/** Convenience: theme display name uppercased, used as title. */
export function themeTitle(theme: string): string {
  const key = theme.trim().toLowerCase();
  const cat = resolveCategory(key);
  return (cat ?? key).toUpperCase();
}
