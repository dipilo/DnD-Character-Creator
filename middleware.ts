// Vercel reads middleware from the deployment root, and which directory that is depends on the
// project's root-directory setting. Both vercel.json files are duplicated for the same reason.
export { config, default } from './app/middleware';
