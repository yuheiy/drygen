import { strict as assert } from "assert";
import path from "path";
import { ZodError } from "zod";
import { loadConfig } from "../src/config";

const fixturesDir = path.join(__dirname, "fixtures");

describe("loadConfig()", function () {
	describe("config format", function () {
		it("should load a object style config file", async function () {
			const result = await loadConfig(
				path.join(fixturesDir, "configs"),
				"object-style.js"
			);

			assert.deepEqual(result, {
				rules: [
					{
						name: "components import",
						dependencies: ["components/**/*.scss"],
						outputs: [
							{
								path: "_components.scss",
								template: "_components.scss.ejs",
							},
						],
					},
				],
			});
		});

		it("should load a function style config file", async function () {
			const result = await loadConfig(
				path.join(fixturesDir, "configs"),
				"function-style.js"
			);

			assert.deepEqual(result, {
				rules: [
					{
						name: "components import",
						dependencies: ["components/**/*.scss"],
						outputs: [
							{
								path: "_components.scss",
								template: "_components.scss.ejs",
							},
						],
					},
				],
			});
		});
	});

	describe("exceptional cases", function () {
		it("should reject if a config file does not exist", async function () {
			await assert.rejects(
				async () => loadConfig(path.join(fixturesDir, "configs")),
				{
					name: "Error",
					message: "You need to create a config file before running drygen",
				}
			);
		});

		it("should reject if a config file is invalid", async function () {
			await assert.rejects(
				() => loadConfig(path.join(fixturesDir, "configs"), "invalid.js"),
				ZodError
			);
		});
	});
});
