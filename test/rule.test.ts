import { strict as assert } from "assert";
import { promises as fsPromises } from "fs";
import path from "path";
import { DependencyFile } from "../src/config";
import { DrygenError } from "../src/error";
import { Rule } from "../src/rule";

const fixturesDir = path.join(__dirname, "fixtures");

async function assertFileContent(path_: string, expectedContent: string) {
	assert.equal(await fsPromises.readFile(path_, "utf-8"), expectedContent);
}

function delay(duration: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, duration));
}

function waitFor(
	callback: () => any,
	{
		timeout = 1000,
		interval = 50,
	}: { timeout?: number; interval?: number } = {}
) {
	return new Promise((resolve, reject) => {
		let lastError: Error;
		let promiseStatus: "idle" | "pending" | "resolved" | "rejected" = "idle";

		const timeoutId = setTimeout(handleTimeout, timeout);
		const intervalId = setInterval(checkCallback, interval);

		function onDone(error: Error | null, result: any) {
			clearTimeout(timeoutId);
			clearInterval(intervalId);

			if (error) {
				reject(error);
			} else {
				resolve(result);
			}
		}

		function checkCallback() {
			if (promiseStatus === "pending") return;
			try {
				const result = callback();
				if (typeof result?.then === "function") {
					promiseStatus = "pending";
					result.then(
						(resolvedValue: any) => {
							promiseStatus = "resolved";
							onDone(null, resolvedValue);
						},
						(rejectedValue: any) => {
							promiseStatus = "rejected";
							lastError = rejectedValue;
						}
					);
				} else {
					onDone(null, result);
				}
			} catch (error) {
				lastError = error;
			}
		}

		function handleTimeout() {
			let error: Error;
			if (lastError) {
				error = lastError;
			} else {
				error = new Error("Timed out in waitFor");
			}
			onDone(error, null);
		}
	});
}

