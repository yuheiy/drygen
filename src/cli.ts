#!/usr/bin/env node

import path from "path";
import meow from "meow";
import drygen from "./drygen";

const cli = meow(
	`
	Usage
	  $ drygen

	Options
	  --config, -c  Specify a path to config file
	  --watch, -w   Watch file changes

	Examples
	  $ drygen
	  $ drygen --config subdir/drygen.config.js
	  $ drygen --watch
`,
	{
		flags: {
			config: {
				type: "string",
				alias: "c",
				default: "drygen.config.js",
			},
			watch: {
				type: "boolean",
				alias: "w",
				default: false,
			},
		},
	}
);

run().catch((error) => {
	console.error(error);
	process.exit(1);
});

async function run(_input = cli.input, flags = cli.flags): Promise<void> {
	const configFilePath = path.resolve(flags.config);
	const config = await loadConfig(configFilePath);

	await drygen({
		cwd: path.dirname(configFilePath),
		rules: config.rules,
		handlebars: config.handlebars,
		watch: flags.watch,
	});
}

async function loadConfig(filePath: string) {
	const configObjectOrFunction = require(filePath);
	const config =
		typeof configObjectOrFunction === "function"
			? await configObjectOrFunction()
			: configObjectOrFunction;

	return config;
}
