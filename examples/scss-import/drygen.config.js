/**
 * @type {import("drygen").UserConfig}
 */
module.exports = {
	rules: [
		{
			name: "objects import",
			dependencies: ["objects/**/*.scss"],
			outputs: [
				{
					path: "_objects.scss",
					template: "import.scss.ejs",
				},
			],
		},
		{
			name: "components import",
			dependencies: ["components/**/*.scss"],
			outputs: [
				{
					path: "_components.scss",
					template: "import.scss.ejs",
				},
			],
		},
	],
};
