# TERRASCAN: Hosting and Judge Presentation Brief

## 1. What TERRASCAN is

TERRASCAN is a browser-based Earth-system trend detective for NASA Space Apps 2026. A user chooses a NASA variable, a place, and a time range. The app fetches real NASA POWER data, runs tested statistics in the browser, and explains the result in plain language.

The app does not claim that a trend causes an impact.

## 2. Main features to show

- **Real NASA data:** NASA POWER monthly data and NASA GIBS/Esri map imagery.
- **Interactive globe:** choose Vidarbha, one of its 11 districts, a world place, or custom coordinates.
- **Four variables:** rainfall, temperature, humidity, and sunshine from the catalogue.
- **Trend result:** Mann–Kendall significance, Sen's slope, OLS cross-check, p-value, total change, years used, and uncertainty.
- **Simple verdict first:** a short answer before the chart, with caveats available below it.
- **Four chart views:** trend line, above/below average, seasonal cycle, and probability/change.
- **Trend Scanner:** ranks which catalogue variables are changing at a place.
- **Robustness Explorer:** checks whether the conclusion holds across overlapping year windows.
- **Regional cell trends:** compares real NASA grid cells and shows opposite directions where present.
- **Provenance:** dataset, version, retrieval date, units, origin, run ID, and raw-data hash.
- **Result Assistant:** optional Google Gemini helper that can explain only the computed result JSON.
- **Simple language support:** English, Hindi, Marathi, and Bengali UI copy.
- **Offline/cached path:** a saved real NASA run can be read when the network is unavailable.

## 3. Recommended slide deck

### Slide 1 — Title

**TERRASCAN: Be an Earth System Trend Detective**

Subtitle: *Real NASA data. Tested trends. Clear answers for Vidarbha.*

Show: the Cesium globe with Vidarbha highlighted.

### Slide 2 — The problem

- Climate data is hard to read.
- A graph can show a change without showing whether it is reliable.
- People need local, understandable evidence rather than a black-box prediction.

Show: one confusing line chart beside one plain-language verdict.

### Slide 3 — Our question

**Is this place really changing, or is it just a wet, hot, or unusual year?**

Explain the user journey:

1. What variable?
2. Where?
3. Which years?
4. What does the evidence say?

### Slide 4 — The solution

Show the main Investigate screen:

- left control rail,
- large right-side map and result workspace,
- metric cards,
- verdict,
- chart and provenance.

### Slide 5 — How the science works

- NASA POWER supplies the time series.
- Missing values stay missing; there is no interpolation.
- Rainfall rates are summed into totals; other variables use the documented aggregation rule.
- Mann–Kendall tests whether a steady trend is detectable.
- Sen's slope measures the typical change.
- OLS and lag-1 autocorrelation are cross-checks.
- A non-significant result is a valid result.

Avoid saying “the app predicts the future” or “the trend caused the impact.”

### Slide 6 — A live investigation

Use one real run, preferably:

- Nagpur or Vidarbha,
- monsoon rainfall,
- a long year range.

Show:

- selected place,
- units,
- years used,
- p-value,
- Sen's slope,
- verdict,
- Cached/Live label,
- source and retrieval date.

### Slide 7 — What makes it different

- It tests significance instead of only drawing a line.
- It shows uncertainty and limitations.
- It checks robustness across year windows.
- It can compare regional NASA grid cells.
- It never hides “no significant trend.”
- It keeps data provenance visible.

### Slide 8 — AI, used safely

- Gemini is optional.
- The visitor supplies the key at runtime.
- The key stays in the browser session and is not in source code or `.env`.
- Gemini receives catalogue definitions and computed result JSON.
- Gemini is told not to invent numbers or claim causes.
- Statistics and displayed numbers come from deterministic code, not AI.

### Slide 9 — Access and inclusion

- Works in a browser on desktop and Android.
- Responsive controls and large touch targets.
- English, Hindi, Marathi, and Bengali interface copy.
- Plain-language Learn page.
- Keyboard focus and reduced-motion support.
- Cached real data helps during a weak connection.

### Slide 10 — Closing

