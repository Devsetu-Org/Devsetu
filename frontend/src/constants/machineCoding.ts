/** Machine coding — one spec, one sitting, hidden tests on the program you write. */

export const MACHINE_CODING_PATH = '/machine-coding';

export type {
  MachineCodingFile,
  MachineCodingLanguage,
  MachineCodingProblem,
} from '../fixtures/machineCodingProblems';

export {
  MACHINE_CODING_LANGUAGES,
  MACHINE_CODING_LANGUAGE_LABELS,
  MACHINE_CODING_PROBLEMS,
  getMachineCodingProblem,
  isMachineCodingLanguage,
} from '../fixtures/machineCodingProblems';
