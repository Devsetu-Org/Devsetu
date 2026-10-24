'use strict';

/**
 * Linux blog playground. Not a catalog lab: the reading page starts this id, which
 * boots a Linux box in its own namespace (lp-<user>, not the lab's lx-<user>).
 * The pod is ephemeral. Closing the playground deletes it and does not snapshot
 * the filesystem; the next open is a new machine.
 * Opening it requires a plan that covers Linux (Linux or DevOps Engineer). The
 * free Linux labs do not unlock it.
 */

const LINUX_BLOG_PLAYGROUND_ID = 'linux-blog-playground';

function isLinuxBlogPlayground(challengeId: unknown): boolean {
  return String(challengeId || '') === LINUX_BLOG_PLAYGROUND_ID;
}

module.exports = {
  LINUX_BLOG_PLAYGROUND_ID,
  isLinuxBlogPlayground,
};
