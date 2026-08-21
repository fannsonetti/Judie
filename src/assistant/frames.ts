import { matchAll, type MatchCandidate } from "./matcher";
import { INTENTS } from "./intents";
import { namedPerson } from "./entities";

export const CAPABILITY_MIN = 0.78;
export const CONVERSATION_MIN = 0.52;

export type SpeechAct =
  | "identity"
  | "creator"
  | "person"
  | "preference"
  | "comparison"
  | "insult"
  | "compliment"
  | "wellbeing"
  | "help"
  | "smalltalk"
  | "unsupported";

export type ScoredRoute = {
  capability: MatchCandidate | null;
  conversation: { act: SpeechAct; confidence: number; entity?: string } | null;
  candidates: MatchCandidate[];
};

const PREFERENCE_CUE =
  /\b(favou?rite|prefer|do you like|do you love|do you hate|do you eat|do you sleep|do you dream|are you bored|are you tired|are you hungry|what do you think|opinion)\b/;

const INSULT_CUE =
  /\b(stupid|dumb|idiot|useless|trash|suck|sucks|worst|braindead|garbage|pathetic|broken|awful|terrible|hate you)\b/;

const COMPARISON_CUE =
  /\b(better|worse|smarter|dumber)\b.+\b(than|or)\b|\bcompared to\b|\bversus\b|\bvs\b|\bdifference between\b|\byou or (siri|alexa|google|chatgpt)\b|\b(siri|alexa|google) or you\b/;

const CREATOR_CUE =
  /\bwho (made|created|built|coded|programmed|owns|designed|developed|wrote) (you|judie|this)\b|\bwho is your (maker|creator|author|owner|developer|boss)\b|\bwho works on (you|judie)\b|\bwhere (do you|are you) (from|running|hosted|installed)\b/;

