import type { Species, SpeciesVariant } from '@/types/dnd';
import { getImportedBucket, mergeCollectionsById } from './sourceHelpers';

export const baseSpecies: Species[] = [
  // Player's Handbook Species
  {
    id: 'dragonborn',
    name: 'Dragonborn',
    description: 'Born of dragons, as their name proclaims, the dragonborn walk proudly through a world that greets them with fearful incomprehension. Shaped by draconic gods or the dragons themselves, dragonborn originally hatched from dragon eggs as a unique race, combining the best attributes of dragons and humanoids. Some dragonborn are faithful servants to true dragons, others form the ranks of soldiers in great wars, and still others find themselves adrift, with no clear calling in life.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'strength', amount: 2 },
      { ability: 'charisma', amount: 1 }
    ],
    features: [
      {
        id: 'draconic-ancestry',
        name: 'Draconic Ancestry',
        description: 'You have draconic ancestry. Choose one type of dragon from the Draconic Ancestry table. Your breath weapon and damage resistance are determined by the dragon type.',
        level: 1,
        source: 'Dragonborn',
        requiresChoice: true,
        options: [
          { id: 'black', name: 'Black Dragon', description: 'Acid damage, 5 by 30 ft. line (Dex save)' },
          { id: 'blue', name: 'Blue Dragon', description: 'Lightning damage, 5 by 30 ft. line (Dex save)' },
          { id: 'brass', name: 'Brass Dragon', description: 'Fire damage, 5 by 30 ft. line (Dex save)' },
          { id: 'bronze', name: 'Bronze Dragon', description: 'Lightning damage, 5 by 30 ft. line (Dex save)' },
          { id: 'copper', name: 'Copper Dragon', description: 'Acid damage, 5 by 30 ft. line (Dex save)' },
          { id: 'gold', name: 'Gold Dragon', description: 'Fire damage, 15 ft. cone (Dex save)' },
          { id: 'green', name: 'Green Dragon', description: 'Poison damage, 15 ft. cone (Con save)' },
          { id: 'red', name: 'Red Dragon', description: 'Fire damage, 15 ft. cone (Dex save)' },
          { id: 'silver', name: 'Silver Dragon', description: 'Cold damage, 15 ft. cone (Con save)' },
          { id: 'white', name: 'White Dragon', description: 'Cold damage, 15 ft. cone (Con save)' }
        ]
      },
      {
        id: 'breath-weapon',
        name: 'Breath Weapon',
        description: 'You can use your action to exhale destructive energy. Your draconic ancestry determines the size, shape, and damage type of the exhalation. When you use your breath weapon, each creature in the area of the exhalation must make a saving throw, the type of which is determined by your draconic ancestry. The DC for this saving throw equals 8 + your Constitution modifier + your proficiency bonus. A creature takes 2d6 damage on a failed save, and half as much damage on a successful one. The damage increases to 3d6 at 6th level, 4d6 at 11th level, and 5d6 at 16th level. After you use your breath weapon, you can\'t use it again until you complete a short or long rest.',
        level: 1,
        source: 'Dragonborn'
      },
      {
        id: 'damage-resistance',
        name: 'Damage Resistance',
        description: 'You have resistance to the damage type associated with your draconic ancestry.',
        level: 1,
        source: 'Dragonborn'
      }
    ],
    languages: ['Common', 'Draconic'],
    source: 'Player\'s Handbook'
  },
  {
    id: 'dwarf',
    name: 'Dwarf',
    description: 'Kingdoms rich in ancient grandeur, halls carved into the roots of mountains, the echoing of picks and hammers in deep mines and blazing forges, a commitment to clan and tradition, and a burning hatred of goblins and orcs—these common threads unite all dwarves.',
    size: 'Medium',
    speed: 25,
    abilityScoreIncreases: [
      { ability: 'constitution', amount: 2 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'Accustomed to life underground, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
        level: 1,
        source: 'Dwarf'
      },
      {
        id: 'dwarven-resilience',
        name: 'Dwarven Resilience',
        description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
        level: 1,
        source: 'Dwarf'
      },
      {
        id: 'stonecunning',
        name: 'Stonecunning',
        description: 'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check, instead of your normal proficiency bonus.',
        level: 1,
        source: 'Dwarf'
      }
    ],
    proficiencies: [
      { name: 'Battleaxe', type: 'weapon' },
      { name: 'Handaxe', type: 'weapon' },
      { name: 'Light Hammer', type: 'weapon' },
      { name: 'Warhammer', type: 'weapon' }
    ],
    languages: ['Common', 'Dwarvish'],
    variants: [
      {
        id: 'hill-dwarf',
        name: 'Hill Dwarf',
        description: 'As a hill dwarf, you have keen senses, deep intuition, and remarkable resilience.',
        abilityScoreIncreases: [
          { ability: 'wisdom', amount: 1 }
        ],
        features: [
          {
            id: 'dwarven-toughness',
            name: 'Dwarven Toughness',
            description: 'Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.',
            level: 1,
            source: 'Hill Dwarf'
          }
        ]
      },
      {
        id: 'mountain-dwarf',
        name: 'Mountain Dwarf',
        description: 'As a mountain dwarf, you\'re strong and hardy, accustomed to a difficult life in rugged terrain.',
        abilityScoreIncreases: [
          { ability: 'strength', amount: 2 }
        ],
        proficiencies: [
          { name: 'Light Armor', type: 'armor' },
          { name: 'Medium Armor', type: 'armor' }
        ],
        features: []
      }
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'elf',
    name: 'Elf',
    description: 'Elves are a magical people of otherworldly grace, living in the world but not entirely part of it. They live in places of ethereal beauty, in the midst of ancient forests or in silvery spires glittering with faerie light, where soft music drifts through the air and gentle fragrances waft on the breeze. Elves love nature and magic, art and artistry, music and poetry, and the good things of the world.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'dexterity', amount: 2 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'Accustomed to twilit forests and the night sky, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
        level: 1,
        source: 'Elf'
      },
      {
        id: 'keen-senses',
        name: 'Keen Senses',
        description: 'You have proficiency in the Perception skill.',
        level: 1,
        source: 'Elf'
      },
      {
        id: 'fey-ancestry',
        name: 'Fey Ancestry',
        description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
        level: 1,
        source: 'Elf'
      },
      {
        id: 'trance',
        name: 'Trance',
        description: 'Elves don\'t need to sleep. Instead, they meditate deeply, remaining semiconscious, for 4 hours a day. (The Common word for such meditation is "trance.") While meditating, you can dream after a fashion; such dreams are actually mental exercises that have become reflexive through years of practice. After resting in this way, you gain the same benefit that a human does from 8 hours of sleep.',
        level: 1,
        source: 'Elf'
      }
    ],
    proficiencies: [
      { name: 'Perception', type: 'skill' }
    ],
    languages: ['Common', 'Elvish'],
    variants: [
      {
        id: 'high-elf',
        name: 'High Elf',
        description: 'As a high elf, you have a keen mind and a mastery of at least the basics of magic.',
        abilityScoreIncreases: [
          { ability: 'intelligence', amount: 1 }
        ],
        features: [
          {
            id: 'elf-weapon-training',
            name: 'Elf Weapon Training',
            description: 'You have proficiency with the longsword, shortsword, shortbow, and longbow.',
            level: 1,
            source: 'High Elf'
          },
          {
            id: 'cantrip',
            name: 'Cantrip',
            description: 'You know one cantrip of your choice from the wizard spell list. Intelligence is your spellcasting ability for it.',
            level: 1,
            source: 'High Elf',
            requiresChoice: true
          }
        ],
        spells: [
          { name: 'Choose Wizard Cantrip', level: 0, atWill: true }
        ]
      },
      {
        id: 'wood-elf',
        name: 'Wood Elf',
        description: 'As a wood elf, you have keen senses and intuition, and your fleet feet carry you quickly and stealthily through your native forests.',
        abilityScoreIncreases: [
          { ability: 'wisdom', amount: 1 }
        ],
        features: [
          {
            id: 'elf-weapon-training',
            name: 'Elf Weapon Training',
            description: 'You have proficiency with the longsword, shortsword, shortbow, and longbow.',
            level: 1,
            source: 'Wood Elf'
          },
          {
            id: 'fleet-of-foot',
            name: 'Fleet of Foot',
            description: 'Your base walking speed increases to 35 feet.',
            level: 1,
            source: 'Wood Elf'
          },
          {
            id: 'mask-of-the-wild',
            name: 'Mask of the Wild',
            description: 'You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena.',
            level: 1,
            source: 'Wood Elf'
          }
        ]
      },
      {
        id: 'drow',
        name: 'Drow',
        description: 'Descended from an earlier subrace of dark-skinned elves, the drow were banished from the surface world for following the goddess Lolth down the path to evil and corruption.',
        abilityScoreIncreases: [
          { ability: 'charisma', amount: 1 }
        ],
        features: [
          {
            id: 'superior-darkvision',
            name: 'Superior Darkvision',
            description: 'Your darkvision has a radius of 120 feet.',
            level: 1,
            source: 'Drow'
          },
          {
            id: 'sunlight-sensitivity',
            name: 'Sunlight Sensitivity',
            description: 'You have disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight when you, the target of your attack, or whatever you are trying to perceive is in direct sunlight.',
            level: 1,
            source: 'Drow'
          },
          {
            id: 'drow-magic',
            name: 'Drow Magic',
            description: 'You know the Dancing Lights cantrip. When you reach 3rd level, you can cast the Faerie Fire spell once per long rest. When you reach 5th level, you can also cast the Darkness spell once per long rest. Charisma is your spellcasting ability for these spells.',
            level: 1,
            source: 'Drow'
          }
        ],
        spells: [
          { name: 'Dancing Lights', level: 0, atWill: true },
          { name: 'Faerie Fire', level: 1, oncePerLongRest: true },
          { name: 'Darkness', level: 2, oncePerLongRest: true }
        ]
      }
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'gnome',
    name: 'Gnome',
    description: 'A constant hum of busy activity pervades the warrens and neighborhoods where gnomes form their close-knit communities. Louder sounds punctuate the hum: a crunch of grinding gears here, a minor explosion there, a yelp of surprise or triumph, and especially bursts of laughter. Gnomes take delight in life, enjoying every moment of invention, exploration, investigation, creation, and play.',
    size: 'Small',
    speed: 25,
    abilityScoreIncreases: [
      { ability: 'intelligence', amount: 2 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'Accustomed to life underground, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
        level: 1,
        source: 'Gnome'
      },
      {
        id: 'gnome-cunning',
        name: 'Gnome Cunning',
        description: 'You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
        level: 1,
        source: 'Gnome'
      }
    ],
    languages: ['Common', 'Gnomish'],
    variants: [
      {
        id: 'forest-gnome',
        name: 'Forest Gnome',
        description: 'Forest gnomes have a knack for stealth and illusion, and are generally reserved and quiet.',
        abilityScoreIncreases: [
          { ability: 'dexterity', amount: 1 }
        ],
        features: [
          {
            id: 'natural-illusionist',
            name: 'Natural Illusionist',
            description: 'You know the Minor Illusion cantrip. Intelligence is your spellcasting ability for it.',
            level: 1,
            source: 'Forest Gnome'
          },
          {
            id: 'speak-with-small-beasts',
            name: 'Speak with Small Beasts',
            description: 'Through sounds and gestures, you can communicate simple ideas with Small or smaller beasts.',
            level: 1,
            source: 'Forest Gnome'
          }
        ],
        spells: [
          { name: 'Minor Illusion', level: 0, atWill: true }
        ]
      },
      {
        id: 'rock-gnome',
        name: 'Rock Gnome',
        description: 'Rock gnomes are known for their inventiveness and curiosity.',
        abilityScoreIncreases: [
          { ability: 'constitution', amount: 1 }
        ],
        features: [
          {
            id: 'artificers-lore',
            name: 'Artificer\'s Lore',
            description: 'Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you can add twice your proficiency bonus, instead of any proficiency bonus you normally apply.',
            level: 1,
            source: 'Rock Gnome'
          },
          {
            id: 'tinker',
            name: 'Tinker',
            description: 'You have proficiency with artisan\'s tools (tinker\'s tools). Using those tools, you can spend 1 hour and 10 gp worth of materials to construct a Tiny clockwork device (AC 5, 1 hp). The device ceases to function after 24 hours (unless you spend 1 hour repairing it to keep the device functioning), or when you use your action to dismantle it; at that time, you can reclaim the materials used to create it.',
            level: 1,
            source: 'Rock Gnome'
          }
        ],
        proficiencies: [
          { name: 'Tinker\'s Tools', type: 'tool' }
        ]
      }
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'half-elf',
    name: 'Half-Elf',
    description: 'Walking in two worlds but truly belonging to neither, half-elves combine what some say are the best qualities of their elf and human parents: human curiosity, inventiveness, and ambition tempered by the refined senses, love of nature, and artistic tastes of the elves. Some half-elves live among humans, set apart by their emotional and physical differences, watching friends and loved ones age while time barely touches them. Others live with the elves, growing restless as they reach adulthood in the timeless elven realms, while their peers continue to live as children.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'charisma', amount: 2 },
      { ability: 'choose', amount: 1, chooseFrom: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom'], chooseCount: 2 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'Thanks to your elf blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
        level: 1,
        source: 'Half-Elf'
      },
      {
        id: 'fey-ancestry',
        name: 'Fey Ancestry',
        description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
        level: 1,
        source: 'Half-Elf'
      },
      {
        id: 'skill-versatility',
        name: 'Skill Versatility',
        description: 'You gain proficiency in two skills of your choice.',
        level: 1,
        source: 'Half-Elf',
        requiresChoice: true,
        options: [
          { id: 'acrobatics', name: 'Acrobatics', description: 'Dexterity skill' },
          { id: 'animal-handling', name: 'Animal Handling', description: 'Wisdom skill' },
          { id: 'arcana', name: 'Arcana', description: 'Intelligence skill' },
          { id: 'athletics', name: 'Athletics', description: 'Strength skill' },
          { id: 'deception', name: 'Deception', description: 'Charisma skill' },
          { id: 'history', name: 'History', description: 'Intelligence skill' },
          { id: 'insight', name: 'Insight', description: 'Wisdom skill' },
          { id: 'intimidation', name: 'Intimidation', description: 'Charisma skill' },
          { id: 'investigation', name: 'Investigation', description: 'Intelligence skill' },
          { id: 'medicine', name: 'Medicine', description: 'Wisdom skill' },
          { id: 'nature', name: 'Nature', description: 'Intelligence skill' },
          { id: 'perception', name: 'Perception', description: 'Wisdom skill' },
          { id: 'performance', name: 'Performance', description: 'Charisma skill' },
          { id: 'persuasion', name: 'Persuasion', description: 'Charisma skill' },
          { id: 'religion', name: 'Religion', description: 'Intelligence skill' },
          { id: 'sleight-of-hand', name: 'Sleight of Hand', description: 'Dexterity skill' },
          { id: 'stealth', name: 'Stealth', description: 'Dexterity skill' },
          { id: 'survival', name: 'Survival', description: 'Wisdom skill' }
        ]
      }
    ],
    // Half-elves "can speak, read, and write Common, Elvish, and one extra language of your choice".
    languages: ['Common', 'Elvish', 'One of your choice'],
    source: 'Player\'s Handbook'
  },
  {
    id: 'half-orc',
    name: 'Half-Orc',
    description: 'Whether united under the leadership of a mighty warlock or having fought to a standstill after years of conflict, orc and human tribes sometimes form alliances, joining forces into a larger horde to the terror of civilized lands nearby. When these alliances are sealed by marriages, half-orcs are born. Some half-orcs rise to become proud chiefs of orc tribes, their human blood giving them an edge over their full-blooded orc rivals. Some venture into the world to prove their worth among humans and other more civilized races. Many of these become adventurers, achieving greatness for their mighty deeds.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'strength', amount: 2 },
      { ability: 'constitution', amount: 1 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'Thanks to your orc blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
        level: 1,
        source: 'Half-Orc'
      },
      {
        id: 'menacing',
        name: 'Menacing',
        description: 'You gain proficiency in the Intimidation skill.',
        level: 1,
        source: 'Half-Orc'
      },
      {
        id: 'relentless-endurance',
        name: 'Relentless Endurance',
        description: 'When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can\'t use this feature again until you finish a long rest.',
        level: 1,
        source: 'Half-Orc'
      },
      {
        id: 'savage-attacks',
        name: 'Savage Attacks',
        description: 'When you score a critical hit with a melee weapon attack, you can roll one of the weapon\'s damage dice one additional time and add it to the extra damage of the critical hit.',
        level: 1,
        source: 'Half-Orc'
      }
    ],
    proficiencies: [
      { name: 'Intimidation', type: 'skill' }
    ],
    languages: ['Common', 'Orc'],
    source: 'Player\'s Handbook'
  },
  {
    id: 'halfling',
    name: 'Halfling',
    description: 'The comforts of home are the goals of most halflings\' lives: a place to settle in peace and quiet, far from marauding monsters and clashing armies; a blazing fire and a generous meal; fine drink and fine conversation. Though some halflings live out their days in remote agricultural communities, others form nomadic bands that travel constantly, lured by the open road and the wide horizon to discover the wonders of new lands and peoples. But even these wanderers love peace, food, hearth, and home, though home might be a wagon jostling along a dirt road or a raft floating downriver.',
    size: 'Small',
    speed: 25,
    abilityScoreIncreases: [
      { ability: 'dexterity', amount: 2 }
    ],
    features: [
      {
        id: 'lucky',
        name: 'Lucky',
        description: 'When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
        level: 1,
        source: 'Halfling'
      },
      {
        id: 'brave',
        name: 'Brave',
        description: 'You have advantage on saving throws against being frightened.',
        level: 1,
        source: 'Halfling'
      },
      {
        id: 'halfling-nimbleness',
        name: 'Halfling Nimbleness',
        description: 'You can move through the space of any creature that is of a size larger than yours.',
        level: 1,
        source: 'Halfling'
      }
    ],
    languages: ['Common', 'Halfling'],
    variants: [
      {
        id: 'lightfoot',
        name: 'Lightfoot',
        description: 'As a lightfoot halfling, you can easily hide from notice, even using other people as cover.',
        abilityScoreIncreases: [
          { ability: 'charisma', amount: 1 }
        ],
        features: [
          {
            id: 'naturally-stealthy',
            name: 'Naturally Stealthy',
            description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
            level: 1,
            source: 'Lightfoot'
          }
        ]
      },
      {
        id: 'stout',
        name: 'Stout',
        description: 'As a stout halfling, you\'re hardier than average and have some resistance to poison.',
        abilityScoreIncreases: [
          { ability: 'constitution', amount: 1 }
        ],
        features: [
          {
            id: 'stout-resilience',
            name: 'Stout Resilience',
            description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
            level: 1,
            source: 'Stout'
          }
        ]
      }
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'human',
    name: 'Human',
    description: 'In the reckonings of most worlds, humans are the youngest of the common races, late to arrive on the world scene and short-lived in comparison to dwarves, elves, and dragons. Perhaps it is because of their shorter lives that they strive to achieve as much as they can in the years they are given. Or maybe they feel they have something to prove to the elder races, and that\'s why they build their mighty empires on the foundation of conquest and trade. Whatever drives them, humans are the innovators, the achievers, and the pioneers of the worlds.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'strength', amount: 1 },
      { ability: 'dexterity', amount: 1 },
      { ability: 'constitution', amount: 1 },
      { ability: 'intelligence', amount: 1 },
      { ability: 'wisdom', amount: 1 },
      { ability: 'charisma', amount: 1 }
    ],
    features: [],
    // Humans "can speak, read, and write Common and one extra language of your choice".
    languages: ['Common', 'One of your choice'],
    variants: [
      {
        id: 'variant-human',
        name: 'Variant Human',
        description: 'If your campaign uses the optional feat rules, your Dungeon Master might allow this variant.',
        abilityScoreIncreases: [
          { ability: 'choose', amount: 1, chooseFrom: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'], chooseCount: 2 }
        ],
        features: [
          {
            id: 'skills',
            name: 'Skills',
            description: 'You gain proficiency in one skill of your choice.',
            level: 1,
            source: 'Variant Human',
            requiresChoice: true
          },
          {
            id: 'feat',
            name: 'Feat',
            description: 'You gain one feat of your choice.',
            level: 1,
            source: 'Variant Human',
            requiresChoice: true
          }
        ],
        proficiencies: [
          { name: 'One skill of choice', type: 'skill' }
        ]
      }
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'tiefling',
    name: 'Tiefling',
    description: 'To be greeted with stares and whispers, to suffer violence and insult on the street, to see mistrust and fear in every eye: this is the lot of the tiefling. And to twist the knife, tieflings know that this is because a pact struck generations ago infused the essence of Asmodeus—overlord of the Nine Hells—into their bloodline. Their appearance and their nature are not their fault but the result of an ancient sin, for which they and their children and their children\'s children will always be held accountable.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'intelligence', amount: 1 },
      { ability: 'charisma', amount: 2 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'Thanks to your infernal heritage, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
        level: 1,
        source: 'Tiefling'
      },
      {
        id: 'hellish-resistance',
        name: 'Hellish Resistance',
        description: 'You have resistance to fire damage.',
        level: 1,
        source: 'Tiefling'
      },
      {
        id: 'infernal-legacy',
        name: 'Infernal Legacy',
        description: 'You know the Thaumaturgy cantrip. When you reach 3rd level, you can cast the Hellish Rebuke spell as a 2nd-level spell once with this trait and regain the ability to do so when you finish a long rest. When you reach 5th level, you can cast the Darkness spell once with this trait and regain the ability to do so when you finish a long rest. Charisma is your spellcasting ability for these spells.',
        level: 1,
        source: 'Tiefling'
      }
    ],
    spells: [
      { name: 'Thaumaturgy', level: 0, atWill: true },
      { name: 'Hellish Rebuke', level: 2, oncePerLongRest: true },
      { name: 'Darkness', level: 2, oncePerLongRest: true }
    ],
    languages: ['Common', 'Infernal'],
    source: 'Player\'s Handbook'
  },
  // Tasha's Cauldron of Everything - Custom Lineage
  {
    id: 'custom-lineage',
    name: 'Custom Lineage',
    description: 'Instead of choosing one of the races presented in the Player\'s Handbook, you can use the following traits to represent your character\'s lineage, giving you full control over how your character\'s origin shaped them.',
    size: 'Small',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'choose', amount: 2, chooseFrom: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'], chooseCount: 1 }
    ],
    features: [
      {
        id: 'creature-type',
        name: 'Creature Type',
        description: 'You are a humanoid. You determine your appearance and whether you resemble any of your kin.',
        level: 1,
        source: 'Custom Lineage'
      },
      {
        id: 'darkvision-optional',
        name: 'Darkvision (Optional)',
        description: 'You can take Darkvision instead of a feat.',
        level: 1,
        source: 'Custom Lineage'
      },
      {
        id: 'feat',
        name: 'Feat',
        description: 'You gain one feat of your choice for which you qualify.',
        level: 1,
        source: 'Custom Lineage',
        requiresChoice: true
      }
    ],
    languages: ['Common', 'One of your choice'],
    source: 'Tasha\'s Cauldron of Everything'
  }
];


const importedSpecies = getImportedBucket('species') as Species[];
export const species = mergeCollectionsById(baseSpecies, importedSpecies);

export const getSpeciesById = (id: string): Species | undefined => {
  return species.find(s => s.id === id);
};

export const getSpeciesVariant = (speciesId: string, variantId: string): SpeciesVariant | undefined => {
  const s = getSpeciesById(speciesId);
  return s?.variants?.find(v => v.id === variantId);
};
