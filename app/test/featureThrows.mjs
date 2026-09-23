// What `deriveFeatureThrows` reads out of a feature's own sentences.
//
// The sheet used to take the first `NdN` in the text, which is wrong in both directions: Supreme
// Healing's worked example became a roll button and Land's Aid's healing never did. Every input
// below is a feature's text as one of the packs carries it, because this fails silently — a missed
// wording costs a button nobody notices is gone, and a wrong one is a die nobody notices is wrong.
//
// Run with `npm run test:feature-throws` from the workspace root.
import assert from 'node:assert/strict';

const { deriveFeatureSaves, deriveFeatureThrows } = await import('@/lib/featureFacets');

const context = {
  level: 20,
  classLevels: { fighter: 20, monk: 20, cleric: 20, druid: 14, barbarian: 20, paladin: 20, bard: 20 },
  abilityModifiers: { strength: 3, dexterity: 4, constitution: 2, intelligence: 1, wisdom: 3, charisma: 5 },
  proficiencyBonus: 6
};

const read = (description, overrides) =>
  deriveFeatureThrows({ description }, { ...context, ...overrides });
const notations = (description, overrides) => read(description, overrides).map((entry) => entry.notation);
const labels = (description, overrides) => read(description, overrides).map((entry) => entry.label);

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, detail: e.message.split('\n')[0] });
  }
}

/* -------------------------------------------------------------------------- *
 * Dice that are not a throw
 * -------------------------------------------------------------------------- */

check('a worked example is not a throw (Supreme Healing)', () => {
  assert.deepEqual(
    notations(
      'Starting at 17th level, when you would normally roll one or more dice to restore hit points ' +
        'with a spell, you instead use the highest number possible for each die. For example, instead ' +
        'of restoring 2d6 hit points to a creature, you restore 12.'
    ),
    []
  );
});

check('a die cost is not a throw (Cunning Strike)', () => {
  assert.deepEqual(
    notations(
      'You remove the die before rolling, and the effect occurs immediately after the attack’s damage ' +
        'is dealt. For example, if you add the Poison effect, remove 1d6 from the Sneak Attack’s damage ' +
        'before rolling. Poison (Cost: 1d6). You add a toxin to your strike.'
    ),
    []
  );
});

check('a cap and a conditional step are not throws (Divine Smite)', () => {
  assert.deepEqual(
    notations(
      'Starting at 2nd level, when you hit a creature with a melee weapon attack, you can expend one ' +
        'spell slot to deal radiant damage to the target, in addition to the weapon’s damage. The extra ' +
        'damage is 2d8 for a 1st-level spell slot, plus 1d8 for each spell level higher than 1st, to a ' +
        'maximum of 5d8. The damage increases by 1d8 if the target is an undead or a fiend, to a ' +
        'maximum of 6d8.'
    ),
    ['2d8']
  );
});

check('a count of rests is not a throw (Greater Divine Intervention)', () => {
  assert.deepEqual(
    notations('If you do so, you can’t use Divine Intervention again until you finish 2d4 Long Rests.'),
    []
  );
});

check('the d20 the character is already rolling is not a throw (Reliable Talent)', () => {
  assert.deepEqual(
    notations(
      'Whenever you make an ability check that uses one of your skill or tool proficiencies, you can ' +
        'treat a d20 roll of 9 or lower as a 10.'
    ),
    []
  );
});

check('another feature’s die is not a throw (Foe Slayer)', () => {
  assert.deepEqual(notations('The damage die of your Hunter’s Mark is a d10 rather than a d6.'), []);
});

/* -------------------------------------------------------------------------- *
 * A die the text states without a count
 * -------------------------------------------------------------------------- */

check('a bare die is a throw, and the sheet prints the count (Martial Arts)', () => {
  assert.deepEqual(
    notations('You can roll a d4 in place of the normal damage of your unarmed strike or monk weapon.'),
    ['1d4']
  );
});

/* -------------------------------------------------------------------------- *
 * What the level does to it
 * -------------------------------------------------------------------------- */

