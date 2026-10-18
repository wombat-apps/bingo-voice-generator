import type { SubscriptionInfo as SubscriptionInfoType } from '../../types';
import './SubscriptionInfo.css';

interface SubscriptionInfoProps {
  subscription: SubscriptionInfoType;
}

function getTierClass(tier: string): string {
  return `tier-badge--${tier.toLowerCase()}`;
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

export function SubscriptionInfo({ subscription }: SubscriptionInfoProps) {
  const { tier, characterCount, characterLimit, nextCharacterCountResetUnix } = subscription;

  const usagePercentage = characterLimit > 0 ? (characterCount / characterLimit) * 100 : 0;
  const remainingCharacters = Math.max(0, characterLimit - characterCount);

  return (
    <div className="subscription-info">
      <div className="subscription-header">
        <span className="subscription-label">Subscription</span>
        <span className={`subscription-tier-badge ${getTierClass(tier)}`}>
          {tier}
        </span>
      </div>

      <div className="subscription-usage">
        <div className="subscription-usage-text">
          <span className="subscription-used">
            {formatNumber(characterCount)}
          </span>
          <span className="subscription-separator"> / </span>
          <span className="subscription-limit">
            {formatNumber(characterLimit)}
          </span>
          <span className="subscription-unit"> characters</span>
        </div>

        <div className="subscription-progress-track">
          <div
            className={`subscription-progress-fill ${getUsageClass(usagePercentage)}`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>

        <div className="subscription-remaining">
          {formatNumber(remainingCharacters)} remaining
        </div>
      </div>

      {nextCharacterCountResetUnix && (
        <div className="subscription-reset">
          Resets {formatRelativeTime(nextCharacterCountResetUnix)}
        </div>
      )}
    </div>
  );
}
