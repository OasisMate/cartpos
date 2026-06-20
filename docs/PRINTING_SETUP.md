# CartPOS - Silent Receipt Printing Setup

CartPOS prints the 80mm thermal receipt automatically after each sale, with **no print
dialog**, once the counter is set up. This is a one-time setup per machine. The receipt design
is identical in every mode.

Turn on **Settings > Printer Settings > Auto-print receipts after sale completion** first.
Then follow the section for how that counter runs CartPOS.

---

## 1. Desktop app (Electron)

Nothing extra to install or configure in the app.

1. Connect the thermal printer and install its driver.
2. Set it as the **Windows default printer**:
   Windows Settings > Bluetooth & devices > Printers & scanners > select the printer >
   **Set as default**. (Turn off "Let Windows manage my default printer".)
3. Make a test sale. The receipt prints silently to that printer.

The desktop app always prints to the Windows default printer. To switch printers, change the
Windows default.

---

## 2. Web browser (Chrome / Edge)

Browsers cannot print silently on their own. Chrome has a built-in flag, `--kiosk-printing`,
that auto-confirms the print and sends it to the default printer.

1. Connect the thermal printer, install its driver, and set it as the **Windows default
   printer** (same as step 2 above).
2. Create a dedicated Chrome shortcut for CartPOS with the kiosk-printing flag:
   - Right-click the desktop > **New > Shortcut**.
   - Location (adjust the Chrome path if different):
     ```
     "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app=https://YOUR-CARTPOS-URL
     ```
     - `--kiosk-printing` = print with no dialog to the default printer.
     - `--app=...` = open CartPOS in a clean app window (optional but recommended).
     - Replace `YOUR-CARTPOS-URL` with your live CartPOS address.
   - Name it "CartPOS" and finish.
3. Always open CartPOS from this shortcut at the counter.
4. Make a test sale. The receipt prints silently.

Edge works the same way: use `msedge.exe` with `--kiosk-printing`.

### Notes / caveats
- The flag must be on the shortcut that launches the browser. A normal Chrome window
  (without the flag) will still show the print dialog. That is expected.
- One flag per machine. It applies to whatever the Windows default printer is.
- If receipts print to the wrong device, fix the **Windows default printer**.
- Only Chromium browsers (Chrome, Edge) support `--kiosk-printing`. Firefox/Safari do not.

---

## How it works (for maintainers)
- All silent printing routes through `printReceipt()` in `src/lib/utils/print.ts`.
- Desktop: the Electron main process (`electron/main.js`, `print-receipt` IPC) renders the
  receipt HTML in a hidden window and calls `webContents.print({ silent: true })` to the
  default printer.
- Browser: `printReceipt()` writes the receipt into a hidden iframe and calls
  `window.print()`; `--kiosk-printing` makes that silent.
- Both paths use the same styled 80mm document built by `buildReceiptPrintDocument()`, so the
  printout matches the on-screen receipt and the public `/r/<token>` page.
- The `Printer Name` field in Settings is informational only; printer selection is the Windows
  default printer in both modes.
