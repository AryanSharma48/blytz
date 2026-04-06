# Blytz : GitHub Bot / CLI Tool

## Description

Blytz is a Github Bot / CLI Tool that will auto update you Readme on every commit, as well as manual updates using the CLI Tool, by installing using npm i -g blytz

## Installation

Follow these steps to install the project:

```bash
npm install
```

## Usage

You can run the following scripts:

- `npm start`
- `npm run prepublishOnly`
- `npm run postpublish`

## Dependencies

This project uses the following dependencies:

- @octokit/app
- @octokit/rest
- dotenv
- express

## Folder Structure

Project structure:

```
├── .env
├── .gitignore
├── bin
│   ├── cli.js
│   └── README-NPM.md
├── LICENSE
├── package-lock.json
├── package.json
├── README.md
├── scripts
│   └── sync-readme.js
├── server
│   ├── analytics.js
│   ├── bot.js
│   ├── github.js
│   └── server.js
└── src
    ├── fileTree.js
    ├── index.js
    ├── processReadme.js
    ├── projectReader.js
    └── template.js
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Built By

Built with ❤️ by @Aryan Sharma