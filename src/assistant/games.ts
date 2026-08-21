import { ConversationContext } from "./types";

export type GameState = {
  kind: "rps" | "guess";
  secret?: number;
  startedAt: number;
} | null;

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

const RPS = ["rock", "paper", "scissors"] as const;
type Rps = (typeof RPS)[number];

function beats(a: Rps, b: Rps) {
  return (
    (a === "rock" && b === "scissors") ||
    (a === "paper" && b === "rock") ||
    (a === "scissors" && b === "paper")
  );
}

const EIGHT = [
  "Yes.",
  "No.",
  "Ask again later.",
  "Looks like it.",
  "I wouldn't.",
  "Count on it.",
  "Doubtful.",
  "Sure.",
];

export function tryGame(
  text: string,
  ctx: ConversationContext
): { response: string; intent: string; game: GameState } | null {
  const t = text.trim().toLowerCase();

  if (/^(flip a coin|coin flip|heads or tails|flip it)$/.test(t) || t === "flip a coin") {
    return {
      intent: "game.coinflip",
      response: Math.random() < 0.5 ? "Heads." : "Tails.",
      game: null,
    };
  }

  const dice = t.match(/^roll (?:a |the )?(?:die|dice|(\d*)d(\d+))$/);
  if (t === "roll a die" || t === "roll the dice" || t === "roll dice" || dice) {
    const n = dice?.[1] ? Number(dice[1] || 1) : 1;
    const sides = dice?.[2] ? Number(dice[2]) : 6;
    const count = Math.max(1, Math.min(8, n || 1));
    const s = Math.max(2, Math.min(20, sides || 6));
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * s));
    const sum = rolls.reduce((a, b) => a + b, 0);
    const response =
      count === 1 ? `${rolls[0]}.` : `${rolls.join(", ")}. That's ${sum}.`;
    return { intent: "game.dice", response, game: null };
  }

  if (/\b(magic 8[- ]?ball|eight ball)\b/.test(t) || /^should i\b/.test(t) && /\bor not\b/.test(t)) {
    return { intent: "game.eightball", response: pick(EIGHT), game: null };
  }

  if (/^(pick a number|random number|give me a (random )?number)$/.test(t)) {
    const n = 1 + Math.floor(Math.random() * 100);
    return { intent: "game.random", response: `${n}.`, game: null };
  }

  if (
    /^(let us |lets |let's )?play (a game|rock paper scissors|rps)$/.test(t) ||
    t === "rock paper scissors" ||
    t === "play rock paper scissors"
  ) {
    return {
      intent: "game.rps",
      response: "Rock, paper, or scissors?",
      game: { kind: "rps", startedAt: Date.now() },
    };
  }

  const throw_ = RPS.find((m) => t === m || t === `i pick ${m}` || t === `${m}!`);
  if (throw_) {
    const mine = pick([...RPS]);
    if (throw_ === mine) {
      return { intent: "game.rps", response: `${cap(mine)}. Tie.`, game: null };
    }
    if (beats(throw_, mine)) {
      return { intent: "game.rps", response: `${cap(mine)}. You win.`, game: null };
    }
    return { intent: "game.rps", response: `${cap(mine)}. I win.`, game: null };
  }

  if (
    /^(guess( a)? number|i am thinking of a number|play guess(ing)?( a number)?)$/.test(t) ||
    t === "guess a number between 1 and 10"
  ) {
    const secret = 1 + Math.floor(Math.random() * 10);
    return {
      intent: "game.guess",
      response: "Pick a number from 1 to 10.",
      game: { kind: "guess", secret, startedAt: Date.now() },
    };
  }

  if (ctx.game?.kind === "guess" && ctx.game.secret != null && Date.now() - ctx.game.startedAt < 120_000) {
    const n = Number(t.replace(/[^\d-]/g, ""));
    if (Number.isInteger(n) && n >= 1 && n <= 10) {
      if (n === ctx.game.secret) {
        return { intent: "game.guess", response: "That's it.", game: null };
      }
      return {
        intent: "game.guess",
        response: n < ctx.game.secret ? "Higher." : "Lower.",
        game: ctx.game,
      };
    }
  }

  return null;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