check('a die that changes with the level (2014 Bardic Inspiration)', () => {
  const text =
    'That creature gains one Bardic Inspiration die, a d6. Your Bardic Inspiration die changes when ' +
    'you reach certain levels in this class. The die becomes a d8 at 5th level, a d10 at 10th level, ' +
    'and a d12 at 15th level.';
  assert.deepEqual(notations(text, { level: 1 }), ['1d6']);
  assert.deepEqual(notations(text, { level: 5 }), ['1d8']);
  assert.deepEqual(notations(text, { level: 14 }), ['1d10']);
  assert.deepEqual(notations(text, { level: 20 }), ['1d12']);
});

check('a list of steps introduced once (Song of Rest)', () => {
  const text =
    'Each of those creatures regains an extra 1d6 hit points. The extra hit points increase when you ' +
    'reach certain levels in this class: to 1d8 at 9th level, to 1d10 at 13th level, and to 1d12 at ' +
    '17th level.';
  assert.deepEqual(notations(text, { level: 8 }), ['1d6']);
  assert.deepEqual(notations(text, { level: 13 }), ['1d10']);
  assert.deepEqual(notations(text, { level: 17 }), ['1d12']);
});

check('a list whose later steps state no lead word (Halo of Spores)', () => {
  const text =
    'You can use your reaction to deal 1d4 necrotic damage to that creature unless it succeeds on a ' +
    'Constitution saving throw against your spell save DC. The necrotic damage increases to 1d6 at ' +
    '6th level, 1d8 at 10th level, and 1d10 at 14th level.';
  assert.deepEqual(notations(text, { level: 5 }), ['1d4']);
  assert.deepEqual(notations(text, { level: 10 }), ['1d8']);
  assert.deepEqual(notations(text, { level: 20 }), ['1d10']);
});

check('the level stated before the increase (Divine Strike)', () => {
  const text =
    'Once on each of your turns when you hit a creature with a weapon attack, you can cause the attack ' +
    'to deal an extra 1d8 radiant damage to the target. When you reach 14th level, the extra damage ' +
    'increases to 2d8.';
  assert.deepEqual(notations(text, { level: 13 }), ['1d8']);
  assert.deepEqual(notations(text, { level: 14 }), ['2d8']);
});

check('a bracketed table, and the class it names sets the level (Land’s Aid)', () => {
  const text =
    'Each creature of your choice in the Sphere must make a Constitution saving throw against your ' +
    'spell save DC, taking 2d6 Necrotic damage on a failed save or half as much damage on a ' +
    'successful one. One creature of your choice in that area regains 2d6 Hit Points. The damage and ' +
    'healing increase by 1d6 when you reach Druid levels 10 (3d6) and 14 (4d6).';
  // Two throws: a feature that states damage and healing offers both, not whichever came first.
  assert.deepEqual(labels(text, { classLevels: { druid: 9 } }), ['2d6 necrotic', '2d6 healing']);
  // "The damage and healing increase" names both, so both grow — the nearest-throw rule alone gave
  // the bigger die to the healing and left the damage at what it is printed at.
  assert.deepEqual(labels(text, { classLevels: { druid: 14 } }), ['4d6 necrotic', '4d6 healing']);
});

check('a clause naming one thing grows only that one (Storm Soul)', () => {
  // Both throws are d6, and the nearest one is the healing — the clause naming the damage is the
  // only thing that keeps the bigger die off it.
  const text =
    'The target takes 1d6 fire damage. You also regain 1d6 hit points. The damage increases to 2d6 ' +
    'at 10th level.';
  assert.deepEqual(labels(text, { level: 10 }), ['2d6 fire', '1d6 healing']);
});

check('a table the level has not reached leaves the printed die (Storm Aura)', () => {
  const text =
    'The target takes 1d6 lightning damage on a failed save, or half as much damage on a successful ' +
    'one. The damage increases when you reach certain levels in this class, increasing to 2d6 at 10th ' +
    'level, 3d6 at 15th level, and 4d6 at 20th level.';
  assert.deepEqual(notations(text, { level: 3 }), ['1d6']);
  assert.deepEqual(notations(text, { level: 20 }), ['4d6']);
});

check('a die restated only to say it grows is the throw (Improved Blessed Strikes)', () => {
  assert.deepEqual(
    notations('The extra damage of your Divine Strike increases to 2d8.'),
    ['2d8']
  );
});

/* -------------------------------------------------------------------------- *
 * What the character adds to it
 * -------------------------------------------------------------------------- */

