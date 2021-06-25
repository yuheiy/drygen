module.exports = async () => {
	await delay(100);

	return {
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
	};
};

function delay(duration) {
	return new Promise((resolve) => setTimeout(resolve, duration));
}
