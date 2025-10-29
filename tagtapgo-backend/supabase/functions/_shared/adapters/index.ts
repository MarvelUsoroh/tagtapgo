/**
 * SIS/LMS Adapters - Public API
 * 
 * Exports all adapter types, factory, and registry for use in sync jobs.
 */

// Types and interfaces
export type {
  IAdapter,
  AdapterConfig,
  MoodleConfig,
  OpenSISConfig,
  GenericConfig,
  AnyAdapterConfig,
} from './adapter-interface.ts';

export {
  BaseAdapter,
  AdapterError,
  DiscoveryError,
  FetchError,
  NormalizationError,
  AuthenticationError,
} from './adapter-interface.ts';

// Adapter implementations
export { MoodleAdapter } from './moodle-adapter.ts';
export { OpenSISAdapter } from './opensis-adapter.ts';
export { GenericAdapter } from './generic-adapter.ts';

// Factory and registry
export {
  AdapterFactory,
  AdapterRegistry,
  globalAdapterRegistry,
} from './adapter-factory.ts';
export type { AdapterHealth } from './adapter-factory.ts';

// Canonical schema types
export type {
  CanonicalSchema,
  CanonicalCourse,
  CanonicalStudent,
  CanonicalAttendance,
  CanonicalSchedule,
  CanonicalMeta,
  AdapterCapabilities,
} from '../types/canonical-schema.ts';

export {
  normalizeAttendanceStatus,
  generateAttendanceId,
  generateScheduleId,
  validateCanonicalSchema,
  ATTENDANCE_STATUS_MAP,
} from '../types/canonical-schema.ts';
