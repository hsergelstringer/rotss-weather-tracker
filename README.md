# Raiders of the Serpent Sea: Weather Tracker

A Foundry VTT (v13–v14) module for the optional **Random Weather in Grimnir** rules (Appendix F) and the **Weather Tracker** (Appendix B).

## What it does

- Tracks the three weather columns: **Temperature** (Extreme Cold to Extreme Heat), **Wind** (No Wind to Strong) and **Snow & Rain** (Clear to Heavy). Precipitation shows as snow at Cool or colder and as rain when warmer.
- **Roll new day** rolls d20 / d12 / d10, adds the **Long Winter** bonus (half the chapter number, rounded down) while the Long Winter lasts, moves each column, and posts a chat card with the dice and effects. Dice So Nice will animate the rolls if it is installed.
- Shows the special events automatically: **Dead Calm** and **Seastorm** at sea, **Blizzard** on land, **Bright and Sunny** anywhere.
- **Predict tomorrow** (after a successful DC 15 Intelligence (Nature) check) rolls the next day now and whispers the result to the GM. The next *Roll new day* uses the forecast.
- **Ritual d4** rolls for *Ritual: Influencing the Weather*. Apply the result with the +/− buttons.
- **Frostheart** moves each column one step towards extreme cold, heavy snow and strong wind (Turnfjall).
- The +/− buttons, or a click on a step, change the weather directly. Use them for *control weather*, Way of the Wanderer and similar effects.
- Players can open the tracker read-only and see changes live.
- Optional setting: apply a matching core weather effect (rain, snow, blizzard, storm) to the active scene.

Open the tracker from the **Token controls** toolbar (cloud icon), or from a macro:

```js
game.modules.get("rotss-weather").api.open();
await game.modules.get("rotss-weather").api.rollDay();
game.modules.get("rotss-weather").api.summary(); // "Cold, Strong Wind, Light Snow"
```

## Rules interpretations

These points aren't fully spelled out in the book, so the module makes a choice:

| Question | Choice |
| --- | --- |
| The Snow & Rain table is headed d8 but its ranges run to 10 and the text says d10 | Rolls a d10 |
| "Half the chapter number" | Rounded down, added to all three dice |
| When does snow fall instead of rain? | At Cool or colder |
| Blizzard ("when the weather is cold") | On land, Cold or Extreme Cold, with heavy precipitation |
| Starting weather | Day 1 at sea: Cool, Calm Wind, Clear (from Chapter 2, "the weather is calm… more brisk than cold") |

To change one of these, edit `scripts/rules.js`, which has no Foundry code in it.

## Install

In Foundry: **Add-on Modules → Install Module**, paste this manifest URL and click **Install**:

```
https://github.com/hsergelstringer/rotss-weather-tracker/releases/latest/download/module.json
```

Then enable **Raiders of the Serpent Sea: Weather Tracker** in your world. Foundry will offer updates when new releases are published.

## Releasing

Bump `version` in `module.json`, commit, then publish a GitHub release tagged `vX.Y.Z`. The release workflow builds `module.zip` and attaches it with a matching `module.json`.
