import type { EndingDefinition } from '../systems/ending/EndingSystem';

export const ENDING_DEFINITIONS: EndingDefinition[] = [
  {
    id: 'ending_true_seeker',
    title: 'The Architect Remains',
    subtitle: 'True Ending',
    description:
      'You stayed. You looked. You did not look away — even when looking away would have been survivable. The fracture seals. The Mirror District heals. You remain.',
    category: 'true',
    conditions: {
      soul: [
        { attribute: 'purpose', operator: '>=', value: 50 },
        { attribute: 'compassion', operator: '>=', value: 40 },
      ],
    },
    triggerScene: 'ending_check_true_seeker',
    isSecret: false,
    artPath: 'art/endings/ending_true_seeker.png',
    musicId: 'ending_true_seeker_credits',
    creditsSuffix:
      'The Mirror District was restored through patience, presence, and the refusal to look away.',
  },

  {
    id: 'ending_good_guardian',
    title: "The Guardian's Vigil",
    subtitle: 'Good Ending',
    description:
      'You did not seal the Heart Mirror. You did not shatter it. You stayed. Through compassion, through presence, through the refusal to abandon those caught between worlds, you became the threshold itself.',
    category: 'good',
    conditions: {
      soul: [
        { attribute: 'compassion', operator: '>=', value: 50 },
        { attribute: 'love', operator: '>=', value: 40 },
        { attribute: 'fear', operator: '<=', value: 20 },
      ],
    },
    triggerScene: 'ending_guardian_approach',
    isSecret: false,
    artPath: 'art/endings/ending_good_guardian.png',
    musicId: 'ending_guardian_theme',
    creditsSuffix:
      'Someone has to stay. It might as well be someone who has already seen the worst of it — and stayed anyway.',
  },

  {
    id: 'ending_neutral_threshold',
    title: 'The Threshold Holds',
    subtitle: 'Neutral Ending',
    description:
      'The fracture didn\'t close. But you held it. You stood at the edge of something enormous and didn\'t let it widen. The work continues — and so do you.',
    category: 'neutral',
    conditions: {},
    triggerScene: 'ending_neutral_threshold',
    isSecret: false,
    artPath: 'art/endings/ending_neutral.png',
    musicId: 'ending_neutral_theme',
    creditsSuffix:
      'The fracture held. The work continues. You will be back tomorrow.',
  },

  {
    id: 'ending_corrupted',
    title: 'The Fracture Wins',
    subtitle: 'Bad Ending',
    description:
      'You accumulated what you could not integrate. The fracture widened because something in you wanted it to. The door opened, and you walked through it.',
    category: 'bad',
    conditions: {
      soul: [
        { attribute: 'shadow', operator: '>=', value: 60 },
      ],
    },
    triggerScene: 'ending_corrupted_approach',
    isSecret: false,
    artPath: 'art/endings/ending_corrupted.png',
    musicId: 'ending_corrupted_theme',
    creditsSuffix:
      'What you could not face closed around you. The work continues in other hands. You were not the last.',
  },

  {
    id: 'ending_transcendent',
    title: 'The Voice Itself',
    subtitle: 'Secret Ending — New Game Plus',
    description:
      'On the second pass you heard what the Voice was actually saying. You recognized who it was. And you did the one thing two hundred years of witnessing had never produced: you told them to rest.',
    category: 'secret',
    conditions: {
      requiresNGPlus: true,
      soul: [
        { attribute: 'purpose', operator: '>=', value: 40 },
        { attribute: 'compassion', operator: '>=', value: 40 },
        { attribute: 'hope', operator: '>=', value: 40 },
        { attribute: 'knowledge', operator: '>=', value: 40 },
        { attribute: 'love', operator: '>=', value: 40 },
      ],
      flags: {
        all_codex_unlocked: true,
        nyx_shadow_shared: true,
        echo_first_meeting: true,
      },
    },
    triggerScene: 'ending_transcendent_approach',
    isSecret: true,
    artPath: 'art/endings/ending_transcendent.png',
    musicId: 'ending_transcendent_credits',
    creditsSuffix:
      'Every threshold needs someone who understands that the work is not to hold the door forever, but to find the one who can hold it next — and then to let go.',
  },
];
