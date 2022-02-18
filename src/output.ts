import * as changeCase from "change-case";
import ejs from "ejs";
import { promises as fsPromises } from "fs";
import normalizePath from "normalize-path";
import path from "path";
import replaceExt from "replace-ext";
import { titleCase } from "title-case";
import { DependencyFile, OutputOptionsObject } from "./config";
import { DrygenError } from "./error";
import { ArrayOrRecordOfArray } from "./types";

export class OutputEntry {
	readonly path: string;
	readonly templatePath: string;
	readonly context: Record<keyof any, any>;

	constructor(
		readonly rootDir: string,
		readonly ruleName: string,
		{ path, template, context }: OutputOptionsObject
	) {
		this.rootDir = rootDir;
		this.ruleName = ruleName;
		this.path = path;
		this.templatePath = template;
		this.context = typeof context !== "undefined" ? context : {};
	}

	async write(dependencyFiles: ArrayOrRecordOfArray<DependencyFile>) {
		const content = await this.#render(dependencyFiles);
		await fsPromises.mkdir(this.dirname, {
			recursive: true,
		});
		await fsPromises.writeFile(this.absolutePath, content);
	}

	async #render(dependencyFiles: ArrayOrRecordOfArray<DependencyFile>) {
		let templateContent;

		try {
			templateContent = await fsPromises.readFile(
				path.resolve(this.rootDir, this.templatePath),
				"utf-8"
			);
		} catch (error) {
			throw new DrygenError(
				`'${normalizePath(
					path.relative(this.rootDir, this.templatePath)
				)}' does not exist`,
				error
			);
		}

		let result;

		try {
			result = await ejs.render(
				templateContent,
				{
					...this.defaultTemplateData,
					dependencies: dependencyFiles,
				},
				{
					async: true,
				}
			);
		} catch (error) {
			throw new DrygenError(
				`template error in '${normalizePath(
					path.relative(this.rootDir, this.templatePath)
				)}'`,
				error
			);
		}

		return result;
	}

	get defaultTemplateData() {
		return {
			name: this.ruleName,
			context: this.context,
			join: path.posix.join,
			relative: (to: string) =>
				path.posix.relative(normalizePath(this.dirname), to),
			replaceExt: (npath: string, ext: string) =>
				normalizePath(replaceExt(npath, ext)),
			...changeCase,
			titleCase,
		};
	}

	get absolutePath() {
		return path.resolve(this.rootDir, this.path);
	}

	get dirname() {
		return path.dirname(this.absolutePath);
	}
}
