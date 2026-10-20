/** True in the offline (Android) build: games run on the device, with no server and no login. */
export const STANDALONE: boolean = import.meta.env.VITE_STANDALONE === 'true';