const IDENTITY_CUE =
  /\bwho are you\b|\bwhat are you\b|\bwhat is your name\b|\bwhat(?: is|'s)? judie\b|\bwho is judie\b/;

const WELLBEING_CUE =
  /\bhow are you\b|\bhow(?: are|'re) you doing\b|\byou good\b|\bhow is it going\b|\bhow you doing\b/;

const DATE_CUE =
  /\b(what|which|tell me|whats)\b.+\b(day|date)\b|\b(day|date)\b.+\b(today|it)\b|\bwhat day we on\b|\btoday['s]* date\b|\bthe date\b/;

const TIME_CUE = /\bwhat time\b|\bthe time\b|\bhow late\b|\bwhat is the time\b/;

const DATE_VETO =
  /\b(favou?rite|food|color|colour|song|movie|animal|drink|snack|band|game)\b|\bwhat did\b|\byesterday\b/;

export function scoreRoute(text: string): ScoredRoute {
  const t = text.trim().toLowerCase();
  const matches = matchAll(t, INTENTS);
  const conversation = scoreConversation(t);

  const framed: MatchCandidate[] = [];
  const dateScore = scoreDate(t);
  if (dateScore > 0) {
    framed.push({ name: "system.time", domain: "system", confidence: dateScore, source: "frame" });
  }
  const timeScore = scoreTime(t);
  if (timeScore > 0) {
    framed.push({ name: "system.time", domain: "system", confidence: timeScore, source: "frame" });
  }
  const weatherScore = scoreWeather(t);
  if (weatherScore > 0) {
    framed.push({ name: "weather.query", domain: "weather", confidence: weatherScore, source: "frame" });
  }

  const merged = [...framed, ...matches].sort((a, b) => b.confidence - a.confidence);
  const capability = pickCapability(merged, conversation, t);

  return {
    capability,
    conversation,
    candidates: dedupe(merged).slice(0, 6),
  };
}

function pickCapability(
  merged: MatchCandidate[],
  conversation: ScoredRoute["conversation"],
  text: string
): MatchCandidate | null {
  const best = merged.find((c) => c.source !== "keyword") ?? null;
  if (!best) return null;
  if (PREFERENCE_CUE.test(text) && best.name.startsWith("system.time")) return null;
  if (conversation && conversation.confidence >= 0.7 && conversationBlocksCapability(conversation.act, best.name)) {
    return null;
  }
  if (best.source === "keyword") return null;
  return best;
}

function conversationBlocksCapability(act: SpeechAct, intent: string) {
  if (act === "preference" && intent.startsWith("system.time")) return true;
  if (act === "comparison" && (intent.startsWith("social.") || intent === "system.status")) return true;
  if (act === "insult" && (intent.startsWith("social.") || intent === "assistant.why")) return true;
  if (act === "creator" && intent === "social.who") return true;
  if (act === "person" && intent === "social.who") return true;
  if (act === "wellbeing" && intent === "system.status") return true;
  return false;
}

function scoreDate(t: string) {
  if (DATE_VETO.test(t)) return 0;
  if (PREFERENCE_CUE.test(t) || COMPARISON_CUE.test(t)) return 0;
  if (!DATE_CUE.test(t) && !/\bwhat day\b/.test(t)) return 0;
  if (/\bwhat day we on\b|\bwhat day is it\b|\bwhat is the date\b|\bwhat is today['s]* date\b/.test(t)) {
    return 0.93;
  }
  if (/\b(day|date)\b/.test(t) && /\b(what|which|today|tell)\b/.test(t)) return 0.88;
  return 0;
}

function scoreTime(t: string) {
  if (DATE_VETO.test(t) || PREFERENCE_CUE.test(t)) return 0;
  if (!TIME_CUE.test(t)) return 0;
  if (/\bwhat time is it\b|\bwhat is the time\b/.test(t)) return 0.93;
  return 0.86;
}

function scoreWeather(t: string) {
  if (PREFERENCE_CUE.test(t) || COMPARISON_CUE.test(t)) return 0;
  if (!/\b(weather|forecast|raining|rain)\b/.test(t)) return 0;
  if (/\b(weather|forecast)\b/.test(t)) return 0.88;
  if (/\b(will it rain|is it raining|rain later|going to rain)\b/.test(t)) return 0.9;
  return 0;
}

export function scoreConversation(t: string): ScoredRoute["conversation"] {
  const entity = namedPerson(t);

  if (/\bnova johnson\b|\bdelilah warren\b/.test(t)) {
    return { act: "person", confidence: 0.99, entity: entity || "nova johnson" };
  }

  if (CREATOR_CUE.test(t)) return { act: "creator", confidence: 0.9 };

  if (entity && !isSelfEntity(entity)) {
    return { act: "person", confidence: 0.86, entity };
  }

  if (/\bhow (good|bad|smart|useful|capable) are you\b/.test(t)) {
    return { act: "comparison", confidence: 0.82 };
  }

  if (INSULT_CUE.test(t) || /\bwhy are you so\b/.test(t) || (/\bwhy are you\b/.test(t) && !WELLBEING_CUE.test(t))) {
    if (!WELLBEING_CUE.test(t) || INSULT_CUE.test(t)) {
      return { act: "insult", confidence: 0.88 };
    }
  }

  if (COMPARISON_CUE.test(t)) return { act: "comparison", confidence: 0.9 };

  if (PREFERENCE_CUE.test(t)) return { act: "preference", confidence: 0.86 };

  if (WELLBEING_CUE.test(t) && !COMPARISON_CUE.test(t) && !/\bhow are you (better|worse|at)\b/.test(t)) {
    return { act: "wellbeing", confidence: 0.9 };
  }

  if (IDENTITY_CUE.test(t) && !entity) return { act: "identity", confidence: 0.9 };
  if (IDENTITY_CUE.test(t) && entity && isSelfEntity(entity)) {
    return { act: "identity", confidence: 0.88 };
  }

  if (/\b(thanks|thank you|cheers|nice one|good job)\b/.test(t)) {
    return { act: "smalltalk", confidence: 0.7 };
  }
  if (/\b(love you|you are (great|the best|awesome|funny)|nice work|well done)\b/.test(t)) {
    return { act: "compliment", confidence: 0.84 };
  }
  if (/\bwhat can you do\b|\bhelp\b|\bcommands\b/.test(t) && t.split(" ").length <= 6) {
    return { act: "help", confidence: 0.7 };
  }

  if (isOpenChat(t)) return { act: "unsupported", confidence: 0.62 };
  return null;
}

function isSelfEntity(entity: string) {
  const e = entity.trim().toLowerCase();
  return e === "judie" || e === "you" || e === "judie assistant" || e === "the assistant";
}

function isOpenChat(t: string) {
  if (t.split(/\s+/).length < 3) return false;
  if (/\b(who|what|why|how|do you|are you|can you|tell me)\b/.test(t)) return true;
  return false;
}

function dedupe(list: MatchCandidate[]) {
  const seen = new Set<string>();
  const out: MatchCandidate[] = [];
  for (const c of list) {
    const key = `${c.name}:${c.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
