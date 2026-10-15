import { formatCompactTime } from '@/utils/formatting/time';

interface SessionTimeIndicatorProps {
  elapsedUs: number;
  durationUs: number;
  label?: string;
  className?: string;
}

const SessionTimeIndicator = ({
  elapsedUs,
  durationUs,
  label = 'Session time',
  className = '',
}: SessionTimeIndicatorProps) => (
  <div className={`flex flex-col items-start gap-0.5 ${className}`}>
    <span className="text-xs capitalize tracking-wide text-gray-500">
      {label}
    </span>
    <span className="flex flex-col items-start gap-0.5 font-mono tabular-nums">
      <span className="text-xl 2xl:text-2xl leading-none font-semibold text-white">
        {formatCompactTime(elapsedUs)}
      </span>
      <span className="text-xs 2xl:text-sm text-gray-400">
        / {formatCompactTime(durationUs, false, true)}
      </span>
    </span>
  </div>
);

export default SessionTimeIndicator;
