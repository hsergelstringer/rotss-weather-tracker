/**
 * Random Weather in Grimnir (Raiders of the Serpent Sea, Appendix F).
 * Pure rules: no Foundry API in this file.
 *
 * Every track is an index into its step list. Higher index means warmer,
 * windier or wetter.
 */

export const TEMPERATURE = [
  { key: "extremeCold", label: "Extreme Cold",
    effect: "As Cold, but the DC is 15 and cold weather gear alone is not sufficient protection." },
  { key: "cold", label: "Cold",
    effect: "DC 10 Constitution save at the end of each hour or gain 1 level of exhaustion, unless the creature has cold immunity, cold resistance or cold weather gear." },
  { key: "cool", label: "Cool",
    effect: "Getting colder, but no special precautions are needed." },
  { key: "average", label: "Average",
    effect: "The weather is comfortable." },
  { key: "warm", label: "Warm",
    effect: "The weather is pleasant." },
  { key: "hot", label: "Hot",
    effect: "Without access to water or fire resistance/immunity, DC 12 Constitution save at the end of each hour or gain 1 level of exhaustion." },
  { key: "extremeHeat", label: "Extreme Heat",
    effect: "Without fire resistance/immunity, DC 16 Constitution save at the end of each hour or gain 1 level of exhaustion." }
];

export const WIND = [
  { key: "none", label: "No Wind",
    effect: "At sea, this creates a Dead Calm." },
  { key: "calm", label: "Calm Wind",
    effect: "Noticeable but not disruptive. Ships can sail." },
  { key: "light", label: "Light Wind",
    effect: "Noticeable but not disruptive. Ships can sail." },
  { key: "strong", label: "Strong Wind",
    effect: "Ranged weapon attacks have disadvantage. Flying creatures must land at the end of their turn or fall." }
];

export const PRECIPITATION = [
  { key: "clear", label: "Clear",
    effect: "No clouds; the heroes can see far into the distance." },
  { key: "cloudy", label: "Cloudy",
    effect: "Clouds obscure the sun or moon." },
  { key: "light", label: "Light", snow: "Light Snow", rain: "Light Rain",
    effect: "Light precipitation; it does not overly impede travel. Visibility is lightly obscured." },
  { key: "heavy", label: "Heavy", snow: "Heavy Snow", rain: "Heavy Rain",
    snowEffect: "Snow accumulates. Visibility is heavily obscured and all movement is difficult terrain.",
    rainEffect: "Trails may wash away; a ship may need to cover its decks to prevent flooding. Visibility is heavily obscured." }
];

const T = Object.fromEntries(TEMPERATURE.map((s, i) => [s.key, i]));
const W = Object.fromEntries(WIND.map((s, i) => [s.key, i]));
const P = Object.fromEntries(PRECIPITATION.map((s, i) => [s.key, i]));

export const EVENTS = {
  deadCalm: {
    label: "Dead Calm", icon: "fa-solid fa-water",
    effect: "Ships that require sails cannot move."
  },
  seastorm: {
    label: "Seastorm", icon: "fa-solid fa-cloud-bolt",
    effect: "Visibility is heavily obscured and navigation checks have disadvantage unless land is in sight. Each hour at sea roll a d100: under 20, lightning strikes the ship. Every hero makes a DC 16 Dexterity save; the lowest failure takes 16 (3d10) lightning damage."
  },
  blizzard: {
    label: "Blizzard", icon: "fa-solid fa-snowflake",
    effect: "Wisdom (Survival) checks take a -10 penalty and have disadvantage. Anyone moving in a group makes a DC 12 Wisdom (Survival) check each hour or becomes separated; finding companions again takes a DC 18 Wisdom (Survival) check."
  },
  brightSunny: {
    label: "Bright and Sunny", icon: "fa-solid fa-sun",
    effect: "A rare respite from the grim. All heroes receive Heroic Inspiration."
  }
};

export const DEFAULT_STATE = {
  // "For the character's first day at sea, the weather is calm, and, with a
  // winter sun bright overhead, the temperature is more brisk than cold."
  temperature: T.cool,
  wind: W.calm,
  precipitation: P.clear,
  location: "sea",
  chapter: 1,
  longWinter: true,
  day: 1,
  forecast: null,
  history: [],
  // Temporary changes layered over the rolled weather: { id, label, changes, expires }.
  // `expires` is in game-time seconds (game.time.worldTime), or null until removed.
  adjustments: []
};

/**
 * Way of the Wanderer monk, Hands of Change (Player's Guide p. 56): an unarmed
 * strike's damage type changes the weather within 1 mile for 1 hour, and shifts
 * the monk's Path of Fate score.
 */
export const HANDS_OF_CHANGE_DURATION = 3600;
export const HANDS_OF_CHANGE = [
  { key: "warmer", damage: "Acid or Fire", label: "Warmer", changes: { temperature: 1 }, fate: -1 },
  { key: "colder", damage: "Cold or Poison", label: "Colder", changes: { temperature: -1 }, fate: 1 },
  { key: "moreSnow", damage: "Cold or Poison", label: "More snow", changes: { precipitation: 1 }, fate: 1 },
  { key: "moreRain", damage: "Lightning or Thunder", label: "More rain", changes: { precipitation: 1 }, fate: -1 },
  { key: "moreWind", damage: "Lightning or Thunder", label: "More wind", changes: { wind: 1 }, fate: -1 },
  { key: "lessPrecipitation", damage: "Radiant", label: "Less rain/snow", changes: { precipitation: -1 }, fate: 1 },
  { key: "lessWind", damage: "Radiant", label: "Less wind", changes: { wind: -1 }, fate: 1 }
];

