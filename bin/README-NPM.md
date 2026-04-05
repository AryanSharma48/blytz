# blytz

`blytz` is a small Node.js CLI that creates and updates a project's `README.md` from local project metadata.

## What it does

- Updates an existing `README.md`
- Creates a new `README.md` with `--init`
- Replaces an existing `README.md` with `--force`
- Reads `package.json` to build README sections automatically
- Generates a basic folder tree for the project structure section

## Install

```bash
npm install -g blytz
```

If you are developing locally from this repository, you can link it instead:

```bash
npm link
```

## Usage

Run the CLI from the root of the project you want to document:

```bash
blytz
```

You can also use the available flags:

```bash
blytz --update
blytz --init
blytz --force
blytz --help
```

## Commands

### `blytz`

Updates the existing `README.md` in the current directory.

### `blytz --update`

Same as `blytz`. Refreshes the current `README.md` using the project metadata it finds.

### `blytz --init`

Creates a new `README.md` only if one does not already exist.

If a README already exists, the CLI stops and suggests using `--force`.

### `blytz --force`

Deletes the existing `README.md` and creates a fresh one.

### `blytz --help`

Prints the usage summary.

## Output sections

The generated README is built from these sections:

- Description
- Installation
- Usage
- Dependencies
- Folder Structure
- License
- Built By

## Project requirements

For best results, include the following in your `package.json`:

- `name`
- `description`
- `author`
- `scripts`
- `dependencies`

The more metadata the CLI can read, the better the generated README will be.

## Example

```bash
cd my-project
blytz
```

## Notes

- The CLI expects to run in a folder that contains `package.json`
- The CLI reads the local `README.md` in the current directory
- The folder tree excludes `node_modules` and `.git`

## License

MIT