check('a class level (Second Wind)', () => {
  const entry = read('you can use it to regain Hit Points equal to 1d10 plus your Fighter level.')[0];
  assert.equal(entry.notation, '1d10+20');
  assert.equal(entry.kind, 'healing');
  assert.equal(entry.detail, '1d10 plus your Fighter level');
});

check('two terms in one chain (Deflect Missiles)', () => {
  const entry = read(
    'When you do so, the damage you take from the attack is reduced by 1d10 + your Dexterity modifier ' +
      '+ your monk level.'
  )[0];
  assert.equal(entry.notation, '1d10+24');
  assert.equal(entry.kind, 'reduction');
});

check('half a class level (Divine Fury)', () => {
  assert.deepEqual(
    notations(
      'The first creature you hit on each of your turns with a weapon attack takes extra damage equal ' +
        'to 1d6 + half your barbarian level.'
    ),
    ['1d6+10']
  );
});

check('the proficiency bonus, as the stat block abbreviates it (Steel Defender)', () => {
  assert.deepEqual(
    notations('Force-Empowered Rend. Melee Weapon Attack: Hit: 1d8 + PB force damage.'),
    ['1d8+6']
  );
});

check('"your level in this class" (Oath of Glory Channel Divinity)', () => {
  const entry = read(
    'The total number of temporary hit points equals 2d8 + your level in this class, divided among ' +
      'the chosen creatures.'
  )[0];
  assert.equal(entry.notation, '2d8+20');
  assert.equal(entry.kind, 'temporary-hit-points');
});

check('a term this character cannot resolve leaves the throw bare', () => {
  const entry = read('it deals psychic damage equal to 1d6 plus your Wisdom modifier.', {
    abilityModifiers: {}
  })[0];
  assert.equal(entry.notation, '1d6');
  assert.equal(entry.detail, '1d6 plus your Wisdom modifier');
});

/* -------------------------------------------------------------------------- *
 * What the throw is for
 * -------------------------------------------------------------------------- */

check('a damage type is read only where the throw deals damage (Steel Defender Repair)', () => {
  const [attack, repair] = read(
    'Force-Empowered Rend. Melee Weapon Attack: Hit: 1d8 + PB force damage. Repair (3/Day). The ' +
      'magical mechanisms inside the defender restore 2d8 + PB hit points to itself.'
  );
  assert.equal(attack.damageType, 'force');
  assert.equal(repair.kind, 'healing');
  assert.equal(repair.damageType, undefined);
});

check('a reduction two sentences away is not this throw’s (Quivering Palm)', () => {
  const entry = read(
    'If it fails, it is reduced to 0 hit points. If it succeeds, it takes 10d10 necrotic damage.'
  )[0];
  assert.equal(entry.kind, 'damage');
  assert.equal(entry.label, '10d10 necrotic');
});

check('a feature that states both keeps the roll it asks for (Tactical Mind)', () => {
  const entry = read(
    'Rather than regaining Hit Points, you roll 1d10 and add the number rolled to the ability check.'
  )[0];
  assert.equal(entry.kind, 'bonus');
});

check('a feature that states no dice has no throw', () => {
  assert.deepEqual(notations('You can attack twice, instead of once, when you take the Attack action.'), []);
});

/* -------------------------------------------------------------------------- *
 * The die a class table states
 * -------------------------------------------------------------------------- */

const MARTIAL_ARTS_2014 = [
  '1d4', '1d4', '1d4', '1d4', '1d6', '1d6', '1d6', '1d6', '1d6', '1d6',
  '1d8', '1d8', '1d8', '1d8', '1d8', '1d8', '1d10', '1d10', '1d10', '1d10'
];
const SNEAK_ATTACK = [
  '1d6', '1d6', '2d6', '2d6', '3d6', '3d6', '4d6', '4d6', '5d6', '5d6',
  '6d6', '6d6', '7d6', '7d6', '8d6', '8d6', '9d6', '9d6', '10d6', '10d6'
];

const withColumn = (description, name, perLevel, level) =>
  deriveFeatureThrows({ name, description }, { ...context, tableDice: { [name.toLowerCase()]: { perLevel, level } } })
    .map((entry) => entry.notation);

