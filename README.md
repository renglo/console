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

3. List the name of the extension in the console config file (.env.*)

Add the name of the extension to the comma separated string 

``` 
VITE_EXTENSIONS=schd,data,<extension_name>
```

## License

This project is licensed under the MIT License. See [LICENSE.txt](LICENSE.txt) for details.

