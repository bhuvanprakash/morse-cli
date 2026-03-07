export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21'),
	() => import('./nodes/22'),
	() => import('./nodes/23'),
	() => import('./nodes/24'),
	() => import('./nodes/25'),
	() => import('./nodes/26')
];

export const server_loads = [0];

export const dictionary = {
		"/(app)/ai": [3,[2]],
		"/(app)/audit": [4,[2]],
		"/(app)/auth-users": [5,[2]],
		"/(app)/billing": [6,[2]],
		"/(app)/dashboard": [7,[2]],
		"/(app)/dpdp": [8,[2]],
		"/(app)/enterprise/sso": [9,[2]],
		"/(app)/flags": [10,[2]],
		"/(auth)/login": [25],
		"/(app)/notifications": [11,[2]],
		"/(app)/onboarding": [12,[2]],
		"/(app)/queue": [13,[2]],
		"/(app)/realtime": [14,[2]],
		"/(app)/secrets": [15,[2]],
		"/(app)/security": [16,[2]],
		"/(app)/settings": [17,[2]],
		"/(auth)/signup": [26],
		"/(app)/sql-editor": [18,[2]],
		"/(app)/status": [19,[2]],
		"/(app)/storage": [20,[2]],
		"/(app)/support": [21,[2]],
		"/(app)/table-editor": [22,[2]],
		"/(app)/table-editor/[table]": [23,[2]],
		"/(app)/trust-center": [24,[2]]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';