check('a die stated only in the class table grows with the level (Martial Arts)', () => {
  const text =
    'You can roll a d4 in place of the normal damage of your unarmed strike or monk weapon. This die ' +
    'changes as you gain monk levels, as shown in the Martial Arts column of the Monk table.';
  assert.deepEqual(withColumn(text, 'Martial Arts', MARTIAL_ARTS_2014, 1), ['1d4']);
  assert.deepEqual(withColumn(text, 'Martial Arts', MARTIAL_ARTS_2014, 11), ['1d8']);
  assert.deepEqual(withColumn(text, 'Martial Arts', MARTIAL_ARTS_2014, 20), ['1d10']);
});

check('a column that changes the count, not the face (Sneak Attack)', () => {
  const text =
    'Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack. The ' +
    'amount of the extra damage increases as you gain levels in this class, as shown in the Sneak ' +
    'Attack column of the Rogue table.';
  assert.deepEqual(withColumn(text, 'Sneak Attack', SNEAK_ATTACK, 20), ['10d6']);
});

check('a column with no entry for this feature leaves the printed die', () => {
  const text = 'You can roll a d4 in place of the normal damage of your unarmed strike.';
  assert.deepEqual(withColumn(text, 'Martial Arts', SNEAK_ATTACK, 20), ['1d4']);
});

check('the table beats what the prose restates (2024 Bardic Inspiration)', () => {
  const text =
    'This inspiration is represented by your Bardic Inspiration die, which is a d6. At Higher Levels. ' +
    'Your Bardic Inspiration die changes when you reach certain Bard levels, as shown in the Bardic ' +
    'Die column of the Bard Features table. The die becomes a d8 at level 5, a d10 at level 10, and ' +
    'a d12 at level 15.';
  const perLevel = [
    '1d6', '1d6', '1d6', '1d6', '1d8', '1d8', '1d8', '1d8', '1d8', '1d10',
    '1d10', '1d10', '1d10', '1d10', '1d12', '1d12', '1d12', '1d12', '1d12', '1d12'
  ];
  assert.deepEqual(withColumn(text, 'Bardic Inspiration', perLevel, 20), ['1d12']);
  // The prose states the same steps, so the two readings must not disagree about one character.
  assert.deepEqual(withColumn(text, 'Bardic Inspiration', perLevel, 7), ['1d8']);
});

/* -------------------------------------------------------------------------- *
 * The save a feature calls for
 * -------------------------------------------------------------------------- */

const saves = (description, overrides) =>
  deriveFeatureSaves({ description }, { ...context, ...overrides }).map((entry) => entry.label);

check('the 2024 formula, at this character’s own numbers (Breath Weapon)', () => {
  assert.deepEqual(
    saves(
      'Each creature in that area must make a Dexterity saving throw (DC 8 plus your Constitution ' +
        'modifier and Proficiency Bonus). On a failed save, a creature takes 1d10 damage.'
    ),
    ['DC 16 DEX']
  );
});

check('the 2014 formula (Necrotic Shroud)', () => {
  assert.deepEqual(
    saves(
      'Creatures other than your allies within 10 feet of you that can see you must succeed on a ' +
        'Charisma saving throw (DC 8 + your proficiency bonus + your Charisma modifier) or become ' +
        'frightened of you.'
    ),
    ['DC 19 CHA']
  );
});

check('"against your spell save DC" is the character’s (Land’s Aid)', () => {
  assert.deepEqual(
    saves(
      'Each creature of your choice in the Sphere must make a Constitution saving throw against your ' +
        'spell save DC, taking 2d6 Necrotic damage on a failed save.',
      { spellSaveDc: 18 }
    ),
    ['DC 18 CON']
  );
});

check('a feature that states no DC names the save and stops (Stunning Strike)', () => {
  assert.deepEqual(
    saves('The target must succeed on a Constitution saving throw or be Stunned until the end of your next turn.'),
    ['CON Save']
  );
});

check('a save the character is good at is not one the feature imposes', () => {
  assert.deepEqual(saves('You have advantage on Dexterity saving throws against spells.'), []);
  assert.deepEqual(saves('You gain proficiency in Wisdom saving throws.'), []);
});

