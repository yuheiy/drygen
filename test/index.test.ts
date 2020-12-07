import fs from "fs";
import path from "path";
import drygen from "../src/drygen";

const fixturesDir = path.join(__dirname, "fixtures");

afterAll(async () => {
	await fs.promises.rmdir(path.join(fixturesDir, "outputs"), {
		recursive: true,
	});
});

describe("drygen", () => {
	it("basic", async () => {
		await drygen({
			cwd: fixturesDir,
			rules: [
				{
					name: "a",
					dependencies: ["dependencies/*.txt"],
					outputs: [
						{
							path: "outputs/file-list.txt",
							template: "file-list.txt.hbs",
						},
					],
				},
			],
		});

		expect(
			await fs.promises.readFile(
				path.join(fixturesDir, "outputs/file-list.txt"),
				"utf-8"
			)
		).toMatchInlineSnapshot(`
		"../dependencies/a.txt:

		aaaaaaaaaaaaaaaaaa

		../dependencies/b.txt:

		bbbbbb

		../dependencies/c.txt:

		ccccccccccccccccccccccccccccc

		"
	`);
	});

	it("unwatch", async () => {
		(
			await drygen({
				rules: [
					{
						name: "a",
						dependencies: [],
						outputs: [],
					},
				],
				watch: true,
			})
		).unwatch();
	});
});
