export const routes = [
	{
		path: "/bar",
		action: () => import("./bar.js"),
	},
	{
		path: "/baz",
		action: () => import("./baz.js"),
	},
	{
		path: "/foo",
		action: () => import("./foo.js"),
	},
];
