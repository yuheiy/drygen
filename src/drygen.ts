import fs from "fs";
import path from "path";
import {
	camelCase,
	capitalCase,
	constantCase,
	dotCase,
	headerCase,
	noCase,
	paramCase,
	pascalCase,
	pathCase,
	sentenceCase,
	snakeCase,
} from "change-case";
import chokidar from "chokidar";
import globby from "globby";
import Handlebars, { HelperDeclareSpec } from "handlebars";
import normalize from "normalize-path";

export interface Options {
	cwd?: string;
	rules: Rule[];
	handlebars?: {
		helpers?: HelperDeclareSpec;
		partials?: { [name: string]: HandlebarsTemplateDelegate };
		compileOptions?: CompileOptions;
	};
	watch?: boolean;
}

export type Rule = {
	name: string;
	dependencies: DependencyPatternList;
	outputs: OutputConfig[];
};

export type DependencyPatternList = string[] | { [key: string]: string[] };

export type DependencyFileList =
	| DependencyFile[]
	| { [key: string]: DependencyFile[] };

export type DependencyFile = {
	path: string;
	parsedPath: path.ParsedPath;
	content: Buffer;
	stats: fs.Stats;
};

export type OutputConfig =
	| OutputTemplateFormat
	| ((context: {
			name: string;
			dependencies: DependencyFileList;
	  }) => OutputFormat[] | Promise<OutputFormat[]>);

export type OutputFormat = OutputTemplateFormat | OutputContentFormat;

export type OutputTemplateFormat = {
	path: string;
	template: string;
	context?: {
		[key: string]: any;
	};
};

export type OutputContentFormat = {
	path: string;
	content: string | Buffer;
};

