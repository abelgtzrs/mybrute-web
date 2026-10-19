import { useEffect, useRef, useState } from "react";
import { registerEnd } from "./ruffle";

/**
 * A javascript: URL for a payload's _end field that calls `onEnd` when client.swf finishes playback.
 * Registered in an effect so React StrictMode's remount registers it again.
 */
export function useSwfEnd(onEnd: () => void): string {
  const handler = useRef(onEnd);
  handler.current = onEnd;
  const [url, setUrl] = useState("javascript:()");
  useEffect(() => {
    const end = registerEnd(() => handler.current());
    setUrl(end.url);
    return end.dispose;
  }, []);
  return url;
}