describe("class Rule", function () {
	let tempDir: string;

	beforeEach(async function () {
		tempDir = await fsPromises.mkdtemp(path.join(fixturesDir, "temp-"));
	});

	afterEach(async function () {
		await fsPromises.rmdir(tempDir, { recursive: true });
	});

	describe("write()", function () {
		describe("options format", function () {
			it("simple dependencies", async function () {
				const outputPath = path.join(tempDir, "_components.scss");

				await new Rule(fixturesDir, {
					name: "simple dependencies",
					dependencies: ["dependencies/components/**/*.scss"],
					outputs: [
						{
							path: outputPath,
							template: "templates/import.scss.ejs",
						},
					],
				}).write();

				await assertFileContent(
					outputPath,
					`@forward "../dependencies/components/_button.scss";
@forward "../dependencies/components/_card.scss";
@forward "../dependencies/components/_disclosure.scss";
`
				);
			});

			it("structured dependencies", async function () {
				const outputPath = path.join(tempDir, "main.scss");

				await new Rule(fixturesDir, {
					name: "structured dependencies",
					dependencies: {
						objects: ["dependencies/objects/**/*.scss"],
						components: ["dependencies/components/**/*.scss"],
					},
					outputs: [
						{
							path: outputPath,
							template: "templates/main.scss.ejs",
						},
					],
				}).write();

				await assertFileContent(
					outputPath,
					`@use "../dependencies/objects/_grid.scss";
@use "../dependencies/objects/_stack.scss";
@use "../dependencies/objects/_wrapper.scss";

@use "../dependencies/components/_button.scss";
@use "../dependencies/components/_card.scss";
@use "../dependencies/components/_disclosure.scss";
`
				);
			});

			it("negative patterns for dependencies", async function () {
				const outputPath = path.join(tempDir, "file-list.txt");

				await new Rule(fixturesDir, {
					name: "negative patterns",
					dependencies: [
						"dependencies/components/**/*.scss",
						"!dependencies/components/_button.scss",
					],
					outputs: [
						{
							path: outputPath,
							template: "templates/file-list.txt.ejs",
						},
					],
				}).write();

				await assertFileContent(
					outputPath,
					`- _card.scss
- _disclosure.scss
`
				);
			});

			it("function style output", async function () {
				const outputPath = path.join(tempDir, "_components.scss");

				await new Rule(fixturesDir, {
					name: "function style output",
					dependencies: ["dependencies/components/**/*.scss"],
					outputs: [
						({ dependencies }) => {
							const total = dependencies.length;
							return {
								path: outputPath,
								template: "templates/import.scss.ejs",
								context: {
									total,
								},
							};
						},
					],
				}).write();

				await assertFileContent(
					outputPath,
					`/*
{
	"total": 3
}
*/
@forward "../dependencies/components/_button.scss";
@forward "../dependencies/components/_card.scss";
@forward "../dependencies/components/_disclosure.scss";
`
				);
			});

			it("async function style output", async function () {
				const outputPath = path.join(tempDir, "_components.scss");

				await new Rule(fixturesDir, {
					name: "async function style output",
					dependencies: ["dependencies/components/**/*.scss"],
					outputs: [
						async ({ dependencies }) => {
							await delay(100);
							const total = dependencies.length;
							return {
								path: outputPath,
								template: "templates/import.scss.ejs",
								context: {
									total,
								},
							};
						},
					],
				}).write();

				await assertFileContent(
					outputPath,
					`/*
{
	"total": 3
}
*/
@forward "../dependencies/components/_button.scss";
@forward "../dependencies/components/_card.scss";
@forward "../dependencies/components/_disclosure.scss";
`
				);
			});

			it("function style output that returns array", async function () {
				await new Rule(fixturesDir, {
					name: "function style output that returns array",
					dependencies: ["dependencies/components/**/*.scss"],
					outputs: [
						({ dependencies }) => {
							const total = dependencies.length;
							return (dependencies as DependencyFile[]).map(
								(component, index) => {
									return {
										path: path.join(
											tempDir,
											`${component.name.replace(/^_/, "")}.html`
										),
										template: "templates/component-preview.html.ejs",
										context: {
											component,
											index,
											total,
										},
									};
								}
							);
						},
					],
				}).write();

				await assertFileContent(
					path.join(tempDir, "button.html"),
					`<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width">
		<title>Button</title>
	</head>
	<body>
		<h1>Button</h1>
		<p>1 / 3</p>
	</body>
</html>
`
				);

				await assertFileContent(
					path.join(tempDir, "card.html"),
					`<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width">
		<title>Card</title>
	</head>
	<body>
		<h1>Card</h1>
		<p>2 / 3</p>
	</body>
</html>
`
				);

				await assertFileContent(
					path.join(tempDir, "disclosure.html"),
					`<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width">
		<title>Disclosure</title>
	</head>
	<body>
		<h1>Disclosure</h1>
		<p>3 / 3</p>
	</body>
</html>
`
				);
			});
		});

		describe("throw an DrygenError", function () {
			it("if the template file does not exist", async function () {
				await assert.rejects(
					() =>
						new Rule(fixturesDir, {
							name: "not exist",
							dependencies: [],
							outputs: [
								{
									path: path.join(tempDir, "output.txt"),
									template: "templates/not-exist.ejs",
								},
							],
						}).write(),
					DrygenError
				);
			});

			it("if there is a syntax error in the template file", async function () {
				await assert.rejects(
					() =>
						new Rule(fixturesDir, {
							name: "syntax error",
							dependencies: [],
							outputs: [
								{
									path: path.join(tempDir, "output.txt"),
									template: "templates/syntax-error.ejs",
								},
							],
						}).write(),
					DrygenError
				);
			});

			it("if the output function throws an Error", async function () {
				await assert.rejects(
					() =>
						new Rule(fixturesDir, {
							name: "output function error",
							dependencies: [],
							outputs: [
								() => {
									throw new Error("failed");
								},
							],
						}).write(),
					DrygenError
				);
			});
		});
	});

	describe("watch mode", function () {
		let rule: Rule;

		afterEach(async function () {
			await rule?.unwatch();
		});

		describe("handle changes", function () {
			it("should rewrite after dependencies have been changed", async function () {
				const dependencyPath = path.join(tempDir, "dependency.txt");
				const outputPath = path.join(tempDir, "file-content.txt");

				rule = new Rule(fixturesDir, {
					name: "watch dependencies",
					dependencies: [dependencyPath],
					outputs: [
						{
							path: outputPath,
							template: "templates/file-content.txt.ejs",
						},
					],
				});

				await rule.watch();

				await delay(300);

				await fsPromises.writeFile(dependencyPath, "dependency content");

				await waitFor(() =>
					assertFileContent(
						outputPath,
						`dependency.txt:

dependency content
`
					)
				);
			});

			it("should rewrite after templates have been changed", async function () {
				const outputPath = path.join(tempDir, "output.txt");
				const templatePath = path.join(tempDir, "template.ejs");

				rule = new Rule(fixturesDir, {
					name: "watch templates",
					dependencies: ["dependencies/**/*.scss"],
					outputs: [
						{
							path: outputPath,
							template: templatePath,
						},
					],
				});

				await rule.watch();

				await delay(300);

				await fsPromises.copyFile(
					path.join(fixturesDir, "templates/file-content.txt.ejs"),
					templatePath
				);

				await waitFor(() =>
					assertFileContent(
						outputPath,
						`_button.scss:

.c-button {
}

.c-button__label {
}

_card.scss:

.c-card {
}

.c-card__title {
}

_disclosure.scss:

.c-disclosure {
}

.c-disclosure__head {
}

_grid.scss:

.o-grid {
}

_stack.scss:

.o-stack {
}

_wrapper.scss:

.o-wrapper {
}

`
					)
				);

				await fsPromises.copyFile(
					path.join(fixturesDir, "templates/file-list.txt.ejs"),
					templatePath
				);

				await waitFor(() =>
					assertFileContent(
						outputPath,
						`- _button.scss
- _card.scss
- _disclosure.scss
- _grid.scss
- _stack.scss
- _wrapper.scss
`
					)
				);
			});

			it("should rewrite after template paths have been changed", async function () {
				const dependencyPath = path.join(tempDir, "dependency.json");
				const outputPath = path.join(tempDir, "output.txt");

				await fsPromises.writeFile(
					dependencyPath,
					JSON.stringify({
						template: "",
					})
				);

				await delay(300);

				rule = new Rule(fixturesDir, {
					name: "watch template paths",
					dependencies: [dependencyPath],
					outputs: [
						({ dependencies }) => {
							const json = JSON.parse((dependencies as any)[0].content);
							return {
								path: outputPath,
								template: json.template,
							};
						},
					],
				});

				await rule.watch();

				await fsPromises.writeFile(
					dependencyPath,
					JSON.stringify({
						template: path.join(fixturesDir, "templates/file-list.txt.ejs"),
					})
				);

				await waitFor(() =>
					assertFileContent(
						outputPath,
						`- dependency.json
`
					)
				);

				await fsPromises.writeFile(
					dependencyPath,
					JSON.stringify({
						template: path.join(fixturesDir, "templates/file-content.txt.ejs"),
					})
				);

				await waitFor(() =>
					assertFileContent(
						outputPath,
						`dependency.json:

${JSON.stringify({
	template: path.join(fixturesDir, "templates/file-content.txt.ejs"),
})}
`
					)
				);
			});

			it("should rewrite after the parent directory of dependencies has been removed", async function () {
				const dependencyPath = path.join(tempDir, "sub/dependency.txt");
				const dependencyDirPath = path.dirname(dependencyPath);
				const templatePath = path.join(tempDir, "file-list.txt.ejs");
				const outputPath = path.join(tempDir, "file-list.txt");

				await fsPromises.copyFile(
					path.join(fixturesDir, "templates/file-list.txt.ejs"),
					templatePath
				);

				rule = new Rule(fixturesDir, {
					name: "handle unlinkDir",
					dependencies: [dependencyPath],
					outputs: [
						{
							path: outputPath,
							template: templatePath,
						},
					],
				});

				await rule.watch();

				await fsPromises.mkdir(dependencyDirPath);
				await fsPromises.writeFile(dependencyPath, "dependency content");

				await delay(300);

				await fsPromises.rmdir(dependencyDirPath, { recursive: true });

				await waitFor(() => assertFileContent(outputPath, ``));
			});
		});

		describe("persistence", function () {
			it("should keep watching even if it gets a DrygenError", async function () {
				const dependencyPath = path.join(tempDir, "dependency.txt");
				const outputPath = path.join(tempDir, "output.txt");
				const templatePath = path.join(tempDir, "template.ejs");

				rule = new Rule(fixturesDir, {
					name: "keep watching",
					dependencies: [dependencyPath],
					outputs: [
						{
							path: outputPath,
							template: templatePath,
						},
					],
				});

				await rule.watch();

				await fsPromises.writeFile(dependencyPath, "dependency content");

				await delay(300);

				await fsPromises.writeFile(templatePath, "<%- dependencies.length %>");

				await waitFor(() => assertFileContent(outputPath, "1"));
			});
		});
	});
});
