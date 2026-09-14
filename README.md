# Console - Frontend

This React-based UI dynamically loads extensions and gives the user.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

The console will be available at `http://localhost:5174`

## White-label

Logos and login copy come from the tenant **`@<tenant>/wl`** pack (aliased as `@wl`).

1. Set `VITE_WL_PACKAGE=@<tenant>/wl` in `.env.development` (and production env).
2. Keep a checkout at `dev/<tenant>-wl` (or `<tenant>-wl` next to `console/`).
   Vite picks that folder up automatically — same idea as `extensions/*/ui`.

Invite **email** copy and the logo attachment are sent by the API, not the
console. Install the same pack as Python in the API venv; see
`dev/renglo-api/README.md` (Console white-label).

## Extensions

To install extensions, look for the README.md document in each extension.

The general steps to install an extension in a dev environment are the following:

1. Get in the UI folder of the extension

```
cd extension/<extension_name>/ui
```

2. Install the extension dependencies

```
npm run install
```

NOTE: In production environments, the extension dependencies will be installed automatically.

Clone the extension into `extensions/`. Console discovers every `extensions/*/ui` pack (and npm-pinned UI packages) automatically. Restart Vite after adding a folder.

## License

This project is licensed under the MIT License. See [LICENSE.txt](LICENSE.txt) for details.
