import { useEffect, useState, type InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string | number;
  /** return an error message to reject the value, or nothing to accept it */
  onCommit: (text: string) => string | void;
}

/** Text field that applies its value on Enter or blur (like the original lab's onchange inputs). */
export function CommitInput({ value, onCommit, className, ...rest }: Props) {
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setText(String(value)); setError(null); }, [value]);

  const commit = () => {
    if (text === String(value)) return setError(null);
    const err = onCommit(text.trim());
    setError(err || null);
  };
  return (
    <input
      {...rest}
      className={(className ?? "") + (error ? " invalid" : "")}
      value={text}
      title={error ?? rest.title}
      aria-invalid={!!error}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setText(String(value)); setError(null); }
      }}
    />
  );
}

export const parseIntStrict = (s: string): number | null => (/^-?\d+$/.test(s) ? parseInt(s, 10) : null);
