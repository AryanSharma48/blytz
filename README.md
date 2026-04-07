# Blytz : GitHub Bot / CLI Tool

Blytz is a Github Bot / CLI Tool that will auto update you Readme on every commit, as well as manual updates using the CLI Tool, by installing using npm i -g blytz.

## Description

blytz is a Node.js application. Add a brief description of its purpose and what problem it solves.

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
- express

## Folder Structure

Project structure:

```
├── .gitignore
├── LICENSE
├── README.md
├── bin
│   ├── README-NPM.md
│   └── cli.js
├── package-lock.json
├── package.json
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
    ├── readmeContext.js
    └── template.js
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Built By

Built with ❤️ by @Aryan Sharma