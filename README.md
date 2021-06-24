# drygen

The code generator that depends on specific files is designed to implement a [Single Source of Truth](https://en.wikipedia.org/wiki/Single_source_of_truth) (SSOT).

## Overview

In some case, you may need to maintain a file content that has symbols that depend on specific files. For example, to load all component files, declare their paths in the entry point file:

```scss
@forward "components/button";
@forward "components/card";
@forward "components/disclosure";
// ...
```

However, it is a waste of time to manually change the content each time these files are added or removed.

Instead, you can automate this task by using _drygen_. First, create the following configuration file named `drygen.config.js`:

```js
module.exports = {
	rules: [
		{
			name: "components import",
			dependencies: ["components/**/*.scss"],
			outputs: [
				{
					path: "_components.scss",
					template: "import.scss.ejs",
				},
			],
		},
	],
};
```

Then create an [EJS](https://ejs.co/) template file named `import.scss.ejs` to render the file content:

```ejs
<% dependencies.forEach((dep) => { -%>
@forward "<%- join(relative(dep.dir), dep.name.replace(/^_/, "")) %>";
<% }); -%>
```

The variables are exposed in the templates:

- `dependencies`: an array of [DependencyFile](#DependencyFile). It contains a file path, contents, etc
- `relative`: returns the relative path from the output file
- `join`: a reference to POSIX specification `path.join()`

Finally, run the command:

```sh
$ drygen
```

The following file will be generated:

```scss
@forward "components/button";
@forward "components/card";
@forward "components/disclosure";
```

If you want to write the file every time the dependency files are changed, you can add the `--watch` flag:

```sh
$ drygen --watch
```

If you want to see more usage examples, please refer to the [`examples` directory](examples/).

## Installation

```sh
$ npm install --save-dev drygen
```

## Command Line Interface

```sh
$ drygen --help

Options:
      --help     Show help                                             [boolean]
      --version  Show version number                                   [boolean]
      --root     a path to project root                                 [string]
  -c, --config   a path to configuration file                           [string]
  -w, --watch    watch file changes                                    [boolean]
```

## Configuration

Before running _drygen_, you need to create a configuration file named `drygen.config.js` or `drygen.config.cjs` inside project root.

```js
module.exports = {
	rules: [
		{
			name: "components import",
			dependencies: ["components/**/*.scss"],
			outputs: [
				{
					path: "_components.scss",
					template: "import.scss.ejs",
				},
			],
		},
	],
};
```

Since _drygen_ ships with TypeScript typings, you can leverage your IDE’s IntelliSense with jsdoc type hints:

```js
/**
 * @type {import("drygen").UserConfig}
 */
module.exports = {
	rules: [
		{
			name: "components import",
			dependencies: ["components/**/*.scss"],
			outputs: [
				{
					path: "_components.scss",
					template: "import.scss.ejs",
				},
			],
		},
	],
};
```

### Options

#### `rules`

Type: `object[]`

Define an array of the rules for file generation.

#### `rules[].name`

Type: `string`

Will be output as logs in your terminal, and can be referenced from the templates.

#### `rules[].dependencies`

Type: `string[] | Record<keyof any, string[]>`

A list of glob matcher patterns. See supported [`minimatch` patterns](https://github.com/isaacs/minimatch#usage).

If you specify an array, `dependencies` variable exposed to the templates will be an array:

```js
{
	// ...
	dependencies: ["components/**/*.scss"],
}
```

```ejs
<% dependencies.forEach(dep => { -%>
@forward "<%- relative(dep.path) %>";
<% }) -%>
```

If you specify an object of arrays, `dependencies` variable exposed to the templates will be an object:

```js
{
	// ...
	dependencies: {
		objects: ["objects/**/*.scss"],
		components: ["components/**/*.scss"],
	},
}
```

```ejs
<% dependencies.objects.forEach((dep) => { -%>
@use "<%- relative(dep.path); %>";
<% }); -%>

<% dependencies.components.forEach((dep) => { -%>
@use "<%- relative(dep.path); %>";
<% }); -%>
```

#### `rules[].outputs`

Type: `({ path: string, template: string, context?: {} } | ({ name, dependencies }: { name: string, dependencies: DependencyFile[] | Record<keyof any, DependencyFile[]> }) => Promise<{ path: string, template: string, context?: {} } | { path: string, template: string, context?: {} }[]>)[]`

An array of the entries for the output file. In most cases, you would specify it as an object:

```js
{
	// ...
	outputs: [
		{
			path: "_component.scss",
			template: "import.scss.ejs",
			context: { greet: "Hi" }, // optional
		},
	],
}
```

- `path`: a path to the output file
- `template`: a path to the [EJS](https://ejs.co/) template file, see [templating section](#Templating) for details
- `context`: an optional object passed to the templates file, can be referenced by `context` variable

If the entry needs to be based on `dependencies`, you can specify a function instead:

```js
{
	// ...
	outputs: [
		({ name, dependencies }) => {
			const json = JSON.parse(dependencies[0].content);
			return {
				path: "output.scss",
				template: "output.scss.ejs",
				context: json,
			};
		},
	],
}
```

- `name`: a name of the rule
- `dependencies`: a list of [`DependencyFile`](#DependencyFile)

And it can return an array:

```js
{
	// ...
	outputs: [
		({ name, dependencies }) => {
			const json = JSON.parse(dependencies[0].content);
			return [
				{
					path: "shared.scss",
					template: "shared.scss.ejs",
					context: json,
				},
				{
					path: "shared.js",
					template: "shared.js.ejs",
					context: json,
				},
			]
		},
	],
}
```

Or it needs to call async function, you can specify a async function instead:

```js
{
	// ...
	outputs: [
		async ({ name, dependencies }) => {
			const inputJSON = JSON.parse(dependencies[0].content)
			const data = await asyncProcess(inputJSON);
			return {
				path: "output.scss",
				template: "output.scss.ejs",
				context: data,
			};
		},
	],
}
```

## Templating

_drygen_ uses [EJS](https://ejs.co/) as a template engine.

### Variables

The following variables are exposed in the templates:

| Name           | Type                                                      | Description                                                                                                                             |
| :------------- | :-------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | `string`                                                  | The value passed to [`rules[].name`](#rulesname)                                                                                        |
| `dependencies` | `DependencyFile[] \| Record<keyof any, DependencyFile[]>` | A list of [DependencyFile](#DependencyFile). The type will be based on the value passed to [`rules[].dependencies`](#rulesdependencies) |
| `context`      | `Record<keyof any, any>`                                  | The value passed to [`rules[].outputs[].context`](#rulesoutputs)                                                                        |
| `join`         | `(...paths: string[]) => string`                          | A reference to POSIX specification [`path.join()`](https://nodejs.org/api/path.html#path_path_join_paths)                               |
| `relative`     | `(to: string) => string`                                  | Returns a relative path from the output file                                                                                            |
| `replaceExt`   | `(path: string, extension: string) => string`             | Replaces the file extension with another one. The wrapper for [`replace-ext` module](https://github.com/gulpjs/replace-ext)             |

In addition, [the core functions of Change Case module](https://github.com/blakeembrey/change-case#core) and [`titleCase`](https://github.com/blakeembrey/change-case#titlecase) are also available.

### Types

#### `DependencyFile`

```ts
type DependencyFile = {
	path: string;
	dir: string;
	root: string;
	base: string;
	name: string;
	ext: string;
	content: Buffer;
	stats: fs.Stats;
};
```

- `path`: an absolute path to the file
- `dir`: `dir` property of the return value of [`path.parse()`](https://nodejs.org/api/path.html#path_path_parse_path)
- `root`: `root` property of the return value of [`path.parse()`](https://nodejs.org/api/path.html#path_path_parse_path)
- `base`: `base` property of the return value of [`path.parse()`](https://nodejs.org/api/path.html#path_path_parse_path)
- `name`: `name` property of the return value of [`path.parse()`](https://nodejs.org/api/path.html#path_path_parse_path)
- `ext`: `ext` property of the return value of [`path.parse()`](https://nodejs.org/api/path.html#path_path_parse_path)
- `content`: contents of the file
- `stats`: [`fs.Stats`](https://nodejs.org/api/fs.html#fs_class_fs_stats) object provides information about the file
