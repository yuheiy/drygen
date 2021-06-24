import { strict as assert } from "assert";
import { promises as fsPromises } from "fs";
import normalizeToPosixPath from "normalize-path";
import path from "path";
import { OutputEntry } from "../src/output";

const fixturesDir = path.join(__dirname, "fixtures");

async function assertFileContent(path_: string, expectedContent: string) {
	assert.equal(await fsPromises.readFile(path_, "utf-8"), expectedContent);
}

function delay(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe("class OutputEntry", function () {
	describe("write()", function () {
		let tempDir: string;

		beforeEach(async function () {
			tempDir = await fsPromises.mkdtemp(path.join(fixturesDir, "temp-"));
		});

		afterEach(async function () {
			await fsPromises.rmdir(tempDir, { recursive: true });
		});

		it("async template", async function () {
			const outputPath = path.join(tempDir, "output.txt");

			await new OutputEntry(fixturesDir, "test", {
				path: outputPath,
				template: "templates/async.ejs",
				context: {
					delay,
				},
			}).write([]);

			await assertFileContent(
				outputPath,
				`foo
bar
baz
`
			);
		});
	});

	describe("get defaultTemplateData()", function () {
		it("relative()", function () {
			const outputEntry = new OutputEntry(fixturesDir, "test", {
				path: "output.txt",
				template: "output.txt.ejs",
			});
			const { relative } = outputEntry.defaultTemplateData;
			const actual = relative(
				normalizeToPosixPath(path.join(fixturesDir, "dependencies/test.txt"))
			);
			const expected = "dependencies/test.txt";
			assert.equal(actual, expected);
		});

		it("replaceExt()", function () {
			const outputEntry = new OutputEntry(fixturesDir, "test", {
				path: "output.txt",
				template: "output.txt.ejs",
			});
			const { replaceExt } = outputEntry.defaultTemplateData;
			const actual = replaceExt(
				normalizeToPosixPath("dependencies/test.txt"),
				".html"
			);
			const expected = "dependencies/test.html";
			assert.equal(actual, expected);
		});
	});
});
