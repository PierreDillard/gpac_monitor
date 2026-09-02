const BuildVersion = () => (
  <span
    title={`Built ${__BUILD_DATE__}`}
    className="text-xs text-gray-400 font-mono shrink-0"
  >
    {__BUILD_SHA__} · {__BUILD_DATE__}
  </span>
);

export default BuildVersion;
