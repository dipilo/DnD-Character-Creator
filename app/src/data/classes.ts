import type { Class } from '@/types/dnd';
import { getImportedBucket, mergeCollectionsById } from './sourceHelpers';

export const baseClasses: Class[] = [
  {
    id: 'barbarian',
    name: 'Barbarian',
    description: 'A fierce warrior of primitive background who can enter a battle rage.',
    hitDie: 12,
    primaryAbility: 'strength',
    savingThrows: ['strength', 'constitution'],
    armorProficiencies: ['Light Armor', 'Medium Armor', 'Shields'],
    weaponProficiencies: ['Simple Weapons', 'Martial Weapons'],
    skillChoices: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'],
    skillCount: 2,
    features: [
      {
        id: 'rage',
        name: 'Rage',
        description: 'In battle, you fight with primal ferocity. On your turn, you can enter a rage as a bonus action. While raging, you gain advantage on Strength checks and Strength saving throws, a bonus to damage rolls with melee weapons using Strength, and resistance to bludgeoning, piercing, and slashing damage. You can\'t cast spells or concentrate on them while raging.',
        level: 1,
        source: 'Barbarian'
      },
      {
        id: 'unarmored-defense',
        name: 'Unarmored Defense',
        description: 'While you are not wearing any armor, your Armor Class equals 10 + your Dexterity modifier + your Constitution modifier. You can use a shield and still gain this benefit.',
        level: 1,
        source: 'Barbarian'
      },
      {
        id: 'reckless-attack',
        name: 'Reckless Attack',
        description: 'Starting at 2nd level, you can throw aside all concern for defense to attack with fierce desperation. When you make your first attack on your turn, you can decide to attack recklessly. Doing so gives you advantage on melee weapon attack rolls using Strength during this turn, but attack rolls against you have advantage until your next turn.',
        level: 2,
        source: 'Barbarian'
      },
      {
        id: 'danger-sense',
        name: 'Danger Sense',
        description: 'At 2nd level, you gain an uncanny sense of when things nearby aren\'t as they should be, giving you an edge when you dodge away from danger. You have advantage on Dexterity saving throws against effects that you can see, such as traps and spells.',
        level: 2,
        source: 'Barbarian'
      },
      {
        id: 'extra-attack',
        name: 'Extra Attack',
        description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
        level: 5,
        source: 'Barbarian'
      },
      {
        id: 'fast-movement',
        name: 'Fast Movement',
        description: 'Starting at 5th level, your speed increases by 10 feet while you aren\'t wearing heavy armor.',
        level: 5,
        source: 'Barbarian'
      },
      {
        id: 'feral-instinct',
        name: 'Feral Instinct',
        description: 'By 7th level, your instincts are so honed that you have advantage on initiative rolls. Additionally, if you are surprised at the beginning of combat and aren\'t incapacitated, you can act normally on your first turn, but only if you enter your rage before doing anything else on that turn.',
        level: 7,
        source: 'Barbarian'
      },
      {
        id: 'brutal-critical',
        name: 'Brutal Critical',
        description: 'Beginning at 9th level, you can roll one additional weapon damage die when determining the extra damage for a critical hit with a melee attack. This increases to two additional dice at 13th level and three additional dice at 17th level.',
        level: 9,
        source: 'Barbarian'
      },
      {
        id: 'relentless-rage',
        name: 'Relentless Rage',
        description: 'Starting at 11th level, your rage can keep you fighting despite grievous wounds. If you drop to 0 hit points while you\'re raging and don\'t die outright, you can make a DC 10 Constitution saving throw. If you succeed, you drop to 1 hit point instead. Each time you use this feature after the first, the DC increases by 5.',
        level: 11,
        source: 'Barbarian'
      },
      {
        id: 'persistent-rage',
        name: 'Persistent Rage',
        description: 'Beginning at 15th level, your rage is so fierce that it ends early only if you fall unconscious or if you choose to end it.',
        level: 15,
        source: 'Barbarian'
      },
      {
        id: 'indomitable-might',
        name: 'Indomitable Might',
        description: 'Beginning at 18th level, if your total for a Strength check is less than your Strength score, you can use that score in place of the total.',
        level: 18,
        source: 'Barbarian'
      },
      {
        id: 'primal-champion',
        name: 'Primal Champion',
        description: 'At 20th level, you embody the power of the wilds. Your Strength and Constitution scores increase by 4. Your maximum for those scores is now 24.',
        level: 20,
        source: 'Barbarian'
      }
    ],
    subclasses: [
      {
        id: 'ancestral-guardian',
        name: 'Path of the Ancestral Guardian',
        description: 'Some barbarians hail from cultures that revere their ancestors. These tribes teach that the warriors of the past linger in the world as mighty spirits, who can guide and protect the living.',
        features: [
          {
            id: 'ancestral-protectors',
            name: 'Ancestral Protectors',
            description: 'Starting when you choose this path at 3rd level, spectral warriors appear when you enter your rage. While you\'re raging, the first creature you hit with an attack on your turn becomes the target of the warriors. Until the start of your next turn, that target has disadvantage on any attack roll that isn\'t against you, and when the target hits a creature other than you with an attack, that creature has resistance to the damage.',
            level: 3,
            source: 'Ancestral Guardian'
          },
          {
            id: 'spirit-shield',
            name: 'Spirit Shield',
            description: 'Beginning at 6th level, the guardian spirits that aid you can provide supernatural protection to those you defend. If you are raging and another creature you can see within 30 feet of you takes damage, you can use your reaction to reduce that damage by 2d6. When you reach certain levels in this class, you can reduce the damage by more: by 3d6 at 10th level and by 4d6 at 14th level.',
            level: 6,
            source: 'Ancestral Guardian'
          }
        ]
      },
      {
        id: 'berserker',
        name: 'Path of the Berserker',
        description: 'For some barbarians, rage is a means to an end—that end being violence. The Path of the Berserker is a path of untrammeled fury, slick with blood.',
        features: [
          {
            id: 'frenzy',
            name: 'Frenzy',
            description: 'Starting when you choose this path at 3rd level, you can go into a frenzy when you rage. If you do so, for the duration of your rage you can make a single melee weapon attack as a bonus action on each of your turns after this one. When your rage ends, you suffer one level of exhaustion.',
            level: 3,
            source: 'Berserker'
          },
          {
            id: 'mindless-rage',
            name: 'Mindless Rage',
            description: 'Beginning at 6th level, you can\'t be charmed or frightened while raging. If you are charmed or frightened when you enter your rage, the effect is suspended for the duration of the rage.',
            level: 6,
            source: 'Berserker'
          },
          {
            id: 'intimidating-presence',
            name: 'Intimidating Presence',
            description: 'Beginning at 10th level, you can use your action to frighten someone with your menacing presence. When you do so, choose one creature that you can see within 30 feet of you. If the creature can see or hear you, it must succeed on a Wisdom saving throw (DC equal to 8 + your proficiency bonus + your Charisma modifier) or be frightened of you until the end of your next turn.',
            level: 10,
            source: 'Berserker'
          },
          {
            id: 'retaliation',
            name: 'Retaliation',
            description: 'Starting at 14th level, when you take damage from a creature that is within 5 feet of you, you can use your reaction to make a melee weapon attack against that creature.',
            level: 14,
            source: 'Berserker'
          }
        ]
      },
      {
        id: 'totem-warrior',
        name: 'Path of the Totem Warrior',
        description: 'The Path of the Totem Warrior is a spiritual journey, as the barbarian accepts a spirit animal as guide, protector, and inspiration.',
        features: [
          {
            id: 'spirit-seeker',
            name: 'Spirit Seeker',
            description: 'Yours is a path that seeks attunement with the natural world, giving you a kinship with beasts. At 3rd level when you adopt this path, you gain the ability to cast the Beast Sense and Speak with Animals spells, but only as rituals.',
            level: 3,
            source: 'Totem Warrior'
          },
          {
            id: 'totem-spirit',
            name: 'Totem Spirit',
            description: 'At 3rd level, when you adopt this path, you choose a totem spirit and gain its feature. You must make or acquire a physical totem object—an amulet or similar adornment—that incorporates fur or feathers, claws, teeth, or bones of the totem animal. Your totem animal options are: Bear (resistance to all damage except psychic while raging), Eagle (opportunity attacks against you have disadvantage while raging, and you can Dash as a bonus action), or Wolf (friends have advantage on melee attacks against creatures within 5 feet of you while raging).',
            level: 3,
            source: 'Totem Warrior',
            requiresChoice: true,
            options: [
              { id: 'bear', name: 'Bear', description: 'While raging, you have resistance to all damage except psychic damage.' },
              { id: 'eagle', name: 'Eagle', description: 'While you\'re raging and aren\'t wearing heavy armor, opportunity attacks against you have disadvantage, and you can use the Dash action as a bonus action.' },
              { id: 'wolf', name: 'Wolf', description: 'While you\'re raging, your friends have advantage on melee attack rolls against any creature within 5 feet of you that is hostile to you.' }
            ]
          }
        ]
      },
      {
        id: 'zealot',
        name: 'Path of the Zealot',
        description: 'Some deities inspire their followers to pitch themselves into a ferocious battle fury. These zealots are vessels for divine power.',
        features: [
          {
            id: 'divine-fury',
            name: 'Divine Fury',
            description: 'Starting when you choose this path at 3rd level, you can channel divine fury into your weapon strikes. While you\'re raging, the first creature you hit on each of your turns with a weapon attack takes extra damage equal to 1d6 + half your barbarian level. The extra damage is necrotic or radiant; you choose the type of damage when you gain this feature.',
            level: 3,
            source: 'Zealot'
          },
          {
            id: 'warrior-of-the-gods',
            name: 'Warrior of the Gods',
            description: 'At 3rd level, your soul is marked for endless battle. If a spell, such as Raise Dead, has the sole effect of restoring you to life (but not undeath), the caster doesn\'t require material components to cast the spell on you.',
            level: 3,
            source: 'Zealot'
          }
        ]
      }
    ],
    subclassLevel: 3,
    equipmentOptions: [
      [{ name: 'Greataxe', type: 'weapon' }, { name: 'Any martial melee weapon', type: 'weapon' }],
      [{ name: 'Two handaxes', type: 'weapon' }, { name: 'Any simple weapon', type: 'weapon' }],
      [{ name: 'Explorer\'s Pack', type: 'pack' }],
      [{ name: 'Four javelins', type: 'weapon' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'bard',
    name: 'Bard',
    description: 'An inspiring magician whose power echoes the music of creation.',
    hitDie: 8,
    primaryAbility: 'charisma',
    savingThrows: ['dexterity', 'charisma'],
    armorProficiencies: ['Light Armor'],
    weaponProficiencies: ['Simple Weapons', 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
    toolProficiencies: ['Three musical instruments of your choice'],
    skillChoices: ['Any'],
    skillCount: 3,
    features: [
      {
        id: 'spellcasting',
        name: 'Spellcasting',
        description: 'You have learned to untangle and reshape the fabric of reality in harmony with your wishes and music. Your spells are part of your vast repertoire, magic that you can tune to different situations.',
        level: 1,
        source: 'Bard'
      },
      {
        id: 'bardic-inspiration',
        name: 'Bardic Inspiration',
        description: 'You can inspire others through stirring words or music. To do so, you use a bonus action on your turn to choose one creature other than yourself within 60 feet of you who can hear you. That creature gains one Bardic Inspiration die, a d6. Once within the next 10 minutes, the creature can roll the die and add the number rolled to one ability check, attack roll, or saving throw it makes.',
        level: 1,
        source: 'Bard'
      },
      {
        id: 'jack-of-all-trades',
        name: 'Jack of All Trades',
        description: 'Starting at 2nd level, you can add half your proficiency bonus, rounded down, to any ability check you make that doesn\'t already include your proficiency bonus.',
        level: 2,
        source: 'Bard'
      },
      {
        id: 'song-of-rest',
        name: 'Song of Rest',
        description: 'Beginning at 2nd level, you can use soothing music or oration to help revitalize your wounded allies during a short rest. If you or any friendly creatures who can hear your performance regain hit points at the end of the short rest by spending one or more Hit Dice, each of those creatures regains an extra 1d6 hit points.',
        level: 2,
        source: 'Bard'
      },
      {
        id: 'bard-college',
        name: 'Bard College',
        description: 'At 3rd level, you delve into the advanced techniques of a bard college of your choice. Your choice grants you features at 3rd level and again at 6th and 14th level.',
        level: 3,
        source: 'Bard'
      },
      {
        id: 'expertise',
        name: 'Expertise',
        description: 'At 3rd level, choose two of your skill proficiencies. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies. At 10th level, you can choose another two skill proficiencies to gain this benefit.',
        level: 3,
        source: 'Bard'
      },
      {
        id: 'font-of-inspiration',
        name: 'Font of Inspiration',
        description: 'Beginning when you reach 5th level, you regain all of your expended uses of Bardic Inspiration when you finish a short or long rest.',
        level: 5,
        source: 'Bard'
      },
      {
        id: 'countercharm',
        name: 'Countercharm',
        description: 'At 6th level, you gain the ability to use musical notes or words of power to disrupt mind-influencing effects. As an action, you can start a performance that lasts until the end of your next turn. During that time, you and any friendly creatures within 30 feet of you have advantage on saving throws against being frightened or charmed.',
        level: 6,
        source: 'Bard'
      },
      {
        id: 'magical-secrets',
        name: 'Magical Secrets',
        description: 'By 10th level, you have plundered magical knowledge from a wide spectrum of disciplines. Choose two spells from any classes, including this one. A spell you choose must be of a level you can cast, as shown on the Bard table, or a cantrip. The chosen spells count as bard spells for you.',
        level: 10,
        source: 'Bard'
      },
      {
        id: 'superior-inspiration',
        name: 'Superior Inspiration',
        description: 'At 20th level, when you roll initiative and have no uses of Bardic Inspiration left, you regain one use.',
        level: 20,
        source: 'Bard'
      }
    ],
    spellcasting: {
      ability: 'charisma',
      cantripsKnown: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      spellsKnown: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
      spellSlots: [
        [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
        [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
        [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]
      ]
    },
    subclasses: [
      {
        id: 'glamour',
        name: 'College of Glamour',
        description: 'The College of Glamour is the home of bards who mastered their craft in the vibrant realm of the Feywild or under the tutelage of someone who dwelled there.',
        features: [
          {
            id: 'mantle-of-majesty',
            name: 'Mantle of Majesty',
            description: 'At 3rd level, you gain the ability to cloak yourself in a fey magic that makes others want to serve you. As a bonus action, you cast Command, without expending a spell slot, and you take on an appearance of unearthly beauty for 1 minute or until your concentration ends.',
            level: 3,
            source: 'Glamour'
          }
        ]
      },
      {
        id: 'lore',
        name: 'College of Lore',
        description: 'Bards of the College of Lore know something about most things, collecting bits of knowledge from sources as diverse as scholarly tomes and peasant tales.',
        features: [
          {
            id: 'bonus-proficiencies',
            name: 'Bonus Proficiencies',
            description: 'When you join the College of Lore at 3rd level, you gain proficiency with three skills of your choice.',
            level: 3,
            source: 'Lore'
          },
          {
            id: 'cutting-words',
            name: 'Cutting Words',
            description: 'Also at 3rd level, you learn how to use your wit to distract, confuse, and otherwise sap the confidence and competence of others. When a creature that you can see within 60 feet of you makes an attack roll, an ability check, or a damage roll, you can use your reaction to expend one of your uses of Bardic Inspiration, rolling a Bardic Inspiration die and subtracting the number rolled from the creature\'s roll.',
            level: 3,
            source: 'Lore'
          },
          {
            id: 'additional-magical-secrets',
            name: 'Additional Magical Secrets',
            description: 'At 6th level, you learn two spells of your choice from any class. A spell you choose must be of a level you can cast, as shown on the Bard table, or a cantrip. The chosen spells count as bard spells for you but don\'t count against the number of bard spells you know.',
            level: 6,
            source: 'Lore'
          },
          {
            id: 'peerless-skill',
            name: 'Peerless Skill',
            description: 'Starting at 14th level, when you make an ability check, you can expend one use of Bardic Inspiration. Roll a Bardic Inspiration die and add the number rolled to your ability check.',
            level: 14,
            source: 'Lore'
          }
        ]
      },
      {
        id: 'swords',
        name: 'College of Swords',
        description: 'Bards of the College of Swords are called blades, and they entertain through daring feats of weapon prowess.',
        features: [
          {
            id: 'bonus-proficiencies-swords',
            name: 'Bonus Proficiencies',
            description: 'When you join the College of Swords at 3rd level, you gain proficiency with medium armor and the scimitar. If you\'re proficient with a simple or martial melee weapon, you can use it as a spellcasting focus for your bard spells.',
            level: 3,
            source: 'Swords'
          },
          {
            id: 'fighting-style',
            name: 'Fighting Style',
            description: 'At 3rd level, you adopt a style of fighting as your specialty. Choose one of the following options: Dueling or Two-Weapon Fighting.',
            level: 3,
            source: 'Swords',
            requiresChoice: true
          }
        ]
      },
      {
        id: 'valor',
        name: 'College of Valor',
        description: 'Bards of the College of Valor are daring skalds whose tales keep alive the memory of the great heroes of the past.',
        features: [
          {
            id: 'bonus-proficiencies-valor',
            name: 'Bonus Proficiencies',
            description: 'When you join the College of Valor at 3rd level, you gain proficiency with medium armor, shields, and martial weapons.',
            level: 3,
            source: 'Valor'
          },
          {
            id: 'combat-inspiration',
            name: 'Combat Inspiration',
            description: 'Also at 3rd level, you learn to inspire others in battle. A creature that has a Bardic Inspiration die from you can roll that die and add the number rolled to a weapon damage roll it just made. Alternatively, when an attack roll is made against the creature, it can use its reaction to roll the Bardic Inspiration die and add the number rolled to its AC.',
            level: 3,
            source: 'Valor'
          },
          {
            id: 'extra-attack-bard',
            name: 'Extra Attack',
            description: 'Starting at 6th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
            level: 6,
            source: 'Valor'
          },
          {
            id: 'battle-magic',
            name: 'Battle Magic',
            description: 'At 14th level, you have mastered the art of weaving spellcasting and weapon use into a single harmonious act. When you use your action to cast a bard spell, you can make one weapon attack as a bonus action.',
            level: 14,
            source: 'Valor'
          }
        ]
      },
      {
        id: 'whispers',
        name: 'College of Whispers',
        description: 'Most folk are happy to welcome a bard into their midst. Bards of the College of Whispers use this to their advantage.',
        features: [
          {
            id: 'psychic-blades',
            name: 'Psychic Blades',
            description: 'When you join the College of Whispers at 3rd level, you gain the ability to make your weapon attacks magically toxic to a creature\'s mind. When you hit a creature with a weapon attack, you can expend one use of your Bardic Inspiration to deal an extra 2d6 psychic damage to that target.',
            level: 3,
            source: 'Whispers'
          }
        ]
      }
    ],
    subclassLevel: 3,
    equipmentOptions: [
      [{ name: 'Rapier', type: 'weapon' }, { name: 'Longsword', type: 'weapon' }, { name: 'Any simple weapon', type: 'weapon' }],
      [{ name: 'Diplomat\'s Pack', type: 'pack' }, { name: 'Entertainer\'s Pack', type: 'pack' }],
      [{ name: 'Lute', type: 'tool' }, { name: 'Any musical instrument', type: 'tool' }],
      [{ name: 'Leather armor', type: 'armor' }, { name: 'Dagger', type: 'weapon' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'cleric',
    name: 'Cleric',
    description: 'A priestly champion who wields divine magic in service of a higher power.',
    hitDie: 8,
    primaryAbility: 'wisdom',
    savingThrows: ['wisdom', 'charisma'],
    armorProficiencies: ['Light Armor', 'Medium Armor', 'Shields'],
    weaponProficiencies: ['Simple Weapons'],
    skillChoices: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'],
    skillCount: 2,
    features: [
      {
        id: 'spellcasting',
        name: 'Spellcasting',
        description: 'As a conduit for divine power, you can cast cleric spells.',
        level: 1,
        source: 'Cleric'
      },
      {
        id: 'divine-domain',
        name: 'Divine Domain',
        description: 'Choose one domain related to your deity. Your choice grants you domain spells and other features when you choose it at 1st level. It also grants you additional ways to use Channel Divinity when you gain that feature at 2nd level, and additional benefits at 6th, 8th, and 17th levels.',
        level: 1,
        source: 'Cleric'
      },
      {
        id: 'channel-divinity',
        name: 'Channel Divinity',
        description: 'At 2nd level, you gain the ability to channel divine energy directly from your deity, using that energy to fuel magical effects. You start with two such effects: Turn Undead and an effect determined by your domain. When you use your Channel Divinity, you choose which effect to create.',
        level: 2,
        source: 'Cleric'
      },
      {
        id: 'channel-divinity-2',
        name: 'Channel Divinity (2/rest)',
        description: 'Beginning at 6th level, you can use your Channel Divinity twice between rests.',
        level: 6,
        source: 'Cleric'
      },
      {
        id: 'destroy-undead',
        name: 'Destroy Undead',
        description: 'Starting at 5th level, when an undead fails its saving throw against your Turn Undead feature, the creature is instantly destroyed if its challenge rating is at or below a certain threshold.',
        level: 5,
        source: 'Cleric'
      },
      {
        id: 'divine-intervention',
        name: 'Divine Intervention',
        description: 'Beginning at 10th level, you can call on your deity to intervene on your behalf when your need is great. Imploring your deity\'s aid requires you to use your action. Describe the assistance you seek, and roll percentile dice. If you roll a number equal to or lower than your cleric level, your deity intervenes.',
        level: 10,
        source: 'Cleric'
      },
      {
        id: 'improved-divine-intervention',
        name: 'Improved Divine Intervention',
        description: 'At 20th level, your call for intervention succeeds automatically, no roll required.',
        level: 20,
        source: 'Cleric'
      }
    ],
    spellcasting: {
      ability: 'wisdom',
      spellPreparation: true,
      spellSlots: [
        [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [5, 4, 3, 3, 2],
        [5, 4, 3, 3, 2, 1], [5, 4, 3, 3, 2, 1], [5, 4, 3, 3, 2, 1, 1], [5, 4, 3, 3, 2, 1, 1], [5, 4, 3, 3, 2, 1, 1, 1],
        [5, 4, 3, 3, 2, 1, 1, 1], [5, 4, 3, 3, 2, 1, 1, 1, 1], [5, 4, 3, 3, 3, 1, 1, 1, 1], [5, 4, 3, 3, 3, 2, 1, 1, 1], [5, 4, 3, 3, 3, 2, 2, 1, 1]
      ]
    },
    subclasses: [
      {
        id: 'knowledge',
        name: 'Knowledge Domain',
        description: 'The gods of knowledge value learning and understanding above all.',
        features: [
          {
            id: 'blessings-of-knowledge',
            name: 'Blessings of Knowledge',
            description: 'At 1st level, you learn two languages of your choice. You also become proficient in your choice of two of the following skills: Arcana, History, Nature, or Religion. Your proficiency bonus is doubled for any ability check you make that uses either of those skills.',
            level: 1,
            source: 'Knowledge Domain'
          }
        ]
      },
      {
        id: 'life',
        name: 'Life Domain',
        description: 'The Life domain focuses on the vibrant positive energy that sustains all life.',
        features: [
          {
            id: 'bonus-proficiency',
            name: 'Bonus Proficiency',
            description: 'When you choose this domain at 1st level, you gain proficiency with heavy armor.',
            level: 1,
            source: 'Life Domain'
          },
          {
            id: 'disciple-of-life',
            name: 'Disciple of Life',
            description: 'Also starting at 1st level, your healing spells are more effective. Whenever you use a spell of 1st level or higher to restore hit points to a creature, the creature regains additional hit points equal to 2 + the spell\'s level.',
            level: 1,
            source: 'Life Domain'
          }
        ]
      },
      {
        id: 'light',
        name: 'Light Domain',
        description: 'Gods of light promote the ideals of rebirth and renewal, truth, vigilance, and beauty.',
        features: [
          {
            id: 'bonus-cantrip',
            name: 'Bonus Cantrip',
            description: 'When you choose this domain at 1st level, you gain the Light cantrip if you don\'t already know it.',
            level: 1,
            source: 'Light Domain'
          },
          {
            id: 'warding-flare',
            name: 'Warding Flare',
            description: 'Also at 1st level, you can interpose divine light between yourself and an attacking enemy. When you are attacked by a creature within 30 feet of you that you can see, you can use your reaction to impose disadvantage on the attack roll, causing light to flare before the attacker before it hits or misses.',
            level: 1,
            source: 'Light Domain'
          }
        ]
      },
      {
        id: 'nature',
        name: 'Nature Domain',
        description: 'Gods of nature are as varied as the natural world itself.',
        features: [
          {
            id: 'acolyte-of-nature',
            name: 'Acolyte of Nature',
            description: 'At 1st level, you learn one druid cantrip of your choice. You also gain proficiency in one of the following skills of your choice: Animal Handling, Nature, or Survival.',
            level: 1,
            source: 'Nature Domain'
          },
          {
            id: 'bonus-proficiency-nature',
            name: 'Bonus Proficiency',
            description: 'Also at 1st level, you gain proficiency with heavy armor.',
            level: 1,
            source: 'Nature Domain'
          }
        ]
      },
      {
        id: 'tempest',
        name: 'Tempest Domain',
        description: 'Gods whose portfolios include the Tempest domain govern storms, sea, and sky.',
        features: [
          {
            id: 'bonus-proficiencies-tempest',
            name: 'Bonus Proficiencies',
            description: 'At 1st level, you gain proficiency with martial weapons and heavy armor.',
            level: 1,
            source: 'Tempest Domain'
          },
          {
            id: 'wrath-of-the-storm',
            name: 'Wrath of the Storm',
            description: 'Also at 1st level, you can thunderously rebuke attackers. When a creature within 5 feet of you that you can see hits you with an attack, you can use your reaction to cause the creature to make a Dexterity saving throw. The creature takes 2d8 lightning or thunder damage (your choice) on a failed saving throw, and half as much damage on a successful one.',
            level: 1,
            source: 'Tempest Domain'
          }
        ]
      },
      {
        id: 'trickery',
        name: 'Trickery Domain',
        description: 'Gods of trickery are mischief-makers and instigators who stand as a constant challenge to the accepted order.',
        features: [
          {
            id: 'blessing-of-the-trickster',
            name: 'Blessing of the Trickster',
            description: 'Starting when you choose this domain at 1st level, you can use your action to touch a willing creature other than yourself to give it advantage on Dexterity (Stealth) checks. This blessing lasts for 1 hour or until you use this feature again.',
            level: 1,
            source: 'Trickery Domain'
          }
        ]
      },
      {
        id: 'war',
        name: 'War Domain',
        description: 'The War domain is coveted by fighters who invoke deities of war.',
        features: [
          {
            id: 'bonus-proficiencies-war',
            name: 'Bonus Proficiencies',
            description: 'At 1st level, you gain proficiency with martial weapons and heavy armor.',
            level: 1,
            source: 'War Domain'
          },
          {
            id: 'war-priest',
            name: 'War Priest',
            description: 'From 1st level, your god delivers bolts of inspiration to you while you are engaged in battle. When you use the Attack action, you can make one weapon attack as a bonus action. You can use this feature a number of times equal to your Wisdom modifier (minimum of once).',
            level: 1,
            source: 'War Domain'
          }
        ]
      }
    ],
    subclassLevel: 1,
    equipmentOptions: [
      [{ name: 'Mace', type: 'weapon' }, { name: 'Warhammer', type: 'weapon' }],
      [{ name: 'Scale mail', type: 'armor' }, { name: 'Leather armor', type: 'armor' }, { name: 'Chain mail', type: 'armor' }],
      [{ name: 'Light crossbow and 20 bolts', type: 'weapon' }, { name: 'Any simple weapon', type: 'weapon' }],
      [{ name: 'Priest\'s Pack', type: 'pack' }, { name: 'Explorer\'s Pack', type: 'pack' }],
      [{ name: 'Shield', type: 'armor' }, { name: 'Any simple weapon', type: 'weapon' }],
      [{ name: 'Holy symbol', type: 'gear' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'druid',
    name: 'Druid',
    description: 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.',
    hitDie: 8,
    primaryAbility: 'wisdom',
    savingThrows: ['intelligence', 'wisdom'],
    armorProficiencies: ['Light Armor', 'Medium Armor', 'Shields'],
    weaponProficiencies: ['Clubs', 'Daggers', 'Darts', 'Javelins', 'Maces', 'Quarterstaffs', 'Scimitars', 'Sickles', 'Slings'],
    toolProficiencies: ['Herbalism kit'],
    skillChoices: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'],
    skillCount: 2,
    features: [
      {
        id: 'druidic',
        name: 'Druidic',
        description: 'You know Druidic, the secret language of druids. You can speak the language and use it to leave hidden messages.',
        level: 1,
        source: 'Druid'
      },
      {
        id: 'spellcasting',
        name: 'Spellcasting',
        description: 'Drawing on the divine essence of nature itself, you can cast spells to shape that essence to your will.',
        level: 1,
        source: 'Druid'
      },
      {
        id: 'wild-shape',
        name: 'Wild Shape',
        description: 'Starting at 2nd level, you can use your action to magically assume the shape of a beast that you have seen before. You can use this feature twice. You regain expended uses when you finish a short or long rest.',
        level: 2,
        source: 'Druid'
      },
      {
        id: 'druid-circle',
        name: 'Druid Circle',
        description: 'At 2nd level, you choose to identify with a circle of druids. Your choice grants you features at 2nd level and again at 6th, 10th, and 14th level.',
        level: 2,
        source: 'Druid'
      },
      {
        id: 'wild-shape-improvement',
        name: 'Wild Shape Improvement',
        description: 'At 4th level, you can transform into a beast with a challenge rating as high as 1/2. At 8th level, you can transform into a beast with a challenge rating as high as 1.',
        level: 4,
        source: 'Druid'
      },
      {
        id: 'timeless-body',
        name: 'Timeless Body',
        description: 'Starting at 18th level, the primal magic that you wield causes you to age more slowly. For every 10 years that pass, your body ages only 1 year.',
        level: 18,
        source: 'Druid'
      },
      {
        id: 'beast-spells',
        name: 'Beast Spells',
        description: 'Beginning at 18th level, you can cast many of your druid spells in any shape you assume using Wild Shape.',
        level: 18,
        source: 'Druid'
      },
      {
        id: 'archdruid',
        name: 'Archdruid',
        description: 'At 20th level, you can use your Wild Shape an unlimited number of times. Additionally, you can ignore the verbal and somatic components of your druid spells, as well as any material components that lack a cost and aren\'t consumed by a spell.',
        level: 20,
        source: 'Druid'
      }
    ],
    spellcasting: {
      ability: 'wisdom',
      spellPreparation: true,
      spellSlots: [
        [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [5, 4, 3, 3, 2],
        [5, 4, 3, 3, 2, 1], [5, 4, 3, 3, 2, 1], [5, 4, 3, 3, 2, 1, 1], [5, 4, 3, 3, 2, 1, 1], [5, 4, 3, 3, 2, 1, 1, 1],
        [5, 4, 3, 3, 2, 1, 1, 1], [5, 4, 3, 3, 2, 1, 1, 1, 1], [5, 4, 3, 3, 3, 1, 1, 1, 1], [5, 4, 3, 3, 3, 2, 1, 1, 1], [5, 4, 3, 3, 3, 2, 2, 1, 1]
      ]
    },
    subclasses: [
      {
        id: 'dreams',
        name: 'Circle of Dreams',
        description: 'Druids who are members of the Circle of Dreams hail from regions that have strong ties to the Feywild.',
        features: [
          {
            id: 'balm-of-the-summer-court',
            name: 'Balm of the Summer Court',
            description: 'Starting at 2nd level, you become imbued with the blessings of the Summer Court. You are a font of energy that offers respite from injuries. You have a pool of fey energy represented by a number of d6s equal to your druid level. As a bonus action, you can choose an ally you can see within 120 feet of you and spend a number of those dice equal to half your druid level or less. Roll the spent dice and add them together. The target regains a number of hit points equal to the total.',
            level: 2,
            source: 'Dreams'
          }
        ]
      },
      {
        id: 'land',
        name: 'Circle of the Land',
        description: 'The Circle of the Land is made up of mystics and sages who safeguard ancient knowledge and rites.',
        features: [
          {
            id: 'bonus-cantrip',
            name: 'Bonus Cantrip',
            description: 'When you choose this circle at 2nd level, you learn one additional druid cantrip of your choice.',
            level: 2,
            source: 'Land'
          },
          {
            id: 'natural-recovery',
            name: 'Natural Recovery',
            description: 'Starting at 2nd level, you can regain some of your magical energy by sitting in meditation and communing with nature. During a short rest, you choose expended spell slots to recover. The spell slots can have a combined level that is equal to or less than half your druid level (rounded up), and none of the slots can be 6th level or higher.',
            level: 2,
            source: 'Land'
          },
          {
            id: 'land-stride',
            name: 'Land\'s Stride',
            description: 'Starting at 6th level, moving through nonmagical difficult terrain costs you no extra movement. You can also pass through nonmagical plants without being slowed by them and without taking damage from them if they have thorns, spines, or a similar hazard.',
            level: 6,
            source: 'Land'
          }
        ]
      },
      {
        id: 'moon',
        name: 'Circle of the Moon',
        description: 'Druids of the Circle of the Moon are fierce guardians of the wilds.',
        features: [
          {
            id: 'combat-wild-shape',
            name: 'Combat Wild Shape',
            description: 'When you choose this circle at 2nd level, you gain the ability to use Wild Shape on your turn as a bonus action, rather than as an action. Additionally, while you are transformed by Wild Shape, you can use a bonus action to expend one spell slot to regain 1d8 hit points per level of the spell slot expended.',
            level: 2,
            source: 'Moon'
          },
          {
            id: 'circle-forms',
            name: 'Circle Forms',
            description: 'The rites of your circle grant you the ability to transform into more dangerous animal forms. Starting at 2nd level, you can use your Wild Shape to transform into a beast with a challenge rating as high as 1. Starting at 6th level, you can transform into a beast with a challenge rating as high as your druid level divided by 3, rounded down.',
            level: 2,
            source: 'Moon'
          },
          {
            id: 'elemental-wild-shape',
            name: 'Elemental Wild Shape',
            description: 'At 10th level, you can expend two uses of Wild Shape at the same time to transform into an air elemental, an earth elemental, a fire elemental, or a water elemental.',
            level: 10,
            source: 'Moon'
          }
        ]
      },
      {
        id: 'shepherd',
        name: 'Circle of the Shepherd',
        description: 'Druids of the Circle of the Shepherd commune with the spirits of nature.',
        features: [
          {
            id: 'speech-of-the-woods',
            name: 'Speech of the Woods',
            description: 'At 2nd level, you gain the ability to converse with beasts and many fey. You learn to speak, read, and write Sylvan. In addition, beasts can understand your speech, and you gain the ability to decipher their noises and motions.',
            level: 2,
            source: 'Shepherd'
          },
          {
            id: 'spirit-totem',
            name: 'Spirit Totem',
            description: 'Starting at 2nd level, you can call forth nature spirits to influence the world around you. As a bonus action, you can magically summon an incorporeal spirit to a point you can see within 60 feet of you. The spirit creates an aura in a 30-foot radius around that point. It counts as neither a creature nor an object, though it has the spectral appearance of the creature it represents. The spirit persists for 1 minute or until you\'re incapacitated.',
            level: 2,
            source: 'Shepherd'
          }
        ]
      },
      {
        id: 'spores',
        name: 'Circle of Spores',
        description: 'Druids of the Circle of Spores find beauty in decay.',
        features: [
          {
            id: 'circle-spells',
            name: 'Circle Spells',
            description: 'Your symbiotic link to fungus and your ability to tap into the cycle of life and death grants you access to certain spells. At 2nd level, you learn the Chill Touch cantrip. At 3rd, 5th, 7th, and 9th level you gain access to the spells listed for that level in the Circle of Spores Spells table.',
            level: 2,
            source: 'Spores'
          },
          {
            id: 'halo-of-spores',
            name: 'Halo of Spores',
            description: 'Starting at 2nd level, you are surrounded by invisible, necrotic spores that are harmless until you unleash them on a creature nearby. When a creature you can see moves into a space within 10 feet of you or starts its turn there, you can use your reaction to deal 1d4 necrotic damage to that creature unless it succeeds on a Constitution saving throw against your spell save DC.',
            level: 2,
            source: 'Spores'
          }
        ]
      }
    ],
    subclassLevel: 2,
    equipmentOptions: [
      [{ name: 'Shield', type: 'armor' }, { name: 'Any simple weapon', type: 'weapon' }],
      [{ name: 'Scimitar', type: 'weapon' }, { name: 'Any simple melee weapon', type: 'weapon' }],
      [{ name: 'Explorer\'s Pack', type: 'pack' }],
      [{ name: 'Leather armor', type: 'armor' }],
      [{ name: 'Druidic focus', type: 'gear' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'fighter',
    name: 'Fighter',
    description: 'A master of martial combat, skilled with a variety of weapons and armor.',
    hitDie: 10,
    primaryAbility: ['strength', 'dexterity'],
    savingThrows: ['strength', 'constitution'],
    armorProficiencies: ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'],
    weaponProficiencies: ['Simple Weapons', 'Martial Weapons'],
    skillChoices: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'],
    skillCount: 2,
    features: [
      {
        id: 'fighting-style',
        name: 'Fighting Style',
        description: 'You adopt a particular style of fighting as your specialty. Choose one of the following options: Archery, Defense, Dueling, Great Weapon Fighting, Protection, or Two-Weapon Fighting.',
        level: 1,
        source: 'Fighter',
        requiresChoice: true,
        options: [
          { id: 'archery', name: 'Archery', description: 'You gain a +2 bonus to attack rolls you make with ranged weapons.' },
          { id: 'defense', name: 'Defense', description: 'While you are wearing armor, you gain a +1 bonus to AC.' },
          { id: 'dueling', name: 'Dueling', description: 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.' },
          { id: 'great-weapon-fighting', name: 'Great Weapon Fighting', description: 'When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll.' },
          { id: 'protection', name: 'Protection', description: 'When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll.' },
          { id: 'two-weapon-fighting', name: 'Two-Weapon Fighting', description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.' }
        ]
      },
      {
        id: 'second-wind',
        name: 'Second Wind',
        description: 'You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.',
        level: 1,
        source: 'Fighter'
      },
      {
        id: 'action-surge',
        name: 'Action Surge',
        description: 'Starting at 2nd level, you can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action. Once you use this feature, you must finish a short or long rest before you can use it again. Starting at 17th level, you can use it twice before a rest.',
        level: 2,
        source: 'Fighter'
      },
      {
        id: 'martial-archetype',
        name: 'Martial Archetype',
        description: 'At 3rd level, you choose an archetype that you strive to emulate in your combat styles and techniques. Your choice grants you features at 3rd level and again at 7th, 10th, 15th, and 18th level.',
        level: 3,
        source: 'Fighter'
      },
      {
        id: 'extra-attack',
        name: 'Extra Attack',
        description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn. The number of attacks increases to three when you reach 11th level in this class and to four when you reach 20th level in this class.',
        level: 5,
        source: 'Fighter'
      },
      {
        id: 'indomitable',
        name: 'Indomitable',
        description: 'Beginning at 9th level, you can reroll a saving throw that you fail. If you do so, you must use the new roll, and you can\'t use this feature again until you finish a long rest. You can use this feature twice between long rests starting at 13th level and three times between long rests starting at 17th level.',
        level: 9,
        source: 'Fighter'
      }
    ],
    subclasses: [
      {
        id: 'battle-master',
        name: 'Battle Master',
        description: 'Those who emulate the archetypal Battle Master employ martial techniques passed down through generations.',
        features: [
          {
            id: 'combat-superiority',
            name: 'Combat Superiority',
            description: 'When you choose this archetype at 3rd level, you learn maneuvers that are fueled by special dice called superiority dice. You learn three maneuvers of your choice. Many maneuvers enhance an attack in some way. You can use only one maneuver per attack. You learn two additional maneuvers of your choice at 7th, 10th, and 15th level.',
            level: 3,
            source: 'Battle Master',
            requiresChoice: true
          },
          {
            id: 'student-of-war',
            name: 'Student of War',
            description: 'At 3rd level, you gain proficiency with one type of artisan\'s tools of your choice.',
            level: 3,
            source: 'Battle Master'
          },
          {
            id: 'know-your-enemy',
            name: 'Know Your Enemy',
            description: 'Starting at 7th level, if you spend at least 1 minute observing or interacting with another creature outside combat, you can learn certain information about its capabilities compared to your own.',
            level: 7,
            source: 'Battle Master'
          },
          {
            id: 'improved-combat-superiority',
            name: 'Improved Combat Superiority',
            description: 'At 10th level, your superiority dice turn into d10s. At 18th level, they turn into d12s.',
            level: 10,
            source: 'Battle Master'
          },
          {
            id: 'relentless',
            name: 'Relentless',
            description: 'Starting at 15th level, when you roll initiative and have no superiority dice remaining, you regain 1 superiority die.',
            level: 15,
            source: 'Battle Master'
          }
        ]
      },
      {
        id: 'champion',
        name: 'Champion',
        description: 'The archetypal Champion focuses on the development of raw physical power honed to deadly perfection.',
        features: [
          {
            id: 'improved-critical',
            name: 'Improved Critical',
            description: 'Beginning when you choose this archetype at 3rd level, your weapon attacks score a critical hit on a roll of 19 or 20.',
            level: 3,
            source: 'Champion'
          },
          {
            id: 'remarkable-athlete',
            name: 'Remarkable Athlete',
            description: 'Starting at 7th level, you can add half your proficiency bonus (round up) to any Strength, Dexterity, or Constitution check you make that doesn\'t already use your proficiency bonus. In addition, when you make a running long jump, the distance you can cover increases by a number of feet equal to your Strength modifier.',
            level: 7,
            source: 'Champion'
          },
          {
            id: 'additional-fighting-style',
            name: 'Additional Fighting Style',
            description: 'At 10th level, you can choose a second option from the Fighting Style class feature.',
            level: 10,
            source: 'Champion'
          },
          {
            id: 'superior-critical',
            name: 'Superior Critical',
            description: 'Starting at 15th level, your weapon attacks score a critical hit on a roll of 18–20.',
            level: 15,
            source: 'Champion'
          },
          {
            id: 'survivor',
            name: 'Survivor',
            description: 'At 18th level, you attain the pinnacle of resilience in battle. At the start of each of your turns, you regain hit points equal to 5 + your Constitution modifier if you have no more than half of your hit points left.',
            level: 18,
            source: 'Champion'
          }
        ]
      },
      {
        id: 'eldritch-knight',
        name: 'Eldritch Knight',
        description: 'The archetypal Eldritch Knight combines the martial mastery common to all fighters with a careful study of magic.',
        features: [
          {
            id: 'spellcasting',
            name: 'Spellcasting',
            description: 'When you reach 3rd level, you augment your martial prowess with the ability to cast spells.',
            level: 3,
            source: 'Eldritch Knight'
          },
          {
            id: 'weapon-bond',
            name: 'Weapon Bond',
            description: 'At 3rd level, you learn a ritual that creates a magical bond between yourself and one weapon. You perform the ritual over the course of 1 hour, which can be done during a short rest. The weapon must be within your reach throughout the ritual. Once you have bonded a weapon to yourself, you can\'t be disarmed of that weapon unless you are incapacitated.',
            level: 3,
            source: 'Eldritch Knight'
          }
        ],
        spellcasting: {
          ability: 'intelligence',
          cantripsKnown: [2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
          spellsKnown: [3, 3, 4, 4, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
          spellSlots: [
            [], [], [2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1]
          ]
        }
      }
    ],
    subclassLevel: 3,
    equipmentOptions: [
      [{ name: 'Chain mail', type: 'armor' }, { name: 'Leather armor, longbow, and 20 arrows', type: 'gear' }],
      [{ name: 'A martial weapon and a shield', type: 'weapon' }, { name: 'Two martial weapons', type: 'weapon' }],
      [{ name: 'A light crossbow and 20 bolts', type: 'weapon' }, { name: 'Two handaxes', type: 'weapon' }],
      [{ name: 'Dungeoneer\'s Pack', type: 'pack' }, { name: 'Explorer\'s Pack', type: 'pack' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'monk',
    name: 'Monk',
    description: 'A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection.',
    hitDie: 8,
    primaryAbility: ['dexterity', 'wisdom'],
    savingThrows: ['strength', 'dexterity'],
    armorProficiencies: [],
    weaponProficiencies: ['Simple Weapons', 'Shortswords'],
    skillChoices: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'],
    skillCount: 2,
    features: [
      {
        id: 'unarmored-defense',
        name: 'Unarmored Defense',
        description: 'Beginning at 1st level, while you are wearing no armor and not wielding a shield, your AC equals 10 + your Dexterity modifier + your Wisdom modifier.',
        level: 1,
        source: 'Monk'
      },
      {
        id: 'martial-arts',
        name: 'Martial Arts',
        description: 'At 1st level, your practice of martial arts gives you mastery of combat styles that use unarmed strikes and monk weapons, which are shortswords and any simple melee weapons that don\'t have the two-handed or heavy property. You gain the following benefits: You can use Dexterity instead of Strength for the attack and damage rolls of your unarmed strikes and monk weapons. You can roll a d4 in place of the normal damage of your unarmed strike or monk weapon. When you use the Attack action with an unarmed strike or a monk weapon on your turn, you can make one unarmed strike as a bonus action.',
        level: 1,
        source: 'Monk'
      },
      {
        id: 'ki',
        name: 'Ki',
        description: 'Starting at 2nd level, your training allows you to harness the mystic energy of ki. Your access to this energy is represented by a number of ki points. You can spend these points to fuel various ki features. You start knowing three such features: Flurry of Blows, Patient Defense, and Step of the Wind.',
        level: 2,
        source: 'Monk'
      },
      {
        id: 'unarmored-movement',
        name: 'Unarmored Movement',
        description: 'Starting at 2nd level, your speed increases by 10 feet while you are unarmored and aren\'t wielding a shield. This bonus increases when you reach certain monk levels.',
        level: 2,
        source: 'Monk'
      },
      {
        id: 'monastic-tradition',
        name: 'Monastic Tradition',
        description: 'When you reach 3rd level, you commit yourself to a monastic tradition. Your tradition grants you features at 3rd level and again at 6th, 11th, and 17th level.',
        level: 3,
        source: 'Monk'
      },
      {
        id: 'deflect-missiles',
        name: 'Deflect Missiles',
        description: 'Starting at 3rd level, you can use your reaction to deflect or catch the missile when you are hit by a ranged weapon attack. When you do so, the damage you take from the attack is reduced by 1d10 + your Dexterity modifier + your monk level. If you reduce the damage to 0, you can catch the missile if it is small enough for you to hold in one hand and you have at least one hand free.',
        level: 3,
        source: 'Monk'
      },
      {
        id: 'slow-fall',
        name: 'Slow Fall',
        description: 'Beginning at 4th level, you can use your reaction when you fall to reduce any falling damage you take by an amount equal to five times your monk level.',
        level: 4,
        source: 'Monk'
      },
      {
        id: 'extra-attack',
        name: 'Extra Attack',
        description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
        level: 5,
        source: 'Monk'
      },
      {
        id: 'stunning-strike',
        name: 'Stunning Strike',
        description: 'Starting at 5th level, you can interfere with the flow of ki in an opponent\'s body. When you hit another creature with a melee weapon attack, you can spend 1 ki point to attempt a stunning strike. The target must succeed on a Constitution saving throw or be stunned until the end of your next turn.',
        level: 5,
        source: 'Monk'
      },
      {
        id: 'ki-empowered-strikes',
        name: 'Ki-Empowered Strikes',
        description: 'Starting at 6th level, your unarmed strikes count as magical for the purpose of overcoming resistance and immunity to nonmagical attacks and damage.',
        level: 6,
        source: 'Monk'
      },
      {
        id: 'evasion',
        name: 'Evasion',
        description: 'At 7th level, your instinctive agility lets you dodge out of the way of certain area effects. When you are subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw, and only half damage if you fail.',
        level: 7,
        source: 'Monk'
      },
      {
        id: 'stillness-of-mind',
        name: 'Stillness of Mind',
        description: 'Starting at 7th level, you can use your action to end one effect on yourself that is causing you to be charmed or frightened.',
        level: 7,
        source: 'Monk'
      },
      {
        id: 'purity-of-body',
        name: 'Purity of Body',
        description: 'At 10th level, your mastery of the ki flowing through you makes you immune to disease and poison.',
        level: 10,
        source: 'Monk'
      },
      {
        id: 'tongue-of-the-sun-and-moon',
        name: 'Tongue of the Sun and Moon',
        description: 'Starting at 13th level, you learn to touch the ki of other minds so that you understand all spoken languages. Moreover, any creature that can understand a language can understand what you say.',
        level: 13,
        source: 'Monk'
      },
      {
        id: 'diamond-soul',
        name: 'Diamond Soul',
        description: 'Beginning at 14th level, your mastery of ki grants you proficiency in all saving throws. Additionally, whenever you make a saving throw and fail, you can spend 1 ki point to reroll it and take the second result.',
        level: 14,
        source: 'Monk'
      },
      {
        id: 'timeless-body',
        name: 'Timeless Body',
        description: 'At 15th level, your ki sustains you so that you suffer none of the frailty of old age, and you can\'t be aged magically. You can still die of old age, however. In addition, you no longer need food or water.',
        level: 15,
        source: 'Monk'
      },
      {
        id: 'empty-body',
        name: 'Empty Body',
        description: 'Beginning at 18th level, you can use your action to spend 4 ki points to become invisible for 1 minute. During that time, you also have resistance to all damage but force damage. Additionally, you can spend 8 ki points to cast the Astral Projection spell, without needing material components.',
        level: 18,
        source: 'Monk'
      },
      {
        id: 'perfect-self',
        name: 'Perfect Self',
        description: 'At 20th level, when you roll for initiative and have no ki points remaining, you regain 4 ki points.',
        level: 20,
        source: 'Monk'
      }
    ],
    subclasses: [
      {
        id: 'four-elements',
        name: 'Way of the Four Elements',
        description: 'You follow a monastic tradition that teaches you to harness the elements.',
        features: [
          {
            id: 'disciple-of-the-elements',
            name: 'Disciple of the Elements',
            description: 'When you choose this tradition at 3rd level, you learn magical disciplines that harness the power of the four elements. A discipline requires you to spend ki points each time you use it. You know the Elemental Attunement discipline and one other elemental discipline of your choice.',
            level: 3,
            source: 'Four Elements'
          }
        ]
      },
      {
        id: 'kensei',
        name: 'Way of the Kensei',
        description: 'Monks of the Way of the Kensei train relentlessly with their weapons, to the point that the weapon becomes an extension of the body.',
        features: [
          {
            id: 'path-of-the-kensei',
            name: 'Path of the Kensei',
            description: 'When you choose this tradition at 3rd level, your special martial arts training leads you to master the use of certain weapons. This path also includes instruction in the deft strokes of calligraphy or painting. You gain proficiency with three martial weapons of your choice.',
            level: 3,
            source: 'Kensei'
          }
        ]
      },
      {
        id: 'open-hand',
        name: 'Way of the Open Hand',
        description: 'Monks of the Way of the Open Hand are the ultimate masters of martial arts combat.',
        features: [
          {
            id: 'open-hand-technique',
            name: 'Open Hand Technique',
            description: 'Starting when you choose this tradition at 3rd level, you can manipulate your enemy\'s ki when you harness your own. Whenever you hit a creature with one of the attacks granted by your Flurry of Blows, you can impose one of the following effects on that target: It must succeed on a Dexterity saving throw or be knocked prone. It must make a Strength saving throw. If it fails, you can push it up to 15 feet away from you. It can\'t take reactions until the end of your next turn.',
            level: 3,
            source: 'Open Hand'
          },
          {
            id: 'wholeness-of-body',
            name: 'Wholeness of Body',
            description: 'At 6th level, you gain the ability to heal yourself. As an action, you can regain hit points equal to three times your monk level. You must finish a long rest before you can use this feature again.',
            level: 6,
            source: 'Open Hand'
          },
          {
            id: 'tranquility',
            name: 'Tranquility',
            description: 'Beginning at 11th level, you can enter a special meditation that surrounds you with an aura of peace. At the end of a long rest, you gain the effect of a Sanctuary spell that lasts until the start of your next long rest (the spell can end early as normal).',
            level: 11,
            source: 'Open Hand'
          },
          {
            id: 'quivering-palm',
            name: 'Quivering Palm',
            description: 'At 17th level, you gain the ability to set up lethal vibrations in someone\'s body. When you hit a creature with an unarmed strike, you can spend 3 ki points to start these imperceptible vibrations, which last for a number of days equal to your monk level. The vibrations are harmless unless you use your action to end them. To do so, you and the target must be on the same plane of existence. When you use this action, the creature must make a Constitution saving throw. If it fails, it is reduced to 0 hit points. If it succeeds, it takes 10d10 necrotic damage.',
            level: 17,
            source: 'Open Hand'
          }
        ]
      },
      {
        id: 'shadow',
        name: 'Way of Shadow',
        description: 'Monks of the Way of Shadow follow a tradition that values stealth and subterfuge.',
        features: [
          {
            id: 'shadow-arts',
            name: 'Shadow Arts',
            description: 'Starting when you choose this tradition at 3rd level, you can use your ki to duplicate the effects of certain spells. As an action, you can spend 2 ki points to cast Darkness, Darkvision, Pass without Trace, or Silence, without providing material components.',
            level: 3,
            source: 'Shadow'
          },
          {
            id: 'shadow-step',
            name: 'Shadow Step',
            description: 'At 6th level, you gain the ability to step from one shadow into another. When you are in dim light or darkness, as a bonus action you can teleport up to 60 feet to an unoccupied space you can see that is also in dim light or darkness.',
            level: 6,
            source: 'Shadow'
          },
          {
            id: 'cloak-of-shadows',
            name: 'Cloak of Shadows',
            description: 'By 11th level, you have learned to become one with the shadows. When you are in an area of dim light or darkness, you can use your action to become invisible. You remain invisible until you make an attack, cast a spell, or are in an area of bright light.',
            level: 11,
            source: 'Shadow'
          },
          {
            id: 'impenetrable-darkness',
            name: 'Impenetrable Darkness',
            description: 'At 17th level, you gain the ability to create an area of impenetrable darkness. As an action, you create a 30-foot-radius sphere of magical darkness centered on a point you choose within 60 feet. The darkness spreads around corners and lasts for 10 minutes.',
            level: 17,
            source: 'Shadow'
          }
        ]
      }
    ],
    subclassLevel: 3,
    equipmentOptions: [
      [{ name: 'A shortsword', type: 'weapon' }, { name: 'Any simple weapon', type: 'weapon' }],
      [{ name: 'A dungeoneer\'s pack', type: 'pack' }, { name: 'An explorer\'s pack', type: 'pack' }],
      [{ name: '10 darts', type: 'weapon' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'paladin',
    name: 'Paladin',
    description: 'A holy knight bound to a sacred oath, combining martial prowess with divine magic.',
    hitDie: 10,
    primaryAbility: ['strength', 'charisma'],
    savingThrows: ['wisdom', 'charisma'],
    armorProficiencies: ['Light Armor', 'Medium Armor', 'Heavy Armor', 'Shields'],
    weaponProficiencies: ['Simple Weapons', 'Martial Weapons'],
    skillChoices: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'],
    skillCount: 2,
    features: [
      {
        id: 'divine-sense',
        name: 'Divine Sense',
        description: 'The presence of strong evil registers on your senses like a noxious odor, and powerful good rings like heavenly music in your ears. As an action, you can open your awareness to detect such forces. Until the end of your next turn, you know the location of any celestial, fiend, or undead within 60 feet of you that is not behind total cover.',
        level: 1,
        source: 'Paladin'
      },
      {
        id: 'lay-on-hands',
        name: 'Lay on Hands',
        description: 'Your blessed touch can heal wounds. You have a pool of healing power that replenishes when you take a long rest. With that pool, you can restore a total number of hit points equal to your paladin level × 5. As an action, you can touch a creature and draw power from the pool to restore a number of hit points to that creature, up to the maximum amount remaining in your pool.',
        level: 1,
        source: 'Paladin'
      },
      {
        id: 'fighting-style',
        name: 'Fighting Style',
        description: 'At 2nd level, you adopt a style of fighting as your specialty. Choose one of the following options: Defense, Dueling, Great Weapon Fighting, or Protection.',
        level: 2,
        source: 'Paladin',
        requiresChoice: true
      },
      {
        id: 'spellcasting',
        name: 'Spellcasting',
        description: 'By 2nd level, you have learned to draw on divine magic through meditation and prayer to cast spells as a cleric does.',
        level: 2,
        source: 'Paladin'
      },
      {
        id: 'divine-smite',
        name: 'Divine Smite',
        description: 'Starting at 2nd level, when you hit a creature with a melee weapon attack, you can expend one spell slot to deal radiant damage to the target, in addition to the weapon\'s damage. The extra damage is 2d8 for a 1st-level spell slot, plus 1d8 if the target is an undead or a fiend.',
        level: 2,
        source: 'Paladin'
      },
      {
        id: 'divine-health',
        name: 'Divine Health',
        description: 'By 3rd level, the divine magic flowing through you makes you immune to disease.',
        level: 3,
        source: 'Paladin'
      },
      {
        id: 'sacred-oath',
        name: 'Sacred Oath',
        description: 'When you reach 3rd level, you swear the oath that binds you as a paladin forever. Up to this time you have been in a preparatory stage, committed to the path but not yet sworn to it. Your choice grants you features at 3rd level and again at 7th, 15th, and 20th level.',
        level: 3,
        source: 'Paladin'
      },
      {
        id: 'extra-attack',
        name: 'Extra Attack',
        description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
        level: 5,
        source: 'Paladin'
      },
      {
        id: 'aura-of-protection',
        name: 'Aura of Protection',
        description: 'Starting at 6th level, whenever you or a friendly creature within 10 feet of you must make a saving throw, the creature gains a bonus to the saving throw equal to your Charisma modifier (with a minimum bonus of +1). You must be conscious to grant this bonus. At 18th level, the range of this aura increases to 30 feet.',
        level: 6,
        source: 'Paladin'
      },
      {
        id: 'aura-of-courage',
        name: 'Aura of Courage',
        description: 'Starting at 10th level, you and friendly creatures within 10 feet of you can\'t be frightened while you are conscious. At 18th level, the range of this aura increases to 30 feet.',
        level: 10,
        source: 'Paladin'
      },
      {
        id: 'improved-divine-smite',
        name: 'Improved Divine Smite',
        description: 'By 11th level, you are so suffused with righteous might that all your melee weapon strikes carry divine power with them. Whenever you hit a creature with a melee weapon, the creature takes an extra 1d8 radiant damage.',
        level: 11,
        source: 'Paladin'
      },
      {
        id: 'cleansing-touch',
        name: 'Cleansing Touch',
        description: 'Beginning at 14th level, you can use your action to end one spell on yourself or on one willing creature that you touch. You can use this feature a number of times equal to your Charisma modifier (a minimum of once).',
        level: 14,
        source: 'Paladin'
      }
    ],
    spellcasting: {
      ability: 'charisma',
      spellPreparation: true,
      spellSlots: [
        [], [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2]
      ]
    },
    subclasses: [
      {
        id: 'ancients',
        name: 'Oath of the Ancients',
        description: 'The Oath of the Ancients is as old as the race of elves and the rituals of the druids.',
        features: [
          {
            id: 'channel-divinity-ancients',
            name: 'Channel Divinity',
            description: 'When you take this oath at 3rd level, you gain the following two Channel Divinity options: Nature\'s Wrath and Turn the Faithless.',
            level: 3,
            source: 'Ancients'
          },
          {
            id: 'aura-of-warding',
            name: 'Aura of Warding',
            description: 'Beginning at 7th level, ancient magic lies so heavily upon you that it forms an eldritch ward. You and friendly creatures within 10 feet of you have resistance to damage from spells. At 18th level, the range of this aura increases to 30 feet.',
            level: 7,
            source: 'Ancients'
          }
        ]
      },
      {
        id: 'devotion',
        name: 'Oath of Devotion',
        description: 'The Oath of Devotion binds a paladin to the loftiest ideals of justice, virtue, and order.',
        features: [
          {
            id: 'channel-divinity-devotion',
            name: 'Channel Divinity',
            description: 'When you take this oath at 3rd level, you gain the following two Channel Divinity options: Sacred Weapon and Turn the Unholy.',
            level: 3,
            source: 'Devotion'
          },
          {
            id: 'aura-of-devotion',
            name: 'Aura of Devotion',
            description: 'Starting at 7th level, you and friendly creatures within 10 feet of you can\'t be charmed while you are conscious. At 18th level, the range of this aura increases to 30 feet.',
            level: 7,
            source: 'Devotion'
          },
          {
            id: 'purity-of-spirit',
            name: 'Purity of Spirit',
            description: 'Beginning at 15th level, you are always under the effects of a Protection from Evil and Good spell.',
            level: 15,
            source: 'Devotion'
          },
          {
            id: 'holy-nimbus',
            name: 'Holy Nimbus',
            description: 'At 20th level, as an action, you can emanate an aura of sunlight. For 1 minute, bright light shines from you in a 30-foot radius, and dim light shines 30 feet beyond that.',
            level: 20,
            source: 'Devotion'
          }
        ]
      },
      {
        id: 'vengeance',
        name: 'Oath of Vengeance',
        description: 'The Oath of Vengeance is a solemn commitment to punish those who have committed a grievous sin.',
        features: [
          {
            id: 'channel-divinity-vengeance',
            name: 'Channel Divinity',
            description: 'When you take this oath at 3rd level, you gain the following two Channel Divinity options: Abjure Enemy and Vow of Enmity.',
            level: 3,
            source: 'Vengeance'
          },
          {
            id: 'relentless-avenger',
            name: 'Relentless Avenger',
            description: 'By 7th level, your supernatural focus helps you close off a foe\'s retreat. When you hit a creature with an opportunity attack, you can move up to half your speed immediately after the attack and as part of the same reaction.',
            level: 7,
            source: 'Vengeance'
          }
        ]
      }
    ],
    subclassLevel: 3,
    equipmentOptions: [
      [{ name: 'A martial weapon and a shield', type: 'weapon' }, { name: 'Two martial weapons', type: 'weapon' }],
      [{ name: 'Five javelins', type: 'weapon' }, { name: 'Any simple melee weapon', type: 'weapon' }],
      [{ name: 'A priest\'s pack', type: 'pack' }, { name: 'An explorer\'s pack', type: 'pack' }],
      [{ name: 'Chain mail', type: 'armor' }, { name: 'A holy symbol', type: 'gear' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'ranger',
    name: 'Ranger',
    description: 'A warrior who uses martial prowess and nature magic to combat threats on the edges of civilization.',
    hitDie: 10,
    primaryAbility: ['dexterity', 'wisdom'],
    savingThrows: ['strength', 'dexterity'],
    armorProficiencies: ['Light Armor', 'Medium Armor', 'Shields'],
    weaponProficiencies: ['Simple Weapons', 'Martial Weapons'],
    skillChoices: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'],
    skillCount: 3,
    features: [
      {
        id: 'favored-enemy',
        name: 'Favored Enemy',
        description: 'Beginning at 1st level, you have significant experience studying, tracking, hunting, and even talking to a certain type of enemy commonly encountered in the wilds. Choose a type of favored enemy: aberrations, beasts, celestials, constructs, dragons, elementals, fey, fiends, giants, monstrosities, oozes, plants, or undead. You gain a +2 bonus to damage rolls with weapon attacks against creatures of the chosen type.',
        level: 1,
        source: 'Ranger',
        requiresChoice: true
      },
      {
        id: 'natural-explorer',
        name: 'Natural Explorer',
        description: 'You are particularly familiar with one type of natural environment and are adept at traveling and surviving in such regions. Choose one type of favored terrain: arctic, coast, desert, forest, grassland, mountain, swamp, or the Underdark. When you make an Intelligence or Wisdom check related to your favored terrain, your proficiency bonus is doubled if you are using a skill that you\'re proficient in.',
        level: 1,
        source: 'Ranger',
        requiresChoice: true
      },
      {
        id: 'fighting-style',
        name: 'Fighting Style',
        description: 'At 2nd level, you adopt a particular style of fighting as your specialty. Choose one of the following options: Archery, Defense, Dueling, or Two-Weapon Fighting.',
        level: 2,
        source: 'Ranger',
        requiresChoice: true
      },
      {
        id: 'spellcasting',
        name: 'Spellcasting',
        description: 'By the time you reach 2nd level, you have learned to use the magical essence of nature to cast spells, much as a druid does.',
        level: 2,
        source: 'Ranger'
      },
      {
        id: 'ranger-archetype',
        name: 'Ranger Archetype',
        description: 'At 3rd level, you choose an archetype that you strive to emulate: Hunter or Beast Master. Your choice grants you features at 3rd level and again at 7th, 11th, and 15th level.',
        level: 3,
        source: 'Ranger'
      },
      {
        id: 'primeval-awareness',
        name: 'Primeval Awareness',
        description: 'Beginning at 3rd level, you can use your action and expend one ranger spell slot to focus your awareness on the region around you. For 1 minute per level of the spell slot you expend, you can sense whether the following types of creatures are present within 1 mile of you (or within up to 6 miles if you are in your favored terrain): aberrations, celestials, dragons, elementals, fey, fiends, and undead.',
        level: 3,
        source: 'Ranger'
      },
      {
        id: 'extra-attack',
        name: 'Extra Attack',
        description: 'Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn.',
        level: 5,
        source: 'Ranger'
      },
      {
        id: 'lands-stride',
        name: 'Land\'s Stride',
        description: 'Starting at 8th level, moving through nonmagical difficult terrain costs you no extra movement. You can also pass through nonmagical plants without being slowed by them and without taking damage from them if they have thorns, spines, or a similar hazard.',
        level: 8,
        source: 'Ranger'
      },
      {
        id: 'hide-in-plain-sight',
        name: 'Hide in Plain Sight',
        description: 'Starting at 10th level, you can spend 1 minute creating camouflage for yourself. You must have access to fresh mud, dirt, plants, soot, and other naturally occurring materials with which to create your camouflage. Once you are camouflaged in this way, you can try to hide by pressing yourself up against a solid surface, such as a tree or wall, that is at least as tall and wide as you are.',
        level: 10,
        source: 'Ranger'
      },
      {
        id: 'vanish',
        name: 'Vanish',
        description: 'Starting at 14th level, you can use the Hide action as a bonus action on your turn. Also, you can\'t be tracked by nonmagical means, unless you choose to leave a trail.',
        level: 14,
        source: 'Ranger'
      },
      {
        id: 'feral-senses',
        name: 'Feral Senses',
        description: 'At 18th level, you gain preternatural senses that help you fight creatures you can\'t see. When you attack a creature you can\'t see, your inability to see it doesn\'t impose disadvantage on your attack rolls against it.',
        level: 18,
        source: 'Ranger'
      },
      {
        id: 'foe-slayer',
        name: 'Foe Slayer',
        description: 'At 20th level, you become an unparalleled hunter of your enemies. Once on each of your turns, you can add your Wisdom modifier to the attack roll or the damage roll of an attack you make against one of your favored enemies.',
        level: 20,
        source: 'Ranger'
      }
    ],
    spellcasting: {
      ability: 'wisdom',
      spellPreparation: true,
      spellSlots: [
        [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2]
      ]
    },
    subclasses: [
      {
        id: 'beast-master',
        name: 'Beast Master',
        description: 'The Beast Master archetype embodies a friendship between the civilized races and the beasts of the world.',
        features: [
          {
            id: 'rangers-companion',
            name: 'Ranger\'s Companion',
            description: 'At 3rd level, you gain a beast companion that accompanies you on your adventures and is trained to fight alongside you. Choose a beast that is no larger than Medium and that has a challenge rating of 1/4 or lower. Add your proficiency bonus to the beast\'s AC, attack rolls, and damage rolls, as well as to any saving throws and skills it is proficient in.',
            level: 3,
            source: 'Beast Master'
          },
          {
            id: 'exceptional-training',
            name: 'Exceptional Training',
            description: 'Beginning at 7th level, on any of your turns when your beast companion doesn\'t attack, you can use a bonus action to command the beast to take the Dash, Disengage, or Help action on its turn.',
            level: 7,
            source: 'Beast Master'
          },
          {
            id: 'bestial-fury',
            name: 'Bestial Fury',
            description: 'Starting at 11th level, when you command your beast companion to take the Attack action, the beast can make two attacks, or it can take the Multiattack action if it has that action.',
            level: 11,
            source: 'Beast Master'
          },
          {
            id: 'share-spells',
            name: 'Share Spells',
            description: 'Beginning at 15th level, when you cast a spell targeting yourself, you can also affect your beast companion with the spell if the beast is within 30 feet of you.',
            level: 15,
            source: 'Beast Master'
          }
        ]
      },
      {
        id: 'gloom-stalker',
        name: 'Gloom Stalker',
        description: 'Gloom stalkers are at home in the darkest places: deep under the earth, in gloomy alleyways, in primeval forests, and wherever else the light dims.',
        features: [
          {
            id: 'dread-ambusher',
            name: 'Dread Ambusher',
            description: 'At 3rd level, you master the art of the ambush. You can give yourself a bonus to your initiative rolls equal to your Wisdom modifier. At the start of your first turn of each combat, your walking speed increases by 10 feet, which lasts until the end of that turn.',
            level: 3,
            source: 'Gloom Stalker'
          }
        ]
      },
      {
        id: 'hunter',
        name: 'Hunter',
        description: 'Emulating the Hunter archetype means accepting your place as a bulwark between civilization and the terrors of the wilderness.',
        features: [
          {
            id: 'hunters-prey',
            name: 'Hunter\'s Prey',
            description: 'At 3rd level, you gain one of the following features of your choice: Colossus Slayer, Giant Killer, or Horde Breaker.',
            level: 3,
            source: 'Hunter',
            requiresChoice: true
          },
          {
            id: 'defensive-tactics',
            name: 'Defensive Tactics',
            description: 'At 7th level, you gain one of the following features of your choice: Escape the Horde, Multiattack Defense, or Steel Will.',
            level: 7,
            source: 'Hunter',
            requiresChoice: true
          },
          {
            id: 'multiattack',
            name: 'Multiattack',
            description: 'At 11th level, you gain one of the following features of your choice: Volley or Whirlwind Attack.',
            level: 11,
            source: 'Hunter',
            requiresChoice: true
          },
          {
            id: 'superior-hunters-defense',
            name: 'Superior Hunter\'s Defense',
            description: 'At 15th level, you gain one of the following features of your choice: Evasion, Stand Against the Tide, or Uncanny Dodge.',
            level: 15,
            source: 'Hunter',
            requiresChoice: true
          }
        ]
      }
    ],
    subclassLevel: 3,
    equipmentOptions: [
      [{ name: 'Scale mail', type: 'armor' }, { name: 'Leather armor', type: 'armor' }],
      [{ name: 'Two shortswords', type: 'weapon' }, { name: 'Two simple melee weapons', type: 'weapon' }],
      [{ name: 'A dungeoneer\'s pack', type: 'pack' }, { name: 'An explorer\'s pack', type: 'pack' }],
      [{ name: 'A longbow and a quiver of 20 arrows', type: 'weapon' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'rogue',
    name: 'Rogue',
    description: 'A scoundrel who uses stealth and trickery to overcome obstacles and enemies.',
    hitDie: 8,
    primaryAbility: 'dexterity',
    savingThrows: ['dexterity', 'intelligence'],
    armorProficiencies: ['Light Armor'],
    weaponProficiencies: ['Simple Weapons', 'Hand Crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
    toolProficiencies: ['Thieves\' tools'],
    skillChoices: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Performance', 'Persuasion', 'Sleight of Hand', 'Stealth'],
    skillCount: 4,
    features: [
      {
        id: 'expertise',
        name: 'Expertise',
        description: 'At 1st level, choose two of your skill proficiencies, or one of your skill proficiencies and your proficiency with thieves\' tools. Your proficiency bonus is doubled for any ability check you make that uses either of the chosen proficiencies. At 6th level, you can choose two more of your proficiencies to gain this benefit.',
        level: 1,
        source: 'Rogue'
      },
      {
        id: 'sneak-attack',
        name: 'Sneak Attack',
        description: 'Beginning at 1st level, you know how to strike subtly and exploit a foe\'s distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack if you have advantage on the attack roll. The attack must use a finesse or a ranged weapon. You don\'t need advantage on the attack roll if another enemy of the target is within 5 feet of it, that enemy isn\'t incapacitated, and you don\'t have disadvantage on the attack roll. The amount of the extra damage increases as you gain levels in this class.',
        level: 1,
        source: 'Rogue'
      },
      {
        id: 'thieves-cant',
        name: 'Thieves\' Cant',
        description: 'During your rogue training you learned thieves\' cant, a secret mix of dialect, jargon, and code that allows you to hide messages in seemingly normal conversation.',
        level: 1,
        source: 'Rogue'
      },
      {
        id: 'cunning-action',
        name: 'Cunning Action',
        description: 'Starting at 2nd level, your quick thinking and agility allow you to move and act quickly. You can take a bonus action on each of your turns in combat. This action can be used only to take the Dash, Disengage, or Hide action.',
        level: 2,
        source: 'Rogue'
      },
      {
        id: 'roguish-archetype',
        name: 'Roguish Archetype',
        description: 'At 3rd level, you choose an archetype that you emulate in the exercise of your rogue abilities. Your archetype choice grants you features at 3rd level and then again at 9th, 13th, and 17th level.',
        level: 3,
        source: 'Rogue'
      },
      {
        id: 'uncanny-dodge',
        name: 'Uncanny Dodge',
        description: 'Starting at 5th level, when an attacker that you can see hits you with an attack, you can use your reaction to halve the attack\'s damage against you.',
        level: 5,
        source: 'Rogue'
      },
      {
        id: 'reliable-talent',
        name: 'Reliable Talent',
        description: 'By 11th level, you have refined your chosen skills until they approach perfection. Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10.',
        level: 11,
        source: 'Rogue'
      },
      {
        id: 'blindsense',
        name: 'Blindsense',
        description: 'Starting at 14th level, if you are able to hear, you are aware of the location of any hidden or invisible creature within 10 feet of you.',
        level: 14,
        source: 'Rogue'
      },
      {
        id: 'slippery-mind',
        name: 'Slippery Mind',
        description: 'By 15th level, you have acquired greater mental strength. You gain proficiency in Wisdom saving throws.',
        level: 15,
        source: 'Rogue'
      },
      {
        id: 'lucky-die',
        name: 'Lucky Die',
        description: 'By 20th level, you have an uncanny knack for succeeding when you need to. If your attack misses a target within range, you can turn the miss into a hit. Alternatively, if you fail an ability check, you can treat the d20 roll as a 20. Once you use this feature, you can\'t use it again until you finish a short or long rest.',
        level: 20,
        source: 'Rogue'
      }
    ],
    subclasses: [
      {
        id: 'arcane-trickster',
        name: 'Arcane Trickster',
        description: 'Some rogues enhance their fine-honed skills of stealth and agility with magic, learning tricks of enchantment and illusion.',
        features: [
          {
            id: 'spellcasting',
            name: 'Spellcasting',
            description: 'When you reach 3rd level, you gain the ability to cast spells.',
            level: 3,
            source: 'Arcane Trickster'
          },
          {
            id: 'mage-hand-legerdemain',
            name: 'Mage Hand Legerdemain',
            description: 'Starting at 3rd level, when you cast Mage Hand, you can make the spectral hand invisible, and you can perform the following additional tasks with it: stow one object the hand is holding in a container worn or carried by another creature, retrieve an object in a container worn or carried by another creature, use thieves\' tools to pick locks and disarm traps at range.',
            level: 3,
            source: 'Arcane Trickster'
          }
        ],
        spellcasting: {
          ability: 'intelligence',
          cantripsKnown: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
          spellsKnown: [3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11],
          spellSlots: [
            [], [], [2], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 1]
          ]
        }
      },
      {
        id: 'assassin',
        name: 'Assassin',
        description: 'You focus your training on the grim art of death.',
        features: [
          {
            id: 'bonus-proficiencies',
            name: 'Bonus Proficiencies',
            description: 'When you choose this archetype at 3rd level, you gain proficiency with the disguise kit and the poisoner\'s kit.',
            level: 3,
            source: 'Assassin'
          },
          {
            id: 'assassinate',
            name: 'Assassinate',
            description: 'Starting at 3rd level, you are at your deadliest when you get the drop on your enemies. You have advantage on attack rolls against any creature that hasn\'t taken a turn in the combat yet. In addition, any hit you score against a creature that is surprised is a critical hit.',
            level: 3,
            source: 'Assassin'
          },
          {
            id: 'infiltration-expertise',
            name: 'Infiltration Expertise',
            description: 'Starting at 9th level, you can unfailingly create false identities for yourself. You must spend seven days and 25 gp to establish the history, profession, and affiliations for an identity.',
            level: 9,
            source: 'Assassin'
          },
          {
            id: 'impostor',
            name: 'Impostor',
            description: 'At 13th level, you gain the ability to unerringly mimic another person\'s speech, writing, and behavior. You must spend at least three hours studying these three components of the person\'s behavior, listening to speech, examining handwriting, and observing mannerisms.',
            level: 13,
            source: 'Assassin'
          },
          {
            id: 'death-strike',
            name: 'Death Strike',
            description: 'Starting at 17th level, you become a master of instant death. When you attack and hit a creature that is surprised, it must make a Constitution saving throw (DC 8 + your Dexterity modifier + your proficiency bonus). On a failed save, double the damage of your attack against the creature.',
            level: 17,
            source: 'Assassin'
          }
        ]
      },
      {
        id: 'swashbuckler',
        name: 'Swashbuckler',
        description: 'You focus your training on the art of the blade, relying on speed, elegance, and charisma in equal parts.',
        features: [
          {
            id: 'fancy-footwork',
            name: 'Fancy Footwork',
            description: 'When you choose this archetype at 3rd level, you learn how to land a strike and then slip away without reprisal. During your turn, if you make a melee attack against a creature, that creature can\'t make opportunity attacks against you for the rest of your turn.',
            level: 3,
            source: 'Swashbuckler'
          },
          {
            id: 'rakish-audacity',
            name: 'Rakish Audacity',
            description: 'Starting at 3rd level, your unmistakable confidence propels you into battle. You can give yourself a bonus to your initiative rolls equal to your Charisma modifier. You also gain an additional way to use your Sneak Attack; you don\'t need advantage on the attack roll to use your Sneak Attack against a creature if you are within 5 feet of it, no other creatures are within 5 feet of you, and you don\'t have disadvantage on the attack roll.',
            level: 3,
            source: 'Swashbuckler'
          }
        ]
      },
      {
        id: 'thief',
        name: 'Thief',
        description: 'You hone your skills in the larcenous arts.',
        features: [
          {
            id: 'fast-hands',
            name: 'Fast Hands',
            description: 'Starting at 3rd level, you can use the bonus action granted by your Cunning Action to make a Sleight of Hand check, use your thieves\' tools to disarm a trap or open a lock, or take the Use an Object action.',
            level: 3,
            source: 'Thief'
          },
          {
            id: 'second-story-work',
            name: 'Second-Story Work',
            description: 'When you choose this archetype at 3rd level, you gain the ability to climb faster than normal; climbing no longer costs you extra movement. In addition, when you make a running jump, the distance you cover increases by a number of feet equal to your Dexterity modifier.',
            level: 3,
            source: 'Thief'
          },
          {
            id: 'supreme-sneak',
            name: 'Supreme Sneak',
            description: 'Starting at 9th level, you have advantage on a Dexterity (Stealth) check if you move no more than half your speed on the same turn.',
            level: 9,
            source: 'Thief'
          },
          {
            id: 'use-magic-device',
            name: 'Use Magic Device',
            description: 'By 13th level, you have learned enough about the workings of magic that you can improvise the use of items even when they are not intended for you. You ignore all class, race, and level requirements on the use of magic items.',
            level: 13,
            source: 'Thief'
          },
          {
            id: 'thiefs-reflexes',
            name: 'Thief\'s Reflexes',
            description: 'When you reach 17th level, you have become adept at laying ambushes and quickly escaping danger. You can take two turns during the first round of any combat. You take your first turn at your normal initiative and your second turn at your initiative minus 10.',
            level: 17,
            source: 'Thief'
          }
        ]
      }
    ],
    subclassLevel: 3,
    equipmentOptions: [
      [{ name: 'Rapier', type: 'weapon' }, { name: 'Shortsword', type: 'weapon' }],
      [{ name: 'Shortbow and quiver of 20 arrows', type: 'weapon' }, { name: 'Shortsword', type: 'weapon' }],
      [{ name: 'Burglar\'s Pack', type: 'pack' }, { name: 'Dungeoneer\'s Pack', type: 'pack' }, { name: 'Explorer\'s Pack', type: 'pack' }],
      [{ name: 'Leather armor', type: 'armor' }, { name: 'Two daggers', type: 'weapon' }, { name: 'Thieves\' tools', type: 'tool' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'sorcerer',
    name: 'Sorcerer',
    description: 'A spellcaster who draws on inherent magic from a gift or bloodline.',
    hitDie: 6,
    primaryAbility: 'charisma',
    savingThrows: ['constitution', 'charisma'],
    armorProficiencies: [],
    weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'],
    skillChoices: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'],
    skillCount: 2,
    features: [
      {
        id: 'spellcasting',
        name: 'Spellcasting',
        description: 'An event in your past, or in the life of a parent or ancestor, left an indelible mark on you, infusing you with arcane magic. This font of magic, whatever its origin, fuels your spells.',
        level: 1,
        source: 'Sorcerer'
      },
      {
        id: 'sorcerous-origin',
        name: 'Sorcerous Origin',
        description: 'Choose a sorcerous origin, which describes the source of your innate magical power. Your choice grants you features when you choose it at 1st level and again at 6th, 14th, and 18th level.',
        level: 1,
        source: 'Sorcerer'
      },
      {
        id: 'font-of-magic',
        name: 'Font of Magic',
        description: 'At 2nd level, you tap into a deep wellspring of magic within yourself. This wellspring is represented by sorcery points, which allow you to create a variety of magical effects. You have 2 sorcery points, and you gain more as you reach higher levels.',
        level: 2,
        source: 'Sorcerer'
      },
      {
        id: 'metamagic',
        name: 'Metamagic',
        description: 'At 3rd level, you gain the ability to twist your spells to suit your needs. You gain two Metamagic options of your choice. You gain another one at 10th and 17th level.',
        level: 3,
        source: 'Sorcerer',
        requiresChoice: true
      },
      {
        id: 'sorcerous-restoration',
        name: 'Sorcerous Restoration',
        description: 'At 20th level, you regain 4 expended sorcery points whenever you finish a short rest.',
        level: 20,
        source: 'Sorcerer'
      }
    ],
    spellcasting: {
      ability: 'charisma',
      cantripsKnown: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
      spellsKnown: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
      spellSlots: [
        [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
        [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
        [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]
      ]
    },
    subclasses: [
      {
        id: 'draconic-bloodline',
        name: 'Draconic Bloodline',
        description: 'Your innate magic comes from draconic magic that was mingled with your blood or that of your ancestors.',
        features: [
          {
            id: 'dragon-ancestor',
            name: 'Dragon Ancestor',
            description: 'At 1st level, you choose one type of dragon as your ancestor. The damage type associated with each dragon is used by features you gain later.',
            level: 1,
            source: 'Draconic Bloodline',
            requiresChoice: true
          },
          {
            id: 'draconic-resilience',
            name: 'Draconic Resilience',
            description: 'As magic flows through your body, it causes physical traits of your dragon ancestors to emerge. At 1st level, your hit point maximum increases by 1 and increases by 1 again whenever you gain a level in this class.',
            level: 1,
            source: 'Draconic Bloodline'
          }
        ]
      },
      {
        id: 'wild-magic',
        name: 'Wild Magic',
        description: 'Your innate magic comes from the wild forces of chaos that underlie the order of creation.',
        features: [
          {
            id: 'wild-magic-surge',
            name: 'Wild Magic Surge',
            description: 'Starting when you choose this origin at 1st level, your spellcasting can unleash surges of untamed magic.',
            level: 1,
            source: 'Wild Magic'
          },
          {
            id: 'tides-of-chaos',
            name: 'Tides of Chaos',
            description: 'Starting at 1st level, you can manipulate the forces of chance and chaos to gain advantage on one attack roll, ability check, or saving throw.',
            level: 1,
            source: 'Wild Magic'
          }
        ]
      }
    ],
    subclassLevel: 1,
    equipmentOptions: [
      [{ name: 'A light crossbow and 20 bolts', type: 'weapon' }, { name: 'Any simple weapon', type: 'weapon' }],
      [{ name: 'A component pouch', type: 'gear' }, { name: 'An arcane focus', type: 'gear' }],
      [{ name: 'A dungeoneer\'s pack', type: 'pack' }, { name: 'An explorer\'s pack', type: 'pack' }],
      [{ name: 'Two daggers', type: 'weapon' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'warlock',
    name: 'Warlock',
    description: 'A wielder of magic that is derived from a bargain with an extraplanar entity.',
    hitDie: 8,
    primaryAbility: 'charisma',
    savingThrows: ['wisdom', 'charisma'],
    armorProficiencies: ['Light Armor'],
    weaponProficiencies: ['Simple Weapons'],
    skillChoices: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'],
    skillCount: 2,
    features: [
      {
        id: 'otherworldly-patron',
        name: 'Otherworldly Patron',
        description: 'At 1st level, you have struck a bargain with an otherworldly being of your choice.',
        level: 1,
        source: 'Warlock'
      },
      {
        id: 'pact-magic',
        name: 'Pact Magic',
        description: 'Your arcane research and the magic bestowed on you by your patron have given you facility with spells.',
        level: 1,
        source: 'Warlock'
      },
      {
        id: 'eldritch-invocations',
        name: 'Eldritch Invocations',
        description: 'In your study of occult lore, you have unearthed eldritch invocations, fragments of forbidden knowledge that imbue you with an abiding magical ability.',
        level: 2,
        source: 'Warlock',
        requiresChoice: true
      },
      {
        id: 'pact-boon',
        name: 'Pact Boon',
        description: 'At 3rd level, your otherworldly patron bestows a gift upon you for your loyal service.',
        level: 3,
        source: 'Warlock',
        requiresChoice: true
      },
      {
        id: 'mystic-arcanum',
        name: 'Mystic Arcanum',
        description: 'At 11th level, your patron bestows upon you a magical secret called an arcanum.',
        level: 11,
        source: 'Warlock'
      },
      {
        id: 'eldritch-master',
        name: 'Eldritch Master',
        description: 'At 20th level, you can draw on your inner reserve of mystical power while entreating your patron to regain expended spell slots.',
        level: 20,
        source: 'Warlock'
      }
    ],
    spellcasting: {
      ability: 'charisma',
      cantripsKnown: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      spellsKnown: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
      spellSlots: [
        [1], [2], [2], [2], [2], [2], [2], [2], [2], [2], [3], [3], [3], [3], [3], [3], [4], [4], [4], [4]
      ]
    },
    subclasses: [
      {
        id: 'archfey',
        name: 'The Archfey',
        description: 'Your patron is a lord or lady of the fey.',
        features: [
          {
            id: 'fey-presence',
            name: 'Fey Presence',
            description: 'Starting at 1st level, your patron bestows upon you the ability to project the beguiling and fearsome presence of the fey.',
            level: 1,
            source: 'Archfey'
          }
        ]
      },
      {
        id: 'fiend',
        name: 'The Fiend',
        description: 'You have made a pact with a fiend from the lower planes.',
        features: [
          {
            id: 'dark-ones-blessing',
            name: 'Dark One\'s Blessing',
            description: 'Starting at 1st level, when you reduce a hostile creature to 0 hit points, you gain temporary hit points.',
            level: 1,
            source: 'Fiend'
          }
        ]
      },
      {
        id: 'great-old-one',
        name: 'The Great Old One',
        description: 'Your patron is a mysterious entity whose nature is utterly foreign.',
        features: [
          {
            id: 'awakened-mind',
            name: 'Awakened Mind',
            description: 'Starting at 1st level, your alien knowledge gives you the ability to touch the minds of other creatures.',
            level: 1,
            source: 'Great Old One'
          }
        ]
      }
    ],
    subclassLevel: 1,
    equipmentOptions: [
      [{ name: 'A light crossbow and 20 bolts', type: 'weapon' }, { name: 'Any simple weapon', type: 'weapon' }],
      [{ name: 'A component pouch', type: 'gear' }, { name: 'An arcane focus', type: 'gear' }],
      [{ name: 'A scholar\'s pack', type: 'pack' }, { name: 'A dungeoneer\'s pack', type: 'pack' }],
      [{ name: 'Leather armor', type: 'armor' }, { name: 'Any simple weapon', type: 'weapon' }, { name: 'Two daggers', type: 'weapon' }]
    ],
    source: 'Player\'s Handbook'
  },
  {
    id: 'wizard',
    name: 'Wizard',
    description: 'A scholarly magic-user capable of manipulating the structures of reality.',
    hitDie: 6,
    primaryAbility: 'intelligence',
    savingThrows: ['intelligence', 'wisdom'],
    armorProficiencies: [],
    weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light Crossbows'],
    skillChoices: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'],
    skillCount: 2,
    features: [
      {
        id: 'spellcasting',
        name: 'Spellcasting',
        description: 'As a student of arcane magic, you have a spellbook containing spells.',
        level: 1,
        source: 'Wizard'
      },
      {
        id: 'arcane-recovery',
        name: 'Arcane Recovery',
        description: 'You have learned to regain some of your magical energy by studying your spellbook.',
        level: 1,
        source: 'Wizard'
      },
      {
        id: 'arcane-tradition',
        name: 'Arcane Tradition',
        description: 'When you reach 2nd level, you choose an arcane tradition.',
        level: 2,
        source: 'Wizard'
      },
      {
        id: 'spell-mastery',
        name: 'Spell Mastery',
        description: 'At 18th level, you have achieved such mastery over certain spells that you can cast them at will.',
        level: 18,
        source: 'Wizard'
      },
      {
        id: 'signature-spell',
        name: 'Signature Spell',
        description: 'When you reach 20th level, you gain mastery over two powerful spells.',
        level: 20,
        source: 'Wizard'
      }
    ],
    spellcasting: {
      ability: 'intelligence',
      spellPreparation: true,
      spellSlots: [
        [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
        [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
        [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]
      ]
    },
    subclasses: [
      {
        id: 'abjuration',
        name: 'School of Abjuration',
        description: 'The School of Abjuration emphasizes magic that blocks, banishes, or protects.',
        features: [
          {
            id: 'arcane-ward',
            name: 'Arcane Ward',
            description: 'Starting at 2nd level, you can weave magic around yourself for protection.',
            level: 2,
            source: 'Abjuration'
          }
        ]
      },
      {
        id: 'evocation',
        name: 'School of Evocation',
        description: 'You focus your study on magic that creates powerful elemental effects.',
        features: [
          {
            id: 'sculpt-spells',
            name: 'Sculpt Spells',
            description: 'Beginning at 2nd level, you can create pockets of relative safety within your evocation spells.',
            level: 2,
            source: 'Evocation'
          }
        ]
      },
      {
        id: 'necromancy',
        name: 'School of Necromancy',
        description: 'The School of Necromancy explores the cosmic forces of life, death, and undeath.',
        features: [
          {
            id: 'grim-harvest',
            name: 'Grim Harvest',
            description: 'At 2nd level, you gain the ability to reap life energy from creatures you kill with your spells.',
            level: 2,
            source: 'Necromancy'
          }
        ]
      }
    ],
    subclassLevel: 2,
    equipmentOptions: [
      [{ name: 'A quarterstaff', type: 'weapon' }, { name: 'A dagger', type: 'weapon' }],
      [{ name: 'A component pouch', type: 'gear' }, { name: 'An arcane focus', type: 'gear' }],
      [{ name: 'A scholar\'s pack', type: 'pack' }, { name: 'An explorer\'s pack', type: 'pack' }],
      [{ name: 'A spellbook', type: 'gear' }]
    ],
    source: 'Player\'s Handbook'
  }
];


const importedClasses = getImportedBucket('classes') as Class[];
export const classes = mergeCollectionsById(baseClasses, importedClasses);

export const getClassById = (id: string): Class | undefined => {
  return classes.find(c => c.id === id);
};

export const getSubclass = (classId: string, subclassId: string): import('@/types/dnd').Subclass | undefined => {
  const cls = getClassById(classId);
  return cls?.subclasses.find(s => s.id === subclassId);
};