export default async function drygen(inputOptions: Options) {
	const options = {
		cwd: path.resolve(inputOptions.cwd || ""),
		rules: inputOptions.rules,
		handlebars: {
			...inputOptions.handlebars,
			compileOptions: {
				noEscape: true,
				...inputOptions.handlebars?.compileOptions,
			},
		},
		watch: inputOptions.watch || false,
	};

	process.chdir(options.cwd);

	const handlebars = createHandlebars(options.handlebars);

	await Promise.all(
		options.rules.map(async (rule) => {
			await writeFor(rule);
		})
	);

	const watchers: chokidar.FSWatcher[] = [];
	if (options.watch) {
		await Promise.all(
			options.rules.map(async (rule) => {
				const dependencyPatternListAsArray = Array.isArray(rule.dependencies)
					? rule.dependencies
					: Object.values(rule.dependencies).flat();
				const dependenciesWatcher = chokidar
					.watch(dependencyPatternListAsArray, { ignoreInitial: true })
					.on("add", () => {
						writeFor(rule);
						refreshTemplateFilePaths();
					})
					.on("change", () => {
						writeFor(rule);
						refreshTemplateFilePaths();
					})
					.on("unlink", () => {
						writeFor(rule);
						refreshTemplateFilePaths();
					});

				const templatesWatcher = chokidar
					.watch(await buildTemplateFilePaths(rule), { ignoreInitial: true })
					.on("add", () => {
						writeFor(rule);
					})
					.on("change", () => {
						writeFor(rule);
					})
					.on("unlink", () => {
						writeFor(rule);
					});

				watchers.push(dependenciesWatcher, templatesWatcher);

				async function refreshTemplateFilePaths() {
					await Promise.resolve(templatesWatcher.unwatch("*"));
					templatesWatcher.add(await buildTemplateFilePaths(rule));
				}
			})
		);
	}

	return {
		async unwatch() {
			if (!options.watch) {
				throw new Error("drygen is not watching");
			}

			await Promise.all(
				watchers.map(async (watcher) => {
					await watcher.close();
				})
			);
		},
	};

	async function writeFor(rule: Rule) {
		const templateErrors: {
			error: Error;
			outputFormat: OutputTemplateFormat;
		}[] = [];

		await Promise.all(
			(await buildOutputFormats(rule)).map(async (outputFormat) => {
				let content: string | Buffer;

				if ("template" in outputFormat) {
					try {
						content = await renderTemplate(rule, outputFormat);
					} catch (error) {
						templateErrors.push({
							error,
							outputFormat,
						});
						return;
					}
				} else {
					content = outputFormat.content;
				}

				await fs.promises.mkdir(path.dirname(outputFormat.path), {
					recursive: true,
				});
				await fs.promises.writeFile(outputFormat.path, content);
			})
		);

		if (templateErrors.length) {
			templateErrors.forEach(({ error, outputFormat }) => {
				console.log(`[drygen] Template errors in "${outputFormat.template}"`);
				console.error(error.message);
			});
			return;
		}

		console.log(`[drygen] Generated for "${rule.name}"`);
	}

	async function buildOutputFormats(rule: Rule) {
		return (
			await Promise.all(
				rule.outputs.map(async (output) => {
					if (typeof output === "function") {
						const outputFormat = await output({
							name: rule.name,
							dependencies: await loadDependencyFiles(rule.dependencies),
						});
						return outputFormat;
					}

					return output;
				})
			)
		).flat();
	}

	async function buildTemplateFilePaths(rule: Rule) {
		const result: string[] = [];

		(await buildOutputFormats(rule)).forEach((outputFormat) => {
			if ("template" in outputFormat) {
				result.push(outputFormat.template);
			}
		});

		return result;
	}

	async function renderTemplate(
		rule: Rule,
		outputFormat: OutputTemplateFormat
	) {
		const [templateContent, dependencyFiles] = await Promise.all([
			fs.promises.readFile(outputFormat.template, "utf-8"),
			loadDependencyFiles(rule.dependencies),
		]);

		const outputDir = path.dirname(outputFormat.path);
		handlebars.registerHelper("relativePath", (filePath: any) => {
			return normalize(path.relative(outputDir, filePath));
		});

		const result = handlebars.compile(
			templateContent,
			options.handlebars.compileOptions
		)({
			name: rule.name,
			dependencies: dependencyFiles,
			context: outputFormat.context || {},
		});

		handlebars.unregisterHelper("relativePath");

		return result;
	}

	async function loadDependencyFiles(patternList: DependencyPatternList) {
		if (Array.isArray(patternList)) {
			const filePaths = await globby(patternList, { absolute: true });
			return Promise.all(
				filePaths.map(async (filePath) => {
					return loadDependencyFile(filePath);
				})
			);
		}

		const result: DependencyFileList = {};
		await Promise.all(
			Object.entries(patternList).map(async ([key, value]) => {
				result[key] = (await loadDependencyFiles(value)) as DependencyFile[];
			})
		);
		return result;
	}

	async function loadDependencyFile(filePath: string) {
		const [content, stats] = await Promise.all([
			fs.promises.readFile(filePath),
			fs.promises.stat(filePath),
		]);
		return {
			path: filePath,
			parsedPath: path.parse(filePath),
			content,
			stats,
		};
	}
}

const defaultHandlebarsHelpers = {
	// case
	camelCase,
	capitalCase,
	constantCase,
	dotCase,
	headerCase,
	noCase,
	paramCase,
	pascalCase,
	pathCase,
	sentenceCase,
	snakeCase,

	// path
	stripExt: function stripExt(filePath: any) {
		return filePath.split(".").slice(0, -1).join(".");
	},
};

const defaultHandlebarsPartials = {};

function createHandlebars(options: {
	helpers?: HelperDeclareSpec;
	partials?: { [name: string]: HandlebarsTemplateDelegate };
}): typeof Handlebars {
	const handlebars = Handlebars.create();

	handlebars.registerHelper({
		...defaultHandlebarsHelpers,
		...options.helpers,
	});

	handlebars.registerPartial({
		...defaultHandlebarsPartials,
		...options.partials,
	});

	return handlebars;
}
