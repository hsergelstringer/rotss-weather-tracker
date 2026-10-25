import * as Rules from "./rules.js";

const MODULE_ID = "rotss-weather";
const TEMPLATE = `modules/${MODULE_ID}/templates/tracker.hbs`;
const HISTORY_LENGTH = 30;

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* -------------------------------------------- */
/*  State                                       */
/* -------------------------------------------- */

function getState() {
  return foundry.utils.mergeObject(foundry.utils.deepClone(Rules.DEFAULT_STATE),
    game.settings.get(MODULE_ID, "state") ?? {}, { inplace: false });
}

async function setState(state) {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can change the weather.");
    return;
  }
  await game.settings.set(MODULE_ID, "state", state);
  if (game.settings.get(MODULE_ID, "sceneWeather")) await applySceneWeather(state);
}

async function applySceneWeather(state) {
  const scene = game.scenes.active;
  if (!scene) return;
  const effect = Rules.sceneWeather(state);
  if (effect && !(effect in (CONFIG.weatherEffects ?? {}))) return;
  if (scene.weather !== effect) await scene.update({ weather: effect });
}

/* -------------------------------------------- */
/*  Dice                                        */
/* -------------------------------------------- */

async function rollWeatherDice() {
  const [d20, d12, d10] = await Promise.all(
    ["1d20", "1d12", "1d10"].map(formula => new Roll(formula).evaluate())
  );
  return { rolls: [d20, d12, d10], dice: { d20: d20.total, d12: d12.total, d10: d10.total } };
}

function describeChange(steps, up, down) {
  if (steps === 0) return "stays the same";
  const word = steps > 0 ? up : down;
  return Math.abs(steps) === 2 ? `${word} by 2 steps` : word;
}

function describeChanges(changes) {
  return {
    temperature: describeChange(changes.temperature, "warmer", "cooler"),
    wind: describeChange(changes.wind, "increases", "decreases"),
    precipitation: describeChange(changes.precipitation, "increases", "decreases")
  };
}

/* -------------------------------------------- */
/*  Chat                                        */
/* -------------------------------------------- */

function weatherCardHTML(state, { title, dice, bonus, changes } = {}) {
  const events = Rules.activeEvents(state).map(key => Rules.EVENTS[key]);
  const described = changes ? describeChanges(changes) : null;
  const dieText = (die, value) => {
    if (!dice) return "";
    const mod = bonus ? ` + ${bonus}` : "";
    return `<span class="dice">${die}: ${value}${mod}</span>`;
  };
  const row = (label, value, effect, die, roll, change) => `
    <li>
      <strong>${label}:</strong> ${value}${change ? ` <em>(${change})</em>` : ""} ${dieText(die, roll)}
      <div class="effect">${effect}</div>
    </li>`;

  return `
    <div class="rotss-weather-card">
      <h3>${title}</h3>
      <ul>
        ${row("Temperature", Rules.TEMPERATURE[state.temperature].label, Rules.TEMPERATURE[state.temperature].effect,
          "d20", dice?.d20, described?.temperature)}
        ${row("Wind", Rules.WIND[state.wind].label, Rules.WIND[state.wind].effect,
          "d12", dice?.d12, described?.wind)}
        ${row("Snow & Rain", Rules.precipitationLabel(state), Rules.precipitationEffect(state),
          "d10", dice?.d10, described?.precipitation)}
      </ul>
      ${events.map(e => `
        <div class="event"><i class="${e.icon}"></i> <strong>${e.label}.</strong> ${e.effect}</div>`).join("")}
    </div>`;
}

function gmIds() {
  return game.users.filter(u => u.isGM).map(u => u.id);
}

/* -------------------------------------------- */
/*  Actions                                     */
/* -------------------------------------------- */

