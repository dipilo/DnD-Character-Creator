// GENERATED FILE — do not edit by hand.
// Source: an Obsidian vault of Kids on Bikes (2nd edition) notes, and the rulebook PDF for the
// three appendices the vault has no note for.
// Regenerate with: node scripts/import-kids-on-bikes.mjs
//
// Every value below is read out of those sources. Anything they do not say is absent
// here rather than invented; `meta.warnings` records what the import could not resolve.

import type { KidsOnBikesContent } from './types';

export const kidsOnBikesContent: KidsOnBikesContent = {
  "meta": {
    "systemId": "kids-on-bikes",
    "label": "Kids on Bikes (2nd Edition)",
    "source": "Obsidian vault notes; rulebook chapter 5 and appendices A, B and K",
    "importedAt": "2026-09-03",
    "warnings": [
      "Appendix B: \"ncarceration\" starts lowercase. The book's own PDF is missing that glyph and it is left as printed.",
      "Trope tables name colors the appendices do not define: While, Yellow",
      "Playing The Game: Tiered Checks has a heading but no text in the vault."
    ]
  },
  "stats": [
    {
      "id": "brains",
      "name": "Brains"
    },
    {
      "id": "brawn",
      "name": "Brawn"
    },
    {
      "id": "fight",
      "name": "Fight"
    },
    {
      "id": "flight",
      "name": "Flight"
    },
    {
      "id": "charm",
      "name": "Charm"
    },
    {
      "id": "grit",
      "name": "Grit"
    }
  ],
  "diceOrder": [
    "d20",
    "d12",
    "d10",
    "d8",
    "d6",
    "d4"
  ],
  "ages": [
    {
      "id": "child",
      "name": "Child",
      "statBonuses": [
        {
          "stat": "flight",
          "amount": 1
        },
        {
          "stat": "charm",
          "amount": 1
        }
      ],
      "freeStrength": "quick-healing",
      "forbiddenStrength": "rebellious",
      "text": "Children automatically receive the Quick Healing Strength, and they cannot take the Rebellious Strength. When rolling stat checks, children add +1 to their Flight and Charm checks, as they’re quick and generally likable."
    },
    {
      "id": "teen",
      "name": "Teen",
      "statBonuses": [
        {
          "stat": "fight",
          "amount": 1
        },
        {
          "stat": "brawn",
          "amount": 1
        }
      ],
      "freeStrength": "rebellious",
      "forbiddenStrength": null,
      "text": "Teens automatically receive the Rebellious Strength. When rolling stat checks, teens add +1 to their Fight and Brawn checks, as they’re pugnacious and in their prime."
    },
    {
      "id": "adult",
      "name": "Adult",
      "statBonuses": [
        {
          "stat": "brains",
          "amount": 1
        },
        {
          "stat": "grit",
          "amount": 1
        }
      ],
      "freeStrength": "skilled-at",
      "forbiddenStrength": null,
      "text": "Adults automatically receive the Skilled at ___ Strength. This skill, selected by the character’s player, will correspond to their life experiences, often representing a job they’ve held or a skill they’ve honed over the years. When rolling stat checks, adults add +1 to their Brains and Grit checks. Even if they aren’t always geniuses, they’ve seen enough of the world to know what it’s about and to not get shaken by much."
    }
  ],
  "finishingTouches": [
    {
      "id": "full-name",
      "name": "Full Name",
      "paragraphs": [
        "Remember to keep your name in line with the tone that you and the other players have agreed to for the game."
      ],
      "callouts": []
    },
    {
      "id": "motivation",
      "name": "Motivation",
      "paragraphs": [
        "Write down something that strongly motivates you.",
        "If you feel it’s appropriate for them to know, you can share this information with the other players. Most likely, you’ll just share this motivation with the GM."
      ],
      "callouts": [
        {
          "kind": "example",
          "defaultOpen": false,
          "paragraphs": [
            "It could be a specific motivation (e.g., “find my son no matter what it costs me” or “impress Tom so that he’ll go out with me”), it could be more general, (e.g., “look cool or “learn”), or it could have to do with concealing some information (e.g., “don’t let the others find out that my business is failing” or “don’t let my children learn that I killed their father”)."
          ]
        },
        {
          "kind": "tip",
          "defaultOpen": false,
          "paragraphs": [
            "Typically, children will be motivated by some kind of curiosity. Teens will often be motivated by social factors like fitting in or finding and maintaining a romantic relationship. Adults will be motivated by holding onto or protecting what they have, whether that’s a business or family. And all ages can be motivated by something or someone that they’ve lost."
          ]
        }
      ]
    },
    {
      "id": "fear",
      "name": "Fear",
      "paragraphs": [
        "Write down something that you’re afraid of. Mechanically, fears will have three effects, which we’ll talk more about in “Planned Actions and Snap Decisions.\""
      ],
      "callouts": [
        {
          "kind": "tip",
          "defaultOpen": false,
          "paragraphs": [
            "Children usually fear things that, rationally, they shouldn't fear and don't fear things they ought to. Generally, children fear the unknown and what they can't see. Children are also generally not ashamed of their fears.",
            "Teens are all over the place. Some teens are still scared of the things that scared them as children, but they'll tend to be very tight-lipped about these fears. Often, though, teens are more scared of social isolation, losing friends, or embarrassing themselves. But sometimes, more mature teens—or ones whose lives have been rough—will have fears more like an adult's.",
            "Few adults have the fears that children have, and most of them aren't worried about the kinds of social things that concern teens. Rather, they're typically afraid of things being taken from them. Some adults also fear realistic things going wrong."
          ]
        }
      ]
    },
    {
      "id": "obligations",
      "name": "Obligations",
      "paragraphs": [
        "Regardless of how easy or difficult your character’s life is, they definitely have things they’re required to do."
      ],
      "callouts": []
    },
    {
      "id": "knack",
      "name": "Knack",
      "paragraphs": [
        "Thinking about your character’s backstory, what is something that your character can always do, even when they’re under pressure? This will be your Knack, something that you can do only once per session without having to roll a check for it. Instead, you’ll get a 10 on that check.",
        "You’ll notice on the character sheet that there is a blank space where you can write Knacks. You’ll only choose 1 for now. There will be opportunities to earn more later—but you’ll only ever be able to have 3 Knacks in total."
      ],
      "callouts": [
        {
          "kind": "tip",
          "defaultOpen": false,
          "paragraphs": [
            "To make your Knack, think about an \"-ing\" verb that describes what you're good at, like \"identifying local plants,\" \"computer programming,\" or \"playing soccer.\""
          ]
        }
      ]
    },
    {
      "id": "backpack",
      "name": "Backpack",
      "paragraphs": [
        "The final finishing touch is indicating what you have in your backpack, literally and figuratively. What items are you never without? The backpack is also a good place to list advantages that you have over other people and the more intangible resources you have at your disposal."
      ],
      "callouts": [
        {
          "kind": "example",
          "defaultOpen": false,
          "paragraphs": [
            "Your backpack might indicate that your parents are exceptionally supportive and do everything they can to give you the resources to succeed at school. It might indicate that your bad relationship with your parents has given you a strong sense of self-reliance and ability to do for yourself."
          ]
        }
      ]
    },
    {
      "id": "trope-specific-questions",
      "name": "Trope-Specific Questions",
      "paragraphs": [
        "Each Trope has two questions about your character that should be answered at some point during the character creation process. The answers to these questions do not need to be shared with the other players at the table—but they can be if you would like to. Your comments should be shared with the GM."
      ],
      "callouts": [
        {
          "kind": "example",
          "defaultOpen": false,
          "paragraphs": [
            "Kalsang Barton is motivated by protecting her son and making his life as easy as possible. The sudden loss of his father when he was only six affected him badly. Her Fear is suffocation, and she tells the table that she has had nightmares about suffocating under the earth, like she assumes her husband did when the mine collapsed. In terms of Obligations, she’s of course obligated to care for and provide for her son as well as taking care of the house, though she says that Daniel is finally starting to be able to be more helpful with his chores. Beyond the tangible obligations of single parenting, though, she feels a need to provide all of the guidance to Daniel that both parents would have. In keeping with the work that she has done, she decides that her starting Knack is repairing vehicles. She carries nothing terribly special with her in a literal sense, but she carries the loss of her husband and the flexibility that she learned when she had to switch jobs.",
            "Isabella Freeman is motivated by fitting in with the cool kids, very much in keeping with her taking the Aspiring Wannabe Trope. Her Fear is spiders, which she has been afraid of for as long as she can remember. Her parents take care of all of her tangible needs other than a few odd chores at her house; however, since they’re both pillars of the community, the nearly explicit agreement is that she won’t do anything to embarrass her pillars-of-the-community parents, so she bears that Obligation. She also has the self-imposed Obligation of trying to fit in with the cool kids. Her Knack, she decides, are her sweet dance moves, which have never failed her before. In her Backpack, she always carries gum to make sure that her breath is as fresh as possible. Figuratively speaking, she carries with her a feeling that her parents are disappointed in her and the concern that she’ll never fit in with the cool kids.",
            "Oswald Gates is motivated by learning as much as he possibly can in as many fields as humanly possible. His Fear is heights and falling, and his Obligation is walking his dog twice a day, but beyond that, his parents take care of everything for him. His Knack is reading and understanding quickly. He always carries his calculator and at least two books with him, since he’s never reading just one book. Figuratively, he carries the advice that his grandmother gave him the last time she visited: “Be yourself, Ozzie. Nobody else can be.”"
          ]
        }
      ]
    }
  ],
  "tropes": [
    {
      "id": "adventurous-scout",
      "name": "Adventurous Scout",
      "ages": [
        "child",
        "teen"
      ],
      "statDice": {
        "brains": "d20",
        "brawn": "d12",
        "grit": "d10",
        "charm": "d8",
        "flight": "d6",
        "fight": "d4"
      },
      "suggestedStrengths": [
        "Cool Under Pressure",
        "Intuitive",
        "Lucky",
        "Prepared",
        "Skilled at…",
        "Treasure Hunter"
      ],
      "suggestedFlaws": [
        "Dogmatic",
        "Gullible",
        "Nosey",
        "Paranoid",
        "Patronizing",
        "Rambunctious",
        "Restless"
      ],
      "questions": [
        "Who first got you into Scouting (or more generally, the great outdoors)?",
        "What do you have to give up to spend as much time in nature as you do?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "Orange",
          "upgrade": "First-Aid Kit"
        },
        {
          "age": "teen",
          "color": "Rusty",
          "upgrade": "Basket"
        }
      ]
    },
    {
      "id": "brilliant-mathlete",
      "name": "Brilliant Mathlete",
      "ages": [
        "child",
        "teen"
      ],
      "statDice": {
        "brains": "d20",
        "flight": "d12",
        "grit": "d10",
        "charm": "d8",
        "fight": "d6",
        "brawn": "d4"
      },
      "suggestedStrengths": [
        "Gross",
        "Intuitive",
        "Loyal",
        "Prepared",
        "Skilled at...",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Absent-minded",
        "Clumsy",
        "Cowardly",
        "Dogmatic",
        "Flippant",
        "Picky",
        "Self-pitying"
      ],
      "questions": [
        "Why do you get so much satisfaction from your academic excellence?",
        "What have you sacrificed to be so good in school?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "Red",
          "upgrade": "Tassels"
        },
        {
          "age": "teen",
          "color": "Purple",
          "upgrade": "Basket"
        }
      ]
    },
    {
      "id": "conspiracy-theorist",
      "name": "Conspiracy Theorist",
      "ages": [
        "teen",
        "adult"
      ],
      "statDice": {
        "brains": "d20",
        "fight": "d12",
        "flight": "d10",
        "grit": "d8",
        "brawn": "d6",
        "charm": "d4"
      },
      "suggestedStrengths": [
        "Heroic",
        "Intuitive",
        "Prepared",
        "Skilled at...",
        "Treasure Hunter",
        "Unassuming"
      ],
      "suggestedFlaws": [
        "Lazy",
        "Paranoid",
        "Patronizing",
        "Reckless",
        "Restless",
        "Superstitious",
        "Weak-willed"
      ],
      "questions": [
        "What are you sure is happening in the town that no one else knows about?",
        "How far will you go to have others believe you?"
      ],
      "suggestedBikes": [
        {
          "age": "teen",
          "color": "Yellow",
          "upgrade": "Basket"
        },
        {
          "age": "adult",
          "color": "Yellow",
          "upgrade": "Milk Crate"
        }
      ]
    },
    {
      "id": "cunning-detective",
      "name": "Cunning Detective",
      "ages": [
        "child",
        "teen",
        "adult"
      ],
      "statDice": {
        "brains": "d20",
        "charm": "d12",
        "grit": "d10",
        "fight": "d8",
        "brawn": "d6",
        "flight": "d4"
      },
      "suggestedStrengths": [
        "Cool Under Pressure",
        "Heroic",
        "Intuitive",
        "Protective",
        "Skilled at...",
        "Treasure Hunter"
      ],
      "suggestedFlaws": [
        "Blunt",
        "Callous",
        "Demanding",
        "Nosey",
        "Patronizing",
        "Prejudiced",
        "Vindictive"
      ],
      "questions": [
        "What’s the most impressive case you cracked?",
        "What case could you never solve, and why does it still bother you?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "Blue",
          "upgrade": "Pedal-Powered Lights"
        },
        {
          "age": "teen",
          "color": "Blue",
          "upgrade": "Pedal-Powered Lights"
        },
        {
          "age": "adult",
          "color": "Blue",
          "upgrade": "Pedal-Powered Lights"
        }
      ]
    },
    {
      "id": "blue-collar-worker",
      "name": "Blue-Collar Worker",
      "ages": [
        "adult"
      ],
      "statDice": {
        "brawn": "d20",
        "fight": "d12",
        "grit": "d10",
        "brains": "d8",
        "charm": "d6",
        "flight": "d4"
      },
      "suggestedStrengths": [
        "Cool Under Pressure",
        "Lucky",
        "Prepared",
        "Quick Healing",
        "Tough",
        "Treasure Hunter"
      ],
      "suggestedFlaws": [
        "Blunt",
        "Envious",
        "Greedy",
        "Reckless",
        "Resentful",
        "Superstitious",
        "Vindictive"
      ],
      "questions": [
        "Though it’s tough work, what do you love about what you do?",
        "What would it mean for you if you lost your job?"
      ],
      "suggestedBikes": [
        {
          "age": "adult",
          "color": "Black",
          "upgrade": "First-Aid Kit"
        }
      ]
    },
    {
      "id": "daring-athlete",
      "name": "Daring Athlete",
      "ages": [
        "teen"
      ],
      "statDice": {
        "brawn": "d20",
        "flight": "d12",
        "grit": "d10",
        "fight": "d8",
        "charm": "d6",
        "brains": "d4"
      },
      "suggestedStrengths": [
        "Gross",
        "Heroic",
        "Loyal",
        "Protective",
        "Skilled at...",
        "Tough"
      ],
      "suggestedFlaws": [
        "Boastful",
        "Gullible",
        "Hot-tempered",
        "Impatient",
        "Messy",
        "Rambunctious",
        "Superstitious"
      ],
      "questions": [
        "Why do you get so much satisfaction from being excellent at your sport?",
        "What have you sacrificed to be so good in this sport?"
      ],
      "suggestedBikes": [
        {
          "age": "teen",
          "color": "Green",
          "upgrade": "Pegs"
        }
      ]
    },
    {
      "id": "dedicated-farmer",
      "name": "Dedicated Farmer",
      "ages": [
        "child",
        "teen",
        "adult"
      ],
      "statDice": {
        "brawn": "d20",
        "grit": "d12",
        "fight": "d10",
        "flight": "d8",
        "brains": "d6",
        "charm": "d4"
      },
      "suggestedStrengths": [
        "Cool Under Pressure",
        "Heroic",
        "Prepared",
        "Protective",
        "Tough",
        "Unassuming"
      ],
      "suggestedFlaws": [
        "Callous",
        "Gluttonous",
        "Ignorant",
        "Insecure",
        "Messy",
        "Petty",
        "Rude"
      ],
      "questions": [
        "Why does working the land bring you so much joy?",
        "What do you miss out on because of the time you have to put in farming?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "White",
          "upgrade": "Basket"
        },
        {
          "age": "teen",
          "color": "Gray",
          "upgrade": "Pedal-Powered Lights"
        },
        {
          "age": "adult",
          "color": "Rusty",
          "upgrade": "Ten Speeder"
        }
      ]
    },
    {
      "id": "laidback-slacker",
      "name": "Laidback Slacker",
      "ages": [
        "teen",
        "adult"
      ],
      "statDice": {
        "brawn": "d20",
        "charm": "d12",
        "flight": "d10",
        "fight": "d8",
        "grit": "d6",
        "brains": "d4"
      },
      "suggestedStrengths": [
        "Cool Under Pressure",
        "Easygoing",
        "Intuitive",
        "Treasure Hunter",
        "Unassuming",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Absent-minded",
        "Capricious",
        "Deceitful",
        "Ignorant",
        "Lazy",
        "Messy",
        "Rude"
      ],
      "questions": [
        "What do you think of all the try-hards around you?",
        "What are you willing to go the extra mile for?"
      ],
      "suggestedBikes": [
        {
          "age": "teen",
          "color": "Yellow",
          "upgrade": "Banana Seat"
        },
        {
          "age": "adult",
          "color": "Gray",
          "upgrade": "Basket"
        }
      ]
    },
    {
      "id": "funny-sidekick",
      "name": "Funny Sidekick",
      "ages": [
        "child",
        "teen"
      ],
      "statDice": {
        "charm": "d20",
        "brawn": "d12",
        "flight": "d10",
        "grit": "d8",
        "fight": "d6",
        "brains": "d4"
      },
      "suggestedStrengths": [
        "Easygoing",
        "Gross",
        "Heroic",
        "Protective",
        "Skilled at...",
        "Treasure Hunter"
      ],
      "suggestedFlaws": [
        "Clumsy",
        "Flippant",
        "Gluttonous",
        "Ignorant",
        "Lazy",
        "Messy",
        "Rude"
      ],
      "questions": [
        "What do you do that always lightens your friends’ moods?",
        "When does being in the “sidekick” role frustrate you?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "Blue",
          "upgrade": "Bell"
        },
        {
          "age": "teen",
          "color": "Orange",
          "upgrade": "Trading Cards"
        }
      ]
    },
    {
      "id": "overeager-enthusiast",
      "name": "Overeager Enthusiast",
      "ages": [
        "child",
        "teen",
        "adult"
      ],
      "statDice": {
        "charm": "d20",
        "brains": "d12",
        "grit": "d10",
        "brawn": "d8",
        "fight": "d6",
        "flight": "d4"
      },
      "suggestedStrengths": [
        "Gross",
        "Intuitive",
        "Lucky",
        "Skilled at...",
        "Treasure Hunter",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Capricious",
        "Cowardly",
        "Impatient",
        "Insecure",
        "Oversensitive",
        "Paranoid",
        "Selfpitying"
      ],
      "questions": [
        "How did you get so passionate about what you’re so passionate about?",
        "What have you ignored to pursue this passion?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "Black",
          "upgrade": "Bell"
        },
        {
          "age": "teen",
          "color": "Black",
          "upgrade": "Trading Cards"
        },
        {
          "age": "adult",
          "color": "Black",
          "upgrade": "Trading Cards"
        }
      ]
    },
    {
      "id": "popular-kid",
      "name": "Popular Kid",
      "ages": [
        "child",
        "teen"
      ],
      "statDice": {
        "charm": "d20",
        "flight": "d12",
        "brains": "d10",
        "grit": "d8",
        "brawn": "d6",
        "fight": "d4"
      },
      "suggestedStrengths": [
        "Cool Under Pressure",
        "Easygoing",
        "Loyal",
        "Lucky",
        "Skilled at...",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Boastful",
        "Capricious",
        "Deceitful",
        "Picky",
        "Prejudiced",
        "Spoiled",
        "Weak-willed"
      ],
      "questions": [
        "Beyond people wanting to impress you and the social capital that brings, what do you like about being popular?",
        "How do you treat the unpopular kids?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "Blue",
          "upgrade": "Trading Cards"
        },
        {
          "age": "teen",
          "color": "Purple",
          "upgrade": "Bell"
        }
      ]
    },
    {
      "id": "prom-royalty",
      "name": "Prom Royalty",
      "ages": [
        "teen"
      ],
      "statDice": {
        "charm": "d20",
        "grit": "d12",
        "fight": "d10",
        "flight": "d8",
        "brains": "d6",
        "brawn": "d4"
      },
      "suggestedStrengths": [
        "Cool Under Pressure",
        "Intuitive",
        "Lucky",
        "Prepared",
        "Skilled at...",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Blunt",
        "Hot-tempered",
        "Petty",
        "Self-centered",
        "Spoiled",
        "Vain",
        "Vindictive"
      ],
      "questions": [
        "What benefits have you gained from having such a high place in the school’s social hierarchy?",
        "How did it feel the first time you heard someone say that you’re “beautiful but terrible”?"
      ],
      "suggestedBikes": [
        {
          "age": "teen",
          "color": "Red",
          "upgrade": "Ten Speeder"
        }
      ]
    },
    {
      "id": "animal-lover",
      "name": "Animal Lover",
      "ages": [
        "child",
        "teen"
      ],
      "statDice": {
        "fight": "d20",
        "brawn": "d12",
        "charm": "d10",
        "flight": "d8",
        "brains": "d6",
        "grit": "d4"
      },
      "suggestedStrengths": [
        "Cool Under Pressure",
        "Easygoing",
        "Protective",
        "Skilled at...",
        "Tough",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Clumsy",
        "Demanding",
        "Dogmatic",
        "Oversensitive",
        "Picky",
        "Spoiled",
        "Weakwilled"
      ],
      "questions": [
        "When did you get the pet that’s always by your side?",
        "Why do you feel like your pet understands you better than most people?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "Purple",
          "upgrade": "Basket"
        },
        {
          "age": "teen",
          "color": "Purple",
          "upgrade": "Milk Crate"
        }
      ]
    },
    {
      "id": "mysterious-transfer",
      "name": "Mysterious Transfer",
      "ages": [
        "child",
        "teen"
      ],
      "statDice": {
        "fight": "d20",
        "flight": "d12",
        "brains": "d10",
        "grit": "d8",
        "brawn": "d6",
        "charm": "d4"
      },
      "suggestedStrengths": [
        "Easygoing",
        "Gross",
        "Heroic",
        "Skilled at...",
        "Unassuming",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Boastful",
        "Envious",
        "Gullible",
        "Picky",
        "Rambunctious",
        "Reckless",
        "Restless"
      ],
      "questions": [
        "Why is being new and mysterious so much fun for you?",
        "Which rumor about you hurts the most?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "Neon Pink",
          "upgrade": "Basket"
        },
        {
          "age": "teen",
          "color": "While",
          "upgrade": "Milk Crate"
        }
      ]
    },
    {
      "id": "overprotective-parent",
      "name": "Overprotective Parent",
      "ages": [
        "adult"
      ],
      "statDice": {
        "fight": "d20",
        "brains": "d12",
        "brawn": "d10",
        "charm": "d8",
        "flight": "d6",
        "grit": "d4"
      },
      "suggestedStrengths": [
        "Heroic",
        "Loyal",
        "Prepared",
        "Protective",
        "Tough",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Demanding",
        "Dogmatic",
        "Nosey",
        "Oversensitive",
        "Paranoid",
        "Prejudiced",
        "Self-pitying"
      ],
      "questions": [
        "When do you feel most appreciated by your kid(s)?",
        "What about your kid(s) do you wish you could change?"
      ],
      "suggestedBikes": [
        {
          "age": "adult",
          "color": "Green",
          "upgrade": "First-Aid Kit"
        }
      ]
    },
    {
      "id": "unlikely-ally",
      "name": "Unlikely Ally",
      "ages": [
        "teen",
        "adult"
      ],
      "statDice": {
        "fight": "d20",
        "grit": "d12",
        "brawn": "d10",
        "brains": "d8",
        "charm": "d6",
        "flight": "d4"
      },
      "suggestedStrengths": [
        "Easygoing",
        "Gross",
        "Heroic",
        "Lucky",
        "Tough",
        "Skilled at..."
      ],
      "suggestedFlaws": [
        "Flippant",
        "Callous",
        "Hot-tempered",
        "Oversensitive",
        "Prejudiced",
        "Rambunctious",
        "Reckless"
      ],
      "questions": [
        "What makes it so surprising that you’re working with this group?",
        "Despite your aloof exterior, what do you genuinely care about?"
      ],
      "suggestedBikes": [
        {
          "age": "teen",
          "color": "Rusty",
          "upgrade": "Milk Crate"
        },
        {
          "age": "adult",
          "color": "Black",
          "upgrade": "Pegs"
        }
      ]
    },
    {
      "id": "aspiring-wannabe",
      "name": "Aspiring Wannabe",
      "ages": [
        "teen"
      ],
      "statDice": {
        "flight": "d20",
        "grit": "d12",
        "charm": "d10",
        "fight": "d8",
        "brains": "d6",
        "brawn": "d4"
      },
      "suggestedStrengths": [
        "Intuitive",
        "Loyal",
        "Prepared",
        "Protective",
        "Skilled at...",
        "Unassuming"
      ],
      "suggestedFlaws": [
        "Deceitful",
        "Envious",
        "Gullible",
        "Insecure",
        "Resentful",
        "Selfcentered",
        "Weakwilled"
      ],
      "questions": [
        "What would it mean to be one of the popular kids?",
        "What would you sacrifice to be one of the cool kids?"
      ],
      "suggestedBikes": [
        {
          "age": "teen",
          "color": "Gold",
          "upgrade": "Pegs"
        }
      ]
    },
    {
      "id": "freakazoid",
      "name": "Freakazoid",
      "ages": [
        "child",
        "teen"
      ],
      "statDice": {
        "flight": "d20",
        "fight": "d12",
        "brawn": "d10",
        "charm": "d8",
        "grit": "d6",
        "brains": "d4"
      },
      "suggestedStrengths": [
        "Gross",
        "Lucky",
        "Tough",
        "Treasure Hunter",
        "Unassuming",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Absent-minded",
        "Flippant",
        "Hottempered",
        "Ignorant",
        "Lazy",
        "Rambunctious",
        "Restless"
      ],
      "questions": [
        "What are the key components of your weirdo facade?",
        "What are you worried people will find out about you if you drop your facade?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "Black",
          "upgrade": "Trading Cards"
        },
        {
          "age": "teen",
          "color": "Orange",
          "upgrade": "Basket"
        }
      ]
    },
    {
      "id": "goody-goody",
      "name": "Goody Goody",
      "ages": [
        "child",
        "teen"
      ],
      "statDice": {
        "flight": "d20",
        "charm": "d12",
        "brains": "d10",
        "brawn": "d8",
        "grit": "d6",
        "fight": "d4"
      },
      "suggestedStrengths": [
        "Loyal",
        "Lucky",
        "Prepared",
        "Skilled at...",
        "Unassuming",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Boastful",
        "Cowardly",
        "Demanding",
        "Impatient",
        "Nosey",
        "Oversensitive",
        "Patronizing"
      ],
      "questions": [
        "Why does approval from adults mean so much to you?",
        "Who did you recently hurt by seeking an adult’s approval?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "Neon Pink",
          "upgrade": "Bell"
        },
        {
          "age": "teen",
          "color": "Silver",
          "upgrade": "Bell"
        }
      ]
    },
    {
      "id": "silver-spoon",
      "name": "Silver Spoon",
      "ages": [
        "child",
        "teen"
      ],
      "statDice": {
        "flight": "d20",
        "brains": "d12",
        "fight": "d10",
        "charm": "d8",
        "brawn": "d6",
        "grit": "d4"
      },
      "suggestedStrengths": [
        "Intuitive",
        "Lucky",
        "Prepared",
        "Treasure Hunter",
        "Unassuming",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Boastful",
        "Greedy",
        "Impatient",
        "Insecure",
        "Rude",
        "Self-centered",
        "Vain"
      ],
      "questions": [
        "What advantages has your wealth given you?",
        "How does your family exploit the town to make its money?"
      ],
      "suggestedBikes": [
        {
          "age": "child",
          "color": "White",
          "upgrade": "Bell"
        },
        {
          "age": "teen",
          "color": "Gold",
          "upgrade": "Pegs"
        }
      ]
    },
    {
      "id": "reclusive-eccentric",
      "name": "Reclusive Eccentric",
      "ages": [
        "adult"
      ],
      "statDice": {
        "grit": "d20",
        "flight": "d12",
        "brains": "d10",
        "brawn": "d8",
        "fight": "d6",
        "charm": "d4"
      },
      "suggestedStrengths": [
        "Intuitive",
        "Prepared",
        "Tough",
        "Treasure Hunter",
        "Unassuming",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Absent-minded",
        "Capricious",
        "Clumsy",
        "Cowardly",
        "Gluttonous",
        "Callous",
        "Picky"
      ],
      "questions": [
        "What drove you away from the world at large?",
        "What have you gained from your time away from the world?"
      ],
      "suggestedBikes": [
        {
          "age": "adult",
          "color": "White",
          "upgrade": "Milk Crate"
        }
      ]
    },
    {
      "id": "seasoned-babysitter",
      "name": "Seasoned Babysitter",
      "ages": [
        "teen"
      ],
      "statDice": {
        "grit": "d20",
        "charm": "d12",
        "flight": "d10",
        "brains": "d8",
        "fight": "d6",
        "brawn": "d4"
      },
      "suggestedStrengths": [
        "Intuitive",
        "Loyal",
        "Protective",
        "Quick Healing",
        "Tough",
        "Wealthy"
      ],
      "suggestedFlaws": [
        "Deceitful",
        "Resentful",
        "Self-centered",
        "Spoiled",
        "Superstitious",
        "Vain",
        "Vindictive"
      ],
      "questions": [
        "How did you get your start babysitting?",
        "What’s a mistake you made while babysitting that bothers you to this day?"
      ],
      "suggestedBikes": [
        {
          "age": "teen",
          "color": "Silver",
          "upgrade": "Banana Seat"
        }
      ]
    },
    {
      "id": "stoic-professional",
      "name": "Stoic Professional",
      "ages": [
        "adult"
      ],
      "statDice": {
        "grit": "d20",
        "brains": "d12",
        "charm": "d10",
        "brawn": "d8",
        "flight": "d6",
        "fight": "d4"
      },
      "suggestedStrengths": [
        "Cool Under Pressure",
        "Easygoing",
        "Heroic",
        "Loyal",
        "Lucky",
        "Prepared"
      ],
      "suggestedFlaws": [
        "Gluttonous",
        "Greedy",
        "Callous",
        "Petty",
        "Spoiled",
        "Vain",
        "Vindictive"
      ],
      "questions": [
        "To what extent do you enjoy the work you do?",
        "What would you rather be doing?"
      ],
      "suggestedBikes": [
        {
          "age": "adult",
          "color": "Gray",
          "upgrade": "Ten Speeder"
        }
      ]
    },
    {
      "id": "young-provider",
      "name": "Young Provider",
      "ages": [
        "teen"
      ],
      "statDice": {
        "grit": "d20",
        "brawn": "d12",
        "charm": "d10",
        "brains": "d8",
        "fight": "d6",
        "flight": "d4"
      },
      "suggestedStrengths": [
        "Easygoing",
        "Protective",
        "Skilled at...",
        "Tough",
        "Treasure Hunter",
        "Unassuming"
      ],
      "suggestedFlaws": [
        "Blunt",
        "Envious",
        "Greedy",
        "Petty",
        "Resentful",
        "Restless",
        "Self-pitying"
      ],
      "questions": [
        "How has working to support your family improved you as a person?",
        "What have you had to sacrifice to support your family?"
      ],
      "suggestedBikes": [
        {
          "age": "teen",
          "color": "Silver",
          "upgrade": "Pegs"
        }
      ]
    }
  ],
  "strengths": [
    {
      "id": "cool-under-pressure",
      "name": "Cool Under Pressure",
      "description": "May spend 1 Adversity Token to take half of your die’s value instead of rolling on a Snap Decision.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "easygoing",
      "name": "Easygoing",
      "description": "Gain 2 Adversity Tokens when you fail, instead of 1.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "gross",
      "name": "Gross",
      "description": "You have some kind of gross bodily trick (loud, quiet, smelly... up to you) that you can do on command.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "heroic",
      "name": "Heroic",
      "description": "You do not need the GM’s permission to spend Adversity Tokens to ignore Fears.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "intuitive",
      "name": "Intuitive",
      "description": "May spend 1 Adversity Token to ask the GM about your surroundings, an NPC, or the like. The GM must answer honestly.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "loyal",
      "name": "Loyal",
      "description": "Each of the Adversity Tokens you spend to help your friends gives them a +2 instead of a +1.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "lucky",
      "name": "Lucky",
      "description": "You may spend 2 Adversity Tokens to reroll a stat check.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "prepared",
      "name": "Prepared",
      "description": "May spend 2 Adversity Tokens to just happen to have one commonplace item with you (GM’s discretion).",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "protective",
      "name": "Protective",
      "description": "Add +3 to rolls when defending one of your friends.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "quick-healing",
      "name": "Quick Healing",
      "description": "(Free for kids; available to teens and adults) You recover from injuries more quickly, and don’t suffer lasting effects from most injuries.",
      "freeFor": [
        "child"
      ],
      "restrictedTo": null,
      "note": "Free for kids; available to teens and adults"
    },
    {
      "id": "rebellious",
      "name": "Rebellious",
      "description": "(Free for and available only to teens) Add +3 to rolls to persuade or resist persuasion from Kids. Add +3 to rolls to resist persuasion from Adults.",
      "freeFor": [
        "teen"
      ],
      "restrictedTo": [
        "teen"
      ],
      "note": "Free for and available only to teens"
    },
    {
      "id": "skilled-at",
      "name": "Skilled at",
      "description": "(Free for Adults; available to teens and, at GM’s discretion, to kids) Choose a skill (GM’s discretion). You are assumed to succeed when making even moderately difficult checks involving this skill. If the GM determines that you do need to roll for a more difficult check, add up to +3 to your roll.",
      "freeFor": [
        "adult"
      ],
      "restrictedTo": null,
      "note": "Free for Adults; available to teens and, at GM’s discretion, to kids"
    },
    {
      "id": "tough",
      "name": "Tough",
      "description": "If you lose a combat roll, add +3 to the negative number. You will still lose the roll no matter what but could reduce your loss to -1.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "treasure-hunter",
      "name": "Treasure Hunter",
      "description": "May spend 1 Adversity Token to find a useful item in your surroundings.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "unassuming",
      "name": "Unassuming",
      "description": "May spend 2 Adversity Tokens to not be seen, within reason (GM’s discretion).",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    },
    {
      "id": "wealthy",
      "name": "Wealthy",
      "description": "May spend money as though you were in a higher age bracket. For example, a wealthy child is considered to have the disposable income of a typical teen, and a wealthy teen is considered to have the disposable income of a typical adult. A wealthy adult is considered to not have to worry too much about money—they would certainly be able to buy anything they need, and likely able to spend their way out of a lot of situations.",
      "freeFor": [],
      "restrictedTo": null,
      "note": null
    }
  ],
  "flaws": [
    {
      "id": "absent-minded",
      "name": "Absent-minded",
      "description": ""
    },
    {
      "id": "blunt",
      "name": "Blunt",
      "description": ""
    },
    {
      "id": "boastful",
      "name": "Boastful",
      "description": ""
    },
    {
      "id": "callous",
      "name": "Callous",
      "description": ""
    },
    {
      "id": "capricious",
      "name": "Capricious",
      "description": ""
    },
    {
      "id": "clumsy",
      "name": "Clumsy",
      "description": ""
    },
    {
      "id": "cowardly",
      "name": "Cowardly",
      "description": ""
    },
    {
      "id": "deceitful",
      "name": "Deceitful",
      "description": ""
    },
    {
      "id": "demanding",
      "name": "Demanding",
      "description": ""
    },
    {
      "id": "dogmatic",
      "name": "Dogmatic",
      "description": ""
    },
    {
      "id": "envious",
      "name": "Envious",
      "description": ""
    },
    {
      "id": "flippant",
      "name": "Flippant",
      "description": ""
    },
    {
      "id": "gluttonous",
      "name": "Gluttonous",
      "description": ""
    },
    {
      "id": "greedy",
      "name": "Greedy",
      "description": ""
    },
    {
      "id": "gullible",
      "name": "Gullible",
      "description": ""
    },
    {
      "id": "hot-tempered",
      "name": "Hot-tempered",
      "description": ""
    },
    {
      "id": "ignorant",
      "name": "Ignorant",
      "description": ""
    },
    {
      "id": "impatient",
      "name": "Impatient",
      "description": ""
    },
    {
      "id": "insecure",
      "name": "Insecure",
      "description": ""
    },
    {
      "id": "lazy",
      "name": "Lazy",
      "description": ""
    },
    {
      "id": "messy",
      "name": "Messy",
      "description": ""
    },
    {
      "id": "nosey",
      "name": "Nosey",
      "description": ""
    },
    {
      "id": "oversensitive",
      "name": "Oversensitive",
      "description": ""
    },
    {
      "id": "paranoid",
      "name": "Paranoid",
      "description": ""
    },
    {
      "id": "patronizing",
      "name": "Patronizing",
      "description": ""
    },
    {
      "id": "petty",
      "name": "Petty",
      "description": ""
    },
    {
      "id": "picky",
      "name": "Picky",
      "description": ""
    },
    {
      "id": "prejudiced",
      "name": "Prejudiced",
      "description": ""
    },
    {
      "id": "rambunctious",
      "name": "Rambunctious",
      "description": ""
    },
    {
      "id": "reckless",
      "name": "Reckless",
      "description": ""
    },
    {
      "id": "resentful",
      "name": "Resentful",
      "description": ""
    },
    {
      "id": "restless",
      "name": "Restless",
      "description": ""
    },
    {
      "id": "rude",
      "name": "Rude",
      "description": ""
    },
    {
      "id": "self-centered",
      "name": "Self-centered",
      "description": ""
    },
    {
      "id": "self-pitying",
      "name": "Self-pitying",
      "description": ""
    },
    {
      "id": "spoiled",
      "name": "Spoiled",
      "description": ""
    },
    {
      "id": "superstitious",
      "name": "Superstitious",
      "description": ""
    },
    {
      "id": "vain",
      "name": "Vain",
      "description": ""
    },
    {
      "id": "vindictive",
      "name": "Vindictive",
      "description": ""
    },
    {
      "id": "weak-willed",
      "name": "Weak-willed",
      "description": ""
    }
  ],
  "bikes": {
    "colors": [
      {
        "id": "black",
        "name": "Black",
        "adjective": "Intense",
        "benefit": "You get +1 to Fight checks."
      },
      {
        "id": "blue",
        "name": "Blue",
        "adjective": "Trustworthy",
        "benefit": "You get +1 to Charm checks."
      },
      {
        "id": "gold",
        "name": "Gold",
        "adjective": "Flashy",
        "benefit": "If you perform a stunt, you get +3 to Charm checks against any characters who witness the stunt."
      },
      {
        "id": "gray",
        "name": "Gray",
        "adjective": "Level Headed",
        "benefit": "If you know the area, you cannot get lost."
      },
      {
        "id": "green",
        "name": "Green",
        "adjective": "Strong",
        "benefit": "You get +1 to Brawn checks."
      },
      {
        "id": "neon-pink",
        "name": "Neon Pink",
        "adjective": "Fast",
        "benefit": "You get +1 to Flight checks."
      },
      {
        "id": "orange",
        "name": "Orange",
        "adjective": "Outgoing",
        "benefit": "Each time you succeed at a check, an ally of your choice receives one Adversity Token."
      },
      {
        "id": "purple",
        "name": "Purple",
        "adjective": "Decisive",
        "benefit": "You may treat Snap Decisions as Planned Actions."
      },
      {
        "id": "red",
        "name": "Red",
        "adjective": "Ambitious",
        "benefit": "Each Adversity Token you spend during a check adds an additional +1 to your roll"
      },
      {
        "id": "rusty",
        "name": "Rusty",
        "adjective": "Tough",
        "benefit": "You get +1 to Grit checks."
      },
      {
        "id": "silver",
        "name": "Silver",
        "adjective": "Noble",
        "benefit": "You have the Protective strength."
      },
      {
        "id": "white",
        "name": "White",
        "adjective": "Confident",
        "benefit": "You get +1 to Brains checks."
      }
    ],
    "upgrades": [
      {
        "id": "banana-seat",
        "name": "Banana Seat",
        "adjective": "Easy Rider",
        "benefit": "Your bike can carry a passenger. Once per day, if the Powered Character is your passenger, they regain up to 2 PT. (This cannot put them over their starting amount)"
      },
      {
        "id": "basket",
        "name": "Basket",
        "adjective": "Organized Mess",
        "benefit": "Once per day, you may reach into the basket and come up with a commonplace item."
      },
      {
        "id": "bell",
        "name": "Bell",
        "adjective": "Useful Ringing",
        "benefit": "If you can explain, in narrative terms, how ringing the bell helps an ally during their check, they get +1 to that check."
      },
      {
        "id": "first-aid-kit",
        "name": "First-Aid Kit",
        "adjective": "Bandages Ready",
        "benefit": "Once per day, you may use this first-aid kit to help an ally recover from an injury (at GM's discretion)."
      },
      {
        "id": "milk-crate",
        "name": "Milk Crate",
        "adjective": "Big Hauler",
        "benefit": "Your bike can carry a single large item. You must explain, in narrative terms, why your bike is outfitted to carry this item."
      },
      {
        "id": "pegs",
        "name": "Pegs",
        "adjective": "Standing Room",
        "benefit": "Your bike can carry a passenger. If you have a passanger, they receive the benefits of your bike's color as well."
      },
      {
        "id": "tassels",
        "name": "Tassels",
        "adjective": "Getaway Ride",
        "benefit": "You get +1 to all checks while being chased."
      },
      {
        "id": "ten-speeder",
        "name": "Ten Speeder",
        "adjective": "Lower Gear",
        "benefit": "You may shift into a lower gear and pedal hard to add d4 to your Flight checks, but you suffer -1 to all Brawn and Grit checks until you can fully catch your breath."
      },
      {
        "id": "trading-cards",
        "name": "Trading Cards",
        "adjective": "Loud Wheels",
        "benefit": "You get +1 to checks, if you are attempting to distract others."
      },
      {
        "id": "pedal-powered-lights",
        "name": "Pedal-Powered Lights",
        "adjective": "Shining Rider",
        "benefit": "You get +1 to all checks after dark."
      }
    ]
  },
  "bondedActions": {
    "intro": [
      "After answering relationship questions, you and another character who know each other very well may agree to have your characters have a Bonded Action. This benefit enables the two of you, once per session, to do something together that you’ve practiced many times before.",
      "This practice will allow you to make collaborative checks more easily. Narratively, after selecting this Bonded Action, the two of you explain the backstory of these shared experiences, giving at least three meaningful experiences you’ve had together related to it and any other details you would like.",
      "Your relationships with other characters will change and grow as the campaign goes on. Between arcs, you’ll have the chance to gain new Bonded Actions, change existing ones, or, if a relationship has become less close, end ones you have."
    ],
    "callouts": [
      {
        "kind": "tip",
        "defaultOpen": true,
        "paragraphs": [
          "If you don’t see one in the chart that would make sense for you and another character, talk to them and the GM and make up a new one."
        ]
      },
      {
        "kind": "example",
        "defaultOpen": false,
        "paragraphs": [
          "For example, while Isabella doesn’t have an especially close relationship with either of the other characters, Kalsang and Oswald do. With Kalsang being older and a mentor figure to Oswald, Helpful Mentorship could make sense. They also think that Friends’ Cant could work, since they’ve read and talked about so many fantasy novels. They decide that this is the most interesting to them, establishing that they can communicate information through references to books that they’ve both read and inside jokes that they have about characters and events in those texts. Even if someone has also read The Hobbit, they won’t know the shorthand that they’ve developed over the years."
        ]
      }
    ],
    "actions": [
      {
        "id": "best-frenemies",
        "name": "Best Frenemies",
        "description": "After one of you succeeds on a roll and brags about their success, the other gets +3 on their next roll. If they succeed and brag, the first character gets +3 on their next roll, then the bonuses end."
      },
      {
        "id": "calming-presence",
        "name": "Calming Presence",
        "description": "When one of you is exposed to a Fear, the other can talk them down, allowing them to ignore any impacts of that Fear."
      },
      {
        "id": "deep-thinkers",
        "name": "Deep Thinkers",
        "description": "When making a relevant Brains check together, use either character’s roll, then add an additional +3 to that roll."
      },
      {
        "id": "friends-cant",
        "name": "Friends’ Cant",
        "description": "As long as you and this character can communicate in writing or verbally, you can pass information to the other without anyone else understanding your meaning."
      },
      {
        "id": "heavy-lifters",
        "name": "Heavy Lifters",
        "description": "When making a relevant Brawn check together, use either character’s roll, then add an additional +3 to that roll."
      },
      {
        "id": "helpful-mentorship",
        "name": "Helpful Mentorship",
        "description": "When the mentee in the relationship fails a roll, the mentor can offer advice. If they do, both characters gain 2 AT."
      },
      {
        "id": "known-location",
        "name": "Known Location",
        "description": "Either character can intuit the location of the other, regardless of how improbable their location is and regardless of how little information the other has."
      },
      {
        "id": "mind-readers",
        "name": "Mind Readers",
        "description": "By making eye contact, both characters can, within reason, communicate what they’re thinking to each other."
      },
      {
        "id": "no-look-pass",
        "name": "No-Look Pass",
        "description": "One character may throw the other player an object that both can easily lift, and the other character can catch it without looking and without making a check."
      },
      {
        "id": "relay-team",
        "name": "Relay Team",
        "description": "When making a relevant Flight check together, use either character’s roll, then add an additional +3 to that roll."
      },
      {
        "id": "standup-comedians",
        "name": "Standup Comedians",
        "description": "The two characters can, within reason, keep the attention of a crowd by being incredibly funny together."
      },
      {
        "id": "sweet-talkers",
        "name": "Sweet Talkers",
        "description": "When making a relevant Charm check together, use either character’s roll, then add an additional +3 to that roll."
      },
      {
        "id": "sworn-protector",
        "name": "Sworn Protector",
        "description": "Either character can suffer the effects of the other character’s failed check to protect them."
      },
      {
        "id": "tag-team",
        "name": "Tag Team",
        "description": "When making a relevant Fight check together, use either character’s roll, then add an additional +3 to that roll."
      },
      {
        "id": "tough-cookies",
        "name": "Tough Cookies",
        "description": "When making a relevant Grit check together, use either character’s roll, then add an additional +3 to that roll."
      }
    ]
  },
  "relationshipQuestions": {
    "positive": [
      {
        "roll": 1,
        "question": "Why do you feel forever indebted to this character?"
      },
      {
        "roll": 2,
        "question": "What do you secretly admire about this character?"
      },
      {
        "roll": 3,
        "question": "What great kindness did this character do for you that they did without thinking about it—but that meant the world to you?"
      },
      {
        "roll": 4,
        "question": "What part of this character’s personality do you realize is exceptional that they do not?"
      },
      {
        "roll": 5,
        "question": "In what way do you care for them that they can’t or won’t reciprocate?"
      },
      {
        "roll": 6,
        "question": "How did this character contribute to the best day of your life?"
      },
      {
        "roll": 7,
        "question": "What plan do you and this character have that most excites you?"
      },
      {
        "roll": 8,
        "question": "What is your private nickname for this character and why?"
      },
      {
        "roll": 9,
        "question": "When did this character surprise you with how far they’d go to help you?"
      },
      {
        "roll": 10,
        "question": "What are you sacrificing to protect this character, and why are you so willing to make that sacrifice?"
      },
      {
        "roll": 11,
        "question": "You often feel the need to stand up for this character. Why are you willing to go so far for them?"
      },
      {
        "roll": 12,
        "question": "What bond do you share with this character that can never be broken?"
      },
      {
        "roll": 13,
        "question": "What about this character makes you so happy?"
      },
      {
        "roll": 14,
        "question": "What tremendous act of bravery did you see this character do?"
      },
      {
        "roll": 15,
        "question": "What do you and this character have a mutual love of that no one else in town seems to like?"
      },
      {
        "roll": 16,
        "question": "You recently thought you lost this character. How? Why was that so upsetting?"
      },
      {
        "roll": 17,
        "question": "What aspect of this character’s personality do you try to use as a model for your own?"
      },
      {
        "roll": 18,
        "question": "When did you first realize that you loved this character—either platonically or romantically?"
      },
      {
        "roll": 19,
        "question": "You’ve been in awe of this character since you met them. How did they make such a strong first impression?"
      },
      {
        "roll": 20,
        "question": "Why do you treasure a seemingly valueless item this character once gave you?"
      }
    ],
    "negative": [
      {
        "roll": 1,
        "question": "What did this character once do that you still resent them for?"
      },
      {
        "roll": 2,
        "question": "What secret are you keeping from them, and who would be devastated if they found out?"
      },
      {
        "roll": 3,
        "question": "You’re sure this character is hiding something from you. How do you feel knowing they’re deceiving you?"
      },
      {
        "roll": 4,
        "question": "What does this character have that you want to take from them?"
      },
      {
        "roll": 5,
        "question": "This character regularly does something that hurts you, perhaps without knowing it. What is it, and why do you think they keep doing it?"
      },
      {
        "roll": 6,
        "question": "How did this character contribute to the worst day of your life?"
      },
      {
        "roll": 7,
        "question": "What dishonest thing did you see this character do that still bothers you to this day?"
      },
      {
        "roll": 8,
        "question": "How does this character keep putting you both at risk? Why do you think they do that?"
      },
      {
        "roll": 9,
        "question": "What does this character often do that makes you irrationally angry?"
      },
      {
        "roll": 10,
        "question": "How do you think this character is self-sabotaging? Why can’t you empathize?"
      },
      {
        "roll": 11,
        "question": "What part of this character’s personality scares you? What does that say about you?"
      },
      {
        "roll": 12,
        "question": "You can’t forgive this character for something they did. What is it and why can’t you?"
      },
      {
        "roll": 13,
        "question": "What dangerous behavior has this character recently started engaging in? How could it affect you?"
      },
      {
        "roll": 14,
        "question": "What is your plan to get revenge on this character, and what misunderstanding led you to make this plan?"
      },
      {
        "roll": 15,
        "question": "Why do you dislike this character when most of the town seems to love them?"
      },
      {
        "roll": 16,
        "question": "You hurt this character years ago. Why can’t you apologize?"
      },
      {
        "roll": 17,
        "question": "What do you intentionally do to annoy this character? What do you get from their response?"
      },
      {
        "roll": 18,
        "question": "How did this character betray you the last time you confided in them?"
      },
      {
        "roll": 19,
        "question": "This character hurt someone close to you. Why haven’t you accepted their apology even though the person they hurt has?"
      },
      {
        "roll": 20,
        "question": "What do you owe this character? Why do you refuse to repay them?"
      }
    ],
    "stranger": [
      {
        "roll": 1,
        "question": "What good thing have you heard about this character that you can’t believe is true?"
      },
      {
        "roll": 2,
        "question": "Why do some members of the town seek out this character?"
      },
      {
        "roll": 3,
        "question": "Recently, this character did something great for the town. Why was it so surprising?"
      },
      {
        "roll": 4,
        "question": "What charming habit is this character known for throughout the town?"
      },
      {
        "roll": 5,
        "question": "What strange record does this character hold in the town?"
      },
      {
        "roll": 6,
        "question": "Why is this character’s family so important in the town?"
      },
      {
        "roll": 7,
        "question": "Which influential townsperson always speaks highly of this character and why?"
      },
      {
        "roll": 8,
        "question": "Based on what you know, how is this character different from the rest of their family?"
      },
      {
        "roll": 9,
        "question": "Why are you going out of your way to get to know this character?"
      },
      {
        "roll": 10,
        "question": "What bad thing have you heard about this character that you can’t believe is true?"
      },
      {
        "roll": 11,
        "question": "What do you selfishly hope to gain from this relative stranger?"
      },
      {
        "roll": 12,
        "question": "What bad reputation does this character have around the town?"
      },
      {
        "roll": 13,
        "question": "Who does this character have a very public feud with?"
      },
      {
        "roll": 14,
        "question": "Why are so many townspeople afraid of this character?"
      },
      {
        "roll": 15,
        "question": "What do you want out of this relationship for your own selfish benefit?"
      },
      {
        "roll": 16,
        "question": "How is this character threatening their family’s reputation?"
      },
      {
        "roll": 17,
        "question": "What scandal in the town was this character involved with?"
      },
      {
        "roll": 18,
        "question": "How did you embarrass yourself last time you tried to get to know this character?"
      },
      {
        "roll": 19,
        "question": "What rumor is whispered about this character around the town?"
      },
      {
        "roll": 20,
        "question": "You know that this character is interested in getting to know you. How did you find that out?"
      }
    ]
  },
  "playRules": {
    "sections": [
      {
        "id": "stat-checks",
        "name": "Stat Checks",
        "paragraphs": [
          "When you do something that runs the risk of failure, the GM will have you make a Stat Check. You'll let the GM know what you want to do and agree on a stat that you'll use. Then, they'll set a numerical difficulty for the action and let you know what it is.",
          "If you roll the maximum value of the die, you get a Lucky Break—meaning that you reroll the die and add the maximum value that you rolled the first time to the new roll. You can get multiple Lucky Breaks on a single check.",
          "After rolling, you and any players whose characters are with you may spend Adversity Tokens to increase your result."
        ]
      },
      {
        "id": "failing-a-roll",
        "name": "Failing A Roll",
        "paragraphs": [
          "Failing a roll gives you an Adversity Token, which you can use to succeed when you really need it or to activate your character's Strengths."
        ]
      },
      {
        "id": "adversity-tokens",
        "name": "Adversity Tokens",
        "paragraphs": [
          "Adversity Tokens (or AT) can be used to improve subsequent rolls, activate Strengths, or, with the GM's permission, ignore your Fears.",
          "After rolling to try to make a check, you can spend your AT to improve the roll. This improvement can make a failure into a success, make your failure less harmful, or make your success more extreme. In addition, characters in the same scene as a character making a check may spend AT to improve that character's roll. Unless you have a Strength that indicates otherwise, each AT you spend adds one to your roll or the roll of the character you're helping.",
          "If you're spending AT to improve you're own roll, explain narratively how previous difficulties have prepared you to better face this challenge. If you're spending AT to help a character your character is with, explain the advice you give them and, collaboratively, explain how that advice saves the day.",
          "[!warning]+ Reminder",
          "At the start of the game, each of you has 3 AT.",
          "[!example]-",
          "For example, as Isabella slips outside, she looks over her shoulder to see if Oswald made it out. As she does, she runs directly into her English teacher, Ms. McKay. “Careful, kiddo,” she says, then pauses. “Are you okay? You’re not leaving during lunch, are you? That would be a school rule violation!” Isabella decides to attempt a Charm check to see if she can convince Ms. McKay to let her go. Gauthier explains that Ms. McKay is one of the more laid-back teachers at the school, but success is far from assured. He sets the difficulty at 8. Isabella rolls a 6, and decides that it’s important enough to her to succeed that she spends 2 AT to bump herself up to a success.",
          "“Oh, I just needed to get something from my bike,” she replies. Gauthier encourages her to pedal harder, reminding her that with AT, you should explain how something you learned before helps you now. “Okay, Ms. McKay, I won’t lie to you: I’m ditching school. I got stuff I need to do, and in class the other day, you were telling us that we needed to live more wildly, right? Well, uh, off I go! Living wildly!”",
          "Ms. McKay smiles. “Then I didn’t see anything, you absolute maniac of a child. I never saw you. Get out of here. Live freely!” She heads back into the school, walking through the door Isabella just came out of."
        ]
      },
      {
        "id": "lucky-breaks",
        "name": "Lucky Breaks",
        "paragraphs": [
          "When you roll the highest value on a die, you roll that die again and add the results together to get the total for your check. If you roll the maximum value of the die multiple times, you get to keep rolling.",
          "[!warning]- Reminder",
          "Spending AT to improve the sum of a roll does not cause a Lucky Break; they only occur if you naturally roll the highest value.",
          "When you get a Lucky Break, the way you succeed must reflect that you have accomplished something beyond what you could do on your own. The outcome should be influenced, in part, by external forces.",
          "[!example]-",
          "For example, Mr. Roachman starts grilling Oswald about why he’s leaving, so he sees two reasonable options here: just start running with a Flight check or try to talk his way out of it with a Charm check. Running to the bike racks, unlocking his bike in time, and getting away without being caught will be very tough: a Flight check with a difficulty of 15. With a d12 in Flight, Oswald would need a Lucky Break. However, convincing him that he needs to go get something that he left in his bike is easier, but still not a piece of cake given how crusty Roachman is. The GM tells him it will be a Charm check with a difficulty of 10. He’ll need a Lucky Break here, too, but he’s more likely to get it, so he decides to try to charm his way out of it. He rolls an 8 and gets the Lucky Break! Then, he rolls a 3 for a total of 11: a success!",
          "Oswald explains that he tells Mr. Roachman, as casually as he can, that he just has to grab something out of his bike, trying to pass it off like nothing and make it seem like not a big deal at all. Roachman starts to tell him that non-seniors aren’t allowed to leave school grounds, when Ms. McKay passes by and casually says, “Oh give it a rest, Harold. You’re a hardass. We all get it.” Mr. Roachman turns bright red and storms down the hall after her, incensed that she’d undermine him in front of a student. Oswald breathes a sigh of relief that he was lucky enough to have Ms. McKay happen to be there, and heads out the door to meet Isabella."
        ]
      },
      {
        "id": "tiered-checks",
        "name": "Tiered Checks",
        "paragraphs": []
      },
      {
        "id": "planned-actions-and-snap-decisions",
        "name": "Planned Actions And Snap Decisions",
        "paragraphs": [
          "!In order to make a check, go through the following flow chart:"
        ]
      }
    ],
    "difficulties": [
      {
        "range": "20 or greater",
        "minimum": 20,
        "maximum": null,
        "explanation": "A task at which only the most incredible could even possibly succeed—but if they succeed, it will be one of the most impressive things a character has ever done. This is a nearly guaranteed failure.\n*Examples: Lifting a car off of someone trapped under it; solving a nearly impossible math problem just by glancing at it.*"
      },
      {
        "range": "17 to 19",
        "minimum": 17,
        "maximum": 19,
        "explanation": "A task where success would be incredible and impressive. This, too, is a nearly guaranteed failure.\n*Examples: Talking a police officer out of arresting you when you have clearly broken the law and have no relationship with the officer; breaking a school record in track.*"
      },
      {
        "range": "13 to 16",
        "minimum": 13,
        "maximum": 16,
        "explanation": "A task where success is extraordinary—but decidedly possible for those who are truly skilled at it.\n*Examples: Doing a flying side kick into the center of a wildly swinging punching bag; withstanding a police interrogation.*"
      },
      {
        "range": "10 to 12",
        "minimum": 10,
        "maximum": 12,
        "explanation": "A task where success is impressive—but unsurprising for those skilled at it.\n*Examples: A strong person prying open a heavy, locked door; a computer whiz repairing a computer quickly under pressure.*"
      },
      {
        "range": "7 to 9",
        "minimum": 7,
        "maximum": 9,
        "explanation": "A task where success is almost certain for those very skilled at it—but not for those who aren’t.\n*Examples: Convincing the principal that it wasn’t you and your friends who started the cafeteria food fight; running a message from one end of a building to the other in a very short time.*"
      },
      {
        "range": "3 to 6",
        "minimum": 3,
        "maximum": 6,
        "explanation": "A task where success is likely for all but those who aren’t skilled or have a low stat in that field.\n*Examples: Throwing a good punch into punching bag; a character silently withstanding a verbal berating.*"
      },
      {
        "range": "1 or 2",
        "minimum": 1,
        "maximum": 2,
        "explanation": "A task where success is nearly guaranteed, except in extreme cases.\n*Examples: A character lifting a 10-pound weight over their head; a character reciting a multiplication table.*"
      }
    ]
  },
  "preGameForm": {
    "title": "Pre-Game Form",
    "intro": "Reference the Content Warning list for possible themes to include here.",
    "lists": [
      {
        "id": "wish-list",
        "name": "Wish List",
        "prompt": "Content you’d be excited to see in game."
      },
      {
        "id": "with-care-list",
        "name": "With Care List",
        "prompt": "Content you don’t want described or roleplayed, but that you’re comfortable having referenced in game."
      },
      {
        "id": "content-warning-list",
        "name": "Content Warning List",
        "prompt": "Content you want to be asked about before including it"
      },
      {
        "id": "detour-list",
        "name": "Detour List",
        "prompt": "Content you don’t want to appear or be referenced in the game."
      }
    ],
    "contentWarnings": [
      "Abandonment",
      "Ableism",
      "Alcohol use",
      "Alien abduction",
      "Body horror",
      "Bugs",
      "Bullying",
      "Car or bike accidents",
      "Classism",
      "Domestic violence",
      "Drug use",
      "Eating disorders",
      "Emotional violence",
      "Fat shaming",
      "Gaslighting",
      "Gendered swearing",
      "Gore",
      "Harm to animals",
      "Harm to children and young adults",
      "Hate speech",
      "Homelessness",
      "Homophobia",
      "Hospitals",
      "Human experimentation",
      "Human sacrifice",
      "ncarceration",
      "Kidnapping",
      "Loss or death of a loved one",
      "Medical conditions/procedures",
      "Mutilation",
      "Neglect",
      "Parental punishment",
      "Permanent injuries",
      "Physical violence",
      "Police brutality",
      "Police presence",
      "Powerlessness",
      "Racism",
      "Religious persecution",
      "Self-harm / Suicidal ideation",
      "Sexism",
      "Sexual assault",
      "Sexual harassment",
      "Social ostracization",
      "Stalking",
      "Torture",
      "Transphobia"
    ],
    "additionalPrompt": "Additional content warnings:"
  },
  "poweredCharacterAspects": {
    "title": "Aspects for Powered Characters",
    "sections": [
      {
        "id": "good",
        "name": "Good",
        "die": "d12",
        "groups": [
          {
            "id": "a-physical-skill-they-have-is",
            "prompt": "A physical skill they have is...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Lockpicking"
                  },
                  {
                    "roll": 2,
                    "text": "Juggling"
                  },
                  {
                    "roll": 3,
                    "text": "Card shuffling / deck manipulation"
                  },
                  {
                    "roll": 4,
                    "text": "Sprinting"
                  },
                  {
                    "roll": 5,
                    "text": "Parkour / free running"
                  },
                  {
                    "roll": 6,
                    "text": "Can climb anything"
                  },
                  {
                    "roll": 7,
                    "text": "Dancing (style)"
                  },
                  {
                    "roll": 8,
                    "text": "Contortion"
                  },
                  {
                    "roll": 9,
                    "text": "Incredible balance"
                  },
                  {
                    "roll": 10,
                    "text": "Great aim with small objects"
                  },
                  {
                    "roll": 11,
                    "text": "Great endurance"
                  },
                  {
                    "roll": 12,
                    "text": "Video games of all kinds"
                  }
                ]
              }
            ]
          },
          {
            "id": "they-are-incredibly-good-with",
            "prompt": "They are incredibly good with...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Technology"
                  },
                  {
                    "roll": 2,
                    "text": "Animals"
                  },
                  {
                    "roll": 3,
                    "text": "Puzzles"
                  },
                  {
                    "roll": 4,
                    "text": "The elderly"
                  },
                  {
                    "roll": 5,
                    "text": "Public speaking"
                  },
                  {
                    "roll": 6,
                    "text": "Organization"
                  },
                  {
                    "roll": 7,
                    "text": "Timing"
                  },
                  {
                    "roll": 8,
                    "text": "Predicting the weather"
                  },
                  {
                    "roll": 9,
                    "text": "Plants"
                  },
                  {
                    "roll": 10,
                    "text": "Guessing games"
                  },
                  {
                    "roll": 11,
                    "text": "Difficult people"
                  },
                  {
                    "roll": 12,
                    "text": "Young children"
                  }
                ]
              }
            ]
          },
          {
            "id": "an-intellectual-skill-they-have-is",
            "prompt": "An intellectual skill they have is...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "An eidetic memory"
                  },
                  {
                    "roll": 2,
                    "text": "The ability to do complex calculations quickly"
                  },
                  {
                    "roll": 3,
                    "text": "Calming down people who are upset"
                  },
                  {
                    "roll": 4,
                    "text": "Life-like drawing"
                  },
                  {
                    "roll": 5,
                    "text": "Lip reading"
                  },
                  {
                    "roll": 6,
                    "text": "Pattern recognition"
                  },
                  {
                    "roll": 7,
                    "text": "Perfect pitch"
                  },
                  {
                    "roll": 8,
                    "text": "Reverse engineering devices"
                  },
                  {
                    "roll": 9,
                    "text": "Reading people’s expressions"
                  },
                  {
                    "roll": 10,
                    "text": "Speed reading"
                  },
                  {
                    "roll": 11,
                    "text": "Lucid dreaming"
                  },
                  {
                    "roll": 12,
                    "text": "Uninhibited imagination"
                  }
                ]
              }
            ]
          },
          {
            "id": "a-virtue-they-seem-to-have-is",
            "prompt": "A virtue they seem to have is...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Compassion"
                  },
                  {
                    "roll": 2,
                    "text": "Honesty"
                  },
                  {
                    "roll": 3,
                    "text": "Patience"
                  },
                  {
                    "roll": 4,
                    "text": "Benevolence"
                  },
                  {
                    "roll": 5,
                    "text": "Courage"
                  },
                  {
                    "roll": 6,
                    "text": "Loyalty"
                  },
                  {
                    "roll": 7,
                    "text": "Gentleness"
                  },
                  {
                    "roll": 8,
                    "text": "Ingenuity"
                  },
                  {
                    "roll": 9,
                    "text": "Curiosity"
                  },
                  {
                    "roll": 10,
                    "text": "Self-discipline"
                  },
                  {
                    "roll": 11,
                    "text": "Objectivity"
                  },
                  {
                    "roll": 12,
                    "text": "Insight OR humility"
                  }
                ]
              }
            ]
          },
          {
            "id": "they-seem-to-enjoy",
            "prompt": "They seem to enjoy...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Desserts"
                  },
                  {
                    "roll": 2,
                    "text": "Television"
                  },
                  {
                    "roll": 3,
                    "text": "A specific genre of music"
                  },
                  {
                    "roll": 4,
                    "text": "Loud noises"
                  },
                  {
                    "roll": 5,
                    "text": "Asking questions"
                  },
                  {
                    "roll": 6,
                    "text": "Shadow puppets"
                  },
                  {
                    "roll": 7,
                    "text": "The outdoors"
                  },
                  {
                    "roll": 8,
                    "text": "Abandoned buildings"
                  },
                  {
                    "roll": 9,
                    "text": "Smell of lavender"
                  },
                  {
                    "roll": 10,
                    "text": "Old books"
                  },
                  {
                    "roll": 11,
                    "text": "High places"
                  },
                  {
                    "roll": 12,
                    "text": "Being clean"
                  }
                ]
              }
            ]
          },
          {
            "id": "they-seem-to-know-a-lot-about",
            "prompt": "They seem to know a lot about...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Religion"
                  },
                  {
                    "roll": 2,
                    "text": "Conspiracy theories"
                  },
                  {
                    "roll": 3,
                    "text": "Mechanics"
                  },
                  {
                    "roll": 4,
                    "text": "The weather"
                  },
                  {
                    "roll": 5,
                    "text": "Architecture"
                  },
                  {
                    "roll": 6,
                    "text": "Psychology"
                  },
                  {
                    "roll": 7,
                    "text": "Botany"
                  },
                  {
                    "roll": 8,
                    "text": "Finding an object’s weak points"
                  },
                  {
                    "roll": 9,
                    "text": "Knitting"
                  },
                  {
                    "roll": 10,
                    "text": "Small appliance repair"
                  },
                  {
                    "roll": 11,
                    "text": "Politics"
                  },
                  {
                    "roll": 12,
                    "text": "Economics"
                  }
                ]
              }
            ]
          },
          {
            "id": "they-insist-that-the-group",
            "prompt": "They insist that the group...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Stay together"
                  },
                  {
                    "roll": 2,
                    "text": "Keep dangerous secrets"
                  },
                  {
                    "roll": 3,
                    "text": "Check in with each other every day"
                  },
                  {
                    "roll": 4,
                    "text": "Go into hiding"
                  },
                  {
                    "roll": 5,
                    "text": "Build an awesome fort"
                  },
                  {
                    "roll": 6,
                    "text": "Use passwords"
                  },
                  {
                    "roll": 7,
                    "text": "Wear suits"
                  },
                  {
                    "roll": 8,
                    "text": "Talk with their backs to each other"
                  },
                  {
                    "roll": 9,
                    "text": "Sleepover regularly"
                  },
                  {
                    "roll": 10,
                    "text": "Pretend nothing has changed"
                  },
                  {
                    "roll": 11,
                    "text": "Come up with a team name and codenames"
                  },
                  {
                    "roll": 12,
                    "text": "Start saving money, just in case"
                  }
                ]
              }
            ]
          },
          {
            "id": "they-want",
            "prompt": "They want...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "To find the source of their powers"
                  },
                  {
                    "roll": 2,
                    "text": "To find their family"
                  },
                  {
                    "roll": 3,
                    "text": "To return where they came from"
                  },
                  {
                    "roll": 4,
                    "text": "To find treasure"
                  },
                  {
                    "roll": 5,
                    "text": "To make friends with everyone"
                  },
                  {
                    "roll": 6,
                    "text": "To discover their limits"
                  },
                  {
                    "roll": 7,
                    "text": "To change the world"
                  },
                  {
                    "roll": 8,
                    "text": "That which they cannot have"
                  },
                  {
                    "roll": 9,
                    "text": "Greater variety in all things"
                  },
                  {
                    "roll": 10,
                    "text": "To live forever"
                  },
                  {
                    "roll": 11,
                    "text": "To be part of something much bigger than them"
                  },
                  {
                    "roll": 12,
                    "text": "To be left to their own devices"
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "id": "bad",
        "name": "Bad",
        "die": "d12",
        "groups": [
          {
            "id": "incredibly-bad-with",
            "prompt": "Incredibly bad with...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Following directions"
                  },
                  {
                    "roll": 2,
                    "text": "Small talk"
                  },
                  {
                    "roll": 3,
                    "text": "Technology"
                  },
                  {
                    "roll": 4,
                    "text": "Animals"
                  },
                  {
                    "roll": 5,
                    "text": "Adults"
                  },
                  {
                    "roll": 6,
                    "text": "The elderly"
                  },
                  {
                    "roll": 7,
                    "text": "Knowing when to stop talking"
                  },
                  {
                    "roll": 8,
                    "text": "Organization"
                  },
                  {
                    "roll": 9,
                    "text": "Timing"
                  },
                  {
                    "roll": 10,
                    "text": "Stressful situations"
                  },
                  {
                    "roll": 11,
                    "text": "Difficult people"
                  },
                  {
                    "roll": 12,
                    "text": "Young children"
                  }
                ]
              }
            ]
          },
          {
            "id": "a-vice-they-seem-to-have-is",
            "prompt": "A vice they seem to have is...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Laziness"
                  },
                  {
                    "roll": 2,
                    "text": "Tactlessness"
                  },
                  {
                    "roll": 3,
                    "text": "Dishonesty"
                  },
                  {
                    "roll": 4,
                    "text": "Impatience"
                  },
                  {
                    "roll": 5,
                    "text": "Cowardice"
                  },
                  {
                    "roll": 6,
                    "text": "Recklessness"
                  },
                  {
                    "roll": 7,
                    "text": "Envy"
                  },
                  {
                    "roll": 8,
                    "text": "Naiveté"
                  },
                  {
                    "roll": 9,
                    "text": "Stubbornness"
                  },
                  {
                    "roll": 10,
                    "text": "Vanity"
                  },
                  {
                    "roll": 11,
                    "text": "Shamelessness"
                  },
                  {
                    "roll": 12,
                    "text": "Arrogance"
                  }
                ]
              }
            ]
          },
          {
            "id": "they-seem-to-fear",
            "prompt": "They seem to fear...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "The dark"
                  },
                  {
                    "roll": 2,
                    "text": "Heights"
                  },
                  {
                    "roll": 3,
                    "text": "Animals"
                  },
                  {
                    "roll": 4,
                    "text": "A member of the group"
                  },
                  {
                    "roll": 5,
                    "text": "An NPC"
                  },
                  {
                    "roll": 6,
                    "text": "Water"
                  },
                  {
                    "roll": 7,
                    "text": "Loud noises"
                  },
                  {
                    "roll": 8,
                    "text": "Change"
                  },
                  {
                    "roll": 9,
                    "text": "Small spaces"
                  },
                  {
                    "roll": 10,
                    "text": "Confrontation"
                  },
                  {
                    "roll": 11,
                    "text": "Being forgotten"
                  },
                  {
                    "roll": 12,
                    "text": "Bugs and insects"
                  }
                ]
              }
            ]
          },
          {
            "id": "they-seem-to-detest",
            "prompt": "They seem to detest...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "A specific, seemingly innocuous location"
                  },
                  {
                    "roll": 2,
                    "text": "An NPC the PCs also dislike"
                  },
                  {
                    "roll": 3,
                    "text": "An NPC the PCs like"
                  },
                  {
                    "roll": 4,
                    "text": "People in suits"
                  },
                  {
                    "roll": 5,
                    "text": "Medical professionals"
                  },
                  {
                    "roll": 6,
                    "text": "Televisions"
                  },
                  {
                    "roll": 7,
                    "text": "Specific sounds"
                  },
                  {
                    "roll": 8,
                    "text": "Specific smells"
                  },
                  {
                    "roll": 9,
                    "text": "Most foods"
                  },
                  {
                    "roll": 10,
                    "text": "Heat"
                  },
                  {
                    "roll": 11,
                    "text": "Cold"
                  },
                  {
                    "roll": 12,
                    "text": "Quiet"
                  }
                ]
              }
            ]
          },
          {
            "id": "they-seem-to-know-nothing-about",
            "prompt": "They seem to know nothing about...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Social norms"
                  },
                  {
                    "roll": 2,
                    "text": "Languages"
                  },
                  {
                    "roll": 3,
                    "text": "Geography"
                  },
                  {
                    "roll": 4,
                    "text": "History"
                  },
                  {
                    "roll": 5,
                    "text": "Technology"
                  },
                  {
                    "roll": 6,
                    "text": "Fashion"
                  },
                  {
                    "roll": 7,
                    "text": "Money"
                  },
                  {
                    "roll": 8,
                    "text": "Sports"
                  },
                  {
                    "roll": 9,
                    "text": "Television and movies"
                  },
                  {
                    "roll": 10,
                    "text": "Current events"
                  },
                  {
                    "roll": 11,
                    "text": "Cars"
                  },
                  {
                    "roll": 12,
                    "text": "Literature"
                  }
                ]
              }
            ]
          },
          {
            "id": "a-seemingly-irrational-belief-they-have-is-that",
            "prompt": "A seemingly irrational belief they have is that...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Birds aren’t real"
                  },
                  {
                    "roll": 2,
                    "text": "There are two parallel worlds that can be traversed"
                  },
                  {
                    "roll": 3,
                    "text": "A secretive group is out to get them"
                  },
                  {
                    "roll": 4,
                    "text": "Some people have been replaced with clones"
                  },
                  {
                    "roll": 5,
                    "text": "A group is trying to destroy the town"
                  },
                  {
                    "roll": 6,
                    "text": "A specific kind of safe food is poisonous"
                  },
                  {
                    "roll": 7,
                    "text": "Radio or television is broadcasting subliminal messages"
                  },
                  {
                    "roll": 8,
                    "text": "Aliens exist and have come to Earth"
                  },
                  {
                    "roll": 9,
                    "text": "An event that the town remembers never occurred"
                  },
                  {
                    "roll": 10,
                    "text": "A key event in the town’s history was to cover up a dark truth"
                  },
                  {
                    "roll": 11,
                    "text": "The perpetrator of a crime was framed"
                  },
                  {
                    "roll": 12,
                    "text": "There is a plot to eliminate witnesses of an event"
                  }
                ]
              }
            ]
          },
          {
            "id": "they-seem-to-want-to-avoid",
            "prompt": "They seem to want to avoid...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Being alone"
                  },
                  {
                    "roll": 2,
                    "text": "Going into buildings"
                  },
                  {
                    "roll": 3,
                    "text": "Being with anyone other than the group"
                  },
                  {
                    "roll": 4,
                    "text": "Telling other than the group anything"
                  },
                  {
                    "roll": 5,
                    "text": "Talking to strangers"
                  },
                  {
                    "roll": 6,
                    "text": "Pushing their limits"
                  },
                  {
                    "roll": 7,
                    "text": "Taking responsibility"
                  },
                  {
                    "roll": 8,
                    "text": "Seeming greedy"
                  },
                  {
                    "roll": 9,
                    "text": "Change of any kind"
                  },
                  {
                    "roll": 10,
                    "text": "Taking even moderate risks"
                  },
                  {
                    "roll": 11,
                    "text": "Anyone interfering with their long-term plans"
                  },
                  {
                    "roll": 12,
                    "text": "Finding out the truth about their past"
                  }
                ]
              }
            ]
          },
          {
            "id": "a-quirk-they-engage-in-frequently-is",
            "prompt": "A quirk they engage in frequently is...",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Repeating themself"
                  },
                  {
                    "roll": 2,
                    "text": "Snapping their fingers"
                  },
                  {
                    "roll": 3,
                    "text": "Stretching or yawning"
                  },
                  {
                    "roll": 4,
                    "text": "Jogging in place"
                  },
                  {
                    "roll": 5,
                    "text": "Whistling"
                  },
                  {
                    "roll": 6,
                    "text": "Checking rooms for hiding spots"
                  },
                  {
                    "roll": 7,
                    "text": "Tapping their fingers on flat surfaces"
                  },
                  {
                    "roll": 8,
                    "text": "Twirling small objects between their fingers"
                  },
                  {
                    "roll": 9,
                    "text": "Adjusting their clothes"
                  },
                  {
                    "roll": 10,
                    "text": "Smelling new objects"
                  },
                  {
                    "roll": 11,
                    "text": "Making sure items are in perfect working order"
                  },
                  {
                    "roll": 12,
                    "text": "Wringing their hands"
                  }
                ]
              }
            ]
          },
          {
            "id": "group-related-put-pc-s-name-in-blank",
            "prompt": "Group Related (put PC’s name in blank)",
            "variants": [
              {
                "label": "",
                "entries": [
                  {
                    "roll": 1,
                    "text": "They’re highly protective of _____."
                  },
                  {
                    "roll": 2,
                    "text": "They ask ____ lots of questions."
                  },
                  {
                    "roll": 3,
                    "text": "They believe ____ is in danger."
                  },
                  {
                    "roll": 4,
                    "text": "They believe ____ is “the chosen one”."
                  },
                  {
                    "roll": 5,
                    "text": "They value _____’s opinion over everyone else’s."
                  },
                  {
                    "roll": 6,
                    "text": "They revere _____."
                  },
                  {
                    "roll": 7,
                    "text": "They actively ignore _____."
                  },
                  {
                    "roll": 8,
                    "text": "They distrust _____."
                  },
                  {
                    "roll": 9,
                    "text": "They will only talk to _____."
                  },
                  {
                    "roll": 10,
                    "text": "They love _____ (platonically or romantically) at first sight."
                  },
                  {
                    "roll": 11,
                    "text": "They think _____ is keeping a dangerous secret."
                  },
                  {
                    "roll": 12,
                    "text": "They feel _____ is always on their side."
                  }
                ]
              }
            ]
          },
          {
            "id": "powers-flip-a-coin-and-roll-d12-to-randomize",
            "prompt": "Powers (flip a coin and roll d12 to randomize)",
            "variants": [
              {
                "label": "Heads",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Alters probability"
                  },
                  {
                    "roll": 2,
                    "text": "Astrally projects"
                  },
                  {
                    "roll": 3,
                    "text": "Blocks others’ senses"
                  },
                  {
                    "roll": 4,
                    "text": "Communicates telepathically with people"
                  },
                  {
                    "roll": 5,
                    "text": "Controls plants"
                  },
                  {
                    "roll": 6,
                    "text": "Controls the elements"
                  },
                  {
                    "roll": 7,
                    "text": "Creates false memories"
                  },
                  {
                    "roll": 8,
                    "text": "Creates illusions"
                  },
                  {
                    "roll": 9,
                    "text": "Knows an object’s history by touching it"
                  },
                  {
                    "roll": 10,
                    "text": "Moves faster than sight for tiny bursts"
                  },
                  {
                    "roll": 11,
                    "text": "Sees confusing glimpses of the future"
                  },
                  {
                    "roll": 12,
                    "text": "Teleports"
                  }
                ]
              },
              {
                "label": "Tails",
                "entries": [
                  {
                    "roll": 1,
                    "text": "Alters the flow of time"
                  },
                  {
                    "roll": 2,
                    "text": "Becomes invisible"
                  },
                  {
                    "roll": 3,
                    "text": "Communicates telepathically with animals"
                  },
                  {
                    "roll": 4,
                    "text": "Controls gravity"
                  },
                  {
                    "roll": 5,
                    "text": "Controls technology"
                  },
                  {
                    "roll": 6,
                    "text": "Controls the weather"
                  },
                  {
                    "roll": 7,
                    "text": "Creates forcefields"
                  },
                  {
                    "roll": 8,
                    "text": "Heals others by touching them"
                  },
                  {
                    "roll": 9,
                    "text": "Lifts more than any normal human could"
                  },
                  {
                    "roll": 10,
                    "text": "Moves objects with their mind"
                  },
                  {
                    "roll": 11,
                    "text": "Shapeshifts"
                  },
                  {
                    "roll": 12,
                    "text": "Turns into a bike"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "poweredCharacter": {
    "title": "Powered Characters",
    "sections": [
      {
        "id": "powered-characters",
        "name": "",
        "paragraphs": [
          "Players cannot create a character with powers to play throughout the campaign. But, early in the first session, the GM will introduce a Powered Character that will then be co-controlled by all of you."
        ]
      },
      {
        "id": "introducing-playing-powered-characters",
        "name": "Introducing & Playing Powered Characters",
        "paragraphs": [
          "When the Powered Character is first introduced, the GM gives each of you a few deliberately selected traits, called Aspects. The GM shares two Aspects per player by placing them, face up, in the middle of the table. Each of you then selects two Aspects to control for the Powered Character. Players should discuss and agree upon which Aspects each of you wants with the GM arbitrating any disputes. As you’re discussing the Aspects, if there are any that you think might make your experience in the game less enjoyable, talk it over with the table and have the GM replace it.",
          "GMs, for more on creating these Aspects, refer to “Creating Aspects for the Powered Character” on page 90 or Appendix K - Aspects for Powered Characters on page 173.",
          "Once everyone has selected their Aspects, place the two you’ll have in front of you, leaving them face up for everyone else to see. These Aspects provide information that helps you to play the Powered Character, such as their personality traits, patterns in their behaviors, their relationship to the group, and, of course, their powers.",
          "Then, the GM puts a pool of 7 Power Tokens (PT) within reach of all of you. You’ll need these to activate the Powered Character’s special abilities. In addition, the GM places a card near this pool that has the Powered Character’s six Stats and their corresponding dice. These Stats will range from d4 to d20, as all characters’ Stats do. The GM will also secretly establish at least one Fear that the Powered Character has, writing it down on a notecard or piece of paper and placing it face down in the center of the table. When that Fear becomes relevant, the GM will flip that card face up.",
          "When situations come up that relate to the Aspects in front of you, you’ll be in charge of the narration. In all other situations, players will share control of the Powered Character. As with the rest of the game, you share control of this character’s narrative.",
          "When an Aspect becomes relevant, turn the card featuring that Aspect sideways. This action helps to focus the table on who will be controlling the Powered Character. Any player may activate any Aspect at the table, even one in front of another player, but the player with that Aspect in front of them should be in charge of the narration related to it. Thus, when another player activates an Aspect in front of another player, they’re handing narrative control over to that player.",
          "While playing, you may flesh out the Powered Character as you see fit, adding desires and motivations as they go. Once a player introduces a new Aspect to the Powered Character, the rest of you should go along with it (unless there are issues with established behaviors or cards that players have or unless anyone asks to hit the brakes on that Aspect). Create a new notecard for that Aspect. Remember, though: you cannot, under any circumstances, give the Powered Character new powers. Only the GM can.",
          "For Aspects that refer to another member of the group, the player who has that Aspect shouldn’t also be playing the character most impacted by that Aspect. After all, if they did, it could lead to awkward moments at the table of the player having to take two roles in a dialogue.",
          "When playing the Powered Character, all of you, including the GM, should have roughly equal input into their actions. As a player, you should have enough information to make decisions about what the Powered Character does. If you don’t, ask the GM for more guidance—and remember that Kids on Bikes is a game where players have strong input over the direction of the narrative of the game. As long as you’re within the bounds of what other players want out of the game, your narrative decisions are correct.",
          "Also, remember that you, the players, are controlling the Powered Character. The characters in the game are not. This isn’t about the PCs manipulating the Powered Character; it’s about the players telling a story together that includes this Powered Character. That doesn’t mean that the Powered Character will always agree with all of the players. In fact, it’d be boring if they did. But, generally, the relationship will not be an adversarial one.",
          "The GM’s control over the Powered Character should drive the narrative toward exciting encounters and stressful situations. If players are unsure what to do or seem stuck, the GM could certainly have the Powered Character figure something out. If the characters need to be pushed toward the revelation of a secret that only the GM knows, the Powered Character could be very useful in this respect, too. Remember, though, that your input is important in the game—and if your ideas conflict with the plan, the GM will try to adapt."
        ]
      },
      {
        "id": "options-for-the-powered-character",
        "name": "Options for the Powered Character",
        "paragraphs": [
          "Alternatively, for the element of surprise, the GM could wait to give you some Aspects of the Powered Character, especially their powers, until they’re relevant. For example, maybe the only information you know at first is that there’s a young boy who wanders from the depths of the woods into your campground. While the characters are getting to know the Powered Character, they might not have access to the Aspects dealing with his psychic powers. When the need to use them arises, the GM then hands out the Aspect cards.",
          "The GM should also feel free to give out additional Aspects as the game goes on. Perhaps it is, as above, that you discover a new Aspect to add to the Powered Character’s personality. But this could also be to get a player more involved with the control of that character. For example, if a player isn’t participating as much with narrating the Powered Character, the GM could give that player a new Aspect card to give them more to do with them, especially if that Aspect is immediately relevant. Changes on the fly are a big part of what this game is all about, so as a player, expect to have those thrown at you.",
          "Finally, some players may not be comfortable having partial control over an NPC, especially if those players are new to roleplaying. If you don’t want to share control over the Powered Character, you can always opt out. And GMs, if you think that the players aren’t ready for it or you want to keep big secrets from the players that the Powered Character knows, they don’t have to get control over that character. As always, adapt the rules to make sure you’re all enjoying yourselves as much as possible!",
          "For example, Isabella and Oswald, after making sure that Kalsang is okay, explain that they need to get to the abandoned mine to search for the missing Daniel. They bike quickly over there, and, approaching the entrance to the mine, see a child lying unconscious just inside the mouth of the mine. Thinking it could be Daniel, they rush over, only to find a boy a few years younger than Daniel. They manage to wake him up. “How… how did I get here?” he asks, with an accent that none of the characters can quite place.",
          "Gauthier, the GM, pauses the narration to say, “Okay! You’ve met your Powered Character! Here are the Aspects that I’ve selected for Raj. Let’s make sure these are all ones that you think would be fun to play.”",
          "After putting out the Powered Character’s PT, Stats, and a face-down Fear, Gauthier places five notecards on the table with Aspects on them: “He trusts Isabella completely,” “A good quality he seems to have is that he’s gentle unless provoked,” “A bad quality he seems to have is impulsivity,” “He seems to know nothing about his past,” and “Knows an object’s history by touching it”.",
          "Breanna asks if there’s a sixth, so that each of them would have two, and Gauthier holds up a piece of folded paper. He explains that the second power won’t be revealed until it’s relevant, so whoever takes that one will be told when to unfold the paper.",
          "Oswald says that he’s interested in taking the revealed power, and Breanna says that’s fine with her as long as she can have the other, secret-for-now power. Yasmin’s okay with not controlling a power, but she thinks the powerful-character-who-doesn’t-remember-anything trope is kind of clichéd and asks Gauthier to break and shift some elements. The other two players and Gauthier agree, so he replaces it with “He seems to know nothing about social norms”. The group likes that one better, and Yasmin takes it.",
          "Yasmin also says that she wants “He trusts Isabella completely”. She says she’s excited to create some tension when the Aspiring Wannabe wants to be left alone by this weird kid in public so she doesn’t seem uncool, and everyone agrees.",
          "Oswald says he’s fine with either of the two remaining Aspects, so Breanna takes Raj’s impulsivity and Oswald takes his gentleness."
        ]
      },
      {
        "id": "using-the-powered-character-s-powers",
        "name": "Using the Powered Character’s Powers",
        "paragraphs": [
          "Powers always have consequences. When someone decides that the Powered Character is going to attempt to use their power, the GM will establish a numerical difficulty that reflects how challenging the action is to complete. The difficulty should be calculated by using the following equation: amount of experience + deviation + scope + degree of control = difficulty. Consult the details below and on the opposite page.",
          "Degree of Control: How precise the Powered Character is trying to be. ~ Low: +1 (e.g., sending a wave of force in all directions, causing an explosion, afflicting all within range with a painful memory) ~ Moderate: +2 (e.g., sending a wave of force only in one straight line, causing an explosion that moves only one direction, afflicting one person with a painful memory) ~ High: +4 (e.g., sending a small burst of force some distance away from them, combusting a can of gasoline without allowing the fire to spread)",
          "Amount of Experience: How often the Powered Character has done this. ~ Mastered: +0 (They have practiced this countless times.) ~ Practiced: +2 (They have tried this quite a few times before.) ~ Untried: +4 (They have done things like this before, but never quite like this.) ~ Unconceived: +6 (They have never even thought of using their powers in this way before, or they are trying to use a power for the first time.)",
          "Deviation: How much this breaks the rules of the universe. ~ Accelerating the Expected: +0 (e.g., gently eroding a rock, opening a flower’s bud, nudging a coin in someone’s hand) ~ Causing the Expected: +1 (e.g., putting a small crack in a rock, making a seed germinate in their palm, sliding a coin across a table) ~ Causing the Unexpected: +2 (e.g., putting a small crack in a diamond, making a plant go from seed to flower in their palm, levitating a coin off the table) ~ Reversing the Expected: +4 (e.g., sealing a crack in a rock, making a flowered plant return to seed, teleporting a coin) ~ Causing the Impossible: +6 (e.g., changing the color of a gemstone, making a plant disappear, changing one coin into another)",
          "Scope ~ Tiny: +1 (e.g., creating a spark, nudging a glass of water off a desk, reversing time by a second) ~ Small: +2 (e.g., creating a small fire in their palm, flipping a desk, reversing time by five seconds) ~ Medium: +4 (e.g., instantly engulfing a person in flames, shoving a parked car a few inches, reversing time by ten seconds) ~ Large: +6 (e.g., instantly engulfing a room in flames, flipping a truck, reversing time by thirty seconds) ~ Extra Large: +8 (Twice the scope of Large) ~ Extra Extra Large: +10 (Three times the scope of Large) ~ Note: Each time the scope increases by the size of “Large”, add +2 to the difficulty.",
          "Once the GM has set the difficulty and shared it with you, you should decide as a group whether to attempt it. In cases where you disagree, the decision to activate a power ultimately rests with the player controlling that power. If you choose to attempt it, you must spend one PT for every d6 that you decide to roll, adding those results together to reach the target number. They may spend more PT after any roll to roll additional dice and add them to the total. If they choose to stop spending PT before reaching or exceeding the target difficulty, any spent PT are lost and the attempt fails. If they meet or exceed that number with the sum of their rolls, though, the attempt is successful. As there are in standard stat checks, there are Lucky Breaks on the Powered Character’s roll, too. Any time you roll a 6, roll again, adding both the 6 and the new roll to the total.",
          "The number of PT expended should factor into the narrative consequences of using the Powered Character’s ability. Because of the possibility of Lucky Breaks, you should spend PT one at a time. In addition to being the best choice for you mechanically, it also allows the GM to offer gradually worse choices for the consequences for the Powered Character’s pushing themself. The table on the opposite page offers some suggestions for what those options could look like. Keep in mind that effects get worse the more PT spent. For example, if spending 1 PT causes a slight headache, spending 3 PT could certainly cause a migraine. If the PT aren’t spent all at once, this is a good chance to narrate the consequences as they worsen.",
          "Each time you spend PT, the GM will give you at least two choices of what could happen as a consequence, and you’ll decide as a group which consequence occurs. Initially, these choices will be the kinds of effects that are impacting the Powered Character, like whether their powers cause a headache or trouble seeing. As those effects become more established, though, the choices will fall along the lines of choices like whether the trouble with the character’s vision comes in the form of momentary blindness or passing color blindness.",
          "Remember, many of these consequences are real-world disabilities. When choosing consequences, make sure that you are being sensitive to this fact and respecting the boundaries set by everyone at the table. If you want to put a consequence on the Detour list, you can do so at any time. Also, these consequences should never be mocked or played for laughs. PT Spent Consequences (Examples)",
          "No effects or incredibly minor effects (a split second of a 1 PT headache, a momentary glare in their vision) Minor physical effects (slight headache, minor tremors in the 2 PT hands, passing blurred vision) Minor mental effects (momentary confusion, passing 3 PT synesthesia, temporary loss of emotional control) Significant physical effects (stabbing pains, nausea, 4 PT momentary blindness) Significant mental effects (prolonged disorientation, inability 5 PT to speak coherently for a few hours, decreased emotional control until fully rested) Profound physical effects (broken bones, blindness until they 6 PT get a night’s sleep, inability to stand without support until fully rested) Profound mental effects (memory loss, replacement of their 7 PT personality with a new one until they get a night’s sleep, erratic perception of reality until they get a night’s sleep)",
          "Certainly, GMs could allow players to spend more than 7 PT, but the consequences of doing so should be increasingly dire, likely involving the effects being more than a good night’s sleep can correct. In especially do-or-die situations, GMs may even let you spend PT that the Powered Character doesn’t have, though the GM, not the players, will decide what the consequences are (barring, of course, any player asking the GM to brake). GMs, for more information on how to decide on these consequences, refer to “Consequences for Using the Powered Character’s Powers” on page 91.",
          "While there is a mechanical economy to the use of the Powered Character’s abilities, remember that no sentient creature is a tool. No matter how useful the Powered Character’s abilities are, don’t simply use the Powered Character. Make sure that it makes narrative sense that they would want to help your group, and make sure that your character understands the sacrifice that using these powers represents for the Powered Character.",
          "For example, the teens talk to the strange child outside of the mine and find out that his name is Raj. Meanwhile, Kalsang looks around for any evidence of Daniel. The GM gives her a Brains check with a difficulty of 4, which she passes, finding her son’s baseball cap, something he always has with him. She runs over to it and picks it up, but she’s not able to find any other evidence of him. Devastated, Kalsang starts crying. (At the table, Carlos turns the “Able to Know an Object’s History by Touch” Aspect, taking narrative control of the Powered Character.) Raj touches Kalsang’s shoulder gently and says, “I...I might be able to help,” and holds out his hand to take the cap. Kalsang, confused, hands it to him, and Carlos announces that he’s going to have Raj try to read the cap’s history to find out when it was last with Daniel. He thinks reading the last few hours of its history should do the trick.",
          "Gauthier, the GM, looks at the rules on pages 68 and 69 and determines the total difficulty will be 9: ~ That this is a Low Degree of Control since he’s not trying to see a specific part of the hat’s history (+1) ~ That Raj has Practiced this skill of reading objects to see the person who possessed them (+2) ~ That this will Cause the Unexpected outcome of Raj suddenly knowing something about this object (+2) ~ And that going back by a few hours is a Medium scope (+4)",
          "Carlos decides to go for it and spends 3 PT. He gets an 8, not quite able to make a connection with the object yet. Based on choices Gauthier presents them with, the players decide that Raj’s hands tremble as he holds the hat, and his face reddens with anger. Carlos decides to spend another PT and gets a 3 on the next d6 for a total of 11. Gauthier says that Daniel seems to have lost his hat more than a few hours ago, so even though the check was a success, the characters have gained no information. Tears start rolling down Raj’s face, but he grits his teeth and says, “I can go back farther... but nothing yet…”",
          "Since Raj hasn’t found anything yet, Carlos asks if he can use the +2 leftover from the roll to make the scope of the check Large and go back by a few more hours. Gauthier agrees, and Raj pushes further into the hat’s past and sees Daniel putting it on in the woods just away from the mine. His bike is there, and his helmet is swinging on the handlebars, having just been placed there. Time jumps forward, and Raj sees a few seconds of Daniel walking toward the mouth of the cave. Then time jumps again. The perspective has changed. The hat is on the ground where Kalsang found it, and Raj can just make out Daniel’s body being dragged by something into the cave. He drops the hat and falls backwards, clutching his stomach and crying, again based on choices the players made after Gauthier gave them options.",
          "Isabella goes over to him to check on him. (At the table, Yasmin turns the “Completely Trusting of One Member of the Group” Aspect and takes narrative control of the Powered Character.) He explains that when he uses his powers, it feels like glass exploding in his stomach. Isabella takes his hands, seeing that they’re trembling violently and tells him it will be okay. Raj looks up at her and smiles. “I believe you,” he says. “Will you hold my hands while I rest? I just want to feel the sun on my face for a little bit.”"
        ]
      },
      {
        "id": "replenishing-power-tokens",
        "name": "Replenishing Power Tokens",
        "paragraphs": [
          "In order to replenish their Power Tokens, the Powered Character needs to rest, eat, or take other appropriate action. A full night’s rest should fully restore the character—unless they have exhausted all of their PT or dipped below zero. In that case, recovery should take more time, though the exact duration is up to the GM’s discretion.",
          "Also, there should be one or two things that can help the Powered Character recover without sleeping—or recover more quickly if they’ve dipped into negative PT. Do they crave a particular kind of food, maybe something high in iron? Does meditation or direct sunlight help them to recover? Likely, spending time with someone they have a close bond with in the group will help, too. In all situations, the Powered Character should be subtly drawn to these things to give you clues—but your GM should feel free to throw in some red herrings.",
          "For example, hearing Yasmin say that Raj likes being in the sun gives Gauthier an idea. One of the ways that Raj will recover his powers is through exposure to direct sunlight. In the time it takes for his trembling and stomach pain to pass, Raj has regained 2 PT, giving him 5 currently in his pool. Later, the characters might think back on this moment, especially if Raj is unsuccessfully trying to recover his powers at night or in the dark of the mines. Or, they might need a few more hints before they put it together. If need be, Gauthier can always ask them to make a Brains check for a character to put it together even if the players don’t."
        ]
      }
    ],
    "powerTokens": 7,
    "aspectsPerPlayer": 2,
    "powerCheck": {
      "equation": "amount of experience + deviation + scope + degree of control",
      "factors": [
        {
          "id": "degree-of-control",
          "name": "Degree of Control",
          "question": "How precise the Powered Character is trying to be.",
          "options": [
            {
              "id": "low",
              "label": "Low",
              "modifier": 1,
              "examples": "e.g., sending a wave of force in all directions, causing an explosion, afflicting all within range with a painful memory"
            },
            {
              "id": "moderate",
              "label": "Moderate",
              "modifier": 2,
              "examples": "e.g., sending a wave of force only in one straight line, causing an explosion that moves only one direction, afflicting one person with a painful memory"
            },
            {
              "id": "high",
              "label": "High",
              "modifier": 4,
              "examples": "e.g., sending a small burst of force some distance away from them, combusting a can of gasoline without allowing the fire to spread"
            }
          ],
          "note": ""
        },
        {
          "id": "amount-of-experience",
          "name": "Amount of Experience",
          "question": "How often the Powered Character has done this.",
          "options": [
            {
              "id": "mastered",
              "label": "Mastered",
              "modifier": 0,
              "examples": "They have practiced this countless times."
            },
            {
              "id": "practiced",
              "label": "Practiced",
              "modifier": 2,
              "examples": "They have tried this quite a few times before."
            },
            {
              "id": "untried",
              "label": "Untried",
              "modifier": 4,
              "examples": "They have done things like this before, but never quite like this."
            },
            {
              "id": "unconceived",
              "label": "Unconceived",
              "modifier": 6,
              "examples": "They have never even thought of using their powers in this way before, or they are trying to use a power for the first time."
            }
          ],
          "note": ""
        },
        {
          "id": "deviation",
          "name": "Deviation",
          "question": "How much this breaks the rules of the universe.",
          "options": [
            {
              "id": "accelerating-the-expected",
              "label": "Accelerating the Expected",
              "modifier": 0,
              "examples": "e.g., gently eroding a rock, opening a flower’s bud, nudging a coin in someone’s hand"
            },
            {
              "id": "causing-the-expected",
              "label": "Causing the Expected",
              "modifier": 1,
              "examples": "e.g., putting a small crack in a rock, making a seed germinate in their palm, sliding a coin across a table"
            },
            {
              "id": "causing-the-unexpected",
              "label": "Causing the Unexpected",
              "modifier": 2,
              "examples": "e.g., putting a small crack in a diamond, making a plant go from seed to flower in their palm, levitating a coin off the table"
            },
            {
              "id": "reversing-the-expected",
              "label": "Reversing the Expected",
              "modifier": 4,
              "examples": "e.g., sealing a crack in a rock, making a flowered plant return to seed, teleporting a coin"
            },
            {
              "id": "causing-the-impossible",
              "label": "Causing the Impossible",
              "modifier": 6,
              "examples": "e.g., changing the color of a gemstone, making a plant disappear, changing one coin into another"
            }
          ],
          "note": ""
        },
        {
          "id": "scope",
          "name": "Scope",
          "question": "",
          "options": [
            {
              "id": "tiny",
              "label": "Tiny",
              "modifier": 1,
              "examples": "e.g., creating a spark, nudging a glass of water off a desk, reversing time by a second"
            },
            {
              "id": "small",
              "label": "Small",
              "modifier": 2,
              "examples": "e.g., creating a small fire in their palm, flipping a desk, reversing time by five seconds"
            },
            {
              "id": "medium",
              "label": "Medium",
              "modifier": 4,
              "examples": "e.g., instantly engulfing a person in flames, shoving a parked car a few inches, reversing time by ten seconds"
            },
            {
              "id": "large",
              "label": "Large",
              "modifier": 6,
              "examples": "e.g., instantly engulfing a room in flames, flipping a truck, reversing time by thirty seconds"
            },
            {
              "id": "extra-large",
              "label": "Extra Large",
              "modifier": 8,
              "examples": "Twice the scope of Large"
            },
            {
              "id": "extra-extra-large",
              "label": "Extra Extra Large",
              "modifier": 10,
              "examples": "Three times the scope of Large"
            }
          ],
          "note": "Each time the scope increases by the size of “Large”, add +2 to the difficulty."
        }
      ],
      "consequences": [
        {
          "tokens": 1,
          "text": "No effects or incredibly minor effects (a split second of a headache, a momentary glare in their vision)"
        },
        {
          "tokens": 2,
          "text": "Minor physical effects (slight headache, minor tremors in the hands, passing blurred vision)"
        },
        {
          "tokens": 3,
          "text": "Minor mental effects (momentary confusion, passing synesthesia, temporary loss of emotional control)"
        },
        {
          "tokens": 4,
          "text": "Significant physical effects (stabbing pains, nausea, momentary blindness)"
        },
        {
          "tokens": 5,
          "text": "Significant mental effects (prolonged disorientation, inability to speak coherently for a few hours, decreased emotional control until fully rested)"
        },
        {
          "tokens": 6,
          "text": "Profound physical effects (broken bones, blindness until they get a night’s sleep, inability to stand without support until fully rested)"
        },
        {
          "tokens": 7,
          "text": "Profound mental effects (memory loss, replacement of their personality with a new one until they get a night’s sleep, erratic perception of reality until they get a night’s sleep)"
        }
      ]
    }
  }
} as const;

export default kidsOnBikesContent;
