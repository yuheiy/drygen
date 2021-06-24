/**
 * @type {import("drygen").UserConfig}
 */
module.exports = {
	rules: [
		{
			name: "shared variables",
			dependencies: ["variables.json"],
			outputs: [
				({ dependencies }) => {
					const variables = JSON.parse(dependencies[0].content);
					return [
						{
							path: "_variables.scss",
							template: "_variables.scss.ejs",
							context: {
								variables,
							},
						},
						{
							path: "variables.js",
							template: "variables.js.ejs",
							context: {
								variables,
							},
						},
					];
				},
			],
		},
	],
};