const Weather = {
  getState,

  summary() {
    return Rules.summary(getState());
  },

  /** Roll the weather for the start of a new day (or apply the stored forecast). */
  async rollDay() {
    const state = getState();
    let dice, bonus, changes, rolls = [];
    if (state.forecast) {
      ({ dice, bonus, changes } = state.forecast);
    } else {
      ({ dice, rolls } = await rollWeatherDice());
      bonus = Rules.longWinterBonus(state);
      changes = Rules.changesFromDice(dice, bonus);
    }

    const next = Rules.applyChanges(state, changes);
    next.day = state.day + 1;
    next.forecast = null;
    next.history = [{ day: next.day, summary: Rules.summary(next), dice, bonus, forecast: !!state.forecast },
      ...state.history].slice(0, HISTORY_LENGTH);
    await setState(next);

    const title = `Day ${next.day}: ${state.forecast ? "the forecast holds" : "the weather turns"}`;
    await ChatMessage.create({
      speaker: { alias: "Grimnir Weather" },
      content: weatherCardHTML(next, { title, dice, bonus, changes }),
      rolls
    });
    return next;
  },

  /**
   * Predicting the Weather: after a successful DC 15 Intelligence (Nature)
   * check, roll tomorrow's weather now. The result is used by the next rollDay.
   */
  async predict() {
    const state = getState();
    const { dice, rolls } = await rollWeatherDice();
    const bonus = Rules.longWinterBonus(state);
    const changes = Rules.changesFromDice(dice, bonus);
    const projected = Rules.applyChanges(state, changes);
    await setState({ ...state, forecast: { dice, bonus, changes, summary: Rules.summary(projected) } });
    await ChatMessage.create({
      speaker: { alias: "Grimnir Weather" },
      content: weatherCardHTML(projected, { title: `Forecast for day ${state.day + 1}`, dice, bonus, changes }),
      whisper: gmIds(),
      rolls
    });
  },

  async clearForecast() {
    await setState({ ...getState(), forecast: null });
  },

  /** Move one track by a number of steps (control weather, rituals, Way of the Wanderer...). */
  async adjust(track, steps) {
    const state = getState();
    await setState(Rules.applyChanges(state, { [track]: steps }));
  },

  /** The Frostheart on Turnfjall: one step towards extreme cold, heavy snow and strong wind. */
  async frostheart() {
    const state = getState();
    await setState(Rules.applyChanges(state, Rules.frostheartChanges(state)));
  },

  /** Ritual: Influencing the Weather. The winner rolls a d4 and adds or subtracts it per track. */
  async ritual() {
    const roll = await new Roll("1d4").evaluate();
    await roll.toMessage({
      speaker: { alias: "Grimnir Weather" },
      flavor: "Ritual: Influencing the Weather. The winner may raise or lower Temperature, Wind and Snow & Rain by this many steps each."
    });
    return roll.total;
  },

  async announce() {
    const state = getState();
    await ChatMessage.create({
      speaker: { alias: "Grimnir Weather" },
      content: weatherCardHTML(state, { title: `Day ${state.day}: current weather` })
    });
  },

  async update(changes) {
    await setState({ ...getState(), ...changes });
  },

  async reset() {
    await setState(foundry.utils.deepClone(Rules.DEFAULT_STATE));
  },

  open() {
    WeatherTracker.instance.render({ force: true });
  }
};

/* -------------------------------------------- */
/*  Tracker window                              */
/* -------------------------------------------- */

class WeatherTracker extends HandlebarsApplicationMixin(ApplicationV2) {
  static #instance;

  static get instance() {
    this.#instance ??= new WeatherTracker();
    return this.#instance;
  }

  static DEFAULT_OPTIONS = {
    id: "rotss-weather-tracker",
    classes: ["rotss-weather"],
    window: { title: "Grimnir Weather", icon: "fa-solid fa-cloud-showers-heavy", resizable: true },
    position: { width: 600, height: "auto" },
    actions: {
      rollDay: () => Weather.rollDay(),
      predict: () => Weather.predict(),
      clearForecast: () => Weather.clearForecast(),
      frostheart: () => Weather.frostheart(),
      ritual: () => Weather.ritual(),
      announce: () => Weather.announce(),
      reset: WeatherTracker.#onReset,
      step: WeatherTracker.#onStep,
      setStep: WeatherTracker.#onSetStep
    }
  };

