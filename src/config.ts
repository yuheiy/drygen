import { cosmiconfig } from "cosmiconfig";
import { Stats } from "fs";
import path from "path";
import { z } from "zod";
const pkg = require("../package.json");

const globPatternsScheme = z.array(z.string());

const dependencyFileScheme = z.object({
	path: z.string(),
	dir: z.string(),
	root: z.string(),
	base: z.string(),
	name: z.string(),
	ext: z.string(),
	content: z.instanceof(Buffer),
	stats: z.instanceof(Stats),
});

export type DependencyFile = z.infer<typeof dependencyFileScheme>;

const outputOptionsObjectScheme = z.object({
	path: z.string(),
	template: z.string(),
	context: z.optional(z.record(z.any())),
});

export type OutputOptionsObject = z.infer<typeof outputOptionsObjectScheme>;

const ruleScheme = z.object({
	name: z.string(),
	dependencies: z.union([globPatternsScheme, z.record(globPatternsScheme)]),
	outputs: z
		.array(
			z.union([
				outputOptionsObjectScheme,
				z
					.function()
					.args(
						z.object({
							name: z.string(),
							dependencies: z.union([
								z.array(dependencyFileScheme),
								z.record(z.array(dependencyFileScheme)),
							]),
						})
					)
					.returns(
						z.union([
							z.union([
								outputOptionsObjectScheme,
								z.array(outputOptionsObjectScheme),
							]),
							z.promise(
								z.union([
									outputOptionsObjectScheme,
									z.array(outputOptionsObjectScheme),
								])
							),
						])
					),
			])
		)
		.min(1),
});

export type RuleOptions = z.infer<typeof ruleScheme>;

const configSchema = z
	.object({
		rules: z.array(ruleScheme).min(1),
	})
	.strict();

export type UserConfig = z.infer<typeof configSchema>;

export async function loadConfig(rootDir: string, configPath?: string) {
	const explorer = cosmiconfig(pkg.name, {
		searchPlaces: [`${pkg.name}.config.js`, `${pkg.name}.config.cjs`],

		transform: async (result) => {
			if (result === null) {
				throw new Error(
					"You need to create a config file before running drygen"
				);
			}

			return typeof result.config === "function"
				? await result.config()
				: result.config;
		},
	});

	const result = configPath
		? await explorer.load(path.resolve(rootDir, configPath))
		: await explorer.search(rootDir);

	return validateConfig(result);
}

function validateConfig(config: unknown) {
	return configSchema.parse(config);
}
