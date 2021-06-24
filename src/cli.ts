import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { drygen } from ".";

export async function cli(argv: string[]) {
	const flags = await yargs(hideBin(argv))
		.option("root", {
			type: "string",
			describe: "a path to project root",
		})
		.option("config", {
			alias: "c",
			type: "string",
			describe: "a path to configuration file",
		})
		.option("watch", {
			alias: "w",
			type: "boolean",
			describe: "watch file changes",
		}).argv;

	await drygen({
		rootDir: flags.root,
		configPath: flags.config,
		watch: flags.watch,
	});
}
