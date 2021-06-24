module.exports = {
	rule: {
		name: "components import",
		dependencies: ["components/**/*.scss"],
		outputs: [
			{
				path: "_components.scss",
				template: "_components.scss.ejs",
			},
		],
	},
};
