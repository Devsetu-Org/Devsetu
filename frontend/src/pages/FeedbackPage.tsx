import React, { useRef, useState } from 'react';
import axios from 'axios';
import { useAppState } from '../context/AppStateContext';
import { getAuthHeader } from '../services/authApi';

export const FEEDBACK_SIGN_IN = {
  title: 'Sign in to provide feedback',
  body: 'For worthy feedback, we come back to you with tokens.',
};

const SUBJECTS = ['General question', 'Billing & plans', 'Bug report', 'Team / campus'] as const;
const MAX_IMAGE_BYTES = 1024 * 1024;

interface FeedbackImage {
  name: string;
  dataUrl: string;
}

function readImageFile(file: File): Promise<FeedbackImage> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    return Promise.reject(new Error('Use a PNG, JPEG, WebP, or GIF.'));
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new Error('Images need to be under 1 MB.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl.startsWith('data:image/')) {
        reject(new Error('Could not read that image.'));
        return;
      }
      resolve({ name: file.name, dataUrl });
    };
    reader.readAsDataURL(file);
  });
}

export default function FeedbackPage(): JSX.Element {
  const { currentUser } = useAppState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>('General question');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<FeedbackImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (file: File | undefined): Promise<void> => {
    setImageError(null);
    if (!file) return;
    try {
      setImage(await readImageFile(file));
    } catch (err) {
      setImage(null);
      setImageError(err instanceof Error ? err.message : 'Could not read that image.');
    }
  };

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (sending) return;
    if (!message.trim() && !image) {
      setError('Add a message or an image.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await axios.post(
        '/api/contact/feedback',
        { subject, message: message.trim(), image: image?.dataUrl },
        { headers: getAuthHeader() },
      );
      setSent(true);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : 0;
      const apiError = axios.isAxiosError(err) ? err.response?.data?.error : null;
      setError(
        status === 413
          ? 'That image is too large. Use one under 1 MB.'
          : typeof apiError === 'string'
            ? apiError
            : 'Could not send feedback. Try again.',
      );
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="app-page feedback-page">
        <header className="profile-hero">
        <h1 className="profile-title">Feedback</h1>
        <p className="profile-lead">We reward worthy feedback with tokens.</p>
        <p className="profile-lead">Thanks — we got your note{image ? ' and the image' : ''}.</p>
        </header>
        <button
          type="button"
          className="profile-contact-submit"
          onClick={() => {
            setSent(false);
            setMessage('');
            setImage(null);
            setSubject('General question');
          }}
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="app-page feedback-page">
      <header className="profile-hero">
        <h1 className="profile-title">Feedback</h1>
        <p className="profile-lead">We reward worthy feedback with tokens.</p>
        <p className="profile-lead">
          Questions about labs, teams, or campuses — send a note and we&apos;ll get back to you.
        </p>
      </header>
      <form className="profile-panel profile-contact-form" onSubmit={(e) => { void onSubmit(e); }}>
        <label className="profile-field">
          <span>Subject</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value as (typeof SUBJECTS)[number])}>
            {SUBJECTS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="profile-field">
          <span>Message</span>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How can we help?"
          />
        </label>
        <div className="profile-field">
          <span>Image</span>
          <div className="feedback-image">
            {image ? (
              <div className="feedback-image-picked">
                <img className="feedback-image-preview" src={image.dataUrl} alt="" />
                <span className="feedback-image-name" title={image.name}>{image.name}</span>
                <button
                  type="button"
                  className="feedback-image-remove"
                  onClick={() => {
                    setImage(null);
                    setImageError(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button type="button" className="feedback-image-add" onClick={() => fileRef.current?.click()}>
                Add image
              </button>
            )}
            <input
              ref={fileRef}
              className="feedback-image-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => { void onPick(e.target.files?.[0]); }}
            />
          </div>
          <p className="feedback-image-hint">
            Optional. PNG, JPEG, WebP, or GIF under 1 MB.
            {currentUser?.email ? ` Sent as ${currentUser.email}.` : ''}
          </p>
          {imageError ? <p className="feedback-image-error">{imageError}</p> : null}
        </div>
        {error ? <p className="feedback-image-error">{error}</p> : null}
        <button type="submit" className="profile-contact-submit" disabled={sending}>
          {sending ? 'Sending…' : 'Send feedback'}
        </button>
      </form>
    </div>
  );
}
