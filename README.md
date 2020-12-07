# drygen

The code generator that depends on the specified files.

## Install

```sh
$ npm install -D drygen
```

## Usage

```sh
$ drygen --help

  Usage
    $ drygen

  Options
    --config, -c  Specify a path to config file
    --watch, -w   Watch file changes

  Examples
    $ drygen
    $ drygen --config subdir/drygen.config.js
    $ drygen --watch
```

## Config

You can configure drygen options by creating `drygen.config.js` in the root directory of your project.

```js
module.exports = {
	rules: [
		{
			name: "sass-import",
			dependencies: {
				utility: ["src/css/utilities/*.scss"],
				component: ["src/css/components/*.scss"],
			},
			outputs: [
				{
					path: "src/css/main.scss",
					template: "src/css/main.scss.hbs",
				},
			],
		},
		{
			name: "controller-import",
			dependencies: ["src/js/controllers/*.js"],
			outputs: [
				{
					path: "src/js/controllers/index.js",
					template: "src/js/controllers/index.js.hbs",
				},
			],
		},
		{
			name: "media-query",
			dependencies: ["src/media-query.json"],
			outputs: [
				({ dependencies }) => {
					const mediaQueries = Object.entries(
						JSON.parse(dependencies[0].content)
					);
					return [
						{
							path: "src/css/_media-query.scss",
							template: "src/css/_media-query.scss.hbs",
							context: {
								mediaQueries,
							},
						},
						{
							path: "src/js/media-query.js",
							template: "src/js/media-query.js.hbs",
							context: {
								mediaQueries,
							},
						},
					];
				},
			],
		},
	],
};
```

## Template

```hbs
// Utilities
{{#each dependencies.utility}}
@use "{{relativePath this.path}}";
{{/each}}

// Components
{{#each dependencies.component}}
@use "{{relativePath this.path}}";
{{/each}}
```
