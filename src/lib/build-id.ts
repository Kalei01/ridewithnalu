declare const __NALU_BUILD_ID__: string | undefined;

/** This build's stamp; "dev" when running locally without a build. */
export const BUILD_ID: string = typeof __NALU_BUILD_ID__ === "string" ? __NALU_BUILD_ID__ : "dev";
