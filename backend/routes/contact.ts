'use strict';

import type { ExpressRequest, ExpressResponse, ExpressNextFunction } from '../types/express';

const express = require('express');
const { sendSalesLead, sendFeedback } = require('../services/emailService');
const { requireInterviewer } = require('../auth/middleware');

const router = express.Router();

const TEAM_SIZES = new Set(['1-10', '11-50', '51-200', '200+']);
const PLANS = new Set(['starter', 'pro', 'enterprise', 'unsure']);
const FEEDBACK_SUBJECTS = new Set(['General question', 'Billing & plans', 'Bug report', 'Team / campus']);
const MAX_IMAGE_BYTES = 1024 * 1024;

const IMAGE_TYPES: Record<string, { ext: string; check: (buf: Buffer) => boolean }> = {
  'image/png': { ext: 'png', check: (buf) => buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 },
  'image/jpeg': { ext: 'jpg', check: (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 },
  'image/webp': {
    ext: 'webp',
    check: (buf) => buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP',
  },
  'image/gif': { ext: 'gif', check: (buf) => buf.length > 6 && buf.toString('ascii', 0, 4) === 'GIF8' },
};

function readFeedbackImage(raw: unknown): { filename: string; contentType: string; content: Buffer } | null {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim();
  const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  if (!match) {
    const err = new Error('Use a PNG, JPEG, WebP, or GIF.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  const declared = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const spec = IMAGE_TYPES[declared];
  const content = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!spec || !spec.check(content)) {
    const err = new Error('That file is not a valid image.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  if (content.length > MAX_IMAGE_BYTES) {
    const err = new Error('Images need to be under 1 MB.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  return { filename: `feedback.${spec.ext}`, contentType: declared, content };
}

// POST /api/contact/sales
router.post('/sales', async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
  try {
    const body = (req.body as Record<string, unknown>) || {};
    const companyName = String(body?.companyName || '').trim();
    const email = String(body?.email || '').toLowerCase().trim();
    const teamSize = String(body?.teamSize || '').trim();
    const plan = String(body?.plan || 'unsure').trim().toLowerCase();
    const message = String(body?.message || '').trim();

    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid work email is required' });
    }
    if (!TEAM_SIZES.has(teamSize)) {
      return res.status(400).json({ error: 'Select a team size' });
    }
    if (!PLANS.has(plan)) {
      return res.status(400).json({ error: 'Select a plan' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message must be 2000 characters or fewer' });
    }

    const domain = email.split('@')[1] || '';

    await sendSalesLead({
      companyName,
      email,
      domain,
      teamSize,
      plan,
      message,
    });

    res.json({ ok: true, message: 'Thanks — our team will reach out shortly.' });
  } catch (e) {
    next(e);
  }
});

// POST /api/contact/feedback
router.post('/feedback', requireInterviewer, async (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
  try {
    const body = (req.body as Record<string, unknown>) || {};
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    const email = String(req.user?.email || '').toLowerCase().trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Sign in again to send feedback.' });
    }
    if (!FEEDBACK_SUBJECTS.has(subject)) {
      return res.status(400).json({ error: 'Choose a subject.' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: 'Message must be 4000 characters or fewer.' });
    }
    if (!message && !body.image) {
      return res.status(400).json({ error: 'Add a message or an image.' });
    }

    const image = readFeedbackImage(body.image);
    await sendFeedback({ email, subject, message, image: image || undefined });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
