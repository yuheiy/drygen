import { loadConfig } from "./config";
import { Rule } from "./rule";

export async function drygen(
	inputOptions: {
		rootDir?: string;
		configPath?: string;
		watch?: boolean;
	} = {}
) {
	const options = {
		rootDir: inputOptions.rootDir || process.cwd(),
		configPath: inputOptions.configPath,
		watch: inputOptions.watch || false,
	};

	const config = await loadConfig(options.rootDir, options.configPath);

	const rules = config.rules.map(
		(ruleOptions) => new Rule(options.rootDir, ruleOptions)
	);

	await Promise.all(
		rules.map(async (rule) => {
			await rule.write();

			if (options.watch) {
				await rule.watch();
			}
		})
	);
}

export type { UserConfig } from "./config";
