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
    languages: ['Common', 'Elvish'],
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
    languages: ['Common'],
    variants: [
      {
        id: 'variant-human',
        name: 'Variant Human',
        description: 'If your campaign uses the optional feat rules from Chapter 6 of the Player\'s Handbook, your Dungeon Master might allow this variant.',
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
  },
  // Mordenkainen's Tome of Foes - Additional Tiefling Variants
  {
    id: 'aasimar',
    name: 'Aasimar',
    description: 'Aasimar are placed in the world to serve as guardians of law and good. Their patrons expect them to strike at evil, lead by example, and further the cause of justice.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'charisma', amount: 2 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'Blessed with a radiant soul, your vision can easily cut through darkness. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
        level: 1,
        source: 'Aasimar'
      },
      {
        id: 'celestial-resistance',
        name: 'Celestial Resistance',
        description: 'You have resistance to necrotic damage and radiant damage.',
        level: 1,
        source: 'Aasimar'
      },
      {
        id: 'healing-hands',
        name: 'Healing Hands',
        description: 'As an action, you can touch a creature and cause it to regain a number of hit points equal to your level. Once you use this trait, you can\'t use it again until you finish a long rest.',
        level: 1,
        source: 'Aasimar'
      },
      {
        id: 'light-bearer',
        name: 'Light Bearer',
        description: 'You know the Light cantrip. Charisma is your spellcasting ability for it.',
        level: 1,
        source: 'Aasimar'
      }
    ],
    spells: [
      { name: 'Light', level: 0, atWill: true }
    ],
    languages: ['Common', 'Celestial'],
    variants: [
      {
        id: 'protector-aasimar',
        name: 'Protector Aasimar',
        description: 'Protector aasimar are charged with guarding the weak and innocent.',
        abilityScoreIncreases: [
          { ability: 'wisdom', amount: 1 }
        ],
        features: [
          {
            id: 'radiant-soul',
            name: 'Radiant Soul',
            description: 'Starting at 3rd level, you can use your action to unleash the divine energy within yourself, causing your eyes to glimmer and two luminous, incorporeal wings to sprout from your back. Your transformation lasts for 1 minute or until you end it as a bonus action. During it, you have a flying speed of 30 feet, and once on each of your turns, you can deal extra radiant damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your level. Once you use this trait, you can\'t use it again until you finish a long rest.',
            level: 3,
            source: 'Protector Aasimar'
          }
        ]
      },
      {
        id: 'scourge-aasimar',
        name: 'Scourge Aasimar',
        description: 'Scourge aasimar are imbued with a divine energy that blazes intensely within them.',
        abilityScoreIncreases: [
          { ability: 'constitution', amount: 1 }
        ],
        features: [
          {
            id: 'radiant-consumption',
            name: 'Radiant Consumption',
            description: 'Starting at 3rd level, you can use your action to unleash the divine energy within yourself, causing a searing light to radiate from you, pour out of your eyes and mouth, and threaten to char you. Your transformation lasts for 1 minute or until you end it as a bonus action. During it, you shed bright light in a 10-foot radius and dim light for an additional 10 feet, and at the end of each of your turns, you and each creature within 10 feet of you take radiant damage equal to half your level (rounded up). In addition, once on each of your turns, you can deal extra radiant damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your level. Once you use this trait, you can\'t use it again until you finish a long rest.',
            level: 3,
            source: 'Scourge Aasimar'
          }
        ]
      },
      {
        id: 'fallen-aasimar',
        name: 'Fallen Aasimar',
        description: 'An aasimar who was touched by dark powers as a youth or who turns to evil in early adulthood can become one of the fallen.',
        abilityScoreIncreases: [
          { ability: 'strength', amount: 1 }
        ],
        features: [
          {
            id: 'necrotic-shroud',
            name: 'Necrotic Shroud',
            description: 'Starting at 3rd level, you can use your action to unleash the divine energy within yourself, causing your eyes to turn into pools of darkness and two skeletal, ghostly, flightless wings to sprout from your back. Your transformation lasts for 1 minute or until you end it as a bonus action. During it, once on each of your turns, you can deal extra necrotic damage to one target when you deal damage to it with an attack or a spell. The extra damage equals your level. In addition, once during the transformation, when a creature within 10 feet of you hits you with an attack roll, you can use your reaction to force the creature to make a Charisma saving throw (DC 8 + your proficiency bonus + your Charisma modifier). On a failed save, the creature becomes frightened of you until the end of your next turn. Once you use this trait, you can\'t use it again until you finish a long rest.',
            level: 3,
            source: 'Fallen Aasimar'
          }
        ]
      }
    ],
    source: 'Mordenkainen\'s Tome of Foes'
  },
  // Fizban's Treasury of Dragons - Dragonborn Variants
  {
    id: 'kobold',
    name: 'Kobold',
    description: 'Kobolds are small, reptilian humanoids related to dragons. They are cunning, industrious, and often serve as minions to more powerful creatures.',
    size: 'Small',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'dexterity', amount: 2 },
      { ability: 'choose', amount: 1, chooseFrom: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'], chooseCount: 1 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
        level: 1,
        source: 'Kobold'
      },
      {
        id: 'draconic-cry',
        name: 'Draconic Cry',
        description: 'As a bonus action, you let out a draconic cry at an enemy you can see within 10 feet of you. Until the start of your next turn, you and your allies have advantage on attack rolls against that enemy. You can use this trait a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest.',
        level: 1,
        source: 'Kobold'
      },
      {
        id: 'kobold-legacy',
        name: 'Kobold Legacy',
        description: 'You have the following legacy options: Defiance (advantage on saves against being frightened) or Draconic Sorcery (choose one damage type).',
        level: 1,
        source: 'Kobold',
        requiresChoice: true
      }
    ],
    languages: ['Common', 'Draconic'],
    source: 'Fizban\'s Treasury of Dragons'
  },
  // 2024 Basic Rules Species
  {
    id: 'goliath',
    name: 'Goliath',
    description: 'Towering over most other folk, goliaths are distant descendants of giants. They are known for their incredible strength and endurance.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'strength', amount: 2 },
      { ability: 'constitution', amount: 1 }
    ],
    features: [
      {
        id: 'natural-athlete',
        name: 'Natural Athlete',
        description: 'You have proficiency in the Athletics skill.',
        level: 1,
        source: 'Goliath'
      },
      {
        id: 'stones-endurance',
        name: 'Stone\'s Endurance',
        description: 'You can focus yourself to occasionally shrug off injury. When you take damage, you can use your reaction to roll a d12. Add your Constitution modifier to the number rolled, and reduce the damage by that total. After you use this trait, you can\'t use it again until you finish a short or long rest.',
        level: 1,
        source: 'Goliath'
      },
      {
        id: 'powerful-build',
        name: 'Powerful Build',
        description: 'You count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
        level: 1,
        source: 'Goliath'
      },
      {
        id: 'mountain-born',
        name: 'Mountain Born',
        description: 'You have resistance to cold damage. You\'re also acclimated to high altitude, including elevations above 20,000 feet.',
        level: 1,
        source: 'Goliath'
      }
    ],
    proficiencies: [
      { name: 'Athletics', type: 'skill' }
    ],
    languages: ['Common', 'Giant'],
    source: 'Volo\'s Guide to Monsters'
  },
  {
    id: 'firbolg',
    name: 'Firbolg',
    description: 'Firbolgs are forest-dwelling folk with a connection to nature. They are gentle giants who prefer peaceful solutions but will defend their homes fiercely.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'wisdom', amount: 2 },
      { ability: 'strength', amount: 1 }
    ],
    features: [
      {
        id: 'firbolg-magic',
        name: 'Firbolg Magic',
        description: 'You can cast Detect Magic and Disguise Self with this trait. Once you cast either spell, you can\'t cast it again with this trait until you finish a short or long rest. When you use this version of Disguise Self, you can seem up to 3 feet shorter. Wisdom is your spellcasting ability for these spells.',
        level: 1,
        source: 'Firbolg'
      },
      {
        id: 'hidden-step',
        name: 'Hidden Step',
        description: 'As a bonus action, you can magically turn invisible until the start of your next turn or until you attack, make a damage roll, or force someone to make a saving throw. Once you use this trait, you can\'t use it again until you finish a short or long rest.',
        level: 1,
        source: 'Firbolg'
      },
      {
        id: 'powerful-build',
        name: 'Powerful Build',
        description: 'You count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
        level: 1,
        source: 'Firbolg'
      },
      {
        id: 'speech-of-beast-and-leaf',
        name: 'Speech of Beast and Leaf',
        description: 'You have the ability to communicate in a limited manner with beasts and plants. They can understand the meaning of your words, though you have no special ability to understand them in return. You have advantage on all Charisma checks you make to influence them.',
        level: 1,
        source: 'Firbolg'
      }
    ],
    spells: [
      { name: 'Detect Magic', level: 1, oncePerShortRest: true },
      { name: 'Disguise Self', level: 1, oncePerShortRest: true }
    ],
    languages: ['Common', 'Elvish', 'Giant'],
    source: 'Volo\'s Guide to Monsters'
  },
  {
    id: 'kenku',
    name: 'Kenku',
    description: 'Kenku are flightless avian humanoids who are cursed to be unable to speak with their own voices. Instead, they communicate through mimicry.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'dexterity', amount: 2 },
      { ability: 'wisdom', amount: 1 }
    ],
    features: [
      {
        id: 'expert-forgery',
        name: 'Expert Forgery',
        description: 'You can duplicate other creatures\' handwriting and craftwork. You have advantage on all checks made to produce forgeries or duplicates of existing objects.',
        level: 1,
        source: 'Kenku'
      },
      {
        id: 'kenku-training',
        name: 'Kenku Training',
        description: 'You are proficient in your choice of two of the following skills: Acrobatics, Deception, Stealth, and Sleight of Hand.',
        level: 1,
        source: 'Kenku',
        requiresChoice: true
      },
      {
        id: 'mimicry',
        name: 'Mimicry',
        description: 'You can mimic sounds you have heard, including voices. A creature that hears the sounds you make can tell they are imitations with a successful Wisdom (Insight) check opposed by your Charisma (Deception) check.',
        level: 1,
        source: 'Kenku'
      }
    ],
    languages: ['Common', 'Auran'],
    source: 'Volo\'s Guide to Monsters'
  },
  {
    id: 'lizardfolk',
    name: 'Lizardfolk',
    description: 'Lizardfolk are primitive reptilian humanoids that lurk in swamps and jungles. They are pragmatic survivors with alien thought processes.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'constitution', amount: 2 },
      { ability: 'wisdom', amount: 1 }
    ],
    features: [
      {
        id: 'bite',
        name: 'Bite',
        description: 'Your fanged maw is a natural weapon, which you can use to make unarmed strikes. If you hit with it, you deal piercing damage equal to 1d6 + your Strength modifier, instead of the bludgeoning damage normal for an unarmed strike.',
        level: 1,
        source: 'Lizardfolk'
      },
      {
        id: 'cunning-artisan',
        name: 'Cunning Artisan',
        description: 'As part of a short rest, you can harvest bone and hide from a slain beast, construct, dragon, monstrosity, or plant creature of size Small or larger to create one of the following items: a shield, a club, a javelin, or 1d4 darts or blowgun needles.',
        level: 1,
        source: 'Lizardfolk'
      },
      {
        id: 'hold-breath',
        name: 'Hold Breath',
        description: 'You can hold your breath for up to 15 minutes at a time.',
        level: 1,
        source: 'Lizardfolk'
      },
      {
        id: 'hunters-lore',
        name: 'Hunter\'s Lore',
        description: 'You gain proficiency with two of the following skills of your choice: Animal Handling, Nature, Perception, Stealth, and Survival.',
        level: 1,
        source: 'Lizardfolk',
        requiresChoice: true
      },
      {
        id: 'natural-armor',
        name: 'Natural Armor',
        description: 'You have tough, scaly skin. When you aren\'t wearing armor, your AC is 13 + your Dexterity modifier. You can use your natural armor to determine your AC if the armor you wear would leave you with a lower AC.',
        level: 1,
        source: 'Lizardfolk'
      }
    ],
    languages: ['Common', 'Draconic'],
    source: 'Volo\'s Guide to Monsters'
  },
  {
    id: 'tabaxi',
    name: 'Tabaxi',
    description: 'Tabaxi are feline humanoids with a curious nature and a wanderlust that drives them to explore the world.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'dexterity', amount: 2 },
      { ability: 'charisma', amount: 1 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'You have a cat\'s keen senses, especially in the dark. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
        level: 1,
        source: 'Tabaxi'
      },
      {
        id: 'feline-agility',
        name: 'Feline Agility',
        description: 'Your reflexes and agility allow you to move with a burst of speed. When you move on your turn in combat, you can double your speed until the end of the turn. Once you use this trait, you can\'t use it again until you move 0 feet on one of your turns.',
        level: 1,
        source: 'Tabaxi'
      },
      {
        id: 'cats-claws',
        name: 'Cat\'s Claws',
        description: 'Because of your claws, you have a climbing speed of 20 feet. In addition, your claws are natural weapons, which you can use to make unarmed strikes. If you hit with them, you deal slashing damage equal to 1d6 + your Dexterity modifier, instead of the bludgeoning damage normal for an unarmed strike.',
        level: 1,
        source: 'Tabaxi'
      },
      {
        id: 'cats-talent',
        name: 'Cat\'s Talent',
        description: 'You have proficiency in the Perception and Stealth skills.',
        level: 1,
        source: 'Tabaxi'
      }
    ],
    proficiencies: [
      { name: 'Perception', type: 'skill' },
      { name: 'Stealth', type: 'skill' }
    ],
    languages: ['Common', 'One of your choice'],
    source: 'Volo\'s Guide to Monsters'
  },
  {
    id: 'triton',
    name: 'Triton',
    description: 'Tritons are aquatic humanoids who guard the depths of the ocean. They are proud warriors who have ventured to the surface world.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'strength', amount: 1 },
      { ability: 'constitution', amount: 1 },
      { ability: 'charisma', amount: 1 }
    ],
    features: [
      {
        id: 'amphibious',
        name: 'Amphibious',
        description: 'You can breathe air and water.',
        level: 1,
        source: 'Triton'
      },
      {
        id: 'control-air-and-water',
        name: 'Control Air and Water',
        description: 'You can cast Fog Cloud with this trait. Starting at 3rd level, you can cast Gust of Wind with it, and starting at 5th level, you can also cast Wall of Water with it. Once you cast a spell with this trait, you can\'t cast that spell with it again until you finish a long rest. Charisma is your spellcasting ability for these spells.',
        level: 1,
        source: 'Triton'
      },
      {
        id: 'embers-of-the-alliance',
        name: 'Embers of the Alliance',
        description: 'You have resistance to cold damage.',
        level: 1,
        source: 'Triton'
      },
      {
        id: 'swim',
        name: 'Swim',
        description: 'You have a swimming speed of 30 feet.',
        level: 1,
        source: 'Triton'
      }
    ],
    spells: [
      { name: 'Fog Cloud', level: 1, oncePerLongRest: true },
      { name: 'Gust of Wind', level: 2, oncePerLongRest: true },
      { name: 'Wall of Water', level: 3, oncePerLongRest: true }
    ],
    languages: ['Common', 'Primordial'],
    source: 'Volo\'s Guide to Monsters'
  },
  {
    id: 'bugbear',
    name: 'Bugbear',
    description: 'Bugbears are hulking humanoids related to goblins. Despite their intimidating appearance, some find a place among civilized folk.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'strength', amount: 2 },
      { ability: 'dexterity', amount: 1 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
        level: 1,
        source: 'Bugbear'
      },
      {
        id: 'long-limbed',
        name: 'Long-Limbed',
        description: 'When you make a melee attack on your turn, your reach for it is 5 feet greater than normal.',
        level: 1,
        source: 'Bugbear'
      },
      {
        id: 'powerful-build',
        name: 'Powerful Build',
        description: 'You count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
        level: 1,
        source: 'Bugbear'
      },
      {
        id: 'sneaky',
        name: 'Sneaky',
        description: 'You are proficient in the Stealth skill.',
        level: 1,
        source: 'Bugbear'
      },
      {
        id: 'surprise-attack',
        name: 'Surprise Attack',
        description: 'If you surprise a creature and hit it with an attack on your first turn in combat, the attack deals an extra 2d6 damage to it. You can use this trait only once per combat.',
        level: 1,
        source: 'Bugbear'
      }
    ],
    proficiencies: [
      { name: 'Stealth', type: 'skill' }
    ],
    languages: ['Common', 'Goblin'],
    source: 'Volo\'s Guide to Monsters'
  },
  {
    id: 'goblin',
    name: 'Goblin',
    description: 'Goblins are small, green-skinned humanoids known for their cunning and survival instincts.',
    size: 'Small',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'dexterity', amount: 2 },
      { ability: 'constitution', amount: 1 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
        level: 1,
        source: 'Goblin'
      },
      {
        id: 'fury-of-the-small',
        name: 'Fury of the Small',
        description: 'When you damage a creature with an attack or a spell, you can cause the attack or spell to deal extra damage to the creature. The extra damage equals your level. Once you use this trait, you can\'t use it again until you finish a short or long rest.',
        level: 1,
        source: 'Goblin'
      },
      {
        id: 'nimble-escape',
        name: 'Nimble Escape',
        description: 'You can take the Disengage or Hide action as a bonus action on each of your turns.',
        level: 1,
        source: 'Goblin'
      }
    ],
    languages: ['Common', 'Goblin'],
    source: 'Volo\'s Guide to Monsters'
  },
  {
    id: 'hobgoblin',
    name: 'Hobgoblin',
    description: 'Hobgoblins are larger, more disciplined cousins of goblins. They are natural soldiers with a strong martial tradition.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'constitution', amount: 2 },
      { ability: 'intelligence', amount: 1 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
        level: 1,
        source: 'Hobgoblin'
      },
      {
        id: 'martial-training',
        name: 'Martial Training',
        description: 'You are proficient with two martial weapons of your choice and with light armor.',
        level: 1,
        source: 'Hobgoblin',
        requiresChoice: true
      },
      {
        id: 'saving-face',
        name: 'Saving Face',
        description: 'Hobgoblins are careful not to show weakness in front of their allies, for fear of losing status. If you miss with an attack or fail an ability check or a saving throw, you can gain a bonus to the roll equal to the number of allies you can see within 30 feet of you (maximum bonus of +5). Once you use this trait, you can\'t use it again until you finish a short or long rest.',
        level: 1,
        source: 'Hobgoblin'
      }
    ],
    languages: ['Common', 'Goblin'],
    source: 'Volo\'s Guide to Monsters'
  },
  {
    id: 'orc',
    name: 'Orc',
    description: 'Orcs are powerful humanoids with grayish skin and prominent tusks. They are known for their strength and ferocity in battle.',
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
        description: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
        level: 1,
        source: 'Orc'
      },
      {
        id: 'aggressive',
        name: 'Aggressive',
        description: 'As a bonus action, you can move up to your speed toward an enemy of your choice that you can see or hear. You must end this move closer to the enemy than you started.',
        level: 1,
        source: 'Orc'
      },
      {
        id: 'menacing',
        name: 'Menacing',
        description: 'You are proficient in the Intimidation skill.',
        level: 1,
        source: 'Orc'
      },
      {
        id: 'powerful-build',
        name: 'Powerful Build',
        description: 'You count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
        level: 1,
        source: 'Orc'
      }
    ],
    proficiencies: [
      { name: 'Intimidation', type: 'skill' }
    ],
    languages: ['Common', 'Orc'],
    source: 'Volo\'s Guide to Monsters'
  },
  {
    id: 'yuan-ti',
    name: 'Yuan-ti',
    description: 'Yuan-ti are serpentine humanoids descended from an ancient empire that made pacts with dark powers.',
    size: 'Medium',
    speed: 30,
    abilityScoreIncreases: [
      { ability: 'charisma', amount: 2 },
      { ability: 'intelligence', amount: 1 }
    ],
    features: [
      {
        id: 'darkvision',
        name: 'Darkvision',
        description: 'You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
        level: 1,
        source: 'Yuan-ti'
      },
      {
        id: 'innate-spellcasting',
        name: 'Innate Spellcasting',
        description: 'You know the Poison Spray cantrip. You can cast Animal Friendship an unlimited number of times, but you can target only snakes with it. Starting at 3rd level, you can also cast Suggestion with this trait. Once you cast it, you can\'t do so again until you finish a long rest. Charisma is your spellcasting ability for these spells.',
        level: 1,
        source: 'Yuan-ti'
      },
      {
        id: 'magic-resistance',
        name: 'Magic Resistance',
        description: 'You have advantage on saving throws against spells and other magical effects.',
        level: 1,
        source: 'Yuan-ti'
      },
      {
        id: 'poison-immunity',
        name: 'Poison Immunity',
        description: 'You are immune to poison damage and the poisoned condition.',
        level: 1,
        source: 'Yuan-ti'
      }
    ],
    spells: [
      { name: 'Poison Spray', level: 0, atWill: true },
      { name: 'Animal Friendship (snakes only)', level: 1, atWill: true },
      { name: 'Suggestion', level: 2, oncePerLongRest: true }
    ],
    languages: ['Common', 'Abyssal', 'Draconic'],
    source: 'Volo\'s Guide to Monsters'
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
