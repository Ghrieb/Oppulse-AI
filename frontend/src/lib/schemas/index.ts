/**
 * The Oppulse AI API contract.
 *
 * Every request and response in the application is described here. The HTTP
 * client validates responses against these schemas, so a mismatch between
 * the frontend and the backend fails loudly at the boundary rather than
 * rendering `undefined` deep inside the UI.
 *
 * Phase B mirrors these shapes in FastAPI/Pydantic and adds a CI check that
 * compares the generated OpenAPI document against `z.toJSONSchema()`.
 */

export * from './common';
export * from './profile';
export * from './missions';
export * from './opportunities';
export * from './applications';
export * from './monitoring';
export * from './assistant';
export * from './auth';
export * from './onboarding';
export * from './resources';
export * from './actions';
