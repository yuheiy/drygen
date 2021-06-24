/**
 * @type {import("drygen").UserConfig}
 */
module.exports = {
	rules: [
		{
			name: "css concat",
			dependencies: ["components/**/*.css"],
			outputs: [
				{
					path: "main.css",
					template: "main.css.ejs",
				},
			],
		},
	],
};
