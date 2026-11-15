"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button, Modal } from "./ui";

interface ConfirmOptions {
  title: string;
  /** What will happen, in plain words */
  text: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for deletions */
  destructive?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

/** Ask "are you sure?" before anything that removes data. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOptions(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal
          open
          onClose={() => answer(false)}
          title={options.title}
          cancelLabel={options.cancelLabel ?? "Nee, terug"}
          footer={
            <Button variant={options.destructive === false ? "primary" : "destructive"} onClick={() => answer(true)}>
              {options.confirmLabel ?? "Ja, verwijderen"}
            </Button>
          }
        >
          <div className="text-base text-stone-700">{options.text}</div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
