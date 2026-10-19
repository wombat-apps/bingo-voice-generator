import type { SubscriptionInfo } from '../../types';
import './SubscriptionUsage.css';

interface SubscriptionUsageProps {
  /** The Active Account's subscription, `null` while it loads or when it failed */
  subscription: SubscriptionInfo | null;
  /** Why the subscription could not be loaded */
  error: string | null;
}

function getUsageClass(percentage: number): string {
  if (percentage >= 90) return 'usage-bar--critical';
  if (percentage >= 70) return 'usage-bar--warning';
  return 'usage-bar--healthy';
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

function formatRelativeTime(unixTimestamp: number): string {
  const now = Date.now();
  const targetDate = unixTimestamp * 1000; // Convert to milliseconds
  const diffMs = targetDate - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 'today';
  }

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (diffDays === 1) {
    return rtf.format(1, 'day');
  }
  if (diffDays < 7) {
    return rtf.format(diffDays, 'day');
  }
  if (diffDays < 30) {
    const weeks = Math.ceil(diffDays / 7);
    return rtf.format(weeks, 'week');
  }

  const months = Math.ceil(diffDays / 30);
  return rtf.format(months, 'month');
}

/** Character usage of the Active Account's Plan in two lines: a bar and the counts. */
export function SubscriptionUsage({ subscription, error }: SubscriptionUsageProps) {
  if (error) {
    return (
      <div className="subscription-usage subscription-usage--error" title={error}>
        Plan unavailable
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="subscription-usage subscription-usage--loading" aria-busy="true">
        <div className="subscription-progress-track" />
        <div className="subscription-usage-meta">Loading plan…</div>
      </div>
    );
  }

  const { characterCount, characterLimit, nextCharacterCountResetUnix } = subscription;
  const usagePercentage = characterLimit > 0 ? (characterCount / characterLimit) * 100 : 0;
  const remainingCharacters = Math.max(0, characterLimit - characterCount);

  return (
    <div
      className="subscription-usage"
      title={`${formatNumber(remainingCharacters)} characters remaining`}
    >
      <div className="subscription-progress-track">
        <div
          className={`subscription-progress-fill ${getUsageClass(usagePercentage)}`}
          style={{ width: `${Math.min(usagePercentage, 100)}%` }}
        />
      </div>
      <div className="subscription-usage-meta">
        <span>
          {formatNumber(characterCount)} / {formatNumber(characterLimit)}
        </span>
        {nextCharacterCountResetUnix && (
          <span>resets {formatRelativeTime(nextCharacterCountResetUnix)}</span>
        )}
      </div>
    </div>
  );
}
