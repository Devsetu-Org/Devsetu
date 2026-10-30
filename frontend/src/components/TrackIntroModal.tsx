import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TrackIntroModalProps {
  open: boolean;
  onClose: () => void;
}

const TOPICS: Array<[string, string, string, string, string]> = [
  ['orders', 'One event per placed order', '6', '3', 'Order ID'],
  ['restaurant.notifications', 'Order alerts sent to restaurant tablets', '3', '3', 'Restaurant ID'],
  ['rider.dispatch', 'Delivery assignment requests for riders', '6', '3', 'Order ID'],
];

export default function TrackIntroModal({ open, onClose }: TrackIntroModalProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.classList.add('landing-modal-open');
    return () => document.body.classList.remove('landing-modal-open');
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="login-modal-overlay track-intro-overlay" role="presentation" onClick={onClose}>
      <div
        className="login-modal track-intro-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-intro-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="login-card login-modal-card track-intro-card">
          <header className="track-intro-header">
            <div>
              <p className="track-intro-kicker">Intro</p>
              <h2 id="track-intro-title" className="track-intro-title">
                QuickBite: Food Delivery
              </h2>
            </div>
            <button type="button" className="ghost track-intro-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          <div className="track-intro-scroll" tabIndex={0}>
            <p>
              QuickBite is a food delivery platform that connects customers, restaurants, and delivery
              riders across several cities. Orders flow from the app to the kitchen and then to a rider,
              and every step depends on the others staying in sync.
            </p>

            <h3>Why Kafka at QuickBite</h3>
            <p>
              Leadership expected order volume to grow quickly as QuickBite expanded to new cities, and
              direct service calls were already slowing down at today&apos;s scale. A proof of concept on
              about 5% of order traffic showed that Kafka could carry the load. When a customer places an
              order, the ordering service tells the restaurant and the rider dispatcher directly. If the
              dispatcher is slow or down, the order is delayed or lost, and the restaurant hears nothing
              until the call succeeds. The team wants each order recorded once and picked up by downstream
              services at their own pace.
            </p>

            <h3>Current Kafka setup</h3>
            <p>
              QuickBite runs a three-broker Kafka cluster in production. Every topic uses replication
              factor 3 and min.insync.replicas=2, so one broker can fail without losing acknowledged data
              or stopping writes. Three topics carry the core flow today:
            </p>

            <div className="track-intro-table-wrap">
              <table className="track-intro-table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Purpose</th>
                    <th>Partitions</th>
                    <th>Replication factor</th>
                    <th>Key</th>
                  </tr>
                </thead>
                <tbody>
                  {TOPICS.map(([topic, purpose, partitions, replication, key]) => (
                    <tr key={topic}>
                      <td>
                        <code>{topic}</code>
                      </td>
                      <td>{purpose}</td>
                      <td>{partitions}</td>
                      <td>{replication}</td>
                      <td>{key}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>
              <code>orders</code>
            </h3>
            <p>
              The orders topic is the system of record for what customers bought. Each event describes the
              order itself: items, prices, delivery address, customer, and timestamps. Any service that
              needs the order can read it, and it is keyed by Order ID.
            </p>

            <h3>
              <code>restaurant.notifications</code>
            </h3>
            <p>
              The restaurant.notifications topic is a delivery channel for one audience: the restaurant.
              Its events are shorter and written for the kitchen, such as &quot;new order to prepare&quot; or
              &quot;order cancelled,&quot; and they are keyed by Restaurant ID so each restaurant&apos;s alerts
              stay in arrival order. A notification is usually derived from an order event, so the two
              topics serve different purposes. One records what happened, and the other tells a restaurant
              what it needs to do.
            </p>

            <h3>
              <code>rider.dispatch</code>
            </h3>
            <p>
              rider.dispatch carries delivery assignment requests. When an order is ready to be picked up,
              the system publishes an event asking for a rider to be matched to it. The dispatch service,
              which chooses a rider based on location, availability, and distance to the restaurant,
              consumes those events and publishes the assignment back out. Keying by Order ID keeps every
              event for a given order in one partition, so its steps happen in sequence. One broker is the
              leader for each partition and takes the writes. One broker is the controller and chooses
              those leaders. Partition 3 already has a few assignments on it, so how far it has been
              written is not zero.
            </p>

            <h3>Your role</h3>
            <p>
              You have joined QuickBite&apos;s Data Platform team as an engineer on Kafka as a service
              (KaaS). The team runs the shared cluster and onboards product teams onto it. Your job is to
              keep the cluster reliable while adoption grows.
            </p>
            <p>
              The next sessions can add order.status events as the order moves through preparation,
              pickup, and delivery.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
