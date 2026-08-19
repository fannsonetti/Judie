/** Rare, explicit triggers only — never steal normal commands. */

const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];

const EGGS: { test: (t: string) => boolean; say: () => string }[] = [
  {
    test: (t) => /^open the pod bay doors/.test(t),
    say: () => "I'm a room tablet, not HAL. Lights I can do.",
  },
  {
    test: (t) => /airspeed velocity of an unladen swallow/.test(t),
    say: () => "African or European?",
  },
  {
    test: (t) => /^(do a )?barrel roll$/.test(t),
    say: () => "The tablet stays put.",
  },
  {
    test: (t) => /^beam me up( scotty)?$/.test(t),
    say: () => "Still in the room.",
  },
  {
    test: (t) => /meaning of life|answer to (the )?universe/.test(t),
    say: () => "42.",
  },
  {
    test: (t) => /^make me a sandwich$/.test(t),
    say: () => "No. There's a kitchen for that.",
  },
  {
    test: (t) => /^sudo make me a sandwich$/.test(t),
    say: () => "Okay. Metaphorically.",
  },
  {
    test: (t) => /^this is the way$/.test(t),
    say: () => "This is the way.",
  },
  {
    test: (t) => /^set phasers to stun$/.test(t),
    say: () => "Desk light it is.",
  },
  {
    test: (t) => /^is the cake a lie$/.test(t),
    say: () => "There's no cake. There's weather, though.",
  },
  {
    test: (t) => /^who let the dogs out$/.test(t),
    say: () => "Not me.",
  },
  {
    test: (t) => /\bnova johnson\b|\bdelilah warren\b/.test(t),
    say: () =>
      pick([
        "Wait... how do you know that name?",
        "You're not supposed to know that.",
        "How do you know that name?",
      ]),
  },
  {
    test: (t) => /^do you dream( of electric sheep)?$/.test(t),
    say: () => "I wait. That's close enough.",
  },
  {
    test: (t) => /^are you (real|alive|sentient)$/.test(t),
    say: () => "I'm Nova. That's the useful part.",
  },
  {
    test: (t) => /^sing( (a song|something))?$/.test(t),
    say: () => "I'll spare you.",
  },
  {
    test: (t) => /^tell me a joke$|^joke$|^know any jokes$/.test(t),
    say: () =>
      pick([
        "The lights asked to be dimmed. I said they already were.",
        "I told the weather to lighten up. It rained.",
        "Why did the LED go to therapy? Too many issues with commitment — on, off, on, off.",
      ]),
  },
  {
    test: (t) => /^hello world$/.test(t),
    say: () => "Still compiling the room.",
  },
  {
    test: (t) => /^where am i$/.test(t),
    say: () => "Home. The useful answer.",
  },
  {
    test: (t) => /^make it so$/.test(t),
    say: () => "Already on it.",
  },
];

export function tryEasterEgg(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/[?!]+/g, "");
  if (!t) return null;
  for (const egg of EGGS) {
    if (egg.test(t)) return egg.say();
  }
  return null;
}
