import type { CodexEntry } from '../systems/codex/CodexSystem';

type CodexBase = Omit<CodexEntry, 'unlockedAt' | 'isNew'>;

const definitions: CodexBase[] = [
  {
    id: 'the_voice',
    title: 'The Voice',
    category: 'character',
    summary: 'A presence that speaks through the Heart Mirror — ancient, grief-stricken, and impossibly patient.',
    fullContent: `The Voice first made contact during the initial fracture event in the Mirror District. It communicates in impressions and half-formed sentences, as though it has forgotten how to speak in full thoughts after so long in isolation.

Researchers at the Sanctuary have debated its nature for decades. Some believe it is a residual consciousness from the First Architect. Others believe it is a collective echo of everyone the Heart Mirror has ever witnessed.

The Voice itself says very little about its own origins — only that it has been "waiting for someone who would not look away."

Its motivations remain unclear, but it has never demonstrated hostile intent. It seems, above all else, to want to be understood.`,
    iconPath: 'icons/codex/the_voice.png',
    unlockCondition: [],
    relatedEntries: ['the_heart_mirror_truth', 'the_first_architect', 'true_nature_of_the_architect'],
    tags: ['character', 'mirror', 'mystery'],
    isSecret: false,
  },

  {
    id: 'echo',
    title: 'Echo',
    category: 'character',
    summary: 'A traveler from the void-between-mirrors. Not quite human. Not quite not.',
    fullContent: `Echo appeared in the Mirror District approximately six weeks before the main fracture event. No one saw her arrive. No one can agree on what she looks like when they try to describe her afterward.

She claims to have been "born in the reflection of a reflection" — a statement that sounds like metaphor until you look at what the Heart Mirror shows when she stands before it.

Echo is curious, cautious, and deeply interested in the question of what it means to exist on the boundary between states. She is not dangerous, but she is not entirely safe either. She exists at the edge of categories.

Her connection to the void-between-mirrors suggests she may be a natural navigator of the spaces that the fracture has opened.`,
    iconPath: 'icons/codex/echo.png',
    unlockCondition: [],
    relatedEntries: ['the_void_between', 'the_fracture'],
    tags: ['character', 'void', 'mystery', 'traveler'],
    isSecret: false,
  },

  {
    id: 'the_void_between',
    title: 'The Void Between',
    category: 'concept',
    summary: 'The space that exists between reflections — not empty, but not quite filled either.',
    fullContent: `Sanctuary theologians originally described the Void Between as a metaphor: the psychological space between who we are and who we see ourselves to be. The Heart Mirror made it literal.

When the first significant fracture occurred, researchers noted that the cracks did not simply open into darkness. They opened into something that reflected back — distorted, but present. Something that had been occupying that space for a very long time.

The Void Between is not hostile. It is not welcoming. It is, as best anyone can determine, a threshold state — a place that exists in the moment before a thing becomes itself.

Travelers who have entered it (voluntarily or otherwise) report a sense of immense age, and a feeling that they are being carefully observed.`,
    iconPath: 'icons/codex/void_between.png',
    unlockCondition: [],
    relatedEntries: ['echo', 'the_fracture', 'the_heart_mirror_truth'],
    tags: ['location', 'void', 'threshold', 'concept'],
    isSecret: false,
  },

  {
    id: 'the_fracture',
    title: 'The Fracture',
    category: 'event',
    summary: 'The ongoing breach in the Heart Mirror and the Mirror District reality-substrate it anchors.',
    fullContent: `The Fracture is not a single event but an ongoing condition. The Heart Mirror — which has stood at the center of the Sanctuary for three hundred years — began showing structural instability approximately eight months ago.

The first visible crack appeared at 3:17 AM on the winter solstice. By morning, six blocks of the Mirror District had become "perceptually unstable": buildings that looked normal from outside revealed interiors that did not match their exteriors, reflective surfaces showed scenes from other times, and several residents reported hearing voices from their mirrors.

The Fracture has been slowly widening since. Sanctuary response teams have contained the worst effects, but every attempted "sealing" has proven temporary. The Mirror District remains the primary affected zone.

The fracture is not simply physical damage to a magical artifact. It is a failure of the boundary between what is reflected and what is real. Someone — or something — will need to address the source, not just the symptom.`,
    iconPath: 'icons/codex/the_fracture.png',
    unlockCondition: [],
    relatedEntries: ['the_heart_mirror_truth', 'the_shattered_mirror_district', 'the_voice'],
    tags: ['event', 'crisis', 'mirror', 'location'],
    isSecret: false,
  },

  {
    id: 'the_heart_mirror_truth',
    title: 'The Heart Mirror — True Nature',
    category: 'artifact',
    summary: 'It is not a mirror. It never was.',
    fullContent: `The Heart Mirror was brought to the Sanctuary three hundred years ago by the First Architect, who described it as "a window into the self that will not lie."

For two hundred and ninety-eight years, it functioned as promised — a meditation tool, a truth-telling instrument, a way to see past one's own defenses into honest self-knowledge.

What no one understood until the Fracture is that the Mirror is not a passive reflective surface. It is a living boundary — an entity in its own right that agreed, at some point, to take the shape of a mirror in order to help. It has been absorbing and processing every reflection, every confession, every moment of genuine self-seeing for three centuries.

The Voice is not a ghost in the mirror. The Voice is what the mirror became after three hundred years of witnessing everything human beings are when they finally look at themselves honestly.`,
    iconPath: 'icons/codex/heart_mirror.png',
    unlockCondition: [{ attribute: 'knowledge', operator: '>=', value: 40 }],
    relatedEntries: ['the_first_architect', 'the_voice', 'the_fracture'],
    tags: ['artifact', 'mirror', 'mystery', 'revelation'],
    isSecret: false,
  },

  {
    id: 'the_first_architect',
    title: 'The First Architect',
    category: 'character',
    summary: 'The founder of the Sanctuary. Their name has been forgotten. Their work has not.',
    fullContent: `The First Architect founded the Sanctuary approximately three hundred years ago following what historical records describe only as "the dissolution event" — a crisis of unknown nature that destroyed the city that previously occupied this location.

They brought the Heart Mirror with them and established the Sanctuary's core purpose: to provide a space for honest self-examination, protected from external pressure.

The First Architect disappeared approximately one year after the Sanctuary's founding. No body was found. Their personal journals were sealed by their own request and have never been opened.

Recent events in the Mirror District have led some researchers to question whether "disappeared" is the correct word. Whether the First Architect left, or whether they remained — just in a different form.`,
    iconPath: 'icons/codex/first_architect.png',
    unlockCondition: [{ attribute: 'knowledge', operator: '>=', value: 30 }],
    relatedEntries: ['the_heart_mirror_truth', 'the_voice', 'true_nature_of_the_architect'],
    tags: ['character', 'history', 'mystery'],
    isSecret: false,
  },

  {
    id: 'true_nature_of_the_architect',
    title: 'The Architect — True Nature',
    category: 'philosophy',
    summary: 'The role of the Architect is not to build. It is to remain.',
    fullContent: `The title "Architect" within the Sanctuary's tradition refers not to a builder but to a guardian of thresholds. An Architect is someone who understands the boundary between states — between what is and what could be, between reflection and reality, between the self that is shown and the self that is hidden.

The First Architect's founding documents describe the role in terms of what it is not: "The Architect does not direct. The Architect does not judge. The Architect does not force the fracture closed or prevent it from opening. The Architect holds the threshold and witnesses what crosses it."

This understanding was largely theoretical for three centuries. The Fracture has made it urgently practical.

To be the Architect is to become comfortable at the edge of categories — to exist in the space that Echo inhabits naturally, that the Voice has inhabited by accident, that the Heart Mirror models in its very structure.

It is not a comfortable role. It was never meant to be comfortable. It was meant to be necessary.`,
    iconPath: 'icons/codex/architect_role.png',
    unlockCondition: [
      { attribute: 'purpose', operator: '>=', value: 40 },
      { attribute: 'knowledge', operator: '>=', value: 40 },
    ],
    relatedEntries: ['the_first_architect', 'the_heart_mirror_truth', 'the_architecture_of_thresholds'],
    tags: ['philosophy', 'role', 'threshold', 'purpose'],
    isSecret: false,
  },

  {
    id: 'the_architecture_of_thresholds',
    title: 'The Architecture of Thresholds',
    category: 'philosophy',
    summary: 'A threshold is not a wall. It is a conversation between what is on either side.',
    fullContent: `The Sanctuary's foundational philosophy holds that all significant transitions — psychological, spiritual, physical — are not binary switches but thresholds: spaces that have their own duration, their own nature, their own requirement to be properly crossed.

The Mirror District, with its reflective surfaces and liminal geometry, was designed to make thresholds visible. The Fracture has made them dangerously permeable.

Threshold architecture, as the First Architect conceived it, requires three elements: a witness (someone present enough to observe the crossing), a frame (a structure that gives the threshold shape), and a passage (the actual movement through). The Heart Mirror was designed to provide all three simultaneously.

The problem with the Fracture is not that the threshold has broken. The problem is that it has become too open — the conversation between what is on either side has become a scream.

To repair a threshold, you do not seal it. You restore the conversation.`,
    iconPath: 'icons/codex/threshold_arch.png',
    unlockCondition: [
      { attribute: 'knowledge', operator: '>=', value: 35 },
      { attribute: 'purpose', operator: '>=', value: 35 },
    ],
    relatedEntries: ['the_first_architect', 'the_fracture', 'true_nature_of_the_architect'],
    tags: ['philosophy', 'threshold', 'theory', 'architecture'],
    isSecret: false,
  },

  {
    id: 'the_shattered_mirror_district',
    title: 'The Mirror District',
    category: 'location',
    summary: 'Seven blocks of reflective architecture at the heart of the city. Currently fractured. Still beautiful.',
    fullContent: `The Mirror District was built in the second century of the Sanctuary's existence as an extension of the Heart Mirror's principles into urban space. Its buildings are faced with treated glass and reflective stone that respond to the Mirror's resonance — in normal conditions, walking through the District offers an ever-shifting experience of self-reflection both literal and psychological.

In the three months since the Fracture began affecting the District, the experience has become significantly more complex.

Reflective surfaces now show inconsistent images: the right version of you, the wrong version, the version from six years ago, the version that made different choices. The buildings shift when unobserved. Certain streets lead to locations that don't appear on maps.

Despite all this, residents have largely refused to leave. When asked why, they give different answers — but many of them involve some version of "because I can finally see clearly here."

The Fracture has made the District dangerous. It has also made it honest in ways that normal space is not.`,
    iconPath: 'icons/codex/mirror_district.png',
    unlockCondition: [],
    relatedEntries: ['the_fracture', 'the_heart_mirror_truth'],
    tags: ['location', 'mirror', 'city', 'district'],
    isSecret: false,
  },

  {
    id: 'the_mirror_naming',
    title: 'Mirror-Naming',
    category: 'concept',
    summary: 'When the Mirror shows you a name, it is not labeling you. It is asking.',
    fullContent: `A phenomenon first documented fifteen years ago but dramatically increased since the Fracture: individuals who spend significant time in the Mirror District report the experience of "being named" by a reflection.

The name is not spoken. It appears in the reflection itself — superimposed over the person's image, written in light that does not correspond to any light source in the room.

Mirror-naming does not give you a name you did not have. Sanctuary researchers have consistently found that the names shown are names the individual already carries in some form: a childhood nickname, a name used only in private, a name from a language the person doesn't consciously know but carries in their ancestry.

The Mirror is not naming you. The Mirror is showing you a name you have not let yourself use.

Since the Fracture, the naming has become more insistent. More people. More names. And some of those names are not from the past — they are from a self that does not yet exist.`,
    iconPath: 'icons/codex/mirror_naming.png',
    unlockCondition: [{ attribute: 'memory', operator: '>=', value: 30 }],
    relatedEntries: ['the_heart_mirror_truth', 'the_shattered_mirror_district'],
    tags: ['concept', 'mirror', 'identity', 'naming'],
    isSecret: false,
  },
];

export const CODEX_DEFINITIONS: CodexEntry[] = definitions.map((d) => ({ ...d, isNew: false }));