**TERRASCAN turns NASA data into a careful local question:**

> What changed, how sure are we, and what can we honestly say?

End with the live URL and a QR code.

## 4. Free hosting: GitHub Pages (recommended)

The repository already includes `.github/workflows/pages.yml`.

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Set **Build and deployment → Source** to **GitHub Actions**.
4. Push to the `main` branch or run the workflow manually under **Actions**.
5. The workflow runs `npm ci`, builds with the repository base path, uploads `dist`, and deploys Pages.
6. Open the workflow's deployment URL and test it on an Android phone.

The Pages URL is normally:

```text
https://YOUR-GITHUB-USER.github.io/YOUR-REPOSITORY/
```

Do not change `VITE_BASE_PATH` to `/` for a project Pages site. The workflow already sets:

```text
VITE_BASE_PATH=/${{ github.event.repository.name }}/
```

## 5. Free hosting: Vercel

Vercel is useful if a clean root URL is preferred.

1. Import the GitHub repository into Vercel.
2. Framework preset: **Vite**.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Install command: `npm ci`.
6. Add `VITE_BASE_PATH=/` as a build environment variable, or leave it unset because `/` is the Vite default.
7. Deploy and open the HTTPS URL on Android.

Do **not** add the Gemini key to Vercel environment variables. The key is intentionally entered by the visitor in the assistant popup.

## 6. Android showcase checklist

- Test Chrome on a 360px, 390px, and 412px-wide viewport.
- Use HTTPS; browser geolocation and fullscreen behavior are safest on HTTPS.
- Test the globe before opening the assistant; Cesium is the largest asset.
- Test zoom in, zoom out, and fullscreen controls.
- Test the language selector and reload the page to confirm the choice persists.
- Test one live NASA request, then test the cached result with the network disabled.
- Keep the phone in portrait for controls and landscape for the globe/chart demo.
- Turn off battery saver if the globe animation is slow.
- Keep the Gemini key out of screenshots and screen recordings.
- Use the QR code to open the deployed URL, not a localhost URL.

## 7. Presenter script

“A user picks a variable, a place, and a time range. TERRASCAN gets real NASA POWER data and tests whether the pattern is more than normal year-to-year noise. The first thing shown is a simple verdict, but every number can be checked in the chart, provenance, and limitations. The optional AI helper explains the computed result; it does not create the science.”

## 8. Presentation colour palette

Use the same palette as the product. Keep slides dark, high-contrast, and spacious.

| Role | Colour | Hex |
|---|---|---|
| Deep ocean background | Background | `#061522` |
| Navy surface | Cards and panels | `#0C2236` |
| Deep secondary surface | Secondary panels | `#0A1F31` |
| Nagpur orange | Primary action and emphasis | `#FF8A1F` |
| Teal cyan | Links, map controls, positive UI accent | `#4FD1C5` |
| Main text | Headings | `#EAF2F6` |
| Muted text | Body and notes | `#B9CCD8` |
| Quiet text | Captions and axes | `#8FA8B9` |
| Rising trend | Colour-blind-safe warm mark | `#D55E00` |
| Falling trend | Colour-blind-safe blue mark | `#0072B2` |
| Uncertain result | Faded slate | `#5B7184` |

### Slide design rules

- Use `#061522` as the slide background and `#0C2236` for content cards.
- Use orange for one primary call to action, not every heading.
- Use teal for links and interactive hints.
- Use white text for headings and muted blue-grey for body copy.
- Never rely on red versus green alone; use blue/orange plus labels and arrows.
- Use large type: 36–48px slide titles, 22–30px section headings, at least 18px body text.
- Keep charts simple: one message per chart, visible units, and a short caption.

## 9. Final showcase checklist

- Replace the README live URL placeholder.
- Confirm GitHub Pages or Vercel deployment is green.
- Test the exact URL on Android mobile data.
- Prepare one real cached run and one live run.
- Add screenshots and the QR code to the deck.
- Never show a Gemini key.
- Say “trend,” not “cause.”
- Mention that the NASA POWER grid is coarse and the result is not a city-level measurement.
