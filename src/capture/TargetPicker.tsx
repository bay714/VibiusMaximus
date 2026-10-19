import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listWindows, type WindowChoice } from "./api";

// A symbol, not translatable text.
const CARET = "▾";

/** "Send to another window" under the Send button: lists the open windows,
 *  and picking one sends there. */
export function TargetPicker({
  open,
  onOpenChange,
  disabled,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled: boolean;
  onPick: (choice: WindowChoice) => void;
}) {
  const { t } = useTranslation();
  const [windows, setWindows] = useState<WindowChoice[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Listed fresh each time, so windows opened since the capture show up.
  useEffect(() => {
    if (!open) return;
    setWindows(null);
    listWindows()
      .then(setWindows)
      .catch(() => setWindows([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onOpenChange(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, onOpenChange]);

  return (
    <div className="vibe-pick" ref={ref}>
      <button
        type="button"
        className="vibe-pick-btn"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {t("vibe.capture.sendElsewhere")} {CARET}
      </button>
      {open && (
        <div className="vibe-pick-menu" role="menu">
          {windows === null ? (
            <div className="vibe-pick-empty">
              {t("vibe.capture.findingWindows")}
            </div>
          ) : windows.length === 0 ? (
            <div className="vibe-pick-empty">{t("vibe.capture.noWindows")}</div>
          ) : (
            windows.map((w) => (
              <button
                key={w.hwnd}
                type="button"
                role="menuitem"
                className="vibe-pick-item"
                title={w.title}
                onClick={() => onPick(w)}
              >
                <strong>{w.app}</strong>
                <span>{w.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
