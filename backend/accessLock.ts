'use strict';

/**
 * When locked, only admins may use product APIs (labs, sessions, billing, …).
 * Public auth, waitlist join, health, and contact stay open.
 * Set ACCESS_LOCKED=0 to reopen for everyone.
 */
function isAccessLocked(): boolean {
  return process.env.ACCESS_LOCKED !== '0';
}

const ACCESS_LOCKED_MESSAGE =
  'Access is closed during the pilot waitlist. Join at /waitlist.';

module.exports = {
  isAccessLocked,
  ACCESS_LOCKED_MESSAGE,
};
