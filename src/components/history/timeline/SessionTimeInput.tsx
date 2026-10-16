import { useState, type FormEvent } from 'react';
import { parseSessionTimeInput } from '@/utils/formatting/sessionTimeInput';

interface SessionTimeInputProps {
  durationUs: number;
  onSeekToSessionTime: (sessionTimeUs: number) => void;
}

const SessionTimeInput = ({
  durationUs,
  onSeekToSessionTime,
}: SessionTimeInputProps) => {
  const [text, setText] = useState('');
  const [isInvalid, setIsInvalid] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sessionTimeUs = parseSessionTimeInput(text, durationUs);
    if (sessionTimeUs === null) {
      setIsInvalid(true);
      return;
    }
    setIsInvalid(false);
    setText('');
    onSeekToSessionTime(sessionTimeUs);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setIsInvalid(false);
        }}
        placeholder="1d 02:00:00 or 26:00:00"
        aria-label="Go to session time"
        aria-invalid={isInvalid}
        title={
          isInvalid
            ? 'Invalid or outside the session'
            : 'Go to session time (Nd hh:mm:ss or hh:mm:ss)'
        }
        className={`w-full rounded-sm bg-black/30 px-2 py-1 font-mono text-xs text-gray-200 placeholder:text-gray-500 border outline-none focus:border-white/40 ${
          isInvalid ? 'border-red-500' : 'border-history-border'
        }`}
      />
    </form>
  );
};

export default SessionTimeInput;
