# About pages: how we make them

Every Team Remco project gets an About page at `<project>.teamremco.org/about`.
This is the guideline for writing one. It is a draft; the Charmera page is the
first test of it, and this file changes with what we learn.

## The flow

1. **Frank talks.** A voice recording, no script: how the app came to be, what
   inspired it, who it is for, anything else worth saying. Frank transcribes it
   with Spokenly and passes the text to the agent. Expect transcription slips
   (names, product terms); check odd words against the repo or ask.
2. **The agent reads the repo.** README, commit history, office notes, the app
   itself. This is where features and facts come from, never from memory.
3. **The agent builds the page around the story.** The story decides the order
   and the shape of the page, so no two About pages are laid out the same.
4. **Screenshots.** Taken from the app with a script, feature by feature (see
   below). Placeholders wherever a real example is still needed.
5. **Frank reviews.** Nothing about why the app exists, or how Frank feels about
   it, ships without Frank reading it.

## Writing from the transcript

- Keep Frank's voice. Clean up spoken filler and repetition, but do not polish
  it into marketing copy. Short quotes straight from the recording are welcome.
- Do not invent. If the story needs a fact the transcript and the repo do not
  give, leave a visible placeholder and ask.
- Facts from the repo (feature counts, limits, dates) are checked against the
  code, not the README alone.
- One screen of story, then the rest can be skimmed.

## Where it lives

In the app's own repo, served at `/about/`, built with the app so it shares its
stylesheet and fonts (Charmera: a second Vite entry, `about/index.html`).
Work on a branch; merging to main publishes it, so merge only after Frank's
review and with no placeholders left.

## Looking like the app

The About page belongs to the app. It is not a Team Remco page dropped on top.

- Reuse the app's own fonts, colors, textures, components and wording
  (Charmera: toy-plastic panels, the rainbow stripe, handwritten captions,
  "roll", "developing"). No new fonts or palettes.
- Same light/dark behavior as the app.
- Works at phone width.
- No trackers, analytics or third-party requests, and no backend.

## Screenshots and features

The layout varies; this part does not. It is what makes every About page feel
familiar.

- **Feature-focused.** Crop to the feature being described, not the whole page.
  One feature per image.
- **Taken by a script** kept in the app's repo, so they can be retaken after an
  update. Run against a local build, at 2x for sharp screens. Sizes kept small
  (WebP or optimized PNG).
- **One pattern for a feature:** screenshot, a short title, one or two sentences.
  Every image has alt text that says what it shows.
- **No personal photos.** Never pull from `~/Pictures` or other personal
  folders. Use photos Frank supplies for the page, or the app's own sample
  content.
- Until real photos are chosen, paint stand-ins from the app's own sample
  content, as Charmera does (`scripts/about-shots.mjs`, `sampleCanvas()`).
- **Placeholders** are obvious and say what is needed, e.g.
  `PLACEHOLDER: a finished 6-photo Corkboard sheet, made from Frank's photos`.
  A page with placeholders left in does not go live.

## Parts every About page has

Same wording on every page; only the project name and links change.

- A clear way back into the app ("Open Charmera").
- The project's "about · support" link pair; support goes to
  `teamremco.org/support?for=<project>`.
- The license line: "Free to use, and free to build on for your own use.
  Commercial use? Ask me." linking to the repo's LICENSE.md, with
  support@teamremco.org as the contact.
- A link to all projects (`teamremco.org/projects`) and to the source repo.
- "Made by Team Remco" and a last-updated date.
- Credits and disclaimers when they apply: third-party data or rules, fonts,
  "not affiliated with" for products the app is built around.

No standard privacy line. If privacy is part of the story (Charmera never
uploads photos), it can appear in the story or a feature, not as boilerplate.

### Keep the shared parts quiet

The story and the app are the page. The shared parts must not clutter it.

- The button back into the app is the only shared part that may sit up top or
  in the story. It can appear twice: near the top and at the end.
- Everything else goes in one compact footer: small type, muted color, a single
  row of links where it fits (about · support · all projects · source), then at
  most two short lines (license line; made by, updated, credits).
- No boxes, banners, badges or icons for shared parts. No repeated support
  appeals in the body.
- If the footer runs past about four lines on a phone, shorten the wording
  before adding anything.

## Before it goes live

- [ ] Frank has read and approved the story.
- [ ] No placeholders left; no personal photos.
- [ ] Every screenshot matches the current app.
- [ ] All the parts above are present and their links work.
- [ ] The shared parts sit in the app button and one quiet footer, nowhere else.
- [ ] Checked at phone width and desktop, light and dark.