/** Temperatures at or below this fall as snow. */
const SNOW_THRESHOLD = T.cool;

const clamp = (value, max) => Math.max(0, Math.min(max, value));

/** d20 temperature roll to warmth change. A high roll means colder. */
export function temperatureChange(total) {
  if (total <= 2) return 2;
  if (total <= 6) return 1;
  if (total <= 16) return 0;
  if (total <= 19) return -1;
  return -2;
}

/** d12 wind roll to wind change. */
export function windChange(total) {
  if (total <= 1) return -2;
  if (total <= 3) return -1;
  if (total <= 7) return 0;
  if (total <= 10) return 1;
  return 2;
}

/**
 * Snow and rain roll to precipitation change. The table is printed as a d8
 * but its ranges run 1-10 and the text says d10, so we roll a d10.
 */
export function precipitationChange(total) {
  if (total <= 1) return -2;
  if (total <= 3) return -1;
  if (total <= 5) return 0;
  if (total <= 8) return 1;
  return 2;
}

/** Added to each die while the Long Winter lasts: half the chapter number, rounded down. */
export function longWinterBonus(state) {
  return state.longWinter ? Math.floor((Number(state.chapter) || 0) / 2) : 0;
}

/** Turn raw die results into step changes. */
export function changesFromDice(dice, bonus) {
  return {
    temperature: temperatureChange(dice.d20 + bonus),
    wind: windChange(dice.d12 + bonus),
    precipitation: precipitationChange(dice.d10 + bonus)
  };
}

/** Apply step changes to a state, clamping each track. Returns a new state. */
export function applyChanges(state, changes) {
  return {
    ...state,
    temperature: clamp(state.temperature + (changes.temperature ?? 0), TEMPERATURE.length - 1),
    wind: clamp(state.wind + (changes.wind ?? 0), WIND.length - 1),
    precipitation: clamp(state.precipitation + (changes.precipitation ?? 0), PRECIPITATION.length - 1)
  };
}

/** Adjustments still in force at game time `now` (all of them when `now` is unknown). */
export function activeAdjustments(state, now) {
  return (state.adjustments ?? []).filter(a => a.expires == null || now == null || a.expires > now);
}

/**
 * The weather as it is right now: the rolled weather plus every active
 * temporary adjustment, clamped to each track.
 */
export function effectiveState(state, now) {
  const total = { temperature: 0, wind: 0, precipitation: 0 };
  for (const { changes } of activeAdjustments(state, now)) {
    for (const key of Object.keys(total)) total[key] += changes[key] ?? 0;
  }
  return applyChanges(state, total);
}

/** "Temperature -1, Wind +1" */
export function describeAdjustment(changes) {
  const names = { temperature: "Temperature", wind: "Wind", precipitation: "Snow & Rain" };
  return Object.entries(changes)
    .filter(([, steps]) => steps)
    .map(([key, steps]) => `${names[key]} ${steps > 0 ? "+" : "−"}${Math.abs(steps)}`)
    .join(", ");
}

/** One step each towards extreme cold, strong wind and heavy snow (the Frostheart on Turnfjall). */
export function frostheartChanges(state) {
  return {
    temperature: state.temperature > 0 ? -1 : 0,
    wind: state.wind < WIND.length - 1 ? 1 : 0,
    precipitation: state.precipitation < PRECIPITATION.length - 1 ? 1 : 0
  };
}

export function isSnow(state) {
  return state.temperature <= SNOW_THRESHOLD;
}

export function precipitationLabel(state, index = state.precipitation) {
  const step = PRECIPITATION[index];
  if (!step.snow) return step.label;
  return isSnow(state) ? step.snow : step.rain;
}

export function precipitationEffect(state) {
  const step = PRECIPITATION[state.precipitation];
  if (step.effect) return step.effect;
  return isSnow(state) ? step.snowEffect : step.rainEffect;
}

/** Special weather events active for a state, as keys of EVENTS. */
export function activeEvents(state) {
  const atSea = state.location === "sea";
  const events = [];
  if (atSea && state.wind === W.none) events.push("deadCalm");
  if (atSea && state.wind === W.strong && state.precipitation === P.heavy) events.push("seastorm");
  if (!atSea && state.temperature <= T.cold && state.precipitation === P.heavy) events.push("blizzard");
  if (state.precipitation === P.clear && state.temperature >= T.average) events.push("brightSunny");
  return events;
}

/** A short one-line summary, e.g. "Cold, Strong Wind, Heavy Snow (Blizzard)". */
export function summary(state) {
  const parts = [
    TEMPERATURE[state.temperature].label,
    WIND[state.wind].label,
    precipitationLabel(state)
  ];
  const events = activeEvents(state).map(key => EVENTS[key].label);
  return parts.join(", ") + (events.length ? ` (${events.join(", ")})` : "");
}

/** Core Foundry scene weather effect that best matches the state, or "" for none. */
export function sceneWeather(state) {
  const snow = isSnow(state);
  if (state.precipitation === P.heavy) return snow ? "blizzard" : "rainStorm";
  if (state.precipitation === P.light) return snow ? "snow" : "rain";
  return "";
}
