"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";

/**
 * Phone: the menu button and its full-height drawer. A native dialog, so the
 * page behind is inert, Escape closes it and focus returns to the button.
 */
export function PhoneMenu({ title, children }: { title: ReactNode; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const search = useSearchParams()?.toString();

  // Any navigation closes the drawer.
  useEffect(() => {
    dialog.current?.close();
  }, [pathname, search]);

  return (
    <>
      <button type="button" className="sf-iconbtn sf-menu__open" aria-label="Menu" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <Menu aria-hidden="true" className="sf-icon" />
      </button>
      <dialog
        ref={dialog}
        className="sf-menu"
        aria-label="Menu"
        onClick={(event) => {
          // A tap on the backdrop lands on the dialog itself.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="sf-menu__sheet">
          <div className="sf-menu__head">
            {title}
            <button type="button" className="sf-iconbtn" aria-label="Close menu" onClick={() => dialog.current?.close()}>
              <X aria-hidden="true" className="sf-icon" />
            </button>
          </div>
          <div className="sf-menu__body">{children}</div>
        </div>
      </dialog>
    </>
  );
}