check('a save the feature forces (Hammering Horns)', () => {
  assert.deepEqual(
    saves(
      'Unless it succeeds on a Strength saving throw against a DC equal to 8 + your proficiency ' +
        'bonus + your Strength modifier, you push it up to 10 feet away from you.'
    ),
    ['DC 17 STR']
  );
});

/* -------------------------------------------------------------------------- *
 * A DC a sibling feature states
 * -------------------------------------------------------------------------- */

const MONKS_FOCUS = {
  name: 'Monk’s Focus',
  description:
    'This energy is represented by Focus Points. You can expend these points to enhance or fuel ' +
    'certain Monk features. You start knowing three such features: Flurry of Blows, Patient ' +
    'Defense, and Step of the Wind, each of which is detailed below. Some features that use Focus ' +
    'Points require your target to make a saving throw. The save DC equals 8 plus your Wisdom ' +
    'modifier and Proficiency Bonus.'
};

const KI = {
  name: 'Ki',
  description:
    'Your access to this energy is represented by a number of ki points. You can spend these points ' +
    'to fuel various ki features. You start knowing three such features: Flurry of Blows, Patient ' +
    'Defense, and Step of the Wind. Some of your ki features require your target to make a saving ' +
    'throw to resist the feature’s effects. The saving throw DC is calculated as follows: Ki save ' +
    'DC = 8 + your proficiency bonus + your Wisdom modifier'
};

const CUNNING_STRIKE = {
  name: 'Cunning Strike',
  description:
    'When you deal Sneak Attack damage, you can add one of the following Cunning Strike effects. ' +
    'If a Cunning Strike effect requires a saving throw, the DC equals 8 plus your Dexterity ' +
    'modifier and Proficiency Bonus.'
};

const PALADIN_CHANNEL_DIVINITY = {
  name: 'Channel Divinity',
  description:
    'You can channel divine energy directly from the Outer Planes. If a Channel Divinity effect ' +
    'requires a saving throw, the DC equals the spell save DC from this class’s Spellcasting feature.'
};

const SACRED_OATH = {
  name: 'Sacred Oath',
  description:
    'Some Channel Divinity effects require saving throws. When you use such an effect from this ' +
    'class, the DC equals your paladin spell save DC.'
};

check('a Focus Point save takes its DC from Monk’s Focus (2024 Stunning Strike)', () => {
  assert.deepEqual(
    saves(
      'Once per turn when you hit a creature, you can expend 1 Focus Point to attempt a stunning ' +
        'strike. The target must make a Constitution saving throw.',
      { siblingFeatures: [MONKS_FOCUS] }
    ),
    ['DC 17 CON']
  );
});

check('a ki save takes its DC from Ki, whose formula is in the next sentence (2014)', () => {
  assert.deepEqual(
    saves(
      'When you hit another creature with a melee weapon attack, you can spend 1 ki point to ' +
        'attempt a stunning strike. The target must succeed on a Constitution saving throw.',
      { siblingFeatures: [KI] }
    ),
    ['DC 17 CON']
  );
});

check('a sibling states the DC for the features it says it fuels (Open Hand Technique)', () => {
  assert.deepEqual(
    saves(
      'Whenever you hit a creature with an attack granted by your Flurry of Blows, you can impose ' +
        'one of the following effects on that target. Push. The target must succeed on a Strength ' +
        'saving throw or be pushed up to 15 feet away from you.',
      { siblingFeatures: [MONKS_FOCUS] }
    ),
    ['DC 17 STR']
  );
});

check('Devious Strikes takes its DC from Cunning Strike', () => {
  assert.deepEqual(
    saves(
      'The following effects are now among your Cunning Strike options. Daze (Cost: 2d6). The ' +
        'target must succeed on a Constitution saving throw.',
      { siblingFeatures: [CUNNING_STRIKE] }
    ),
    ['DC 18 CON']
  );
});

check('a sibling that points at the spell save DC resolves to it (Abjure Foes)', () => {
  assert.deepEqual(
    saves(
      'You can expend one use of this class’s Channel Divinity to overwhelm foes with awe. Each ' +
        'target must succeed on a Wisdom saving throw or have the Frightened condition.',
      { siblingFeatures: [PALADIN_CHANNEL_DIVINITY], spellSaveDc: 19 }
    ),
    ['DC 19 WIS']
  );
});

