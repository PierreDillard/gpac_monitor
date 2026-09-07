import { EXPECTED_WS_PROTOCOL_VERSION } from '@/services/ws/protocolVersion';

const BuildVersion = () => (
  <span
    title={`Built ${__BUILD_DATE__} — expects WS protocol v${EXPECTED_WS_PROTOCOL_VERSION}`}
    className="text-xs text-gray-400 font-mono shrink-0"
  >
    {__BUILD_SHA__} · {__BUILD_DATE__} · protocol v
    {EXPECTED_WS_PROTOCOL_VERSION}
  </span>
);

export default BuildVersion;
