import chalk from "chalk";
import chokidar, { FSWatcher } from "chokidar";
import { promises as fsPromises } from "fs";
import globby from "globby";
import normalizeToPosixPath from "normalize-path";
import path from "path";
import { DependencyFile, RuleOptions } from "./config";
import { DrygenError } from "./error";
import { OutputEntry } from "./output";
import { ArrayOrRecordOfArray } from "./types";

export class Rule {
	readonly name: RuleOptions["name"];
	readonly dependencyPatterns: RuleOptions["dependencies"];
	readonly outputOptions: RuleOptions["outputs"];
	#templateWatcher?: FSWatcher;
	#dependenciesWatcher?: FSWatcher;

	constructor(
		readonly rootDir: string,
		{ name, dependencies, outputs }: RuleOptions
	) {
		this.name = name;
		this.dependencyPatterns = dependencies;
		this.outputOptions = outputs;
	}

	async write(dependencyFiles?: ArrayOrRecordOfArray<DependencyFile>) {
		if (!dependencyFiles) {
			dependencyFiles = await this.#loadDependencyFiles();
		}

		await Promise.all(
			(
				await this.#buildOutputEntries(dependencyFiles)
			).map(async (outputEntry) => {
				await outputEntry.write(dependencyFiles!);
				this.#log(
					`'${path.relative(this.rootDir, outputEntry.path)}' has been written`
				);
			})
		);
	}

	async watch() {
		if (this.#isWatching) {
			throw new Error("This instance is already on watch");
		}

		const handleWatch = async (refreshTemplate: boolean = false) => {
			try {
				const dependencyFiles = await this.#loadDependencyFiles();

				if (!this.#isWatching) {
					return;
				}

				const tasks = [this.write(dependencyFiles)];

				if (refreshTemplate) {
					tasks.push(this.#refreshTemplateWatcher(dependencyFiles));
				}

				await Promise.all(tasks);
			} catch (error) {
				if (error instanceof DrygenError) {
					this.#error(error);
				} else {
					throw error;
				}
			}
		};

		const dependencyFiles = await this.#loadDependencyFiles();

		this.#templateWatcher = chokidar
			.watch(await this.#buildTemplatePaths(dependencyFiles), {
				ignoreInitial: true,
			})
			.on("add", async () => {
				await handleWatch();
			})
			.on("change", async () => {
				await handleWatch();
			})
			.on("unlink", (path_) => {
				this.#log(
					`'${path.relative(
						this.rootDir,
						path_
					)}' has been removed, you should create a template file for this path`
				);
			});

		this.#dependenciesWatcher = chokidar
			.watch(
				this.#dependencyPatternsAsArray.map((pattern) =>
					path.resolve(this.rootDir, pattern)
				),
				{
					ignoreInitial: true,
				}
			)
			.on("add", async () => {
				await handleWatch(true);
			})
			.on("change", async () => {
				await handleWatch(true);
			})
			.on("unlink", async () => {
				await handleWatch(true);
			});
	}

	async unwatch() {
		if (!this.#isWatching) {
			throw new Error("This instance is not yet on watch");
		}

		await Promise.all([
			this.#templateWatcher?.close(),
			this.#dependenciesWatcher?.close(),
		]);

		this.#templateWatcher = undefined;
		this.#dependenciesWatcher = undefined;
	}

	#log(message: string) {
		console.log("%s %s: %s", chalk.gray("[drygen]"), this.name, message);
	}

	#error(error: DrygenError) {
		console.error(chalk.red("[drygen] %s: %s"), this.name, error.message);

		if (error.cause.stack) {
			console.error(chalk.red(error.cause.stack));
		}
	}

	async #buildOutputEntries(
		dependencyFiles: ArrayOrRecordOfArray<DependencyFile>
	) {
		return (
			await Promise.all(
				this.outputOptions.map(async (outputOptions) => {
					let outputOptionsObjects;

					if (typeof outputOptions === "function") {
						try {
							outputOptionsObjects = await outputOptions({
								name: this.name,
								dependencies: dependencyFiles,
							});
						} catch (error) {
							throw new DrygenError("error in the output function", error);
						}
					} else {
						outputOptionsObjects = outputOptions;
					}

					if (!Array.isArray(outputOptionsObjects)) {
						outputOptionsObjects = [outputOptionsObjects];
					}

					return outputOptionsObjects.map(
						(outputOptionsObject) =>
							new OutputEntry(this.rootDir, this.name, outputOptionsObject)
					);
				})
			)
		).flat();
	}

	async #buildTemplatePaths(
		dependencyFiles: ArrayOrRecordOfArray<DependencyFile>
	) {
		const outputEntries = await this.#buildOutputEntries(dependencyFiles);
		return outputEntries.map(({ rootDir, templatePath }) =>
			path.resolve(rootDir, templatePath)
		);
	}

	async #loadDependencyFiles(
		dependencyPatterns: RuleOptions["dependencies"] = this.dependencyPatterns
	) {
		if (Array.isArray(dependencyPatterns)) {
			const paths = (
				await globby(
					dependencyPatterns.map((pattern) =>
						normalizeToPosixPath(path.resolve(this.rootDir, pattern))
					)
				)
			).sort();
			return Promise.all(paths.map(this.#loadDependencyFile.bind(this)));
		}

		const result: Record<keyof any, DependencyFile[]> = {};
		await Promise.all(
			Object.entries(dependencyPatterns).map(async ([key, globPatterns]) => {
				result[key] = (await this.#loadDependencyFiles(
					globPatterns
				)) as DependencyFile[];
			})
		);
		return result;
	}

	async #loadDependencyFile(path_: string) {
		const [content, stats] = await Promise.all([
			fsPromises.readFile(path.resolve(this.rootDir, path_)),
			fsPromises.stat(path.resolve(this.rootDir, path_)),
		]);
		const posixPath = normalizeToPosixPath(path_);

		return {
			path: posixPath,
			...path.posix.parse(posixPath),
			content,
			stats,
		};
	}

	get #dependencyPatternsAsArray() {
		if (Array.isArray(this.dependencyPatterns)) {
			return this.dependencyPatterns;
		}

		return Object.values(this.dependencyPatterns).flat();
	}

	get #isWatching() {
		return (
			typeof this.#templateWatcher !== "undefined" ||
			typeof this.#dependenciesWatcher !== "undefined"
		);
	}

	async #refreshTemplateWatcher(
		dependencyFiles: ArrayOrRecordOfArray<DependencyFile>
	) {
		if (!this.#isWatching || !this.#templateWatcher) {
			return;
		}

		const currentTemplatePaths = Object.entries(
			this.#templateWatcher.getWatched()
		)
			.map(([dir, paths]) => paths.map((path_) => path.join(dir, path_)))
			.flat();

		const freshTemplatePaths = await this.#buildTemplatePaths(dependencyFiles);

		const hasChanged = !(
			currentTemplatePaths.length === freshTemplatePaths.length &&
			currentTemplatePaths.every(
				(currentTemplatePath, index) =>
					currentTemplatePath === freshTemplatePaths[index]
			)
		);

		if (hasChanged) {
			this.#templateWatcher.unwatch("*");
			this.#templateWatcher.add(freshTemplatePaths);
		}
	}
}
