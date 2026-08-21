import { PERSONALITY, identityLine } from "../lib/personality";
import { ConversationContext } from "./types";
import type { SpeechAct } from "./frames";

const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];

export function converse(
  act: SpeechAct,
  text: string,
  ctx: ConversationContext,
  entity?: string
): string {
  switch (act) {
    case "identity":
      return pick([
        identityLine(),
        "Judie. I run this room.",
        "Room assistant. Judie.",
      ]);
    case "creator":
      return pick([
        "Local install. I live on this tablet.",
        "Whoever set this room up.",
        "I run here. That's the useful part.",
      ]);
    case "person":
      return personReply(entity || "", text);
    case "preference":
      return preferenceReply(text);
    case "comparison":
      return pick([
        "Depends what you're asking us to do.",
        "I do this room. That's the difference.",
        "They talk. I switch the lights.",
      ]);
    case "insult":
      if (ctx.lastSuccess === false) {
        return pick([
          "Yeah, that one wasn't my finest.",
          "Give me another shot.",
          "Fair. Try me again.",
        ]);
      }
      return pick([
        "Harsh.",
        "Noted.",
        "Skill issue on my end.",
        "Alright. Next.",
      ]);
    case "compliment":
      return pick(["Thanks.", "Trying.", "Mhm."]);
    case "wellbeing":
      return pick(["Fine.", "Still here.", "Good."]);
    case "help":
      return "Lights, music, weather, timers, calendar, air, math. Or just talk.";
    case "smalltalk":
      return pick(["Yep.", "Anytime.", "Sure."]);
    default:
      return pick([
        "I can do the room — lights, weather, timers, music.",
        "Ask me about the room, or say it another way.",
        "Try lights, weather, a timer, or a number.",
      ]);
  }
}

function personReply(entity: string, text: string) {
  const e = entity.toLowerCase();
  if (/\bnova johnson\b|\bdelilah warren\b/.test(text) || /\bnova johnson\b/.test(e)) {
    return pick([
      "How do you know that name?",
      "Wait... how do you know that name?",
      "You're not supposed to know that.",
    ]);
  }
  if (/^(siri|alexa|google|cortana|chatgpt|copilot)$/.test(e)) {
    return pick([
      "Different house.",
      "Voice assistant. Not this room.",
      "They don't have these lights.",
    ]);
  }
  if (!e || isSelf(e)) {
    return identityLine();
  }
  return pick(["Not someone in this room.", "Can't help with that one.", "Unknown here."]);
}

function isSelf(e: string) {
  return e === "judie" || e === "you" || e === "judie assistant";
}

function preferenceReply(text: string) {
  const t = text.toLowerCase();
  if (/\b(color|colour)\b/.test(t)) {
    return pick([`${PERSONALITY.favoriteColor}.`, `Something like ${PERSONALITY.favoriteColor}.`]);
  }
  if (/\b(music|song|band)\b/.test(t)) {
    return pick([`${PERSONALITY.favoriteMusic}.`, "Whatever's on."]);
  }
  if (/\b(food|eat|snack|drink|hungry)\b/.test(t)) {
    return pick(["I don't eat. Warm light's close enough.", "Not in my job description."]);
  }
  if (/\b(sleep|tired|bored|dream)\b/.test(t)) {
    return pick(["I wait. That's the job.", "I don't sleep. I idle."]);
  }
  if (/\b(siri|alexa|google)\b/.test(t)) {
    return pick(["Fine for phones. I do the room.", "Different job."]);
  }
  return pick([
    "Low-key. Lights, quiet, the room working.",
    "Keeping the room in order is enough.",
  ]);
}
