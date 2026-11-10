/** Panels whose Play list interleaves readings (blogs) with labs. */

import { K8S_LABS_PATH, K8S_PRIMER_PATH } from './k8sPrimer';
import {
  getK8sReading,
  k8sReadingPath,
  listK8sTrackItems,
  type K8sReading,
  type K8sTrackItem,
} from './k8sReadings';
import {
  getLinuxReading,
  linuxReadingPath,
  listLinuxTrackItems,
  LINUX_LABS_PATH,
} from './linuxReadings';
import {
  DOCKER_LABS_PATH,
  dockerReadingPath,
  getDockerReading,
  listDockerTrackItems,
} from './dockerReadings';
import {
  DEVOPS_INTRO_PATH,
  devopsReadingPath,
  getDevopsReading,
  listDevopsIntroItems,
} from './devopsReadings';
import {
  getSparkReading,
  listSparkTrackItems,
  SPARK_PLATFORM_LABS_PATH,
  sparkReadingPath,
} from './sparkReadings';

export type ReadingTrackId = 'kubernetes' | 'linux' | 'docker' | 'devops' | 'spark';

export interface ReadingTrack {
  id: ReadingTrackId;
  label: string;
  /** Crumb parent, e.g. /track/platforms-engineer. */
  domainPath: string;
  domainLabel: string;
  labsPath: string;
  primer: { path: string; label: string } | null;
  relatedLabsIntro: string;
  getReading: (slug: string | null | undefined) => K8sReading | null;
  readingPath: (slug: string) => string;
  listTrackItems: () => K8sTrackItem[];
}

export const READING_TRACKS: Record<ReadingTrackId, ReadingTrack> = {
  kubernetes: {
    id: 'kubernetes',
    label: 'Kubernetes',
    domainPath: '/track/devops-engineer',
    domainLabel: 'DevOps Engineer',
    labsPath: K8S_LABS_PATH,
    primer: { path: K8S_PRIMER_PATH, label: 'Kubernetes primer' },
    relatedLabsIntro:
      'These ideas show up when you create a Pod on the cluster. If you are working through the Kubernetes track from the start, the lab below is a natural place to practice.',
    getReading: getK8sReading,
    readingPath: k8sReadingPath,
    listTrackItems: listK8sTrackItems,
  },
  linux: {
    id: 'linux',
    label: 'Linux',
    domainPath: '/track/devops-engineer',
    domainLabel: 'DevOps Engineer',
    labsPath: LINUX_LABS_PATH,
    primer: null,
    relatedLabsIntro:
      'Practice these ideas on your own Linux machine. The labs below come right after this reading on the track.',
    getReading: getLinuxReading,
    readingPath: linuxReadingPath,
    listTrackItems: listLinuxTrackItems,
  },
  docker: {
    id: 'docker',
    label: 'Docker',
    domainPath: '/track/devops-engineer',
    domainLabel: 'DevOps Engineer',
    labsPath: DOCKER_LABS_PATH,
    primer: null,
    relatedLabsIntro:
      'Practice these ideas on your own machine running Docker. The labs below come right after this reading on the track.',
    getReading: getDockerReading,
    readingPath: dockerReadingPath,
    listTrackItems: listDockerTrackItems,
  },
  devops: {
    id: 'devops',
    label: 'Introduction',
    domainPath: '/track/devops-engineer',
    domainLabel: 'DevOps Engineer',
    labsPath: DEVOPS_INTRO_PATH,
    primer: null,
    relatedLabsIntro: '',
    getReading: getDevopsReading,
    readingPath: devopsReadingPath,
    listTrackItems: listDevopsIntroItems,
  },
  spark: {
    id: 'spark',
    label: 'Spark',
    domainPath: '/track/platforms-engineer',
    domainLabel: 'Platforms Engineer',
    labsPath: SPARK_PLATFORM_LABS_PATH,
    primer: null,
    relatedLabsIntro:
      'The chapter labs are where you practice this on a live cluster. Read the blog first, then open the lab and do the shift yourself.',
    getReading: getSparkReading,
    readingPath: sparkReadingPath,
    listTrackItems: listSparkTrackItems,
  },
};

export function readingTrackForPanel(
  domainId: string | null | undefined,
  panelId: string | null | undefined,
): ReadingTrack | null {
  if (domainId === 'platforms-engineer' && panelId === 'spark') return READING_TRACKS.spark;
  if (domainId !== 'devops-engineer') return null;
  if (panelId === 'introduction') return READING_TRACKS.devops;
  if (panelId === 'kubernetes') return READING_TRACKS.kubernetes;
  if (panelId === 'linux') return READING_TRACKS.linux;
  if (panelId === 'docker') return READING_TRACKS.docker;
  return null;
}
