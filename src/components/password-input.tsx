"use client";

import { useState } from "react";
import { EyeIcon } from "@/components/ui";

/** Campo de senha com botão de mostrar/esconder (olho). */
export default function PasswordInput(props: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength: number;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative mt-2">
      <input
        type={visible ? "text" : "password"}
        required
        minLength={props.minLength}
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        aria-invalid={props.invalid || undefined}
        className={`field pr-14 ${props.invalid ? "border-red-400 focus:border-red-500 focus:ring-red-500/10" : ""}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        title={visible ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-ink-mute transition hover:text-ink"
      >
        <EyeIcon open={visible} size={20} />
      </button>
    </div>
  );
}
