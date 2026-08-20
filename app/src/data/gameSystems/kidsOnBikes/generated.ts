// GENERATED FILE — do not edit by hand.
// Source: an Obsidian vault of Kids on Bikes (2nd edition) notes.
// Regenerate with: node scripts/import-kids-on-bikes.mjs
//
// Every value below is read out of the vault's notes. Anything the notes do not say is absent
// here rather than invented; `meta.warnings` records what the import could not resolve.

import type { KidsOnBikesContent } from './types';

export const kidsOnBikesContent: KidsOnBikesContent = {
  "meta": {
    "systemId": "kids-on-bikes",
    "label": "Kids on Bikes (2nd Edition)",
    "source": "Obsidian vault notes",
    "importedAt": "2026-08-20",
    "warnings": [
      "Trope tables name colors the appendices do not define: While, Yellow",
      "Playing The Game: Lucky Breaks has a heading but no text in the vault."
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
          "Adversity Tokens (or AT) can be used to improve subsequent rolls, activate Strengths, or, with the GM's permission, ignore your Fears."
        ]
      },
      {
        "id": "lucky-breaks",
        "name": "Lucky Breaks",
        "paragraphs": []
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
  }
} as const;

export default kidsOnBikesContent;