check('the declaring clause names what it covers, not only the feature (Sacred Oath)', () => {
  assert.deepEqual(
    saves(
      'When you take this oath at 3rd level, you gain the following two Channel Divinity options. ' +
        'Turn the Unholy. Each fiend that can see or hear you must make a Wisdom saving throw.',
      { siblingFeatures: [SACRED_OATH], spellSaveDc: 19 }
    ),
    ['DC 19 WIS']
  );
});

check('a sibling this feature never names states nothing for it', () => {
  assert.deepEqual(
    saves(
      'Each hostile creature that starts its turn in this aura must succeed on a Wisdom saving ' +
        'throw or be charmed until the aura ends.',
      { siblingFeatures: [MONKS_FOCUS, CUNNING_STRIKE] }
    ),
    ['WIS Save']
  );
});

check('a sibling that only imposes a save is not a source for anyone', () => {
  assert.deepEqual(
    saves('The target must succeed on a Constitution saving throw.', {
      siblingFeatures: [
        {
          name: 'Quivering Palm',
          description: 'When you end them, the target must make a Constitution saving throw, taking 10d12 Force damage.'
        }
      ]
    }),
    ['CON Save']
  );
});

check('Tasha’s writes the summed formula the other way round (Infectious Fury)', () => {
  assert.deepEqual(
    saves(
      'The target must succeed on a Wisdom saving throw (DC equal to 8 + your Constitution ' +
        'modifier + your proficiency bonus) or suffer one of the following effects.'
    ),
    ['DC 16 WIS']
  );
});

/* -------------------------------------------------------------------------- *
 * What a success does to the damage
 * -------------------------------------------------------------------------- */

const LANDS_AID =
  'Each creature of your choice in the Sphere must make a Constitution saving throw against your ' +
  'spell save DC, taking 2d6 Necrotic damage on a failed save or half as much damage on a ' +
  'successful one. One creature of your choice in that area regains 2d6 Hit Points.';

check('a save that mitigates says so (Land’s Aid)', () => {
  assert.deepEqual(saves(LANDS_AID, { spellSaveDc: 19 }), ['DC 19 CON (half)']);
});

check('the save is tied to the damage it halves, never the healing beside it', () => {
  const [save] = deriveFeatureSaves({ description: LANDS_AID }, { ...context, spellSaveDc: 19 });
  const damage = read(LANDS_AID, { spellSaveDc: 19 }).find((entry) => entry.kind === 'damage');
  assert.equal(save.halvesDamage, true);
  assert.equal(save.throwId, damage.id);
});

check('the clause is read when it is its own sentence (Storm Aura)', () => {
  assert.deepEqual(
    saves(
      'The target must make a Dexterity saving throw. The target takes 1d6 lightning damage on a ' +
        'failed save, or half as much damage on a successful one.'
    ),
    ['DEX Save (half)']
  );
});

check('a save that negates rather than halves stays plain (Searing Sunburst)', () => {
  assert.deepEqual(
    saves(
      'Each creature in that 20-foot-radius sphere must succeed on a Constitution saving throw or ' +
        'take 2d6 radiant damage.'
    ),
    ['CON Save']
  );
});

check('Evasion is about somebody else’s effect, not a save this feature imposes', () => {
  assert.deepEqual(
    saves(
      'When you are subjected to an effect that allows you to make a Dexterity saving throw to ' +
        'take only half damage, you instead take no damage if you succeed on the saving throw.'
    ),
    []
  );
});

/* -------------------------------------------------------------------------- *
 * What a failed save does
 * -------------------------------------------------------------------------- */

const saveEntries = (description, overrides) =>
  deriveFeatureSaves({ description }, { ...context, ...overrides });
const effects = (description, overrides) => saveEntries(description, overrides).map((entry) => entry.effect);
const conditions = (description, overrides) =>
  saveEntries(description, overrides).map((entry) => entry.conditions ?? []);

check('the 2014 "or" clause is the effect (Stunning Strike)', () => {
  const description =
    'The target must succeed on a Constitution saving throw or be stunned until the end of your ' +
    'next turn.';
  assert.deepEqual(effects(description), ['be stunned until the end of your next turn']);
  assert.deepEqual(conditions(description), [['Stunned']]);
});

