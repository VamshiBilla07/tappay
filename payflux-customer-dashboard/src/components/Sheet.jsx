import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Sheet({ title, subtitle, onClose, children, footer }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") closeRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(15,18,24,.58)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        className="sheet-in relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px]"
        style={{
          background: "var(--sf)",
          color: "var(--tx)",
          border: "1px solid var(--ln)",
          boxShadow: "0 -20px 60px -20px rgba(0,0,0,.5)",
        }}
      >
        <div
          className="sticky top-0 z-10 flex items-start gap-3 px-5 pt-5 pb-3"
          style={{ background: "var(--sf)" }}
        >
          <div className="flex-1 min-w-0">
            <h2 className="text-[17px] font-semibold m-0">{title}</h2>
            {subtitle && <p className="mu text-[13px] mt-1 mb-0">{subtitle}</p>}
          </div>
          <button type="button" className="ib" aria-label="Close" onClick={onClose} style={{ flex: "none" }}>
            <X size={20} />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 px-5 py-3" style={{ background: "var(--sf)", borderTop: "1px solid var(--ln)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
