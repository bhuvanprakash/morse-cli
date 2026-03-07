import * as server from '../entries/pages/_layout.server.ts.js';

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/pages/_layout.svelte.js')).default;
export { server };
export const server_id = "src/routes/+layout.server.ts";
export const imports = ["_app/immutable/nodes/0.sf7IFUMs.js","_app/immutable/chunks/BPnsuLqX.js","_app/immutable/chunks/BduvbBnn.js","_app/immutable/chunks/DDG0o6vg.js","_app/immutable/chunks/DycvlYHe.js","_app/immutable/chunks/DHhjxLSq.js","_app/immutable/chunks/0MudJAfO.js","_app/immutable/chunks/DHRnkkyx.js","_app/immutable/chunks/BwTKkVlh.js","_app/immutable/chunks/Dpd2Wexk.js","_app/immutable/chunks/nPCCZWbp.js","_app/immutable/chunks/DzCVv3RM.js","_app/immutable/chunks/D72F0fx6.js","_app/immutable/chunks/tGkT7eka.js"];
export const stylesheets = ["_app/immutable/assets/0.CEIVg9z9.css"];
export const fonts = [];
