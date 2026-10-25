import * as Rules from "./rules.js";

/**
 * A read-only weather bar at the top of the canvas, for everyone. Click it to
 * show the effects; the book icon opens the full tracker.
 */

const ELEMENT_ID = "rotss-weather-hud";
const esc = text => Handlebars.escapeExpression(String(text ?? ""));

const ICONS = {
  temperature: ["fa-temperature-empty", "fa-temperature-empty", "fa-temperature-quarter", "fa-temperature-half",
    "fa-temperature-half", "fa-temperature-three-quarters", "fa-temperature-full"],
  wind: ["fa-ban", "fa-wind", "fa-wind", "fa-tornado"],
  precipitation: ["fa-sun", "fa-cloud", null, null]
};

function precipitationIcon(weather) {
  if (weather.precipitation < 2) return ICONS.precipitation[weather.precipitation];
  if (Rules.isSnow(weather)) return "fa-snowflake";
  return weather.precipitation === 3 ? "fa-cloud-showers-heavy" : "fa-cloud-rain";
}

function item(icon, label, effect, extraClass = "") {
  return `<span class="hud-item ${extraClass}" data-tooltip="${esc(effect)}"><i class="fa-solid ${icon}"></i> ${esc(label)}</span>`;
}

/**
 * Draw or update the bar.
 * @param {object} state        Stored tracker state
 * @param {object} options
 * @param {boolean} options.visible   Whether this client should see it at all
 * @param {boolean} options.expanded  Show effect text below the bar
 * @param {Function} options.onToggle Called when the bar is clicked
 * @param {Function} options.onOpen   Called when the tracker button is clicked
 */
export function renderHud(state, { visible, expanded, onToggle, onOpen }) {
  let hud = document.getElementById(ELEMENT_ID);
  if (!visible) {
    hud?.remove();
    return;
  }
  if (!hud) {
    hud = document.createElement("aside");
    hud.id = ELEMENT_ID;
    hud.addEventListener("click", event => {
      if (event.target.closest("[data-hud-open]")) onOpen();
      else onToggle();
    });
    (document.getElementById("interface") ?? document.body).append(hud);
  }

  const now = game.time.worldTime;
  const weather = Rules.effectiveState(state, now);
  const adjustments = Rules.activeAdjustments(state, now);
  const events = Rules.activeEvents(weather).map(key => Rules.EVENTS[key]);
  const temperature = Rules.TEMPERATURE[weather.temperature];
  const wind = Rules.WIND[weather.wind];

  const adjustmentTip = adjustments
    .map(a => `${a.label}: ${Rules.describeAdjustment(a.changes)}${a.expires == null ? "" : ` (${Rules.formatDuration(a.expires - now)} left)`}`)
    .join(" · ");

  hud.classList.toggle("expanded", expanded);
  hud.innerHTML = `
    <div class="hud-bar" role="button" aria-expanded="${expanded}" aria-label="Weather">
      <span class="hud-day">Day ${esc(state.day)}</span>
      ${item(ICONS.temperature[weather.temperature], temperature.label, temperature.effect)}
      ${item(ICONS.wind[weather.wind], wind.label, wind.effect)}
      ${item(precipitationIcon(weather), Rules.precipitationLabel(weather), Rules.precipitationEffect(weather))}
      ${events.map(e => item(e.icon.replace("fa-solid ", ""), e.label, e.effect, "hud-event")).join("")}
      ${adjustments.length ? `<span class="hud-item hud-adjusted" data-tooltip="${esc(adjustmentTip)}"><i class="fa-solid fa-hourglass-half"></i></span>` : ""}
      <button type="button" class="hud-open" data-hud-open data-tooltip="Open weather tracker"><i class="fa-solid fa-book-open"></i></button>
    </div>
    ${expanded ? `
    <div class="hud-details">
      ${events.map(e => `<p class="hud-event"><strong>${esc(e.label)}.</strong> ${esc(e.effect)}</p>`).join("")}
      <p><strong>${esc(temperature.label)}.</strong> ${esc(temperature.effect)}</p>
      <p><strong>${esc(wind.label)}.</strong> ${esc(wind.effect)}</p>
      <p><strong>${esc(Rules.precipitationLabel(weather))}.</strong> ${esc(Rules.precipitationEffect(weather))}</p>
      ${adjustments.map(a => `<p class="hud-adjusted"><i class="fa-solid fa-hourglass-half"></i> ${esc(a.label)}: ${esc(Rules.describeAdjustment(a.changes))}${a.expires == null ? "" : `, ${esc(Rules.formatDuration(a.expires - now))} left`}</p>`).join("")}
    </div>` : ""}`;
}