  static PARTS = {
    main: { template: TEMPLATE }
  };

  async _prepareContext() {
    const state = getState();
    const isGM = game.user.isGM;
    const track = (key, steps, current, labelFor) => ({
      key,
      // Displayed like the printed tracker: the harshest step at the top.
      steps: steps.map((step, index) => ({ index, label: labelFor(index), active: index === current })),
      current
    });
    const temperature = track("temperature", Rules.TEMPERATURE, state.temperature, i => Rules.TEMPERATURE[i].label);
    const wind = track("wind", Rules.WIND, state.wind, i => Rules.WIND[i].label);
    const precipitation = track("precipitation", Rules.PRECIPITATION, state.precipitation,
      i => Rules.precipitationLabel(state, i));
    wind.steps.reverse();
    precipitation.steps.reverse();
    temperature.title = "Temperature";
    wind.title = "Wind";
    precipitation.title = "Snow & Rain";

    return {
      isGM,
      state,
      tracks: [temperature, wind, precipitation],
      effects: [
        { label: Rules.TEMPERATURE[state.temperature].label, text: Rules.TEMPERATURE[state.temperature].effect },
        { label: Rules.WIND[state.wind].label, text: Rules.WIND[state.wind].effect },
        { label: Rules.precipitationLabel(state), text: Rules.precipitationEffect(state) }
      ],
      events: Rules.activeEvents(state).map(key => Rules.EVENTS[key]),
      bonus: Rules.longWinterBonus(state),
      atSea: state.location === "sea",
      forecast: state.forecast ? { ...state.forecast, described: describeChanges(state.forecast.changes) } : null,
      history: state.history.slice(0, 7)
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    if (!game.user.isGM) return;
    const html = this.element;
    html.querySelector("[name=location]")?.addEventListener("change", ev => Weather.update({ location: ev.target.value }));
    html.querySelector("[name=chapter]")?.addEventListener("change", ev =>
      Weather.update({ chapter: Math.max(1, Number(ev.target.value) || 1) }));
    html.querySelector("[name=longWinter]")?.addEventListener("change", ev => Weather.update({ longWinter: ev.target.checked }));
    html.querySelector("[name=day]")?.addEventListener("change", ev =>
      Weather.update({ day: Math.max(1, Number(ev.target.value) || 1) }));
  }

  static #onStep(event, target) {
    Weather.adjust(target.dataset.track, Number(target.dataset.steps));
  }

  static #onSetStep(event, target) {
    if (!game.user.isGM) return;
    const { track, index } = target.dataset;
    Weather.update({ [track]: Number(index) });
  }

  static async #onReset() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Reset weather" },
      content: "<p>Reset the weather to the first day at sea and clear the history?</p>"
    });
    if (confirmed) await Weather.reset();
  }
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "state", {
    scope: "world",
    config: false,
    type: Object,
    default: foundry.utils.deepClone(Rules.DEFAULT_STATE),
    onChange: () => {
      const app = WeatherTracker.instance;
      if (app.rendered) app.render();
    }
  });

  game.settings.register(MODULE_ID, "sceneWeather", {
    name: "Show weather on the active scene",
    hint: "Sets the active scene's weather effect (rain, snow, blizzard, storm) whenever the weather changes.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.modules.get(MODULE_ID).api = Weather;
});

Hooks.on("getSceneControlButtons", controls => {
  const tokens = controls.tokens;
  if (!tokens) return;
  tokens.tools.rotssWeather = {
    name: "rotssWeather",
    title: "Grimnir Weather",
    icon: "fa-solid fa-cloud-showers-heavy",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => Weather.open()
  };
});