check('2024 states it in a sentence of its own (Stunning Strike)', () => {
  const description =
    'The target must make a Constitution saving throw. On a failed save, the target has the ' +
    'Stunned condition until the start of your next turn. On a successful save, the target’s ' +
    'Speed is halved until the start of your next turn.';
  assert.deepEqual(effects(description), [
    'the target has the Stunned condition until the start of your next turn'
  ]);
  assert.deepEqual(conditions(description), [['Stunned']]);
});

check('two conditions are read in the order the clause names them (Channel Divinity)', () => {
  assert.deepEqual(
    conditions(
      'Each creature in a 30-foot Emanation originating from you must make a Wisdom saving throw. ' +
        'If the creature fails its save, it has the Frightened and Incapacitated conditions for 1 ' +
        'minute.'
    ),
    [['Frightened', 'Incapacitated']]
  );
});

check('"If it fails," is the same clause (Quivering Palm)', () => {
  assert.deepEqual(
    effects(
      'The creature must make a Constitution saving throw. If it fails, it is reduced to 0 hit ' +
        'points. If it succeeds, it takes 10d10 necrotic damage.'
    ),
    ['it is reduced to 0 hit points']
  );
});

check('"Unless the save succeeds," is the same clause (Rune Carver)', () => {
  assert.deepEqual(
    effects(
      'You can force the creature to make a Wisdom saving throw. Unless the save succeeds, the ' +
        'creature is charmed by you for 1 minute.'
    ),
    ['the creature is charmed by you for 1 minute']
  );
});

check('a 2024 condition clause with no verb of its own (Cunning Strike)', () => {
  const description = 'The target must succeed on a Dexterity saving throw or have the Prone condition.';
  assert.deepEqual(effects(description), ['have the Prone condition']);
  assert.deepEqual(conditions(description), [['Prone']]);
});

check('damage is already a throw, so a damage-only clause is no effect (Deflect Attacks)', () => {
  assert.deepEqual(
    effects(
      'The creature must succeed on a Dexterity saving throw or take damage equal to two rolls of ' +
        'your Martial Arts die plus your Dexterity modifier.'
    ),
    [undefined]
  );
});

check('the mitigation phrase is not an effect (Land’s Aid)', () => {
  assert.deepEqual(
    effects(
      'Each creature in that area must make a Constitution saving throw against your spell save ' +
        'DC, taking 2d6 Necrotic damage on a failed save or half as much damage on a successful one.'
    ),
    [undefined]
  );
});

check('nor is it when the save states it in its own sentence (Storm Aura)', () => {
  assert.deepEqual(
    effects(
      'The target must make a Dexterity saving throw. The target takes 1d6 lightning damage on a ' +
        'failed save, or half as much damage on a successful one.'
    ),
    [undefined]
  );
});

check('what is left beside the damage is the effect (Wild Surge)', () => {
  const description =
    'Each creature within 10 feet of you must succeed on a Constitution saving throw or take 1d6 ' +
    'radiant damage and be blinded until the start of your next turn.';
  assert.deepEqual(effects(description), ['be blinded until the start of your next turn']);
  assert.deepEqual(conditions(description), [['Blinded']]);
});

check('a clause that only announces a list is not the effect (Infectious Fury)', () => {
  assert.deepEqual(
    effects(
      'The target must succeed on a Wisdom saving throw (DC equal to 8 + your Constitution ' +
        'modifier + your proficiency bonus) or suffer one of the following effects (your choice): ' +
        '• The target must use its reaction to make a melee attack against another creature.'
    ),
    [undefined]
  );
});

check('two saves take the DC each one’s own clause states', () => {
  assert.deepEqual(
    saves(
      'The target must succeed on a Strength saving throw (DC 15) or be pushed 15 feet away. The ' +
        'target must succeed on a Dexterity saving throw (DC 12) or have the Prone condition.'
    ),
    ['DC 15 STR', 'DC 12 DEX']
  );
});

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? `\n       ${entry.detail}` : ''}`);
}
const failed = checks.filter((entry) => !entry.ok).length;
console.log(`\nfeature throws: ${checks.length - failed}/${checks.length} passed`);
process.exit(failed > 0 ? 1 : 0);
