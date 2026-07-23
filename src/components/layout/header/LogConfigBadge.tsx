import { Badge } from '@/components/ui/badge';
import { useAppSelector } from '@/shared/hooks/redux';
import { selectLogsConfigString } from '@/shared/store/selectors/logs/logsConfigSelectors';

const LogConfigBadge = () => {
  const configString = useAppSelector(selectLogsConfigString);

  if (!configString) {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      title={configString}
      className="shrink-0 max-w-[220px] truncate font-mono font-normal"
    >
      {configString}
    </Badge>
  );
};

export default LogConfigBadge;
