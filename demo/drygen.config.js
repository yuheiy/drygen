module.exports = {
	rules: [
		{
			name: "css-concat",
			dependencies: ["css-concat/*.css", "!css-concat/main.css"],
			outputs: [
				{
					path: "css-concat/main.css",
					template: "css-concat/main.css.hbs",
				},
			],
		},
		{
			name: "sass-import",
			dependencies: {
				utility: ["sass-import/utilities/*.scss"],
				component: ["sass-import/components/*.scss"],
			},
			outputs: [
				{
					path: "sass-import/main.scss",
					template: "sass-import/main.scss.hbs",
				},
			],
		},
		{
			name: "routes-import",
			dependencies: ["routes-import/*.js", "!routes-import/index.js"],
			outputs: [
				{
					path: "routes-import/index.js",
					template: "routes-import/index.js.hbs",
				},
			],
		},
		{
			name: "shared-media-query",
			dependencies: ["shared-media-query/data.json"],
			outputs: [
				({ dependencies }) => {
					const mediaQueries = Object.entries(
						JSON.parse(dependencies[0].content)
					);
					return [
						{
							path: "shared-media-query/media-query.scss",
							template: "shared-media-query/media-query.scss.hbs",
							context: {
								mediaQueries,
							},
						},
						{
							path: "shared-media-query/media-query.js",
							template: "shared-media-query/media-query.js.hbs",
							context: {
								mediaQueries,
							},
						},
					];
				},
				({ dependencies }) => {
					const mediaQueries = JSON.parse(dependencies[0].content);
					return Object.entries(mediaQueries).map(([key, value]) => {
						return {
							path: `shared-media-query/doc-${key}.md`,
							template: "shared-media-query/doc.md.hbs",
							context: {
								key,
								value,
							},
						};
					});
				},
			],
		},
	],
};
