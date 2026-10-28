# teamremco.org

The Team Remco homepage, served at https://teamremco.org.

## Brand

The page is built on the Team Remco brand kit (`teamremco-style`), copied into `assets/brand/`. `assets/brand/BRAND_VERSION` names the kit commit it came from; to update, copy again from the kit (see its `docs/USING.md`) and compare. `styles.css` adds only the page's own layout, using the kit's `--tr-` tokens.

The earlier weather-sky page (live New York weather and the console, `data-sky` themes) is kept at the git tag `weather-sky`.

## projects.json

The list of projects, read by the homepage console (opened with the hero button or `/`) (`ls`, `cd`, `cat`, `grep`) and, later, the Projects page. Adding a project is one entry here.

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

The private launchpad is not in this file; it lives in `app.js`.

## License

Copyright Team Remco (https://teamremco.org).

Free to use, and free to build on for your own use. You may use, copy and change this for personal, educational and other noncommercial purposes under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).

Commercial use needs permission. If you'd like to use this commercially, email [support@teamremco.org](mailto:support@teamremco.org) and we can talk.

Third-party libraries keep their own licenses.
