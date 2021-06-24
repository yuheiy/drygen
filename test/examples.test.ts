import { strict as assert } from "assert";
import execa from "execa";
import fs, { promises as fsPromises } from "fs";
import path from "path";

const examplesDir = path.join(__dirname, "../examples");

async function assertFileContent(path_: string, expectedContent: string) {
	assert.equal(await fsPromises.readFile(path_, "utf-8"), expectedContent);
}

function testExample(
	name: string,
	expectedOutputFiles: {
		path: string;
		content: string;
	}[]
) {
	const targetDir = path.join(examplesDir, name);

	describe(name, function () {
		before(async function () {
			this.timeout(30000);

			await Promise.all(
				expectedOutputFiles.map(
					async (outputFile) =>
						fs.existsSync(path.join(targetDir, outputFile.path)) &&
						fsPromises.unlink(path.join(targetDir, outputFile.path))
				)
			);
			await execa("npm", ["install", "--prefix", `./examples/${name}`]);
			await execa("npm", ["run", "build", "--prefix", `./examples/${name}`]);
		});

		expectedOutputFiles.forEach((outputFile) => {
			it(outputFile.path, async function () {
				await assertFileContent(
					path.join(targetDir, outputFile.path),
					outputFile.content
				);
			});
		});
	});
}

describe("examples", function () {
	before(async function () {
		this.timeout(30000);
		await execa("npm", ["run", "build"]);
	});

	testExample("css-concat", [
		{
			path: "main.css",
			content: `/* button.css */
.c-button {
}

.c-button__label {
}

/* card.css */
.c-card {
}

.c-card__title {
}

/* disclosure.css */
.c-disclosure {
}

.c-disclosure__head {
}

`,
		},
	]);

	testExample("scss-import", [
		{
			path: "_objects.scss",
			content: `@forward "objects/grid";
@forward "objects/stack";
@forward "objects/wrapper";
`,
		},
		{
			path: "_components.scss",
			content: `@forward "components/button";
@forward "components/card";
@forward "components/disclosure";
`,
		},
	]);

	testExample("shared-variables", [
		{
			path: "_variables.scss",
			content: `$primary: #DE6B48;
$secondary: #daedbd;
$tertiary: #7dbbc3;
`,
		},
		{
			path: "variables.js",
			content: `export const primary = "#DE6B48";
export const secondary = "#daedbd";
export const tertiary = "#7dbbc3";
`,
		},
	]);
});
