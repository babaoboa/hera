"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { CardTitle, Chip, Glyph, ICONS, fadeUp } from "@/components/hera/ui";

/* Asks for the policy PDF — click to choose or drop it on the card. */
export default function PolicyUploadCard({
  reason,
  received,
  disabled,
  onFiles,
}: {
  reason?: string;
  /** filename once a policy has arrived (collapses the card) */
  received: string | null;
  /** Hera is still replying — a chosen file is queued until she's done */
  disabled: boolean;
  onFiles: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  if (received) {
    return (
      <div style={fadeUp}>
        <Chip tone="green">
          <Glyph d={ICONS.check} size={11} stroke={3} /> Policy received · {received}
        </Chip>
      </div>
    );
  }

  const accept = (files: FileList | null) => {
    const pdf = files && [...files].find((f) => f.type === "application/pdf");
    if (!files || !pdf) return;
    setPicked(pdf.name);
    onFiles(files);
  };

  return (
    <div className="max-w-[620px] rounded-card bg-surface p-4 shadow-card" style={fadeUp}>
      <CardTitle icon={ICONS.file} title="Share your home insurance policy" sub={reason ?? "I'll read it so I know exactly what you're covered for."} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          accept(e.dataTransfer.files);
        }}
        className={`mt-4 flex flex-col items-center gap-3 rounded-[10px] border border-dashed px-4 py-6 text-center transition-colors duration-150 ${
          over ? "border-accent bg-accent-tint" : "border-line-strong bg-inset"
        }`}
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-surface text-ink-2 shadow-hairline">
          <Glyph d={ICONS.upload} size={16} />
        </span>
        <div className="text-[12.5px] text-ink-2">Drop your policy PDF here — the declarations page or full wording</div>
        {picked ? (
          <Chip tone="accent">{disabled ? "Sending" : "Sent"} · {picked}</Chip>
        ) : (
          <Button size="sm" variant="primary" onClick={() => inputRef.current?.click()}>
            Choose PDF
          </Button>
        )}
      </div>
      <p className="mt-3 text-[11.5px] leading-snug text-ink-3">Stored on this device in your Hera file. Hera only reads it to help you.</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          accept(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
