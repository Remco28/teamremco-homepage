# teamremco.org

The Team Remco homepage, served at https://teamremco.org.

## projects.json

The list of projects, read by the homepage console (`ls`, `cd`, `cat`, `grep`) and by the Projects page. Adding a project is one entry here.

| Field | What it is |
| --- | --- |
| `id` | Short name used by the console, e.g. `cd charmera` |
| `title` | The project's own name, as its page shows it |
| `url` | Where the app lives |
| `blurb` | One line, shown by `ls -l` |
| `about` | A few sentences, shown by `cat` and searched by `grep` |
| `tags` | Words `grep` also matches |
| `aboutUrl` | The project's About page, or `null` until it has one |
| `support` | Whether to show a support link (pay what you want); `false` until decided |
| `repo` | The source code |
| `spark` | One line in Frank's voice, shown when a spark lands on the project on the Projects page |
| `desktop` | For a desktop app, the systems it runs on (e.g. `"Linux"`); its link then reads "get it" |
| `listed` | Optional; `false` keeps a project off the Projects page (the console still has it) |

On the Projects page, a project links to its `aboutUrl` when it has one, and to `url` otherwise.

The private launchpad is not in this file; it lives in `app.js`.

## Projects page

`projects/` is the Projects page at https://teamremco.org/projects/: a line drawing of a brain where a spark travels along the folds and lands on one project at a time, with the plain list underneath. `sparks.js` reads `/projects.json` and `brain.json`.

`brain.json` is traced from `tools/brain/brain-source.png`, a generated line drawing (white single-stroke lines on black). To trace a new drawing:

```bash
cd tools/brain
uv run --with numpy --with scikit-image --with pillow python trace.py brain-source.png a   # a.json + a-overlay.png to check the trace
python3 process.py                                                                          # smooths, crops, simplifies → brain.json
cp brain.json ../../projects/brain.json
```

The page is `noindex` until it is linked from the homepage.

## License

Copyright Team Remco (https://teamremco.org).

Free to use, and free to build on for your own use. You may use, copy and change this for personal, educational and other noncommercial purposes under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

Commercial use needs permission. If you'd like to use this commercially, email [support@teamremco.org](mailto:support@teamremco.org) and we can talk.

Third-party libraries keep their own licenses.
